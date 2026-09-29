# Changelog

All notable changes are listed here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/): the git tag `vMAJOR.MINOR.PATCH` is
the source of truth, `./release.sh` cuts a release (see `doc/VERSIONING.md`).

Write entries under `[Unreleased]` as the work is done, in the sections `Added`,
`Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

## [Unreleased]

### Added
- Version of the application shown in the menu, derived from the git tag.
- `release.sh` to cut a release (changelog + annotated tag `vX.Y.Z`).
- Invitations to join a beekeeper group (Administration → Invitations): an
  administrator of the group, or of the platform, invites an existing account by
  its full email address; 10 addresses without an account within 24 hours pause
  the invitations for 24 hours. The invitee answers from the landing page.
- Invitation emails, sent through the OVH MX Plan server in the layout of the
  Keycloak emails, with a link to `/invitations` that signs the visitor in first,
  then opens the landing page, where the pending invitations come first.
- A reminder can be emailed to the invitee from the pending invitations, at most
  once per 24 hours.

### Changed
- Groups are shown by their Keycloak description (e.g. "Vedrin s'abeille")
  instead of the `fancy_name` attribute, in invitations, delegation and sharing.
