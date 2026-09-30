#!/usr/bin/env bash
set -euo pipefail

#
# Require a second factor (OTP) of the users holding the mfa-required realm
# role, on an EXISTING realm: the realm export only feeds the import of a new
# realm, and the built-in flows cannot be edited, so the change is applied
# through the Admin API, in the custom browser-passkey flow.
#
# What it sets up (idempotent, each step is skipped when already done):
#   1. the realm role mfa-required, carried by admin and beekeeper-group-admin
#      as a composite child
#   2. flow "Conditional OTP": a condition "user does NOT hold mfa-required",
#      so the voluntary OTP keeps working for everybody else
#   3. flow "Mandatory OTP" under "Password and OTP": OTP for the holders of
#      mfa-required, configured at sign-in when missing
# Sign-in with a passkey (user verification required) is not affected, and the
# flow only runs when the realm uses browser-passkey as its browser flow.
#
# The realm is chosen by APP_ENV in .env (prod: hornet-finder, dev:
# hornet-finder-dev), through the flow-admin service account (role manage-realm).
#
# Usage: ./enforce-admin-2fa.sh           dry run: print what would change
#        ./enforce-admin-2fa.sh --apply   write it
#
# Environment: KC_BASE_URL overrides https://$KC_HOSTNAME (local tests).
#

SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

APPLY=0
case "${1:-}" in
    "") ;;
    --apply) APPLY=1 ;;
    -h|--help) sed -n '23,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) handle_error "Unknown option: $1 (see -h)" ;;
esac

cd "$SCRIPT_DIR"
load_env
ENVIRONMENT="$(get_configured_environment)"
if [[ "$ENVIRONMENT" == "prod" ]]; then REALM="hornet-finder"; else REALM="hornet-finder-dev"; fi

[[ -n "${KC_HOSTNAME:-}" ]] || handle_error "KC_HOSTNAME is missing from .env"
[[ -n "${FLOW_ADMIN_SECRET:-}" ]] || handle_error "FLOW_ADMIN_SECRET is missing from .env: see .env.example"
export KC_URL="${KC_BASE_URL:-https://${KC_HOSTNAME}}" REALM APPLY
export CLIENT_ID="${FLOW_ADMIN_CLIENT_ID:-flow-admin}"

python3 - <<'PY'
import json, os, sys, urllib.error, urllib.parse, urllib.request

KC, REALM, APPLY = os.environ["KC_URL"], os.environ["REALM"], os.environ["APPLY"] == "1"
ROLE = "mfa-required"
CARRIERS = ("admin", "beekeeper-group-admin")
REQUIRED_CFG = "mfa-role-required"
NOT_REQUIRED_CFG = "mfa-role-not-required"


def call(method, path, body=None, form=None, token=None, allow=()):
    url = path if path.startswith("http") else f"{KC}/admin/realms/{REALM}{path}"
    data, headers = None, {}
    if form is not None:
        data = urllib.parse.urlencode(form).encode()
    elif body is not None:
        data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None), resp.headers
    except urllib.error.HTTPError as err:
        if err.code in allow:
            return err.code, None, err.headers
        sys.exit(f"{method} {path} -> HTTP {err.code}: {err.read().decode()[:300]}")


_, tok, _ = call("POST", f"{KC}/realms/{REALM}/protocol/openid-connect/token",
                 form={"grant_type": "client_credentials", "client_id": os.environ["CLIENT_ID"],
                       "client_secret": os.environ["FLOW_ADMIN_SECRET"]})
TOKEN = tok["access_token"]
print(f"Realm {REALM} on {KC}, {'APPLY' if APPLY else 'dry run'}")
changes = 0


def step(text, method, path, body=None, allow=()):
    """Announce a write, perform it only with --apply."""
    global changes
    changes += 1
    print(f"  {'DO  ' if APPLY else 'WOULD'} {text}")
    if APPLY:
        return call(method, path, body, token=TOKEN, allow=allow)
    return None


def get(path, allow=()):
    return call("GET", path, token=TOKEN, allow=allow)[1]


q = urllib.parse.quote

# 1. role and composites
if get(f"/roles/{ROLE}", allow=(404,)) is None:
    step(f"create realm role {ROLE}", "POST", "/roles", {
        "name": ROLE,
        "description": "Users holding this role must use a second factor (OTP) to sign in with a password"})
role = get(f"/roles/{ROLE}", allow=(404,)) or {"id": "<new>", "name": ROLE}
for carrier in CARRIERS:
    if get(f"/roles/{carrier}", allow=(404,)) is None:
        sys.exit(f"realm role {carrier} not found")
    kids = [c["name"] for c in get(f"/roles/{carrier}/composites")]
    if ROLE not in kids:
        step(f"make {ROLE} a composite child of {carrier}", "POST", f"/roles/{carrier}/composites", [role])


def executions(flow):
    return get(f"/authentication/flows/{q(flow)}/executions")


def sub_flow(parent, alias):
    """Representation of the sub-flow `alias` listed in the executions of `parent`."""
    if call("GET", f"/authentication/flows/{q(parent)}/executions", token=TOKEN, allow=(404,))[1] is None:
        sys.exit(f"flow {parent!r} not found: bind the custom browser-passkey flow first")
    for e in executions(parent):
        if e.get("displayName") == alias and e.get("flowId"):
            return get(f"/authentication/flows/{e['flowId']}")
    sys.exit(f"flow {alias!r} not found in {parent!r}: is the realm built from a recent realm-export?")


def add_condition_and_otp(flow, cfg_alias, negate, with_otp):
    """Add the role condition (and the OTP form) to a flow, when missing."""
    present = {e.get("providerId") for e in executions(flow)}
    for provider, want in (("conditional-user-role", True), ("auth-otp-form", with_otp)):
        if not want or provider in present:
            continue
        step(f"add {provider} to flow {flow!r}", "POST",
             f"/authentication/flows/{q(flow)}/executions/execution", {"provider": provider})
        if not APPLY:
            continue
        ex = [e for e in executions(flow) if e.get("providerId") == provider][-1]
        if provider == "conditional-user-role":
            call("POST", f"/authentication/executions/{ex['id']}/config",
                 {"alias": cfg_alias, "config": {"condUserRole": ROLE, "negate": negate}}, token=TOKEN)
        call("PUT", f"/authentication/flows/{q(flow)}/executions", dict(ex, requirement="REQUIRED"), token=TOKEN)


pw = sub_flow("Credential", "Password and OTP")
cond = sub_flow("Password and OTP", "Conditional OTP")
if cond["builtIn"] or pw["builtIn"]:
    sys.exit("built-in flows cannot be edited: bind the custom browser-passkey flow first")

# 2. voluntary OTP only for users without the role
add_condition_and_otp("Conditional OTP", NOT_REQUIRED_CFG, "true", with_otp=False)

# 3. mandatory OTP for users with the role
names = {e.get("displayName") for e in executions("Password and OTP")}
if "Mandatory OTP" not in names:
    step("create flow 'Mandatory OTP' under 'Password and OTP'", "POST",
         "/authentication/flows/Password%20and%20OTP/executions/flow",
         {"alias": "Mandatory OTP", "type": "basic-flow", "provider": "registration-page-form",
          "description": "OTP for users holding the mfa-required role, configured at sign-in when missing"})
    if APPLY:
        ex = [e for e in executions("Password and OTP") if e.get("displayName") == "Mandatory OTP"][0]
        call("PUT", "/authentication/flows/Password%20and%20OTP/executions",
             dict(ex, requirement="CONDITIONAL"), token=TOKEN)
if "Mandatory OTP" in names or APPLY:
    add_condition_and_otp("Mandatory OTP", REQUIRED_CFG, "false", with_otp=True)
else:
    print("  WOULD add conditional-user-role and auth-otp-form to flow 'Mandatory OTP'")
    changes += 1

print("Nothing to do: already in place." if not changes else
      f"{changes} change(s) {'applied' if APPLY else 'planned (rerun with --apply)'}.")
PY
