#!/bin/bash
set -e

if [ "$KC_HOSTNAME" = "0.0.0.0:8080" ]; then
  echo "Starting in DEV mode..."
  exec /opt/keycloak/bin/kc.sh start-dev --db-url "jdbc:postgresql://hornet-finder-keycloak-db/keycloak" --db postgres --db-username keycloak --db-password "$KC_DB_PASSWORD" --hostname "localhost" --hostname-strict=false

else
  echo "Starting in PROD mode..."
  exec /opt/keycloak/bin/kc.sh start --optimized --http-enabled=true --db-url-host hornet-finder-keycloak-db --db-username keycloak --db-password "$KC_DB_PASSWORD" --proxy-headers xforwarded
fi
