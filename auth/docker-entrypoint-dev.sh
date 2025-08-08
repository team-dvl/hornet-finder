#!/bin/bash
set -e

echo "Starting Keycloak in DEV mode for local testing..."

# Force DEV mode for local testing
exec /opt/keycloak/bin/kc.sh start-dev \
  --db postgres \
  --db-url "jdbc:postgresql://hornet-finder-dev-keycloak-db/keycloak_dev" \
  --db-username keycloak_dev \
  --db-password "$DEV_KEYCLOAK_DB_PASSWORD" \
  --hostname "auth.dev.velutina.ovh" \
  --hostname-strict=false \
  --proxy-headers xforwarded \
  --import-realm
