FROM quay.io/keycloak/keycloak:26.2 AS builder
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=false
ENV KC_FEATURES=token-exchange,recovery-codes
ENV KC_DB=postgres
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.2
COPY --from=builder /opt/keycloak/ /opt/keycloak/
WORKDIR /opt/keycloak

# Copier le thème personnalisé
COPY themes/ /opt/keycloak/themes/

COPY docker-entrypoint.sh /opt/keycloak/docker-entrypoint.sh

ENTRYPOINT ["/opt/keycloak/docker-entrypoint.sh"]
