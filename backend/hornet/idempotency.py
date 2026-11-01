"""
Idempotent journal entries: the client names each entry it sends with a UUID
of its own (`client_key`), kept from the first attempt to the last. A request
replayed with a key already recorded (the answer of the first one was lost:
timeout, dropped connection, app closed) records nothing and gets the entry
already recorded back, with status 200 instead of 201.

The key is checked twice: once before the validation, because a replay must
not be refused for a state the first request changed itself (a nest that its
own destruction closed); then again under a lock of the parent row, which
serialises two attempts sent at the same time.

A key belongs to its author and to its object: the same key from someone
else, or on another object, is a client error (409), never a replay.

See doc/OFFLINE.md.
"""

import uuid

from rest_framework import serializers
from rest_framework.exceptions import APIException


class KeyConflict(APIException):
    status_code = 409
    default_detail = "This client_key is already used by another entry."
    default_code = 'client_key_conflict'


def client_key(request):
    """The `client_key` of the request as a UUID, None when absent; 400 when malformed."""
    raw = request.data.get('client_key') if hasattr(request.data, 'get') else None
    if raw in (None, ''):
        return None
    try:
        return uuid.UUID(str(raw))
    except ValueError as error:
        raise serializers.ValidationError({'client_key': "Must be a UUID."}) from error


def check_owner(entries, parent_field, parent_pk, author):
    """
    Raise `KeyConflict` unless every entry already recorded under a key is on
    the same object (`parent_field` id equal to `parent_pk`) and by the same
    author. True when there is at least one such entry (a replay).
    """
    entries = list(entries)
    if not entries:
        return False
    author_pk = getattr(author, 'pk', None)
    for entry in entries:
        if getattr(entry, f'{parent_field}_id') != parent_pk or entry.performed_by_id != author_pk:
            raise KeyConflict()
    return True
