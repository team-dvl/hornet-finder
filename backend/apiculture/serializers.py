from typing import Optional

from rest_framework import serializers

from hornet.models import unique_slug
from hornet.serializers import user_summary

from . import permissions as perms
from .models import Hive, HiveType


class HiveTypeSerializer(serializers.ModelSerializer):
    hive_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = HiveType
        fields = ['id', 'slug', 'name', 'description', 'sort_order', 'bar_family', 'max_bars',
                  'bars_per_box', 'max_colonies', 'hive_count']
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
