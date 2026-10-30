import json
import re
from datetime import timedelta
from typing import Optional
from django.db.models import Max
from django.utils import timezone

from rest_framework import serializers
from . import apiary_permissions as apiary_perms
from .afsca import AFSCA_DIGITS, AFSCA_FORMAT, normalize_afsca
from . import nest_permissions as nest_perms
from . import trap_permissions as trap_perms
from .trap_permissions import is_publicly_visible
from .models import (
    Apiary, Hornet, Nest, NestEvent, NestPhoto, Species, Trap, TrapEvent, TrapPhoto, TrapType, User,
    HORNET_SPECIES_SLUG, unique_slug,
)
from hornet_finder_api.utils import user_exists, get_user_display_name


def user_summary(user) -> Optional[dict]:
    """Public-facing representation of a user: GUID plus Keycloak display name."""
    if not user:
        return None
    display_name = get_user_display_name(str(user.guid))
    return {
        'guid': str(user.guid),
        'display_name': display_name or str(user.guid)[:8] + '...',
    }

class GPSValidationMixin:
    def validate_longitude(self, value: float) -> float:
        if not (-180 <= value <= 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180 degrees.")
        return value

    def validate_latitude(self, value: float) -> float:
        if not (-90 <= value <= 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90 degrees.")
        return value
    
    def validate_created_by(self, value: str) -> str:
        if not user_exists(value):
            raise serializers.ValidationError("User does not exist.")
        return value

class HornetSerializer(GPSValidationMixin, serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    class Meta:
        model = Hornet
        fields = ['id', 'longitude', 'latitude', 'direction', 'duration', 'mark_color_1', 'mark_color_2', 'created_at', 'created_by', 'linked_nest', 'archived', 'archived_at']
        read_only_fields = ['id', 'created_at', 'archived', 'archived_at']
        extra_kwargs = { # Adding this to make the validation limits understandable by the swagger
            'direction': {
                'min_value': 0,
                'max_value': 359,
            },
            'duration': {
                'min_value': 0,
            },
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Enrichir le champ created_by avec le display_name Keycloak
        if instance.created_by:
            display_name = get_user_display_name(str(instance.created_by.guid))
            data['created_by'] = {
                'guid': str(instance.created_by.guid),
                'display_name': display_name or str(instance.created_by.guid)[:8] + '...'
            }
        else:
            data['created_by'] = None
        return data

    def validate_direction(self, value: int) -> int:
        if not (0 <= value <= 359):
            raise serializers.ValidationError("Direction must be between 0 and 359.")
        return value

    def validate_duration(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("Duration must be a positive integer.")
        return value



class PublicHornetSerializer(serializers.ModelSerializer):
    """
    Sighting as seen by those who may not know who reported it: anonymous
    visitors and trappers. No author, no link to a nest.
    """

    class Meta:
        model = Hornet
        fields = ['id', 'longitude', 'latitude', 'direction', 'duration', 'mark_color_1', 'mark_color_2',
                  'created_at', 'archived', 'archived_at']
        read_only_fields = fields


class NestPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = NestPhoto
        fields = ['id', 'url', 'thumbnail_url', 'created_at']
        read_only_fields = fields

    def get_url(self, instance) -> Optional[str]:
        return instance.image.url if instance.image else None

    def get_thumbnail_url(self, instance) -> Optional[str]:
        return instance.thumbnail.url if instance.thumbnail else None


# A phone's clock may run slightly ahead of the server's
DESTROYED_AT_CLOCK_SKEW = timedelta(minutes=5)
# A phone number as people type it: digits, an optional leading +, spaces and the usual separators;
# 8 to 15 digits (E.164 allows 15; a Belgian number has 9 after its 0)
PHONE_PATTERN = re.compile(r'^\+?[0-9 ./()-]+$')


class NestEventSerializer(serializers.ModelSerializer):
    """An entry of the journal of a nest, as shown on its sheet."""
    photos = NestPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = NestEvent
        fields = ['id', 'kind', 'performed_at', 'performed_by', 'outcome', 'actor', 'fixmystreet_ref',
                  'means', 'details', 'comments', 'photos']
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        # Who did what is for those who see every nest; a reporter sees what happened to theirs
        named = request is not None and nest_perms.sees_all_nests(request)
        data['performed_by'] = user_summary(instance.performed_by) if named else None
        data['can_delete'] = request is not None and nest_perms.can_delete_event(request, instance)
        return data


class NestEventInputSerializer(serializers.Serializer):
    """What a verification (`visit`), a destruction or a reactivation carries (POST /nests/<id>/events/)."""
    kind = serializers.ChoiceField(choices=[NestEvent.KIND_VISIT, NestEvent.KIND_DESTRUCTION,
                                            NestEvent.KIND_REACTIVATION])
    performed_at = serializers.DateTimeField(required=False)
    outcome = serializers.ChoiceField(choices=NestEvent.VISIT_OUTCOMES, required=False)
    basis = serializers.ListField(child=serializers.ChoiceField(choices=NestEvent.BASES), required=False)
    nest_type = serializers.ChoiceField(choices=Nest.TYPE_CHOICES, required=False, allow_blank=True)
    height_class = serializers.ChoiceField(choices=Nest.HEIGHT_CHOICES, required=False, allow_blank=True)
    size_class = serializers.ChoiceField(choices=Nest.SIZE_CHOICES, required=False, allow_blank=True)
    actor = serializers.ChoiceField(choices=NestEvent.ACTOR_CHOICES, required=False)
    fixmystreet_ref = serializers.CharField(max_length=32, required=False, allow_blank=True)
    means = serializers.ListField(child=serializers.ChoiceField(choices=NestEvent.MEANS), required=False)
    comments = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate_performed_at(self, value):
        if value > timezone.now() + DESTROYED_AT_CLOCK_SKEW:
            raise serializers.ValidationError("La date ne peut pas être dans le futur.")
        return value

    def validate(self, attrs):
        kind = attrs['kind']
        if kind == NestEvent.KIND_VISIT and not attrs.get('outcome'):
            raise serializers.ValidationError({'outcome': "Le résultat de la vérification est requis."})
        if kind != NestEvent.KIND_VISIT:
            for field in ('outcome', 'basis', 'nest_type', 'height_class', 'size_class'):
                attrs.pop(field, None)
        else:
            attrs['basis'] = sorted(set(attrs.get('basis') or []))
        if kind != NestEvent.KIND_DESTRUCTION:
            for field in ('actor', 'fixmystreet_ref', 'means'):
                attrs.pop(field, None)
        else:
            attrs.setdefault('actor', 'unknown')
            attrs['means'] = sorted(set(attrs.get('means') or []))
        return attrs


class NestSerializer(GPSValidationMixin, serializers.ModelSerializer):
    photos = NestPhotoSerializer(many=True, read_only=True)
    # At the report only: what the reporter saw (an empty nest is recorded as abandoned)
    state = serializers.ChoiceField(choices=NestEvent.REPORT_STATES, write_only=True, required=False)

    class Meta:
        model = Nest
        fields = ['id', 'longitude', 'latitude', 'public_place', 'address', 'status', 'destroyed', 'destroyed_at',
                  'nest_type', 'height_class', 'size_class', 'created_at', 'created_by', 'comments',
                  'contact_phone', 'private_comments', 'last_event_at', 'archived', 'archived_at', 'photos',
                  'state', 'owner']
        # The reporter is the requester, set by the view: never a form field, nor
        # the owner (PUT /nests/<id>/owner/). The status follows the journal
        # (POST /nests/<id>/events/)
        read_only_fields = ['id', 'status', 'created_at', 'created_by', 'owner', 'last_event_at', 'archived',
                            'archived_at']
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Enrichir le champ created_by avec le display_name Keycloak
        if instance.created_by:
            display_name = get_user_display_name(str(instance.created_by.guid))
            data['created_by'] = {
                'guid': str(instance.created_by.guid),
                'display_name': display_name or str(instance.created_by.guid)[:8] + '...'
            }
        else:
            data['created_by'] = None
        # Most nests are still owned by their reporter: no second Keycloak lookup then
        data['owner'] = (data['created_by'] if instance.owner_id == instance.created_by_id
                         else user_summary(instance.owner))
        # What the requester may do, so the UI does not have to redo the rules
        request = self.context.get('request')
        if request is None or not nest_perms.can_see_contact(request, instance):
            data.pop('contact_phone', None)
            data.pop('private_comments', None)
        if request is not None:
            data['permissions'] = {
                'update': nest_perms.can_edit_nest(request, instance),
                'photos': nest_perms.can_edit_nest(request, instance),
                'reactivate': nest_perms.can_reactivate_nest(request),
                'delete': nest_perms.can_delete_nest(request),
                'nearby_apiaries': nest_perms.can_see_nearby_apiaries(request),
                'visit': nest_perms.can_visit_nest(request, instance),
                'destroy': nest_perms.can_record_destruction(request, instance),
                'change_owner': nest_perms.can_change_owner(request, instance),
            }
            # The journal comes with one nest, not with a list
            if self.context.get('with_events'):
                data['events'] = NestEventSerializer(instance.events.all(), many=True, context=self.context).data
        return data

    def validate_address(self, value: str) -> str:
        # Allow empty address
        if not value or value.strip() == '':
            return value
        
        if len(value) > 255:
            raise serializers.ValidationError("Address must be 255 characters or less.")
        
        return value

    def validate_contact_phone(self, value: str) -> str:
        value = (value or '').strip()
        if not value:
            return ''
        digits = sum(char.isdigit() for char in value)
        if not PHONE_PATTERN.match(value) or not 8 <= digits <= 15:
            raise serializers.ValidationError("Numéro de téléphone non valide.")
        return value

    def validate_private_comments(self, value: str) -> str:
        return (value or '').strip()

    def validate_destroyed_at(self, value):
        if value is not None and value > timezone.now() + DESTROYED_AT_CLOCK_SKEW:
            raise serializers.ValidationError("The destruction date cannot be in the future.")
        return value

    def validate(self, attrs):
        """
        Keep `destroyed_at` in step with `destroyed`: set when the nest turns
        destroyed (now, unless a date is given), cleared when an admin turns
        it back. A destroyed nest only turns back through an admin.
        """
        instance = self.instance
        was_destroyed = bool(instance and instance.destroyed)
        destroyed = attrs.get('destroyed', was_destroyed)

        if was_destroyed and not destroyed:
            request = self.context.get('request')
            if request is None or not nest_perms.can_reactivate_nest(request):
                raise serializers.ValidationError(
                    {'destroyed': "A destroyed nest can only be reactivated by an admin."}
                )

        if not destroyed:
            attrs['destroyed_at'] = None
        elif attrs.get('destroyed_at') is None:
            # No date given: keep the recorded one, or stamp a new destruction
            attrs.pop('destroyed_at', None)
            if not was_destroyed:
                attrs['destroyed_at'] = timezone.now()
        return attrs

class PublicNestSerializer(GPSValidationMixin, serializers.ModelSerializer):
    """
    Serializer for public access to destroyed nests.
    Excludes sensitive information like created_by. The address and the comments of a
    nest on private ground (a garden) are left out: they may identify the occupants.
    """
    class Meta:
        model = Nest
        fields = ['id', 'longitude', 'latitude', 'public_place', 'address', 'destroyed', 'destroyed_at', 'created_at', 'comments', 'archived', 'archived_at']
        read_only_fields = ['id', 'created_at', 'archived', 'archived_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not instance.public_place:
            data['address'] = ''
            data['comments'] = ''
        return data

class ApiarySerializer(GPSValidationMixin, serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    photo_thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Apiary
        fields = ['id', 'longitude', 'latitude', 'address', 'infestation_level', 'afsca_number',
                  'photo_url', 'photo_thumbnail_url', 'created_at', 'created_by', 'owner',
                  'comments', 'host_name']
        # The creator and the owner are set by the server, never by a form
        read_only_fields = ['id', 'created_at', 'created_by', 'owner']

    def get_photo_url(self, instance) -> Optional[str]:
        return instance.photo.url if instance.photo else None

    def get_photo_thumbnail_url(self, instance) -> Optional[str]:
        return instance.photo_thumbnail.url if instance.photo_thumbnail else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # A listing may pass a cache so each name is looked up once per page
        summaries = self.context.get('user_summaries')

        def summary(user):
            if summaries is None or user is None:
                return user_summary(user)
            if user.pk not in summaries:
                summaries[user.pk] = user_summary(user)
            return summaries[user.pk]

        data['created_by'] = summary(instance.created_by)
        data['owner'] = summary(instance.owner)
        data['extended_permissions'] = [
            {
                'group': agp.group.path,
                'group_name': agp.group.name,
                'can_read': agp.can_read,
                'can_update': agp.can_update,
                'can_delete': agp.can_delete,
            }
            for agp in instance.apiarygrouppermission_set.all()
        ]
        # What the requester may do, so the UI does not have to redo the rules
        request = self.context.get('request')
        if request is not None:
            data['permissions'] = {
                'read': apiary_perms.has_apiary_permission(request, instance, apiary_perms.READ),
                'update': apiary_perms.has_apiary_permission(request, instance, apiary_perms.UPDATE),
                'delete': apiary_perms.has_apiary_permission(request, instance, apiary_perms.DELETE),
                'share': apiary_perms.can_share_apiary(request, instance),
                'change_owner': apiary_perms.can_change_owner(request, instance),
            }
        return data

    def validate_afsca_number(self, value: str) -> str:
        normalized = normalize_afsca(value)
        if normalized is not None:
            return normalized
        # A number recorded before the format was enforced may be kept as is
        if self.instance is not None and value.strip() == self.instance.afsca_number:
            return self.instance.afsca_number
        raise serializers.ValidationError(
            f"An AFSCA number has {AFSCA_DIGITS} digits, written {AFSCA_FORMAT}."
        )

    def validate_address(self, value: str) -> str:
        return value.strip()

    def validate_host_name(self, value: str) -> str:
        return value.strip()

    def validate_infestation_level(self, value):
        if value is None:
            return None
        valid_levels = [choice[0] for choice in Apiary.INFESTATION_LEVEL_CHOICES]
        if value not in valid_levels:
            raise serializers.ValidationError(f"Infestation level must be one of {valid_levels}.")
        return value


# ---------------------------------------------------------------------------
# Traps module
# ---------------------------------------------------------------------------

class TrapTypeSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    photo_thumbnail_url = serializers.SerializerMethodField()
    trap_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = TrapType
        fields = ['id', 'slug', 'name', 'description', 'sort_order', 'apiary_bound',
                  'accumulates', 'reading_interval_days', 'refill_interval_days',
                  'photo_url', 'photo_thumbnail_url', 'trap_count']
        extra_kwargs = {
            'reading_interval_days': {'min_value': 1, 'max_value': 365},
            'refill_interval_days': {'min_value': 1, 'max_value': 365},
        }
        # The slug is internal identity, derived from the name on creation and
        # frozen afterwards: an administrator names a trap type, they do not
        # invent an identifier for it.
        read_only_fields = ['id', 'slug', 'trap_count']

    def get_photo_url(self, instance) -> Optional[str]:
        return instance.photo.url if instance.photo else None

    def get_photo_thumbnail_url(self, instance) -> Optional[str]:
        return instance.photo_thumbnail.url if instance.photo_thumbnail else None

    def create(self, validated_data):
        validated_data['slug'] = unique_slug(TrapType, validated_data['name'])
        return super().create(validated_data)


class SpeciesSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    photo_thumbnail_url = serializers.SerializerMethodField()
    event_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Species
        fields = ['id', 'slug', 'name', 'scientific_name', 'wikipedia_url', 'sort_order',
                  'photo_url', 'photo_thumbnail_url', 'photo_credit', 'photo_source_url',
                  'event_count']
        # Same rule as the trap types: the slug is derived, never typed
        read_only_fields = ['id', 'slug', 'event_count']

    def get_photo_url(self, instance) -> Optional[str]:
        return instance.photo.url if instance.photo else None

    def get_photo_thumbnail_url(self, instance) -> Optional[str]:
        return instance.photo_thumbnail.url if instance.photo_thumbnail else None

    def create(self, validated_data):
        validated_data['slug'] = unique_slug(
            Species, validated_data.get('scientific_name') or validated_data['name'],
        )
        # A new species goes to the end of the list (just before "other"), the
        # admin moves it from there
        last = Species.objects.aggregate(last=Max('sort_order'))['last']
        validated_data.setdefault('sort_order', 0 if last is None else last + 1)
        instance = super().create(validated_data)
        Species.keep_other_last()
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        Species.keep_other_last()
        return instance


class TrapPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = TrapPhoto
        fields = ['id', 'url', 'thumbnail_url', 'created_at']
        read_only_fields = fields

    def get_url(self, instance) -> Optional[str]:
        return instance.image.url if instance.image else None

    def get_thumbnail_url(self, instance) -> Optional[str]:
        return instance.thumbnail.url if instance.thumbnail else None


class TrapEventSerializer(serializers.ModelSerializer):
    photos = TrapPhotoSerializer(many=True, read_only=True)
    species_slug = serializers.SlugRelatedField(
        source='species', slug_field='slug', queryset=Species.objects.all(),
        required=False, allow_null=True, write_only=True,
    )

    class Meta:
        model = TrapEvent
        fields = ['id', 'trap', 'kind', 'performed_at', 'performed_by', 'species',
                  'species_slug', 'quantity', 'observed_quantity', 'emptied', 'left_quantity',
                  'batch', 'bycatch_counted', 'comments', 'photos', 'created_at']
        # On a catch, `quantity` is written as what the trap held and read back
        # as the catches derived from it (see Trap.recompute_catches)
        read_only_fields = ['id', 'trap', 'performed_by', 'species', 'observed_quantity',
                            'emptied', 'left_quantity', 'batch', 'bycatch_counted', 'created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['performed_by'] = user_summary(instance.performed_by)
        data['species'] = (
            {
                'slug': instance.species.slug,
                'name': instance.species.name,
                'wikipedia_url': instance.species.wikipedia_url,
                'photo_thumbnail_url': (
                    instance.species.photo_thumbnail.url
                    if instance.species.photo_thumbnail else None
                ),
            }
            if instance.species else None
        )
        return data

    def validate(self, attrs):
        # Mirrors the database constraint with a message the UI can display
        kind = attrs.get('kind', getattr(self.instance, 'kind', None))
        species = attrs.get('species', getattr(self.instance, 'species', None))
        quantity = attrs.get('quantity', getattr(self.instance, 'quantity', None))

        if kind == TrapEvent.KIND_CATCH:
            if species is None:
                # A catch is a Vespa velutina catch unless stated otherwise
                species = Species.objects.filter(slug=HORNET_SPECIES_SLUG).first()
                if species is None:
                    raise serializers.ValidationError(
                        {'species_slug': "A catch requires a species."}
                    )
                attrs['species'] = species
            if quantity is None:
                raise serializers.ValidationError({'quantity': "A catch requires a quantity."})
            if quantity == 0 and species.slug != HORNET_SPECIES_SLUG:
                raise serializers.ValidationError(
                    {'quantity': "Only the Asian hornet can be recorded at zero."}
                )
            if 'quantity' in attrs:
                left = getattr(self.instance, 'left_quantity', None)
                if left is not None and quantity < left:
                    raise serializers.ValidationError(
                        {'quantity': f"The trap kept {left} of them after this reading."}
                    )
                attrs['observed_quantity'] = quantity
            if self.instance is None:
                # A lone catch takes everything out, as readings used to
                attrs['emptied'] = True
        elif species is not None or quantity is not None:
            raise serializers.ValidationError(
                "Only a catch can carry a species and a quantity."
            )
        return attrs


class CatchItemSerializer(serializers.Serializer):
    species_slug = serializers.SlugRelatedField(
        source='species', slug_field='slug', queryset=Species.objects.all(),
    )
    # What the trap holds; zero is only meaningful for the Asian hornet
    quantity = serializers.IntegerField(min_value=0)
    # What stayed in a trap that could only be partly emptied
    left = serializers.IntegerField(min_value=0, required=False, allow_null=True, default=None)


class CatchSerializer(serializers.Serializer):
    """
    One visit: a reading, recorded as one catch event per species, plus the
    maintenance actions done at the same time, one event each. Write-only, the
    response is the list of created events.

    Each item gives what the trap holds of a species, the catches are derived
    from it (see `Trap.recompute_catches`). For a trap emptied at every visit,
    that is simply what was taken out. A trap whose type accumulates must say
    whether it was `emptied`; any other trap always is. One that could only be
    partly emptied is not `emptied` and gives what stayed of every species
    (`left`); left entirely or not at all, it is stored as left in place or
    emptied.

    The Asian hornet may be recorded at zero, which is how a reading without
    any catch is kept; another species at zero is refused. `bycatch_counted`
    says whether the other species were counted: it is forced to true as soon
    as one of them is recorded.

    Expects the trap in the context (`trap`).
    """

    performed_at = serializers.DateTimeField()
    comments = serializers.CharField(required=False, allow_blank=True, default='')
    items = CatchItemSerializer(many=True, allow_empty=False)
    bycatch_counted = serializers.BooleanField(required=False, allow_null=True, default=None)
    emptied = serializers.BooleanField(required=False, allow_null=True, default=None)
    actions = serializers.ListField(
        child=serializers.ChoiceField(choices=TrapEvent.VISIT_ACTION_KINDS),
        required=False, default=list,
    )

    # Fields a multipart request (the one carrying photos) sends as JSON
    JSON_FIELDS = ('items', 'actions')

    def to_internal_value(self, data):
        if any(isinstance(data.get(name), str) for name in self.JSON_FIELDS):
            decoded = {key: data.get(key) for key in data}
            for name in self.JSON_FIELDS:
                if isinstance(decoded.get(name), str):
                    try:
                        decoded[name] = json.loads(decoded[name])
                    except ValueError as exc:
                        raise serializers.ValidationError({name: "Invalid JSON."}) from exc
            data = decoded
        return super().to_internal_value(data)

    def validate_items(self, items):
        slugs = [item['species'].slug for item in items]
        if len(slugs) != len(set(slugs)):
            raise serializers.ValidationError("Each species can appear only once.")
        if any(item['quantity'] == 0 and item['species'].slug != HORNET_SPECIES_SLUG
               for item in items):
            raise serializers.ValidationError("Only the Asian hornet can be recorded at zero.")
        return items

    def validate_actions(self, actions):
        if len(actions) != len(set(actions)):
            raise serializers.ValidationError("Each action can appear only once.")
        return actions

    def validate(self, attrs):
        if any(item['species'].slug != HORNET_SPECIES_SLUG for item in attrs['items']):
            attrs['bycatch_counted'] = True
        items = attrs['items']
        partly = any(item['left'] is not None for item in items)
        if self.context['trap'].trap_type.accumulates:
            if attrs['emptied'] is None:
                raise serializers.ValidationError({'emptied': "Say whether the trap was emptied."})
        else:
            if partly:
                raise serializers.ValidationError(
                    {'items': "Only a trap that accumulates can keep part of its catches."}
                )
            attrs['emptied'] = True
        if partly:
            if attrs['emptied']:
                raise serializers.ValidationError(
                    {'items': "An emptied trap keeps nothing: leave out what was left."}
                )
            if any(item['left'] is None for item in items):
                raise serializers.ValidationError(
                    {'items': "Say what was left of every species, zero included."}
                )
            if any(item['left'] > item['quantity'] for item in items):
                raise serializers.ValidationError(
                    {'items': "What was left cannot exceed what the trap held."}
                )
            # Nothing or everything left: an emptied trap, or one left in place
            if all(item['left'] == 0 for item in items):
                attrs['emptied'] = True
            if attrs['emptied'] or all(item['left'] == item['quantity'] for item in items):
                for item in items:
                    item['left'] = None
        return attrs


class VisibilityField(serializers.ChoiceField):
    """The visibility of a trap; the former value `group` is read as `restricted`."""

    def to_internal_value(self, data):
        return super().to_internal_value(Trap.normalize_visibility(data) or data)


class TrapSerializer(GPSValidationMixin, serializers.ModelSerializer):
    """Full representation, for users allowed to read the trap."""

    trap_type_slug = serializers.SlugRelatedField(
        source='trap_type', slug_field='slug', queryset=TrapType.objects.all(),
        write_only=True,
    )
    photo_url = serializers.SerializerMethodField()
    photo_thumbnail_url = serializers.SerializerMethodField()
    last_event_at = serializers.SerializerMethodField()
    tag_short = serializers.SerializerMethodField()
    publicly_visible = serializers.SerializerMethodField()
    visibility_locked = serializers.SerializerMethodField()
    visibility = VisibilityField(choices=Trap.VISIBILITY_CHOICES, required=False)

    class Meta:
        model = Trap
        fields = ['id', 'latitude', 'longitude', 'address', 'active', 'visibility',
                  'publicly_visible', 'visibility_locked',
                  'trap_type', 'trap_type_slug', 'photo_url', 'photo_thumbnail_url',
                  'installed_at', 'comments', 'hornet_catch_count', 'contents', 'owner', 'group',
                  'last_event_at', 'tag_short', 'created_at', 'updated_at']
        # `active` is driven by the installation and removal events, never sent
        # by a form: DRF reads an absent boolean in form-data as False (the
        # unchecked-checkbox convention), which would store every new trap as
        # already put away.
        read_only_fields = ['id', 'owner', 'group', 'trap_type', 'active',
                            'hornet_catch_count', 'contents', 'created_at', 'updated_at']

    def get_photo_url(self, instance) -> Optional[str]:
        return instance.photo.url if instance.photo else None

    def get_photo_thumbnail_url(self, instance) -> Optional[str]:
        return instance.photo_thumbnail.url if instance.photo_thumbnail else None

    def get_publicly_visible(self, instance) -> bool:
        return is_publicly_visible(instance)

    def get_visibility_locked(self, instance) -> bool:
        """The trap must stay restricted: an apiary-bound type, and an owner who is a beekeeper."""
        return Trap.restricted_by_nature(instance.trap_type, instance.owner)

    def get_tag_short(self, instance) -> Optional[str]:
        # `active_tags` is prefetched by the trap viewset; query otherwise
        active = getattr(instance, 'active_tags', None)
        if active is None:
            active = list(instance.tags.filter(revoked_at__isnull=True)[:1])
        return active[0].short if active else None

    def get_last_event_at(self, instance) -> Optional[str]:
        # The trap manager annotates it; query otherwise
        if hasattr(instance, 'last_event'):
            return instance.last_event.isoformat() if instance.last_event else None
        last = instance.events.first()  # ordered by -performed_at
        return last.performed_at.isoformat() if last else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # A listing may pass a cache so an owner's name is looked up once per page
        summaries = self.context.get('user_summaries')
        if summaries is not None and instance.owner_id:
            if instance.owner_id not in summaries:
                summaries[instance.owner_id] = user_summary(instance.owner)
            data['owner'] = summaries[instance.owner_id]
        else:
            data['owner'] = user_summary(instance.owner)
        data['group'] = (
            {'path': instance.group.path, 'name': instance.group.name}
            if instance.group else None
        )
        data['trap_type'] = (
            {
                'id': instance.trap_type.id,
                'slug': instance.trap_type.slug,
                'name': instance.trap_type.name,
                'apiary_bound': instance.trap_type.apiary_bound,
                'accumulates': instance.trap_type.accumulates,
                'reading_interval_days': instance.trap_type.reading_interval_days,
                'photo_thumbnail_url': (
                    instance.trap_type.photo_thumbnail.url
                    if instance.trap_type.photo_thumbnail else None
                ),
            }
            if instance.trap_type_id else None
        )
        # What the requester may do, so the UI does not have to redo the rules.
        # The delegation stays out: its groups come from `/delegation/`.
        request = self.context.get('request')
        if request is not None:
            data['permissions'] = {
                'update': trap_perms.can_edit_trap(request, instance),
                'act': trap_perms.can_act_on_trap(request, instance),
                'change_owner': trap_perms.can_change_owner(request, instance),
            }
        return data

    def validate(self, attrs):
        # An apiary-bound trap of a beekeeper is never public (the stored visibility says what it is)
        trap_type = attrs.get('trap_type') or getattr(self.instance, 'trap_type', None)
        request = self.context.get('request')
        owner = self.instance.owner if self.instance else (trap_perms.local_user(request) if request else None)
        if attrs.get('visibility') == Trap.VISIBILITY_PUBLIC and Trap.restricted_by_nature(trap_type, owner):
            raise serializers.ValidationError({
                'visibility': "A beekeeper's trap of this type is set up in front of hives: it cannot be public.",
            })
        return attrs


class TrapDetailSerializer(TrapSerializer):
    """Trap plus its journal, for the detail view."""

    events = TrapEventSerializer(many=True, read_only=True)

    class Meta(TrapSerializer.Meta):
        fields = TrapSerializer.Meta.fields + ['events']


class PublicTrapSerializer(serializers.ModelSerializer):
    """
    Representation served to anonymous visitors.

    Deliberately leaves out the owner, the group and the journal: a passer-by
    sees that a trap is there and what it catches, nothing about who runs it.
    """

    photo_url = serializers.SerializerMethodField()
    photo_thumbnail_url = serializers.SerializerMethodField()
    trap_type = serializers.SerializerMethodField()

    class Meta:
        model = Trap
        fields = ['id', 'latitude', 'longitude', 'active', 'trap_type', 'photo_url',
                  'photo_thumbnail_url', 'installed_at', 'hornet_catch_count']
        read_only_fields = fields

    def get_photo_url(self, instance) -> Optional[str]:
        return instance.photo.url if instance.photo else None

    def get_photo_thumbnail_url(self, instance) -> Optional[str]:
        return instance.photo_thumbnail.url if instance.photo_thumbnail else None

    def get_trap_type(self, instance) -> dict:
        return {'slug': instance.trap_type.slug, 'name': instance.trap_type.name}
