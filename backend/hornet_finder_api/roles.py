"""
Application roles, as Keycloak puts them in `realm_access.roles`.

Each role is one trade; a person doing several holds several roles (one per
Keycloak group, see `doc/KEYCLOAK_USERS_GROUPS.md`).
"""

ADMIN = 'admin'
# Beekeepers: apiaries, their traps, and hornet sightings at the hives
BEEKEEPER = 'beekeeper'
# Nest hunters: hornet sightings and releases, every nest
HUNTER = 'hunter'
# Trap campaign: traps and their QR codes; the default role of a new account
TRAPPER = 'trapper'

APP_ROLES = (ADMIN, BEEKEEPER, HUNTER, TRAPPER)

# Roles renamed in Keycloak but still carried by tokens issued before the
# change. `volunteer` held both trades before they were split.
# TODO: remove in the release after the Keycloak migration (prod note 0018).
LEGACY_ROLES = {'volunteer': (HUNTER, TRAPPER)}


def normalize(roles) -> list:
    """The roles of a token, legacy names replaced by the current ones."""
    result = []
    for role in roles or []:
        for name in LEGACY_ROLES.get(role, (role,)):
            if name not in result:
                result.append(name)
    return result
