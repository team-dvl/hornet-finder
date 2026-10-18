"""
The kinds of notifications a user can turn on or off, account-wide (every device).

Each kind has a default (`default`): on, except "Tous les nouveaux nids" for a
beekeeper, who chooses it explicitly; the coordinators of the nests get it by
default. `User.notification_prefs` keeps only the choices that differ from the
default, `{kind: bool}`. A kind is listed in the Notifications module only to
the people it concerns (`concerns`). Turning a device on or off is another
matter (the push subscription of that device).
"""

TRAP_READING = 'trap_reading'
TRAP_REFILL = 'trap_refill'
TRAP_HANDOVER = 'trap_handover'
GROUP_MESSAGE = 'group_message'
PLATFORM_MESSAGE = 'platform_message'
# Nests (see hornet/nest_alerts.py)
NEST_NEW = 'nest_new'
NEST_NEAR_APIARY = 'nest_near_apiary'
NEST_FOLLOWUP = 'nest_followup'
# A message to one's own devices: never filtered
TEST = 'test'

KINDS = {
    TRAP_READING: "Rappels de relevé",
    TRAP_REFILL: "Rappels d'attractif",
    TRAP_HANDOVER: "Pièges qui me sont transférés",
    NEST_NEW: "Tous les nouveaux nids",
    NEST_NEAR_APIARY: "Nids près de mes ruchers",
    NEST_FOLLOWUP: "Suivi de mes signalements",
    GROUP_MESSAGE: "Messages de mon groupe",
    PLATFORM_MESSAGE: "Messages de la plateforme",
}

PLATFORM_ADMINS = '/admins'
HUNTER_COORDINATORS = '/hunters/admin'
BEEKEEPERS = '/beekeepers'


def _paths(user) -> list:
    return list(getattr(user, 'group_paths', None) or [])


def _in(paths, group: str) -> bool:
    return any(p == group or p.startswith(group + '/') for p in paths)


def is_nest_coordinator(user) -> bool:
    """Platform admins and the administrators of the nest hunters, from the mirror of their groups."""
    paths = _paths(user)
    return _in(paths, PLATFORM_ADMINS) or _in(paths, HUNTER_COORDINATORS)


def is_beekeeper(user) -> bool:
    return _in(_paths(user), BEEKEEPERS)


def default(user, kind: str) -> bool:
    if kind == NEST_NEW:
        return is_nest_coordinator(user)
    return True


def concerns(user, kind: str) -> bool:
    """Whether the Notifications module lists `kind` to `user`."""
    if kind == NEST_NEW:
        return is_nest_coordinator(user) or is_beekeeper(user)
    if kind == NEST_NEAR_APIARY:
        return is_beekeeper(user)
    return True


def wants(user, kind: str) -> bool:
    """Whether `user` (a local User) receives `kind`; unknown users and kinds receive."""
    if user is None or kind not in KINDS:
        return True
    value = (user.notification_prefs or {}).get(kind)
    return default(user, kind) if value is None else value is not False


def choose(user, kind: str, enabled: bool) -> None:
    """Record a choice in `user.notification_prefs` (not saved): only what differs from the default stays."""
    prefs = dict(user.notification_prefs or {})
    if enabled == default(user, kind):
        prefs.pop(kind, None)
    else:
        prefs[kind] = enabled
    user.notification_prefs = prefs
