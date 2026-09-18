#!/usr/bin/env bash
set -uo pipefail

#
# Environment status report for Hornet Finder.
#
# Read-only: checks the worktree, the .env configuration, the compose stack,
# the storage (Docker volumes, ZFS datasets and snapshots), the running
# services, the certificates and the public endpoints, then prints a short
# report. Nothing is created, started or changed.
#
# Exit code: 0 when no check failed, 1 otherwise (warnings do not fail).
#

# get_script_dir will work with either zsh or bash
get_script_dir() {
    local SOURCE="${BASH_SOURCE[0]:-${(%):-%x}}"
    while [ -h "$SOURCE" ]; do
        local DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"
        SOURCE="$(readlink "$SOURCE")"
        [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
    done
    cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd
}

SCRIPT_DIR="$(get_script_dir)"

source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/volumes.sh"
source "$SCRIPT_DIR/lib/zfs.sh"

CHECK_NET=1
CERT_WARN_DAYS=14

print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Print a status report of the environment declared in .env. Read-only."
    echo ""
    echo "Options:"
    echo "  --no-net            Skip network checks (HTTPS endpoints, served certificate)"
    echo "  -h, --help          Display this help"
    echo ""
    echo "Exit code: 0 when no check failed, 1 otherwise."
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-net)
            CHECK_NET=0
            shift
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            print_help
            exit 1
            ;;
    esac
done

# --- Report helpers ---------------------------------------------------------

OK_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

section() { echo ""; echo "== $1"; }
ok()      { echo "  ✅ $1"; ((OK_COUNT++)); }
warn()    { echo "  ⚠️  $1"; ((WARN_COUNT++)); }
fail()    { echo "  ❌ $1"; ((FAIL_COUNT++)); }
info()    { echo "     $1"; }

# cert_days_left prints the number of days before the PEM on stdin expires
cert_days_left() {
    local end
    end=$(openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2) || return 1
    [[ -n "$end" ]] || return 1
    echo $(( ($(date -d "$end" +%s) - $(date +%s)) / 86400 ))
}

# report_cert_expiry turns a days-left value into an ok/warn/fail line
report_cert_expiry() {
    local label="$1" days="$2"
    if (( days < 0 )); then
        fail "$label: EXPIRED $(( -days )) day(s) ago"
    elif (( days < CERT_WARN_DAYS )); then
        warn "$label: expires in $days day(s)"
    else
        ok "$label: valid, expires in $days day(s)"
    fi
}

# --- Worktree ----------------------------------------------------------------

cd "$SCRIPT_DIR"

section "Worktree"
info "Path:   $SCRIPT_DIR"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    info "Branch: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"
    if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
        warn "Tracked files have uncommitted changes"
    else
        ok "Working tree clean (tracked files)"
    fi
else
    warn "Not a git worktree"
fi

# --- Configuration ------------------------------------------------------------

section "Configuration (.env)"
if [[ ! -f .env ]]; then
    fail "Missing .env (copy .env.example and adjust it)"
    echo ""
    echo "Aborting: nothing else can be checked without .env"
    exit 1
fi
load_env
MODE=$(get_configured_environment) || exit 1
ok "APP_ENV=$MODE"

REQUIRED_VARS=(COMPOSE_FILE HOST KC_HOSTNAME DB_PASSWORD KEYCLOAK_DB_PASSWORD
               DJANGO_SECRET_KEY KC_CLIENT_ID KC_CLIENT_SECRET KC_BOOTSTRAP_ADMIN_PASSWORD
               API_DB_VOLUME KEYCLOAK_DB_VOLUME)
[[ "$MODE" == "prod" ]] && REQUIRED_VARS+=(FRONTEND_DIST_VOLUME)
missing=() placeholders=()
for v in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!v:-}" ]]; then
        missing+=("$v")
    elif [[ "${!v}" == *change-this* ]]; then
        placeholders+=("$v")
    fi
done
if (( ${#missing[@]} )); then
    fail "Missing variable(s): ${missing[*]}"
else
    ok "All required variables set (${#REQUIRED_VARS[@]})"
fi
if (( ${#placeholders[@]} )); then
    fail "Placeholder value(s) still in use: ${placeholders[*]}"
fi
info "HOST=${HOST:-?}  KC_HOSTNAME=${KC_HOSTNAME:-?}  KC_CLIENT_ID=${KC_CLIENT_ID:-?}"
info "BIND_IP=${BIND_IP:-0.0.0.0}  PROXY_PORT=${PROXY_PORT:-80}  PROXY_SSL_PORT=${PROXY_SSL_PORT:-443}"

# --- Compose stack ------------------------------------------------------------

section "Compose stack"
if [[ -n "${COMPOSE_FILE:-}" ]]; then
    IFS="${COMPOSE_PATH_SEPARATOR:-:}" read -r -a compose_files <<< "$COMPOSE_FILE"
    files_missing=0
    for f in "${compose_files[@]}"; do
        if [[ -f "$f" ]]; then
            info "$f"
        else
            fail "Compose file not found: $f"
            files_missing=1
        fi
    done
    if [[ "$files_missing" == 0 ]]; then
        if [[ "$MODE" == "dev" && "$COMPOSE_FILE" != *docker-compose.dev.yml* ]] || \
           [[ "$MODE" == "prod" && "$COMPOSE_FILE" != *docker-compose.prod.yml* ]]; then
            fail "COMPOSE_FILE does not match APP_ENV=$MODE"
        fi
        if [[ "$COMPOSE_FILE" != *external-volumes* ]]; then
            warn "No external-volumes overlay in COMPOSE_FILE: data volumes are managed by Compose"
        fi
    fi
else
    fail "COMPOSE_FILE not set: docker compose cannot find the stack"
fi

if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon not reachable"
    DOCKER_OK=0
else
    DOCKER_OK=1
    if config_err=$(docker compose config --quiet 2>&1); then
        ok "docker compose config resolves"
        expected=$(managed_volumes | wc -l)
        external=$(docker compose config --format yaml 2>/dev/null | grep -c 'external: true' || true)
        if [[ "$COMPOSE_FILE" == *external-volumes* ]]; then
            if (( external == expected )); then
                ok "$external external volume(s) declared, matching .env"
            else
                fail "$external external volume(s) in compose but $expected declared in .env"
            fi
        fi
    else
        fail "docker compose config failed:"
        info "${config_err//$'\n'/$'\n'     }"
    fi
fi

# --- Storage ------------------------------------------------------------------

section "Storage"
if [[ -z "$(managed_volumes)" ]]; then
    fail "No volume declared in .env"
elif [[ "$DOCKER_OK" == 1 ]]; then
    while read -r v; do
        if docker_volume_exists "$v"; then
            ok "Docker volume $v ($(docker volume inspect "$v" --format '{{.Driver}}'))"
        else
            fail "Docker volume $v missing (run ./storage-init.sh)"
        fi
    done < <(managed_volumes)
fi

if zfs_backend_configured; then
    if ! command -v zfs >/dev/null 2>&1; then
        fail "ZFS_PARENT=$ZFS_PARENT but the zfs command is not available"
    elif ! dataset_exists "$ZFS_PARENT"; then
        fail "Parent dataset $ZFS_PARENT does not exist"
    else
        ok "ZFS backend: $ZFS_PARENT"
        while read -r v; do
            d=$(dataset_for_volume "$v")
            if dataset_exists "$d"; then
                read -r used avail < <(zfs list -H -o used,avail "$d")
                snaps=$(zfs list -H -t snapshot -o name "$d" 2>/dev/null | wc -l)
                latest=$(zfs list -H -t snapshot -o name,creation -s creation "$d" 2>/dev/null | tail -1 | cut -f2)
                ok "Dataset $d: used $used, avail $avail, $snaps snapshot(s)"
                if [[ -n "$latest" ]]; then
                    info "latest snapshot: $latest"
                else
                    warn "no snapshot yet for $v"
                fi
            else
                fail "Dataset $d missing (run ./storage-init.sh)"
            fi
        done < <(managed_volumes)
    fi
else
    info "ZFS_PARENT not set: plain local Docker volumes"
fi

# --- Services -----------------------------------------------------------------

section "Services"
if [[ "$DOCKER_OK" == 1 ]] && docker compose config --quiet >/dev/null 2>&1; then
    running=0 total=0
    while read -r svc; do
        [[ -n "$svc" ]] || continue
        ((total++))
        state=$(docker compose ps -a --format '{{.Service}} {{.State}} {{.Status}}' 2>/dev/null | awk -v s="$svc" '$1==s {print $2" ("substr($0, index($0,$3))")"}')
        if [[ "$state" == running* ]]; then
            ok "$svc: $state"
            ((running++))
        elif [[ -z "$state" ]]; then
            fail "$svc: not created"
        else
            fail "$svc: $state"
        fi
    done < <(docker compose config --services 2>/dev/null)
    if (( total > 0 && running == 0 )); then
        info "Stack is down. Start it with ./deploy.sh"
    fi
else
    warn "Skipped: compose stack not resolvable"
fi

# --- Certificates -------------------------------------------------------------

section "Certificates"
CERT_DIR="certbot"
[[ "$MODE" == "dev" ]] && CERT_DIR="certbot-dev"
CERT_FILE="$CERT_DIR/conf/live/${HOST}/fullchain.pem"
if [[ -r "$CERT_FILE" ]]; then
    days=$(cert_days_left < "$CERT_FILE") && report_cert_expiry "Local $CERT_FILE" "$days"
elif sudo -n test -r "$CERT_FILE" 2>/dev/null; then
    days=$(sudo -n cat "$CERT_FILE" | cert_days_left) && report_cert_expiry "Local $CERT_FILE" "$days"
elif sudo -n true 2>/dev/null; then
    fail "No certificate at $CERT_FILE (run ./deploy-certs.sh)"
else
    warn "Cannot read $CERT_FILE (root only, no passwordless sudo); see the served certificate below"
fi

# --- Network ------------------------------------------------------------------

if [[ "$CHECK_NET" == 1 ]]; then
    section "Endpoints"
    check_http() {
        local label="$1" url="$2" expect="$3" code
        code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$url" 2>/dev/null) || true
        if [[ ! "$code" =~ ^[1-9][0-9]{2}$ ]]; then
            fail "$label: no answer ($url)"
        elif [[ " $expect " == *" $code "* ]]; then
            ok "$label: HTTP $code"
        else
            warn "$label: HTTP $code (expected $expect)"
        fi
    }
    realm="hornet-finder"
    [[ "$MODE" == "dev" ]] && realm="hornet-finder-dev"
    check_http "Application  https://${HOST}/" "https://${HOST}/" "200"
    check_http "Keycloak     https://${KC_HOSTNAME}/realms/${realm}" "https://${KC_HOSTNAME}/realms/${realm}" "200"
    # Without a token the API answers 400/401/403: any of them proves Django is up
    check_http "API          https://${HOST}/api/hornets/" "https://${HOST}/api/hornets/" "400 401 403"

    if days=$(timeout 10 openssl s_client -connect "${HOST}:443" -servername "$HOST" </dev/null 2>/dev/null | cert_days_left); then
        report_cert_expiry "Served certificate for $HOST" "$days"
    else
        fail "No TLS handshake with ${HOST}:443"
    fi
fi

# --- Summary ------------------------------------------------------------------

echo ""
echo "== Summary: $OK_COUNT ok, $WARN_COUNT warning(s), $FAIL_COUNT failure(s)"
(( FAIL_COUNT == 0 ))
