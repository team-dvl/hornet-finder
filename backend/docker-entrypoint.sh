#!/bin/bash
set -e

echo "Waiting for PostgreSQL to be ready..."
while ! nc -z "$DB_HOST" 5432; do
  sleep 1
done
echo "PostgreSQL is up!"

#python manage.py migrate hornet 0002 --fake --noinput
python manage.py migrate --noinput
python manage.py collectstatic --noinput

gunicorn hornet_finder_api.wsgi:application --bind 0.0.0.0:8000 --access-logfile -
