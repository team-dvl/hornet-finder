#!/usr/bin/env bash
set -euo pipefail

#
# Refresh the Keycloak realm export committed in auth/ from the running realm.
#
# The environment comes from APP_ENV in .env: prod writes auth/realm-export.json
# (realm hornet-finder), dev writes auth/realm-export-dev.json (realm
# hornet-finder-dev). It calls the Admin API "partial export" (the same as
# Realm settings > Action > Partial export in the console) with the flow-admin
# service account (client_credentials, role manage-realm): no Keycloak restart
# and no new credential. Keycloak itself masks every secret as **********.
#
# Before touching the file, the export is checked: it must belong to the
# expected realm and every secret/password field must be masked, otherwise
# nothing is written. Users are never exported, apart from the service
# accounts of the clients.
#
# Usage: ./export-realm.sh [-n]
#        -n  dry run: check the export and show the diff, write nothing
#
# Note: the committed export only feeds the import of a NEW realm
# (--import-realm skips an existing one). Its masked secrets must be set again
# in Keycloak after such an import, see auth/README.md.
#

SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

DRY_RUN=0
case "${1:-}" in
    "") ;;
    -n|--dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '19,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) handle_error "Unknown option: $1 (see -h)" ;;
esac

cd "$SCRIPT_DIR"
load_env
ENVIRONMENT="$(get_configured_environment)"

if [[ "$ENVIRONMENT" == "prod" ]]; then
    REALM="hornet-finder"
    TARGET="auth/realm-export.json"
else
    REALM="hornet-finder-dev"
    TARGET="auth/realm-export-dev.json"
fi

[[ -n "${KC_HOSTNAME:-}" ]] || handle_error "KC_HOSTNAME is missing from .env"
[[ -n "${FLOW_ADMIN_SECRET:-}" ]] || handle_error "FLOW_ADMIN_SECRET is missing from .env: see .env.example"
CLIENT_ID="${FLOW_ADMIN_CLIENT_ID:-flow-admin}"
KC_URL="https://${KC_HOSTNAME}"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "🔑 Requesting a $CLIENT_ID token on realm $REALM ($KC_URL)"
TOKEN="$(curl -sfS -X POST "$KC_URL/realms/$REALM/protocol/openid-connect/token" \
    -d grant_type=client_credentials -d "client_id=$CLIENT_ID" \
    --data-urlencode "client_secret=$FLOW_ADMIN_SECRET" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')" \
    || handle_error "Cannot get a token: check FLOW_ADMIN_SECRET and that the $CLIENT_ID client exists on realm $REALM"

echo "📦 Exporting realm $REALM"
curl -sfS -X POST -H "Authorization: Bearer $TOKEN" \
    "$KC_URL/admin/realms/$REALM/partial-export?exportClients=true&exportGroupsAndRoles=true" \
    -o "$TMP" \
    || handle_error "Partial export refused: $CLIENT_ID needs the realm-management role manage-realm on realm $REALM"

# Validate, then normalise to the layout of the committed files (2 spaces,
# non-ASCII kept, final newline). Keycloak's key order is kept to limit the diff.
python3 - "$TMP" "$REALM" <<'PY' || handle_error "Export rejected, $TARGET left untouched"
import json, re, sys

path, realm = sys.argv[1], sys.argv[2]
data = json.load(open(path, encoding="utf-8"))
if data.get("realm") != realm:
    sys.exit(f"unexpected realm {data.get('realm')!r}, expected {realm!r}")

MASK = "**********"
SECRET_KEY = re.compile(r"(^|[._-])(secret|password|clientSecret)$|^clientSecret$", re.I)
leaks = []

def walk(node, where):
    if isinstance(node, dict):
        for key, value in node.items():
            here = f"{where}/{key}"
            if SECRET_KEY.search(key) and isinstance(value, str) and value and value != MASK:
                leaks.append(here)
            walk(value, here)
    elif isinstance(node, list):
        for i, value in enumerate(node):
            walk(value, f"{where}[{i}]")

walk(data, "")
if leaks:
    sys.exit("unmasked secret(s), nothing written: " + ", ".join(leaks))

# Real users would carry credentials: only service accounts are expected.
users = [u.get("username", "?") for u in data.get("users", [])
         if not u.get("serviceAccountClientId")]
if users:
    sys.exit(f"unexpected non-service-account users: {len(users)}")

with open(path, "w", encoding="utf-8") as out:
    json.dump(data, out, indent=2, ensure_ascii=False)
    out.write("\n")
PY

if cmp -s "$TMP" "$TARGET"; then
    show_success "$TARGET is already up to date"
    exit 0
fi

echo ""
if [[ "$DRY_RUN" == 1 ]]; then
    echo "Dry run, $TARGET not written. Diff:"
    diff -u "$TARGET" "$TMP" | head -200 || true
    exit 0
fi

cp "$TMP" "$TARGET"
git --no-pager diff --stat -- "$TARGET" || true
show_success "$TARGET updated: review with 'git diff $TARGET', then commit"
