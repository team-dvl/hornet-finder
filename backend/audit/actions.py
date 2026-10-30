"""
Catalogue of the business actions recorded in the audit trail.

A code is `<domain>.<verb>`; the domain is what the admin module filters on.
Every code recorded must be listed here (checked by `record`), so the
catalogue served to the frontend is complete.
"""

ACTIONS = {
    # Hornet sightings
    'hornet.reported': "Hornet sighting reported",
    'hornet.updated': "Hornet sighting updated",
    'hornet.deleted': "Hornet sighting deleted",
    'hornet.archived': "Hornet sighting archived",
    'hornet.unarchived': "Hornet sighting unarchived",
    'hornet.bulk_archived': "Hornet sightings of a period archived",
    # Nests
    'nest.reported': "Nest reported",
    'nest.updated': "Nest updated",
    'nest.destroyed': "Nest marked destroyed",
    'nest.reactivated': "Nest marked active again",
    'nest.visited': "Nest visited",
    'nest.event_deleted': "Nest journal entry removed",
    'nest.season_ended': "Nests left untreated marked abandoned at the end of the season",
    'nest.deleted': "Nest deleted",
    'nest.photo_added': "Nest photos added",
    'nest.photo_removed': "Nest photo removed",
    'nest.owner_changed': "Nest handed over to another owner",
    'nest.archived': "Nest archived",
    'nest.unarchived': "Nest unarchived",
    'nest.bulk_archived': "Nests of a period archived",
    # Apiaries
    'apiary.created': "Apiary created",
    'apiary.updated': "Apiary updated",
    'apiary.deleted': "Apiary deleted",
    'apiary.photo_set': "Apiary photo set",
    'apiary.photo_removed': "Apiary photo removed",
    'apiary.shared': "Apiary shared with a group",
    'apiary.share_changed': "Apiary sharing changed",
    'apiary.unshared': "Apiary no longer shared with a group",
    'apiary.owner_changed': "Apiary handed over",
    # Traps and their journal
    'trap.created': "Trap created (installation)",
    'trap.updated': "Trap updated",
    'trap.deleted': "Trap deleted",
    'trap.photo_set': "Trap photo set",
    'trap.photo_removed': "Trap photo removed",
    'trap.delegated': "Trap delegated to a group",
    'trap.undelegated': "Trap delegation removed",
    'trap.owner_changed': "Trap handed over",
    'trap.restricted': "Trap restricted: its owner became a beekeeper",
    'trap.event_recorded': "Trap journal entry recorded",
    'trap.visit_recorded': "Trap visit recorded",
    'trap.visit_deleted': "Trap visit deleted",
    'trap.event_corrected': "Trap journal entry corrected",
    'trap.event_deleted': "Trap journal entry deleted",
    'trap.journal_photo_removed': "Trap journal photo removed",
    # Hives
    'hive.created': "Hive created",
    'hive.updated': "Hive updated",
    'hive.moved': "Hive moved to an apiary",
    'hive.stored': "Hive stored",
    'hive.retired': "Hive retired",
    'hive.keeper_changed': "Hive entrusted to another beekeeper",
    'hive.deleted': "Hive deleted",
    # QR codes
    'tag.batch_generated': "QR codes generated",
    'tag.associated': "QR code associated with a trap",
    'tag.revoked': "QR code revoked",
    # Referentials
    'trap_type.created': "Trap type created",
    'trap_type.updated': "Trap type updated",
    'trap_type.deleted': "Trap type deleted",
    'hive_type.created': "Hive type created",
    'hive_type.updated': "Hive type updated",
    'hive_type.deleted': "Hive type deleted",
    'species.created': "Species created",
    'species.updated': "Species updated",
    'species.deleted': "Species deleted",
    'species.reordered': "Species reordered",
    # Groups (Keycloak)
    'group.member_removed': "Member removed from a group",
    'group.admin_named': "Group administrator named",
    'group.admin_dismissed': "Group administrator dismissed",
    'notification.sent': "Push notification sent to a group or a member",
    # Invitations
    'invitation.sent': "Group invitation sent",
    'invitation.reminded': "Group invitation reminder sent",
    'invitation.cancelled': "Group invitation withdrawn",
    'invitation.accepted': "Group invitation accepted",
    'invitation.declined': "Group invitation declined",
    'invitation.expired': "Group invitation expired",
    # Statistics exports
    'stats.export_link': "Statistics export requested (direct link)",
    'stats.export_emailed': "Statistics export requested (emailed link)",
    'stats.export_downloaded': "Statistics export downloaded",
    # Platform settings
    'platform.notifications_changed': "Notification kinds held back or resumed for everyone",
    # The audit trail itself
    'audit.exported': "Audit trail exported",
}


def domain_of(action: str) -> str:
    return action.split('.', 1)[0]


DOMAINS = sorted({domain_of(code) for code in ACTIONS})
