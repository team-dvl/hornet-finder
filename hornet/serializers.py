from rest_framework import serializers
from .models import Hornet


class HornetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hornet
        fields = '__all__' 
        read_only_fields = ['id', 'created_at']

    def validate_direction(self, value):
        if not (0 <= value <= 365):
            raise serializers.ValidationError("Direction must be between 0 and 365.")
        return value