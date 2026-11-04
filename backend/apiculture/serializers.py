import datetime
from typing import Optional

from django.utils import timezone

from rest_framework import serializers

from hornet.models import Apiary, unique_slug
from hornet.serializers import user_summary

from . import permissions as perms
from .models import Colony, Hive, HiveType, Inspection, Visit, VisitPhoto


class HiveTypeSerializer(serializers.ModelSerializer):
    hive_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = HiveType
        fields = ['id', 'slug', 'name', 'description', 'sort_order', 'bar_family', 'max_bars',
                  'bars_per_box', 'max_colonies', 'portable', 'hive_count']
        extra_kwargs = {
            'max_bars': {'min_value': 1, 'max_value': 99},
            'bars_per_box': {'min_value': 1, 'max_value': 30},
            'max_colonies': {'min_value': 1, 'max_value': 2},
        }
        # Same rule as the trap types: derived from the name, never typed
        read_only_fields = ['id', 'slug', 'hive_count']

    def validate(self, attrs):
        current = {name: getattr(self.instance, name, None)
                   for name in ('bar_family', 'max_bars', 'bars_per_box', 'max_colonies')}
        merged = {**current, **attrs}
        family = merged.get('bar_family') or ''
        errors = {}
        if family == HiveType.BAR_FAMILY_TOPBAR and not merged.get('max_bars'):
            errors['max_bars'] = "A top-bar hive has a maximum number of bars."
        if family == HiveType.BAR_FAMILY_WARRE and not merged.get('bars_per_box'):
            errors['bars_per_box'] = "A Warré hive has a number of bars per box."
        if family != HiveType.BAR_FAMILY_TOPBAR and (merged.get('max_colonies') or 1) > 1:
            errors['max_colonies'] = "Only a top-bar hive, split by a divider, holds two colonies."
        if errors:
            raise serializers.ValidationError(errors)
        # Fields that do not apply to the family are cleared, not kept stale
        if family != HiveType.BAR_FAMILY_TOPBAR:
            attrs['max_bars'] = None
        if family != HiveType.BAR_FAMILY_WARRE:
            attrs['bars_per_box'] = None
        return attrs

    def create(self, validated_data):
        validated_data['slug'] = unique_slug(HiveType, validated_data['name'])
        return super().create(validated_data)


def _apiary_summary(apiary) -> Optional[dict]:
    if apiary is None:
        return None
    return {'id': apiary.id, 'address': apiary.address, 'afsca_number': apiary.afsca_number}


class HiveSerializer(serializers.ModelSerializer):
    """
    A hive as read and edited. Where it stands, its owner and its keeper change
    through the actions of the viewset (`move`, `store`, `retire`, `keeper`),
    which keep their history; the creation alone sets them directly.
    """

    # The client may choose the identifier (creation offline)
    id = serializers.UUIDField(required=False)
    hive_type = serializers.PrimaryKeyRelatedField(queryset=HiveType.objects.all())

    class Meta:
        model = Hive
        fields = ['id', 'hive_type', 'name', 'number', 'status', 'commissioned_on', 'comments',
                  'created_at', 'updated_at']
        read_only_fields = ['status', 'created_at', 'updated_at']

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("A hive has a name.")
        return value

    def validate_number(self, value: str) -> str:
        return value.strip()

    def update(self, instance, validated_data):
        # The identifier is chosen once, at the creation: a new one would copy the row
        validated_data.pop('id', None)
        return super().update(instance, validated_data)

    def validate_hive_type(self, value):
        # Bars and colonies are about to depend on the type (colonies, visits):
        # a hive does not change type once created
        if self.instance is not None and value.pk != self.instance.hive_type_id:
            raise serializers.ValidationError("The type of a hive cannot be changed.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        summaries = self.context.get('user_summaries')

        def summary(user):
            if summaries is None or user is None:
                return user_summary(user)
            if user.pk not in summaries:
                summaries[user.pk] = user_summary(user)
            return summaries[user.pk]

        data['hive_type_name'] = instance.hive_type.name
        data['apiary'] = _apiary_summary(instance.apiary)
        if instance.owner_group_id:
            data['owner'] = {'kind': 'group', 'path': instance.owner_group.path,
                             'name': instance.owner_group.name}
        elif instance.owner_user_id:
            data['owner'] = {'kind': 'user', **summary(instance.owner_user)}
        else:
            data['owner'] = None
        data['keeper'] = summary(instance.keeper)
        hive_type = instance.hive_type
        data['bar_family'] = hive_type.bar_family
        data['max_bars'] = hive_type.max_bars
        data['bars_per_box'] = hive_type.bars_per_box
        data['max_colonies'] = hive_type.max_colonies
        data['portable'] = hive_type.portable
        data['divider_bar'] = instance.divider_bar
        # The living colonies, prefetched by the viewset as `living_colonies`
        living = getattr(instance, 'living_colonies', None)
        if living is None:
            living = instance.colonies.filter(ended_on__isnull=True)
        data['colonies'] = [colony_summary(colony) for colony in sorted(living, key=lambda c: c.compartment)]
        request = self.context.get('request')
        if request is not None:
            manage = perms.can_manage_hive(request, instance)
            tend = manage or perms.is_keeper(request, instance)
            data['permissions'] = {'edit': tend, 'move': tend, 'manage': manage}
        if self.context.get('with_history'):
            data['placements'] = [
                {'apiary': _apiary_summary(p.apiary), 'apiary_label': p.apiary_label,
                 'started_on': p.started_on, 'ended_on': p.ended_on}
                for p in instance.placements.select_related('apiary')
            ]
            data['custodies'] = [
                {'keeper': summary(c.keeper), 'started_on': c.started_on, 'ended_on': c.ended_on}
                for c in instance.custodies.select_related('keeper')
            ]
        return data


def colony_summary(colony) -> Optional[dict]:
    """A colony as named in another object's representation."""
    if colony is None:
        return None
    return {'id': str(colony.pk), 'name': colony.name, 'origin': colony.origin,
            'compartment': colony.compartment, 'bars': colony.bars, 'started_on': colony.started_on,
            'ended_on': colony.ended_on, 'requeening_since': colony.requeening_since,
            'laying_since': colony.laying_since, 'in_hive_since': in_hive_since(colony)}


def in_hive_since(colony):
    """Since when a living colony lives in its hive (its current stay), else None."""
    if colony.ended_on is not None:
        return None
    stays = getattr(colony, 'open_stays', None)
    if stays is None:
        stays = list(colony.occupancies.filter(ended_on__isnull=True))
    return stays[0].started_on if stays else None


class ColonySerializer(serializers.ModelSerializer):
    """
    A colony as read and edited. Where it lives and how it ends change through
    the actions of the viewset (`transfer`, `split`, `swarm`, `end`, `laying`),
    which keep their history; the creation alone sets its place.
    """

    id = serializers.UUIDField(required=False)

    class Meta:
        model = Colony
        fields = ['id', 'name', 'origin', 'compartment', 'bars', 'started_on', 'ended_on', 'end_cause',
                  'requeening_since', 'laying_since', 'comments', 'created_at', 'updated_at']
        read_only_fields = ['compartment', 'ended_on', 'end_cause', 'laying_since', 'created_at',
                            'updated_at']
        # Default: today, set by the view
        extra_kwargs = {'started_on': {'required': False}}

    def update(self, instance, validated_data):
        # The identifier is chosen once, at the creation: a new one would copy the row
        validated_data.pop('id', None)
        return super().update(instance, validated_data)

    def validate_name(self, value: str) -> str:
        return value.strip()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        hive = instance.hive
        data['hive'] = {'id': str(hive.pk), 'name': hive.name, 'number': hive.number,
                        'status': hive.status, 'hive_type_name': hive.hive_type.name,
                        'bar_family': hive.hive_type.bar_family, 'portable': hive.hive_type.portable,
                        'apiary': _apiary_summary(hive.apiary)}
        data['in_hive_since'] = in_hive_since(instance)
        data['parent'] = colony_summary(instance.parent)
        data['merged_into'] = colony_summary(instance.merged_into)
        request = self.context.get('request')
        if request is not None:
            tend = perms.can_tend_hive(request, hive)
            data['permissions'] = {'edit': tend, 'manage': perms.can_manage_hive(request, hive)}
        if self.context.get('with_history'):
            data['children'] = [colony_summary(child) for child in instance.children.all()]
            data['occupancies'] = [
                {'hive': {'id': str(stay.hive_id), 'name': stay.hive.name, 'number': stay.hive.number},
                 'compartment': stay.compartment, 'started_on': stay.started_on, 'ended_on': stay.ended_on}
                for stay in instance.occupancies.select_related('hive')
            ]
        return data


class InspectionSerializer(serializers.ModelSerializer):
    """One colony looked at during a visit; every observation is optional."""

    id = serializers.IntegerField(required=False)
    hive = serializers.PrimaryKeyRelatedField(queryset=Hive.objects.select_related('hive_type'), allow_null=True,
                                              required=False)
    colony = serializers.PrimaryKeyRelatedField(queryset=Colony.objects.select_related('hive__hive_type'),
                                                allow_null=True, required=False)

    class Meta:
        model = Inspection
        fields = ['id', 'hive', 'hive_label', 'colony', 'colony_label', 'compartment', 'queen_seen', 'eggs_seen',
                  'brood_seen', 'queen_cells', 'temper', 'activity', 'pollen', 'hornets', 'entrance_guard',
                  'feeding', 'feeding_amount', 'feeding_unit', 'bars', 'notes']
        read_only_fields = ['hive_label', 'colony_label', 'compartment']
        extra_kwargs = {'feeding_amount': {'min_value': 0}, 'bars': {'min_value': 0, 'max_value': 99}}

    @staticmethod
    def _one_of(value, allowed, field):
        if value and value not in allowed:
            raise serializers.ValidationError(f"Expected one of {', '.join(allowed)}.")
        return value

    def validate_temper(self, value):
        return self._one_of(value, Inspection.TEMPERS, 'temper')

    def validate_activity(self, value):
        return self._one_of(value, Inspection.ACTIVITIES, 'activity')

    def validate_hornets(self, value):
        return self._one_of(value, Inspection.HORNETS, 'hornets')

    def validate_feeding(self, value):
        return self._one_of(value, Inspection.FEEDINGS, 'feeding')

    def validate_feeding_unit(self, value):
        return self._one_of(value, Inspection.UNITS, 'feeding_unit')

    def validate(self, attrs):
        colony, hive = attrs.get('colony'), attrs.get('hive')
        if colony is not None:
            hive = hive or colony.hive
            if colony.hive_id != hive.pk:
                raise serializers.ValidationError({'colony': "This colony does not live in this hive."})
            attrs['hive'] = hive
        if hive is None and (self.instance is None or self.instance.hive_label == ''):
            # An inspection kept from a hive deleted since stays as it reads
            raise serializers.ValidationError({'hive': "An inspection is about a hive or a colony."})
        if not attrs.get('feeding'):
            attrs['feeding_amount'], attrs['feeding_unit'] = None, ''
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['hive'] = str(instance.hive_id) if instance.hive_id else None
        data['colony'] = str(instance.colony_id) if instance.colony_id else None
        data['bar_family'] = instance.hive.hive_type.bar_family if instance.hive_id else ''
        return data


class VisitPhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = VisitPhoto
        fields = ['id', 'inspection', 'image_url', 'thumbnail_url', 'created_at']

    def get_image_url(self, instance) -> str:
        return instance.image.url

    def get_thumbnail_url(self, instance) -> Optional[str]:
        return instance.thumbnail.url if instance.thumbnail else None


class VisitSerializer(serializers.ModelSerializer):
    """
    A visit as read and written. `participants` (GUIDs) and `inspections`
    (each colony looked at) are written with it; photos have their own action.
    """

    id = serializers.UUIDField(required=False)
    apiary = serializers.PrimaryKeyRelatedField(queryset=Apiary.objects.all(), required=False)
    kinds = serializers.ListField(child=serializers.ChoiceField(choices=Visit.KINDS), required=False)

    class Meta:
        model = Visit
        fields = ['id', 'apiary', 'started_at', 'duration_minutes', 'title', 'kinds', 'report', 'guest_names',
                  'weather_temperature', 'weather_precipitation', 'weather_wind', 'weather_cloud_cover',
                  'weather_summary', 'weather_source', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'duration_minutes': {'min_value': 1, 'max_value': 24 * 60},
            'weather_temperature': {'min_value': -40, 'max_value': 50},
            'weather_precipitation': {'min_value': 0, 'max_value': 500},
            'weather_wind': {'min_value': 0, 'max_value': 300},
            'weather_cloud_cover': {'min_value': 0, 'max_value': 100},
        }

    def update(self, instance, validated_data):
        validated_data.pop('id', None)
        # A visit stays where it took place
        validated_data.pop('apiary', None)
        return super().update(instance, validated_data)

    def validate_started_at(self, value):
        if value > timezone.now() + datetime.timedelta(minutes=15):
            raise serializers.ValidationError("A visit recorded here has taken place: not in the future.")
        return value

    def validate_title(self, value):
        return value.strip()

    def validate_weather_summary(self, value):
        if value and value not in Visit.WEATHER_SUMMARIES:
            raise serializers.ValidationError(f"Expected one of {', '.join(Visit.WEATHER_SUMMARIES)}.")
        return value

    def validate_weather_source(self, value):
        if value and value not in Visit.WEATHER_SOURCES:
            raise serializers.ValidationError("Expected 'open-meteo' or nothing.")
        return value

    def validate_guest_names(self, value):
        return value.strip()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['apiary'] = _apiary_summary(instance.apiary) if instance.apiary_id else None
        data['apiary_label'] = instance.apiary_label
        data['created_by'] = user_summary(instance.created_by)
        data['participants'] = [user_summary(user) for user in instance.participants.all()]
        data['inspections'] = InspectionSerializer(instance.inspections.all(), many=True).data
        data['photos'] = VisitPhotoSerializer(instance.photos.all(), many=True).data
        request = self.context.get('request')
        if request is not None:
            data['permissions'] = {'edit': perms.can_edit_visit(request, instance)}
        return data
