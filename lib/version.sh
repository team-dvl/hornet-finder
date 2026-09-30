#!/usr/bin/env bash
#
# Version helpers. The single source of truth is the git tag `vMAJOR.MINOR.PATCH`
# (semver); nothing else stores the version by hand.
#

# app_version prints the version of the checked-out commit, without the "v":
#   1.4.0                  the commit is exactly the tag v1.4.0
#   1.4.0-7-g3d79b93       7 commits after v1.4.0 (git describe)
#   ...-dirty              uncommitted changes in the worktree
#   0.0.0-<sha>            no tag reachable yet
app_version() {
    local root="${1:-.}" described
    if described=$(git -C "$root" describe --tags --match 'v[0-9]*' --dirty 2>/dev/null); then
        echo "${described#v}"
    else
        echo "0.0.0-$(git -C "$root" describe --always --dirty 2>/dev/null || echo unknown)"
    fi
}

# export_app_version exports APP_VERSION, read by the compose files and passed
# to the frontend build (VITE_APP_VERSION).
export_app_version() {
    APP_VERSION="$(app_version "${SCRIPT_DIR:-.}")"
    export APP_VERSION
}
