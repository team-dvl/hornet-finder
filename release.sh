#!/usr/bin/env bash
set -euo pipefail

#
# Cut a release: move CHANGELOG.md's [Unreleased] section under the new version,
# commit it and create the annotated tag vX.Y.Z (semver). Run it from the dev
# worktree, on the `devel` branch. Nothing is pushed unless --push is given.
#

SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
source "$SCRIPT_DIR/lib/version.sh"

BRANCH="devel"
REPO_URL="https://github.com/team-dvl/hornet-finder"
CHANGELOG="$SCRIPT_DIR/CHANGELOG.md"
PUSH=0
DRY_RUN=0
BUMP=""

print_help() {
    echo "Usage: $0 <major|minor|patch|X.Y.Z> [--push] [--dry-run]"
    echo ""
    echo "  major|minor|patch   Bump the last released version (git tag v*)"
    echo "  X.Y.Z               Use this exact version"
    echo "  --push              Push $BRANCH and the tag to origin"
    echo "  --dry-run           Show what would happen, change nothing"
    echo "  -h, --help          Display this help"
}

die() { echo "❌ $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
    case $1 in
        --push) PUSH=1; shift ;;
        --dry-run) DRY_RUN=1; shift ;;
        -h|--help) print_help; exit 0 ;;
        -*) print_help >&2; die "Unknown option: $1" ;;
        *) [[ -z "$BUMP" ]] || die "Only one version argument"; BUMP="$1"; shift ;;
    esac
done
[[ -n "$BUMP" ]] || { print_help >&2; exit 1; }

cd "$SCRIPT_DIR"

[[ "$(git rev-parse --abbrev-ref HEAD)" == "$BRANCH" ]] || die "Releases are cut from the $BRANCH branch"
[[ -z "$(git status --porcelain)" ]] || die "The worktree has uncommitted changes"

# Last released version (0.0.0 when there is no tag yet)
LAST_TAG="$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true)"
LAST="${LAST_TAG#v}"
LAST="${LAST:-0.0.0}"
IFS=. read -r MAJOR MINOR PATCH <<<"$LAST"

case "$BUMP" in
    major) NEW="$((MAJOR + 1)).0.0" ;;
    minor) NEW="$MAJOR.$((MINOR + 1)).0" ;;
    patch) NEW="$MAJOR.$MINOR.$((PATCH + 1))" ;;
    *)
        [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Not a semver version: $BUMP"
        NEW="$BUMP"
        ;;
esac
TAG="v$NEW"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "Tag $TAG already exists"

# [Unreleased] must hold something to release
grep -q '^## \[Unreleased\]' "$CHANGELOG" || die "CHANGELOG.md has no [Unreleased] section"
NOTES="$(awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} /^\[.*\]: /{f=0} f' "$CHANGELOG" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')"
grep -q '[^[:space:]]' <<<"$NOTES" || die "[Unreleased] is empty: nothing to release"

echo "Release: ${LAST_TAG:-<no tag>} → $TAG"
echo "----"
echo "$NOTES"
echo "----"
if [[ "$DRY_RUN" == 1 ]]; then
    echo "(dry run: nothing changed)"
    exit 0
fi

DATE="$(date +%Y-%m-%d)"
OLD_LINKS="$(grep '^\[[^]]*\]: ' "$CHANGELOG" | grep -v "^\[Unreleased\]: \|^\[$NEW\]: " || true)"

# New section under [Unreleased]; the compare links block is rebuilt below
{
    awk -v new="$NEW" -v date="$DATE" '
        /^\[[^]]*\]: / { next }
        /^## \[Unreleased\]/ { print; print ""; print "## [" new "] - " date; next }
        { print }
    ' "$CHANGELOG" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}'
    echo ""
    echo "[Unreleased]: $REPO_URL/compare/$TAG...HEAD"
    if [[ -n "$LAST_TAG" ]]; then
        echo "[$NEW]: $REPO_URL/compare/$LAST_TAG...$TAG"
    else
        echo "[$NEW]: $REPO_URL/releases/tag/$TAG"
    fi
    [[ -z "$OLD_LINKS" ]] || echo "$OLD_LINKS"
} > "$CHANGELOG.new"
mv "$CHANGELOG.new" "$CHANGELOG"

git add CHANGELOG.md
git commit -q -m "chore: release $TAG"
git tag -a "$TAG" -m "Velutina $NEW" -m "$NOTES"
echo "✅ Committed and tagged $TAG (app version: $(app_version))"

if [[ "$PUSH" == 1 ]]; then
    git push -u origin "$BRANCH" "$TAG"
else
    echo "Push with: git push -u origin $BRANCH $TAG"
fi
