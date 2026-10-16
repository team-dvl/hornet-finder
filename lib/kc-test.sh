#!/usr/bin/env bash

#
# Keycloak helpers for the dev-only test accounts (KC_TEST_* in .env), shared by
# smoke-traps.sh and ui-shots.sh. Development realm only: it relies on the
# password-grant client that the production realm does not have.
#
# Callers must have loaded KC_HOSTNAME and the KC_TEST_* variables beforehand.
#

# kc_totp: current code of KC_TEST_TOTP_SECRET (base32, HmacSHA1, 6 digits, 30 s:
# the realm OTP policy), for the accounts whose role requires a second factor
# (t-admin, through mfa-required)
kc_totp() {
    python3 -c "
import base64, hashlib, hmac, os, struct, time
secret = os.environ['KC_TEST_TOTP_SECRET'].replace(' ', '').upper()
key = base64.b32decode(secret + '=' * (-len(secret) % 8))
digest = hmac.new(key, struct.pack('>Q', int(time.time()) // 30), hashlib.sha1).digest()
offset = digest[-1] & 15
print('%06d' % ((struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 10**6))"
}

# kc_test_token <email> [otp]: prints the access token of a test account; `otp`
# adds the TOTP code. On failure prints Keycloak's own error (never a secret)
# on stderr and returns 1. Keycloak refuses a TOTP code it has already
# accepted, so two otp tokens must come from different 30 s windows.
kc_test_token() {
    local email="$1" extra=() response
    if [[ "${2:-}" == "otp" ]]; then
        [[ -n "${KC_TEST_TOTP_SECRET:-}" ]] || { echo "KC_TEST_TOTP_SECRET is missing: $email has an OTP (see .env.example)." >&2; return 1; }
        extra=(-d "totp=$(kc_totp)")
    fi
    response=$(curl -sk -X POST "https://${KC_HOSTNAME}/realms/hornet-finder-dev/protocol/openid-connect/token" \
        -d "client_id=$KC_TEST_CLIENT_ID" --data-urlencode "client_secret=$KC_TEST_CLIENT_SECRET" \
        -d "username=$email" --data-urlencode "password=$KC_TEST_USER_PASSWORD" "${extra[@]}" \
        -d "grant_type=password" -d "scope=openid membership")
    printf '%s' "$response" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except ValueError:
    d = {'error': 'no JSON answer from Keycloak'}
if 'access_token' in d:
    print(d['access_token'])
else:
    sys.stderr.write('Token request for $email failed: %s (%s)\n' % (d.get('error'), d.get('error_description', '')))
    sys.exit(1)"
}
