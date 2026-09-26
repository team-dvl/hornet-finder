#!/usr/bin/env bash
#
# Phone screenshots of the dev frontend, to check the mobile UI on the real
# rendering engines: WebKit (iPhone 14, iPhone SE, 320 px) and Chromium
# (Pixel 7, 360 px Galaxy). Playwright runs in its Docker image, signs in with
# the dev-only test admin (KC_TEST_* in .env) and walks the main screens,
# opening dialogs without ever submitting them.
#
# A few fixtures (two traps on the same spot, a nest, a hornet) are created
# through the API beforehand so that every sheet can be opened, and deleted
# on exit, like smoke-traps.sh does.
#
# Usage: ./ui-shots.sh [-d <device>]... [-o <out_dir>]
#   -d  only this device (repeatable): ip14, se, w320, pixel7, galaxy
#   -o  output directory (default: ui-shots/, ignored by git)
#
set -u

SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
set -a; . ./.env; set +a

if [[ "${APP_ENV:-}" != "dev" ]]; then
    echo "This script only runs against the development environment (APP_ENV=dev)." >&2
    exit 1
fi
if [[ -z "${KC_TEST_CLIENT_ID:-}" || -z "${KC_TEST_CLIENT_SECRET:-}" || -z "${KC_TEST_USER_PASSWORD:-}" ]]; then
    echo "KC_TEST_CLIENT_ID / KC_TEST_CLIENT_SECRET / KC_TEST_USER_PASSWORD are missing from .env: see .env.example." >&2
    exit 1
fi

PW_VERSION=1.63.0
OUT="ui-shots"
DEVICES=()
while getopts "d:o:" opt; do
    case "$opt" in
        d) DEVICES+=("$OPTARG") ;;
        o) OUT="$OPTARG" ;;
        *) sed -n '2,17p' "$0"; exit 1 ;;
    esac
done

USER_EMAIL="t-admin@example.invalid"
BASE="https://${HOST}/api"
AUTH="https://${KC_HOSTNAME}/realms/hornet-finder-dev/protocol/openid-connect/token"
# The map opens on DEFAULT_GEOLOCATION (Vedrin); the fixtures sit in its left
# half, clear of the map controls and of the real data around the centre
LAT=50.4930
LNG=4.8800

TOKEN=$(curl -sk -X POST "$AUTH" -d "client_id=$KC_TEST_CLIENT_ID" --data-urlencode "client_secret=$KC_TEST_CLIENT_SECRET" \
    -d "username=$USER_EMAIL" --data-urlencode "password=$KC_TEST_USER_PASSWORD" \
    -d "grant_type=password" -d "scope=openid membership" \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")
if [[ -z "$TOKEN" ]]; then echo "Could not get a token for $USER_EMAIL." >&2; exit 1; fi
H=(-H "Authorization: Bearer $TOKEN")

# create <path> <curl args...>: prints the id of the created object
create() {
    local path="$1"; shift
    curl -sk -X POST "$BASE$path" "${H[@]}" "$@" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))"
}

TRAP_TYPE=$(curl -sk "$BASE/trap-types/" "${H[@]}" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);d=d.get('results',d) if isinstance(d,dict) else d;print(d[0]['slug'] if d else '')")
TRAP1=$(create /traps/ -F "latitude=$LAT" -F "longitude=$LNG" -F "trap_type_slug=$TRAP_TYPE" \
    -F "installed_at=$(date +%F)" -F "comments=ui-shots")
TRAP2=$(create /traps/ -F "latitude=$LAT" -F "longitude=$LNG" -F "trap_type_slug=$TRAP_TYPE" \
    -F "installed_at=$(date +%F)" -F "comments=ui-shots")
NEST=$(create /nests/ -H "Content-Type: application/json" \
    -d "{\"latitude\": 50.4890, \"longitude\": 4.8795, \"comments\": \"ui-shots\"}")
HORNET=$(create /hornets/ -H "Content-Type: application/json" \
    -d "{\"latitude\": 50.4870, \"longitude\": 4.8805, \"direction\": 300, \"duration\": 300}")
# An apiary with every optional field, shared so its sheet shows a sharing row
APIARY=$(create /apiaries/ -F "latitude=50.4910" -F "longitude=4.8790" -F "infestation_level=2" \
    -F "afsca_number=2.000.000.001" -F "address=Rue de l'Essai 1, 5020 Namur" -F "comments=ui-shots" \
    -F "photo=@frontend/public/vsab-logo-transparent.png")
[[ -n "$APIARY" ]] && curl -sk -o /dev/null -X PUT "$BASE/apiaries/$APIARY/sharing/" "${H[@]}" \
    -H "Content-Type: application/json" -d '{"group_path": "/beekeepers/vsab", "can_update": true}'

cleanup() {
    [[ -n "$TRAP1" ]] && curl -sk -o /dev/null -X DELETE "$BASE/traps/$TRAP1/" "${H[@]}"
    [[ -n "$TRAP2" ]] && curl -sk -o /dev/null -X DELETE "$BASE/traps/$TRAP2/" "${H[@]}"
    [[ -n "$NEST" ]] && curl -sk -o /dev/null -X DELETE "$BASE/nests/$NEST/" "${H[@]}"
    [[ -n "$HORNET" ]] && curl -sk -o /dev/null -X DELETE "$BASE/hornets/$HORNET/" "${H[@]}"
    [[ -n "$APIARY" ]] && curl -sk -o /dev/null -X DELETE "$BASE/apiaries/$APIARY/" "${H[@]}"
}
trap cleanup EXIT
echo "Fixtures: traps $TRAP1 $TRAP2, nest $NEST, hornet $HORNET, apiary $APIARY"

mkdir -p "$OUT" .cache/ui-shots
docker run --rm --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -e BASE_URL="https://${HOST}" -e KC_USER="$USER_EMAIL" -e KC_PASS="$KC_TEST_USER_PASSWORD" \
    -e LAT="$LAT" -e LNG="$LNG" -e DEVICES="${DEVICES[*]:-}" \
    -v "$SCRIPT_DIR/frontend/scripts:/scripts:ro" -v "$SCRIPT_DIR/$OUT:/out" \
    -v "$SCRIPT_DIR/.cache/ui-shots:/work" -w /work \
    "mcr.microsoft.com/playwright:v${PW_VERSION}-noble" \
    bash -c "test -d node_modules/playwright || npm install --no-save --silent playwright@${PW_VERSION} >/dev/null; NODE_PATH=/work/node_modules node /scripts/phone-shots.cjs"
STATUS=$?
echo "Screenshots in $OUT/"
exit $STATUS
