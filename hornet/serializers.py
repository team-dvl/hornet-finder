from rest_framework import serializers
from .models import Hornet, Nest


class HornetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hornet
        fields = '__all__' 
        read_only_fields = ['id', 'created_at']

    def validate_direction(self, value):
        if not (0 <= value <= 359):
            raise serializers.ValidationError("Direction must be between 0 and 359.")
        return value

class NestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Nest
        fields = ['id', 'longitude', 'latitude', 'destroyed', 'created_at']
        read_only_fields = ['id', 'created_at']