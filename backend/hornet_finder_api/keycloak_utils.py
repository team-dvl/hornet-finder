import os
import threading
import time
import requests

# Token cache (thread-safe)
_token_cache = {
    'access_token': None,
    'expires_at': 0
}
_token_lock = threading.Lock()

def get_keycloak_api_token() -> str:
    """
    Récupère et met en cache un token d'accès Keycloak (client credentials).
    Utilise les variables d'env : KC_CLIENT_SECRET, KC_INTERNAL_URL, KC_REALM
    """
    global _token_cache
    now = time.time()
    with _token_lock:
        if _token_cache['access_token'] and _token_cache['expires_at'] > now + 30:
            return _token_cache['access_token']
        client_id = os.environ.get('KC_CLIENT_ID', 'hornet-api')
        client_secret = os.environ.get('KC_CLIENT_SECRET')
        keycloak_url = os.environ.get('KC_INTERNAL_URL')
        realm = os.environ.get('KC_REALM')
        if not (client_id and client_secret and keycloak_url and realm):
            print("Missing Keycloak configuration: KC_CLIENT_ID, KC_CLIENT_SECRET, KC_INTERNAL_URL, or KC_REALM.")
            return None
        token_url = f"{keycloak_url.rstrip('/')}/realms/{realm}/protocol/openid-connect/token"
        data = {
            'grant_type': 'client_credentials',
            'client_id': client_id,
            'client_secret': client_secret
        }
        try:
            resp = requests.post(token_url, data=data, timeout=5)
            if resp.status_code == 200:
                token_data = resp.json()
                _token_cache['access_token'] = token_data['access_token']
                _token_cache['expires_at'] = now + token_data.get('expires_in', 60)
                return _token_cache['access_token']
        except Exception:
            pass
        return None

def get_user_display_name(guid: str) -> str:
    """
    Récupère le prénom et le nom Keycloak (ou preferred_username/email/id) pour un utilisateur donné par son GUID.
    Utilise un token client credentials, mis en cache.
    """
    keycloak_url = os.environ.get('KC_INTERNAL_URL')
    realm = os.environ.get('KC_REALM')
    if not (keycloak_url and realm):
        return None
    token = get_keycloak_api_token()
    if not token:
        return None
    url = f"{keycloak_url.rstrip('/')}/admin/realms/{realm}/users/{guid}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            user = resp.json()
            # Privilégier prénom + nom, sinon preferred_username, sinon email, sinon id
            first = user.get('firstName', '')
            last = user.get('lastName', '')
            if first or last:
                return f"{first} {last}".strip()
            return user.get('preferred_username') or user.get('email') or user.get('id')
    except Exception:
        pass
    return None
