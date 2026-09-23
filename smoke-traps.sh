#!/usr/bin/env bash
#
# End-to-end walk through the traps API against the running dev stack.
#
# The permission rules of the traps module depend on Keycloak roles and group
# paths, which the Django test suite can only simulate. This script exercises
# them for real, with the dev-only accounts described in .env
# (KC_TEST_CLIENT_ID and friends). It is a development tool: it needs the
# password-grant client that exists in the development realm only, and it
# creates and deletes its own trap as it goes.
#
# Usage: ./smoke-traps.sh   (from the dev worktree, stack up)
#
set -u

SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
set -a; . ./.env; set +a

if [[ "${APP_ENV:-}" != "dev" ]]; then
    echo "This script only runs against the development environment (APP_ENV=dev)." >&2
    exit 1
fi
if [[ -z "${KC_TEST_CLIENT_ID:-}" || -z "${KC_TEST_CLIENT_SECRET:-}" ]]; then
    echo "KC_TEST_CLIENT_ID / KC_TEST_CLIENT_SECRET are missing from .env: see .env.example." >&2
    exit 1
fi
BASE="https://${HOST}/api"
AUTH="https://${KC_HOSTNAME}/realms/hornet-finder-dev/protocol/openid-connect/token"
PASS=0; FAIL=0
OUT="$(mktemp)"; trap 'rm -f "$OUT"' EXIT

token() {
  curl -sk -X POST "$AUTH" -d "client_id=$KC_TEST_CLIENT_ID" -d "client_secret=$KC_TEST_CLIENT_SECRET" \
    -d "username=$1@example.invalid" -d "password=$KC_TEST_USER_PASSWORD" \
    -d "grant_type=password" -d "scope=openid membership" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])"
}

# call <expected> <label> <method> <path> [curl args...]
call() {
  local want="$1" label="$2" method="$3" path="$4"; shift 4
  local code
  code=$(curl -sk -o "$OUT" -w '%{http_code}' -X "$method" "$BASE$path" "$@")
  if [ "$code" = "$want" ]; then PASS=$((PASS+1)); printf '  ok   %-58s %s\n' "$label" "$code"
  else FAIL=$((FAIL+1)); printf '  FAIL %-58s attendu %s, obtenu %s\n     %s\n' "$label" "$want" "$code" "$(head -c 200 "$OUT")"; fi
}

OWNER=$(token t-owner); MEMBER=$(token t-member)
GADMIN=$(token t-groupadmin); ADMIN=$(token t-admin); PUREADMIN=$(token t-adminonly)
H_OWNER=(-H "Authorization: Bearer $OWNER"); H_MEMBER=(-H "Authorization: Bearer $MEMBER")
H_GADMIN=(-H "Authorization: Bearer $GADMIN"); H_ADMIN=(-H "Authorization: Bearer $ADMIN")
H_PURE=(-H "Authorization: Bearer $PUREADMIN")

echo "== Création"
TRAP=$(curl -sk -X POST "$BASE/traps/" "${H_OWNER[@]}" \
  -F "latitude=50.47" -F "longitude=4.87" -F "trap_type_slug=bottle" \
  -F "installed_at=$(date +%F)" -F "comments=e2e" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))")
if [ -z "$TRAP" ]; then echo "  FAIL création du piège"; exit 1; fi
echo "  ok   piège #$TRAP créé par t-owner"; PASS=$((PASS+1))
call 403 "l'administrateur seul ne peut pas créer de piège" POST "/traps/" "${H_PURE[@]}" -F "latitude=50.4" -F "longitude=4.8" -F "trap_type_slug=bottle" -F "installed_at=$(date +%F)"
ACTIVE0=$(curl -sk "$BASE/traps/$TRAP/" "${H_OWNER[@]}" | python3 -c "import sys,json;print(json.load(sys.stdin)['active'])")
if [ "$ACTIVE0" = "True" ]; then PASS=$((PASS+1)); echo "  ok   piège en service dès la création"; else FAIL=$((FAIL+1)); echo "  FAIL piège créé avec active=$ACTIVE0"; fi

echo "== Journal"
call 201 "t-owner enregistre une prise"                 POST "/traps/$TRAP/events/" "${H_OWNER[@]}" -F "kind=catch" -F "quantity=5" -F "performed_at=$(date -Is)"
call 403 "l'administrateur n'enregistre pas d'événement" POST "/traps/$TRAP/events/" "${H_PURE[@]}" -F "kind=inspection" -F "performed_at=$(date -Is)"
call 400 "prise sans quantité refusée"                  POST "/traps/$TRAP/events/" "${H_OWNER[@]}" -F "kind=catch" -F "performed_at=$(date -Is)"
call 400 "inspection avec quantité refusée"             POST "/traps/$TRAP/events/" "${H_OWNER[@]}" -F "kind=inspection" -F "quantity=2" -F "performed_at=$(date -Is)"
COUNT=$(curl -sk "$BASE/traps/$TRAP/" "${H_OWNER[@]}" | python3 -c "import sys,json;print(json.load(sys.stdin)['hornet_catch_count'])")
if [ "$COUNT" = "5" ]; then PASS=$((PASS+1)); echo "  ok   compteur de frelons = 5"; else FAIL=$((FAIL+1)); echo "  FAIL compteur = $COUNT, attendu 5"; fi

echo "== Avant délégation"
call 403 "t-member ne peut pas agir (pas encore délégué)" POST "/traps/$TRAP/events/" "${H_MEMBER[@]}" -F "kind=inspection" -F "performed_at=$(date -Is)"

echo "== Délégation"
call 403 "t-member ne peut pas déléguer"                PUT "/traps/$TRAP/delegation/" "${H_MEMBER[@]}" -H "Content-Type: application/json" -d '{"group_path":"/volunteers/vol-group-a"}'
call 200 "t-owner délègue à son groupe"                 PUT "/traps/$TRAP/delegation/" "${H_OWNER[@]}" -H "Content-Type: application/json" -d '{"group_path":"/volunteers/vol-group-a"}'
call 403 "t-owner ne peut pas déléguer hors de ses groupes" PUT "/traps/$TRAP/delegation/" "${H_OWNER[@]}" -H "Content-Type: application/json" -d '{"group_path":"/beekeepers/bkp-group-a"}'
call 201 "t-member agit une fois délégué"               POST "/traps/$TRAP/events/" "${H_MEMBER[@]}" -F "kind=cleaning" -F "performed_at=$(date -Is)"
call 403 "t-member ne peut pas modifier le piège"       PATCH "/traps/$TRAP/" "${H_MEMBER[@]}" -H "Content-Type: application/json" -d '{"comments":"non"}'
call 200 "t-groupadmin retire la délégation"            DELETE "/traps/$TRAP/delegation/" "${H_GADMIN[@]}"
call 403 "t-member ne peut plus agir"                   POST "/traps/$TRAP/events/" "${H_MEMBER[@]}" -F "kind=inspection" -F "performed_at=$(date -Is)"

echo "== Visibilité de groupe"
call 200 "t-owner re-délègue en visibilité groupe"      PUT "/traps/$TRAP/delegation/" "${H_OWNER[@]}" -H "Content-Type: application/json" -d '{"group_path":"/volunteers/vol-group-a","visibility":"group"}'
ANON=$(curl -sk "$BASE/traps/?lat=50.47&lon=4.87&radius=1" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")
if [ "$ANON" = "0" ]; then PASS=$((PASS+1)); echo "  ok   invisible pour un visiteur anonyme"; else FAIL=$((FAIL+1)); echo "  FAIL visible anonymement ($ANON résultat(s))"; fi
SEEN=$(curl -sk "$BASE/traps/?lat=50.47&lon=4.87&radius=1" "${H_MEMBER[@]}" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")
if [ "$SEEN" = "1" ]; then PASS=$((PASS+1)); echo "  ok   visible pour un membre du groupe"; else FAIL=$((FAIL+1)); echo "  FAIL membre voit $SEEN piège(s)"; fi

echo "== Statut et propriétaire"
call 201 "événement de retrait"                         POST "/traps/$TRAP/events/" "${H_OWNER[@]}" -F "kind=removal" -F "performed_at=$(date -Is)"
ACTIVE=$(curl -sk "$BASE/traps/$TRAP/" "${H_OWNER[@]}" | python3 -c "import sys,json;print(json.load(sys.stdin)['active'])")
if [ "$ACTIVE" = "False" ]; then PASS=$((PASS+1)); echo "  ok   piège remisé après retrait"; else FAIL=$((FAIL+1)); echo "  FAIL active=$ACTIVE"; fi
call 403 "t-owner ne peut pas changer de propriétaire"  PUT "/traps/$TRAP/owner/" "${H_OWNER[@]}" -H "Content-Type: application/json" -d "{\"owner_guid\":\"$(curl -sk "$BASE/traps/$TRAP/" "${H_ADMIN[@]}" | python3 -c "import sys,json;print(json.load(sys.stdin)['owner']['guid'])")\"}"

echo "== Référentiel"
call 200 "t-owner lit les types de pièges"              GET "/trap-types/" "${H_OWNER[@]}"
call 403 "t-owner ne peut pas créer un type"            POST "/trap-types/" "${H_OWNER[@]}" -H "Content-Type: application/json" -d '{"name":"E2E"}'
# The slug is internal identity: derived from the name, never taken from the payload
call 201 "t-admin crée un type"                         POST "/trap-types/" "${H_ADMIN[@]}" -H "Content-Type: application/json" -d '{"slug":"ignore-moi","name":"Type E2E"}'
SLUG=$(python3 -c "import sys,json;print(json.load(open('$OUT'))['slug'])")
if [ "$SLUG" = "type-e2e" ]; then PASS=$((PASS+1)); echo "  ok   slug dérivé du nom ($SLUG)"; else FAIL=$((FAIL+1)); echo "  FAIL slug=$SLUG"; fi
TID=$(curl -sk "$BASE/trap-types/" "${H_ADMIN[@]}" | python3 -c "import sys,json;print([t['id'] for t in json.load(sys.stdin) if t['slug']=='type-e2e'][0])")
call 204 "t-admin supprime un type inutilisé"           DELETE "/trap-types/$TID/" "${H_ADMIN[@]}"
BID=$(curl -sk "$BASE/trap-types/" "${H_ADMIN[@]}" | python3 -c "import sys,json;print([t['id'] for t in json.load(sys.stdin) if t['slug']=='bottle'][0])")
call 409 "suppression d'un type utilisé refusée"        DELETE "/trap-types/$BID/" "${H_ADMIN[@]}"

echo "== QR Codes"
J=(-H "Content-Type: application/json")
call 201 "t-owner génère deux QR Codes"                 POST "/tags/batch/" "${H_OWNER[@]}" "${J[@]}" -d '{"count":2}'
read -r TAG_A TAG_B < <(python3 -c "import json;d=json.load(open('$OUT'));print(d[0]['value'],d[1]['value'])")
# Same length, one bit flipped in the MAC: well formed but not authentic
FORGED=$(python3 -c "import base64;r=bytearray(base64.urlsafe_b64decode('$TAG_A'+'=' * (-len('$TAG_A')%4)));r[-1]^=1;print(base64.urlsafe_b64encode(bytes(r)).decode().rstrip('='))")
call 200 "QR Code neuf lu comme libre"                  GET "/tags/$TAG_A/" "${H_OWNER[@]}"
call 400 "QR Code falsifié refusé"                      GET "/tags/$FORGED/" "${H_OWNER[@]}"
call 400 "valeur mal formée refusée"                    GET "/tags/pas-un-qr-code/" "${H_OWNER[@]}"
call 403 "t-member ne peut pas associer au piège"       POST "/tags/$TAG_A/associate/" "${H_MEMBER[@]}" "${J[@]}" -d "{\"trap_id\":$TRAP}"
call 200 "t-owner associe le QR Code A"                 POST "/tags/$TAG_A/associate/" "${H_OWNER[@]}" "${J[@]}" -d "{\"trap_id\":$TRAP}"
call 409 "B sans confirmation : le piège a déjà A"      POST "/tags/$TAG_B/associate/" "${H_OWNER[@]}" "${J[@]}" -d "{\"trap_id\":$TRAP}"
call 200 "B remplace A après confirmation"              POST "/tags/$TAG_B/associate/" "${H_OWNER[@]}" "${J[@]}" -d "{\"trap_id\":$TRAP,\"replace\":true}"
call 410 "l'ancien QR Code A est révoqué"               GET "/tags/$TAG_A/" "${H_OWNER[@]}"
call 200 "B ouvre le piège"                             GET "/tags/$TAG_B/" "${H_OWNER[@]}"
TID_OF_B=$(python3 -c "import json;print(json.load(open('$OUT'))['trap']['id'])")
if [ "$TID_OF_B" = "$TRAP" ]; then PASS=$((PASS+1)); echo "  ok   B résout vers le piège #$TRAP"; else FAIL=$((FAIL+1)); echo "  FAIL B résout vers $TID_OF_B"; fi

echo "== Ménage"
call 204 "t-admin supprime le piège d'essai"            DELETE "/traps/$TRAP/" "${H_ADMIN[@]}"

echo
echo "Résultat : $PASS ok, $FAIL échec(s)"
exit $((FAIL > 0))
