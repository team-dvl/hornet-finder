"""
The weather at an apiary at a given hour, from Open-Meteo (open data, CC BY
4.0, no key): https://open-meteo.com. Values of weather models to the hour,
not a measurement on the spot: a grid of a few km for recent days (forecast
models), coarser for days older than RECENT_DAYS (reanalysis, about 10 to
30 km).

The server asks, never the browser: the person's IP address stays with us,
and the position sent is rounded to 0.01° (about 1 km), so the apiary itself
is not given away.
"""

import datetime
import json
import logging
import urllib.parse
import urllib.request

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
# Older days come from the archive (ERA5), the recent ones from the forecast models
ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
RECENT_DAYS = 80
HOURLY = ['temperature_2m', 'precipitation', 'cloud_cover', 'wind_speed_10m', 'weather_code']
TIMEOUT_SECONDS = 8

# WMO weather interpretation codes, grouped (https://open-meteo.com/en/docs)
SUMMARY_OF_CODE = {
    0: 'clear', 1: 'mostly_clear', 2: 'partly_cloudy', 3: 'overcast',
    45: 'fog', 48: 'fog',
    51: 'drizzle', 53: 'drizzle', 55: 'drizzle', 56: 'drizzle', 57: 'drizzle',
    61: 'rain', 63: 'rain', 65: 'rain', 66: 'rain', 67: 'rain',
    71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow', 85: 'snow', 86: 'snow',
    80: 'showers', 81: 'showers', 82: 'showers',
    95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
}


class WeatherUnavailable(Exception):
    """Open-Meteo did not answer, or not with the hour asked."""


def _get(url, params):
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(f"{url}?{query}", headers={'User-Agent': 'velutina-apiculture'})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # nosec: fixed host
        return json.loads(response.read().decode())


def at_apiary(latitude: float, longitude: float, when: datetime.datetime) -> dict:
    """
    The weather of the hour nearest `when` (aware datetime) around the apiary:
    temperature (°C), precipitation (mm in the hour), wind (km/h at 10 m),
    cloud cover (%) and a general summary.
    """
    if not getattr(settings, 'WEATHER_ENABLED', True):
        raise WeatherUnavailable('disabled')
    utc = when.astimezone(datetime.timezone.utc)
    hour = utc.replace(minute=0, second=0, microsecond=0)
    if utc.minute >= 30 and (hour + datetime.timedelta(hours=1)).date() == hour.date():
        hour += datetime.timedelta(hours=1)
    day = hour.date().isoformat()
    recent = (timezone.now().date() - hour.date()).days <= RECENT_DAYS
    try:
        data = _get(FORECAST_URL if recent else ARCHIVE_URL, {
            'latitude': round(latitude, 2), 'longitude': round(longitude, 2), 'hourly': ','.join(HOURLY),
            'timezone': 'UTC', 'start_date': day, 'end_date': day, 'wind_speed_unit': 'kmh',
        })
        hourly = data['hourly']
        index = hourly['time'].index(hour.strftime('%Y-%m-%dT%H:%M'))
    except (OSError, ValueError, KeyError) as exc:
        logger.warning("Open-Meteo gave no weather for %s: %s", day, exc)
        raise WeatherUnavailable(str(exc)) from exc

    def value(name):
        values = hourly.get(name) or []
        return values[index] if index < len(values) else None

    code = value('weather_code')
    cover = value('cloud_cover')
    return {
        'temperature': value('temperature_2m'),
        'precipitation': value('precipitation'),
        'wind': value('wind_speed_10m'),
        'cloud_cover': round(cover) if cover is not None else None,
        'summary': SUMMARY_OF_CODE.get(code, '') if code is not None else '',
        'hour': hour.isoformat(),
        'source': 'open-meteo',
    }
