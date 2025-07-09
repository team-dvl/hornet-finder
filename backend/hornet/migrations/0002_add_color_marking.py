# Generated manually for hornet color marking feature

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hornet', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='hornet',
            name='mark_color_1',
            field=models.CharField(blank=True, choices=[('', 'Aucune couleur'), ('red', 'Rouge'), ('blue', 'Bleu'), ('yellow', 'Jaune'), ('green', 'Vert'), ('orange', 'Orange'), ('purple', 'Violet'), ('pink', 'Rose'), ('brown', 'Marron'), ('white', 'Blanc'), ('black', 'Noir'), ('gray', 'Gris'), ('cyan', 'Cyan'), ('magenta', 'Magenta'), ('lime', 'Vert citron')], default='', max_length=20),
        ),
        migrations.AddField(
            model_name='hornet',
            name='mark_color_2',
            field=models.CharField(blank=True, choices=[('', 'Aucune couleur'), ('red', 'Rouge'), ('blue', 'Bleu'), ('yellow', 'Jaune'), ('green', 'Vert'), ('orange', 'Orange'), ('purple', 'Violet'), ('pink', 'Rose'), ('brown', 'Marron'), ('white', 'Blanc'), ('black', 'Noir'), ('gray', 'Gris'), ('cyan', 'Cyan'), ('magenta', 'Magenta'), ('lime', 'Vert citron')], default='', max_length=20),
        ),
    ]
