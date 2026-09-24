#!/usr/bin/env bash
#
# Command-line access to the dev catch-all mailbox (Mailpit REST API behind
# oauth2-proxy at https://$HOST/mail/). It authenticates with the service
# account of the mail-proxy-dev Keycloak client (client_credentials grant,
# realm role mail-reader), so workflow tests can read the emails Keycloak or
# Django sent, e.g. to follow a verification link. Development tool only.
#
# Usage: ./mail-api.sh list [limit]        latest messages (default 20)
#        ./mail-api.sh search <query>      Mailpit search syntax, e.g. to:x@y subject:"..."
#        ./mail-api.sh get <id|latest>     one message (JSON)
#        ./mail-api.sh links <id|latest>   URLs found in the message text body
#        ./mail-api.sh clear               delete every message
#        ./mail-api.sh token               print the bearer token (for curl)
#
set -euo pipefail

SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
set -a; . ./.env; set +a

if [[ "${APP_ENV:-}" != "dev" ]]; then
    echo "This script only runs against the development environment (APP_ENV=dev)." >&2
    exit 1
fi
if [[ -z "${MAIL_PROXY_CLIENT_SECRET:-}" ]]; then
    echo "MAIL_PROXY_CLIENT_SECRET is missing from .env: see .env.example." >&2
    exit 1
fi
API="https://${HOST}/mail/api/v1"
AUTH="https://${KC_HOSTNAME}/realms/hornet-finder-dev/protocol/openid-connect/token"

token() {
    curl -sfS -X POST "$AUTH" -d "client_id=mail-proxy-dev" \
        -d "client_secret=$MAIL_PROXY_CLIENT_SECRET" -d "grant_type=client_credentials" \
        | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])"
}

# api <method> <path> [curl args...]
api() {
    local method="$1" path="$2"; shift 2
    curl -sfS -X "$method" -H "Authorization: Bearer $TOKEN" "$API$path" "$@"
}

summary() {
    python3 -c '
import sys, json
d = json.load(sys.stdin)
print(d.get("messages_count", 0), "message(s)")
for m in d.get("messages", []):
    to = ", ".join(a["Address"] for a in m.get("To") or [])
    print("%s  %s  %-35s  %s" % (m["ID"], m["Created"][:19], to, m["Subject"]))
'
}

cmd="${1:-list}"
TOKEN="$(token)"
case "$cmd" in
    list)   api GET "/messages?limit=${2:-20}" | summary ;;
    search) api GET /search --get --data-urlencode "query=${2:?query required}" | summary ;;
    get)    api GET "/message/${2:?id required}" ;;
    links)  api GET "/message/${2:?id required}" \
                | python3 -c 'import sys,json,re;[print(u) for u in dict.fromkeys(re.findall(r"https?://[^\s<>\"]+", json.load(sys.stdin)["Text"]))]' ;;
    clear)  api DELETE /messages -o /dev/null && echo "Mailbox cleared." ;;
    token)  echo "$TOKEN" ;;
    *)      sed -n '9,15p' "$0" >&2; exit 1 ;;
esac
