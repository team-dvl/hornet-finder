from rest_framework import serializers
from .models import Hornet, Nest, Apiary
from hornet_finder_api.utils import user_exists


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
    class Meta:
        model = Hornet
        fields = ['id', 'longitude', 'latitude', 'direction', 'duration', 'mark_color_1', 'mark_color_2', 'created_at', 'created_by', 'linked_nest']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = { # Adding this to make the validation limits understandable by the swagger
            'direction': {
                'min_value': 0,
                'max_value': 359,
            },
            'duration': {
                'min_value': 0,
            },
        }

    def validate_direction(self, value: int) -> int:
        if not (0 <= value <= 359):
            raise serializers.ValidationError("Direction must be between 0 and 359.")
        return value

    def validate_duration(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("Duration must be a positive integer.")
        return value

    def validate(self, data):
        # Validation croisée pour les couleurs
        mark_color_1 = data.get('mark_color_1', '')
        mark_color_2 = data.get('mark_color_2', '')
        
        if mark_color_1 and mark_color_2 and mark_color_1 == mark_color_2:
            raise serializers.ValidationError("Les deux marques de couleur ne peuvent pas être identiques.")
        
        return data

class NestSerializer(GPSValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Nest
        fields = ['id', 'longitude', 'latitude', 'public_place', 'address', 'destroyed', 'destroyed_at', 'created_at', 'created_by', 'comments']
        read_only_fields = ['id', 'created_at']
    
    def to_representation(self, instance):
        """
        Override to conditionally include created_by field.
        Only show created_by to the creator of the nest or to admins.
        """
        data = super().to_representation(instance)
        
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user = request.user
            # Show created_by if user is admin or is the creator
            if 'admin' in getattr(user, 'roles', []) or instance.created_by == user.username:
                return data
        
        # Remove created_by for other authenticated users
        data.pop('created_by', None)
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
        fields = ['id', 'longitude', 'latitude', 'public_place', 'address', 'destroyed', 'destroyed_at', 'created_at', 'comments']
        read_only_fields = ['id', 'created_at']

class ApiarySerializer(GPSValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Apiary
        fields = ['id', 'longitude', 'latitude', 'infestation_level', 'created_at', 'created_by', 'comments']
        read_only_fields = ['id', 'created_at']
    
    def validate_infestation_level(self, value: int) -> int:
        valid_levels = [choice[0] for choice in Apiary.INFESTATION_LEVEL_CHOICES]
        if value not in valid_levels:
            raise serializers.ValidationError(f"Infestation level must be one of {valid_levels}.")
        return value
