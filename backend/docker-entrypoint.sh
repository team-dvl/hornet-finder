#!/bin/bash
set -e

echo "Waiting for PostgreSQL to be ready..."
while ! nc -z "$DB_HOST" 5432; do
  sleep 1
done
echo "PostgreSQL is up!"

if python manage.py migrate --check --noinput >/dev/null 2>&1; then
    echo "[MIGRATION] Database up to date, nothing to apply."
    python manage.py migrate --noinput
else
    echo "[MIGRATION] Pending migrations detected, applying now..."
    python manage.py migrate --noinput
    echo "[MIGRATION] Migrations applied."
fi

python manage.py collectstatic --noinput

gunicorn hornet_finder_api.wsgi:application --bind 0.0.0.0:8000 --access-logfile -
