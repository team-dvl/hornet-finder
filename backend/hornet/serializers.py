import json
from typing import Optional

from rest_framework import serializers
from . import apiary_permissions as apiary_perms
from .models import (
    Apiary, Hornet, Nest, Species, Trap, TrapEvent, TrapPhoto, TrapType, User,
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



class NestSerializer(GPSValidationMixin, serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    class Meta:
        model = Nest
        fields = ['id', 'longitude', 'latitude', 'public_place', 'address', 'destroyed', 'destroyed_at', 'created_at', 'created_by', 'comments', 'archived', 'archived_at']
        read_only_fields = ['id', 'created_at', 'archived', 'archived_at']
    
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

    def validate_address(self, value: str) -> str:
        # Allow empty address
        if not value or value.strip() == '':
            return value
        
        if len(value) > 255:
            raise serializers.ValidationError("Address must be 255 characters or less.")
        
        return value

class PublicNestSerializer(GPSValidationMixin, serializers.ModelSerializer):
    """
    Serializer for public access to destroyed nests.
    Excludes sensitive information like created_by.
    """
    class Meta:
        model = Nest
        fields = ['id', 'longitude', 'latitude', 'public_place', 'address', 'destroyed', 'destroyed_at', 'created_at', 'comments', 'archived', 'archived_at']
        read_only_fields = ['id', 'created_at', 'archived', 'archived_at']

class ApiarySerializer(GPSValidationMixin, serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    photo_thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Apiary
        fields = ['id', 'longitude', 'latitude', 'infestation_level', 'afsca_number',
                  'photo_url', 'photo_thumbnail_url', 'created_at', 'created_by', 'owner',
                  'comments']
        # The creator and the owner are set by the server, never by a form
        read_only_fields = ['id', 'created_at', 'created_by', 'owner']

    def get_photo_url(self, instance) -> Optional[str]:
        return instance.photo.url if instance.photo else None

    def get_photo_thumbnail_url(self, instance) -> Optional[str]:
        return instance.photo_thumbnail.url if instance.photo_thumbnail else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['created_by'] = user_summary(instance.created_by)
        data['owner'] = user_summary(instance.owner)
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
                'update': apiary_perms.has_apiary_permission(request, instance, apiary_perms.UPDATE),
                'delete': apiary_perms.has_apiary_permission(request, instance, apiary_perms.DELETE),
                'share': apiary_perms.can_share_apiary(request, instance),
            }
        return data

    def validate_afsca_number(self, value: str) -> str:
        return value.strip()

    def validate_infestation_level(self, value: int) -> int:
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
        fields = ['id', 'slug', 'name', 'description', 'sort_order',
                  'photo_url', 'photo_thumbnail_url', 'trap_count']
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
        return super().create(validated_data)


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
                  'species_slug', 'quantity', 'batch', 'comments', 'photos', 'created_at']
        read_only_fields = ['id', 'trap', 'performed_by', 'species', 'batch', 'created_at']

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
            if not quantity:
                raise serializers.ValidationError(
                    {'quantity': "A catch requires a quantity of at least 1."}
                )
        elif species is not None or quantity is not None:
            raise serializers.ValidationError(
                "Only a catch can carry a species and a quantity."
            )
        return attrs


class CatchItemSerializer(serializers.Serializer):
    species_slug = serializers.SlugRelatedField(
        source='species', slug_field='slug', queryset=Species.objects.all(),
    )
    quantity = serializers.IntegerField(min_value=1)


class CatchSerializer(serializers.Serializer):
    """
    One visit's findings: a quantity per species, recorded as one catch event
    per species. Write-only, the response is the list of created events.
    """

    performed_at = serializers.DateTimeField()
    comments = serializers.CharField(required=False, allow_blank=True, default='')
    items = CatchItemSerializer(many=True, allow_empty=False)

    def to_internal_value(self, data):
        # A multipart request (the one carrying photos) sends the items as JSON
        items = data.get('items')
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except ValueError as exc:
                raise serializers.ValidationError({'items': "Invalid JSON."}) from exc
            data = {key: data.get(key) for key in data if key != 'items'} | {'items': items}
        return super().to_internal_value(data)

    def validate_items(self, items):
        slugs = [item['species'].slug for item in items]
        if len(slugs) != len(set(slugs)):
            raise serializers.ValidationError("Each species can appear only once.")
        return items


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

    class Meta:
        model = Trap
        fields = ['id', 'latitude', 'longitude', 'address', 'active', 'visibility',
                  'trap_type', 'trap_type_slug', 'photo_url', 'photo_thumbnail_url',
                  'installed_at', 'comments', 'hornet_catch_count', 'owner', 'group',
                  'last_event_at', 'tag_short', 'created_at', 'updated_at']
        # `active` is driven by the installation and removal events, never sent
        # by a form: DRF reads an absent boolean in form-data as False (the
        # unchecked-checkbox convention), which would store every new trap as
        # already put away.
        read_only_fields = ['id', 'owner', 'group', 'trap_type', 'active',
                            'hornet_catch_count', 'created_at', 'updated_at']

    def get_photo_url(self, instance) -> Optional[str]:
        return instance.photo.url if instance.photo else None

    def get_photo_thumbnail_url(self, instance) -> Optional[str]:
        return instance.photo_thumbnail.url if instance.photo_thumbnail else None

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
                'photo_thumbnail_url': (
                    instance.trap_type.photo_thumbnail.url
                    if instance.trap_type.photo_thumbnail else None
                ),
            }
            if instance.trap_type_id else None
        )
        return data

    def validate(self, attrs):
        visibility = attrs.get('visibility', getattr(self.instance, 'visibility', None))
        group = getattr(self.instance, 'group_id', None)
        if visibility == Trap.VISIBILITY_GROUP and not group:
            # Setting a group goes through the delegation endpoint, so a trap
            # cannot become group-visible before it has one.
            raise serializers.ValidationError({
                'visibility': "Delegate the trap to a group before restricting its visibility.",
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
