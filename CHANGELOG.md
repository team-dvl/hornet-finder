# Changelog

All notable changes are listed here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/): the git tag `vMAJOR.MINOR.PATCH` is
the source of truth, `./release.sh` cuts a release (see `doc/VERSIONING.md`).

Write entries under `[Unreleased]` as the work is done, in the sections `Added`,
`Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

## [Unreleased]

## [1.0.0] - 2026-09-30

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
- Statistics module (menu → Statistiques), for every signed-in user: Asian
  hornet catches per day, week or month, per trap and per week with a 95 %
  interval and the previous year alongside; catches per species; trap types
  compared (efficiency, selectivity); most active traps; coverage of the
  territory and catch pressure on a 250 m grid, also as layers of the map.
  Periods: last 7 or 30 days, month, season (spring, summer,
  summer-autumn-winter), year, free dates. Totals count every trap; anything
  located (zone, map, trap list) only the traps the user can see.
- Each table as a list or as charts, and exported to Excel, PDF (with its
  charts) or CSV; maps to Excel or CSV. In the installed app the file goes
  through the share sheet (print, save to Files, other apps). A link to the
  files can be emailed to the signed-in user (download page valid one hour, ten
  downloads).

### Changed
- A trap visit is recorded as a reading ("Relevé"), zero catches included,
  with the maintenance done on the spot (cleaning, refill, repair) and whether
  the other species were counted.
- The infestation level of an apiary is optional ("Non évalué").
- New app icon: an Asian hornet traced after a photo, in a target on the yellow
  of the Vedrin s'abeille logo; the dev icon is purple with a red "DEV" band.
  Full-bleed icons (maskable on Android, opaque on iOS) fill the home-screen
  shape instead of showing black corners or a white disc. Icon URLs carry a hash
  of their content, so no cache keeps an old icon. Sources and build in
  `frontend/icons/`.
- Groups are shown by their Keycloak description (e.g. "Vedrin s'abeille")
  instead of the `fancy_name` attribute, in invitations, delegation and sharing.

### Fixed
- The dev PWA added to an iPhone home screen got the prod icon: Safari also
  fetches `/apple-touch-icon.png` on its own, which the dev server now answers
  with the dev icon.

### Security
- PyJWT updated from 2.13.0 to 2.15.1 (GHSA-r6x4-923q-g947, GHSA-w2cx-738m-mc7w,
  GHSA-9v7f-9g4p-ffgj). Token validation only accepts RS256/PS256, so the
  algorithm-confusion flaws were not reachable; `PyJWKClient` redirect handling
  is fixed.

[Unreleased]: https://github.com/team-dvl/hornet-finder/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/team-dvl/hornet-finder/releases/tag/v1.0.0
