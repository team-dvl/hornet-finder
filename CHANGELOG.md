# Changelog

All notable changes are listed here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/): the git tag `vMAJOR.MINOR.PATCH` is
the source of truth, `./release.sh` cuts a release (see `doc/VERSIONING.md`).

Write entries under `[Unreleased]` as the work is done, in the sections `Added`,
`Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

## [Unreleased]

### Added
- Group administration (Administration → Mon groupe, "Groupes" for platform admins):
  the members of a beekeeper group, listed by name, and the invitations, now in a
  second tab. An administrator of the group removes a member; naming or dismissing
  an administrator, and removing one, is for platform admins, and a group always
  keeps at least one administrator. A removal reaches the person's connection
  within the hour at most.
- The coverage and pressure maps can be drawn on hexagons instead of 250 m
  squares ("Maille" selector under the map, `grid=hex` in the API): cells of the
  same area (6.25 ha), six neighbours at the same distance, same totals.
- Species can be reordered by an administrator (Administration → Espèces, "Ordre"
  button): move up / move down on each row. New species are added at the end.

### Changed
- The invitations page moved to Administration → Mon groupe (`/admin/group`); the
  old `/admin/invitations` address redirects there.

### Removed
- The "display order" number of the species form, replaced by the move buttons.

### Security
- Passwords need at least 12 characters and may not contain the username or the
  email address; they are checked when an account is created or a password is
  changed, existing passwords stay valid until then.
- After 10 failed sign-ins an account is locked for a minute, the wait doubling
  up to 15 minutes; a successful sign-in or the end of the wait unlocks it.
- An email address given by Facebook is no longer trusted as verified: a new
  Facebook account confirms its address by email, and one that matches an
  existing account must prove it owns that account before being linked. Google
  addresses are still trusted.
- A passkey used alone, without a password, must verify the user on the device
  (Face ID, fingerprint or device code); a security key without a PIN is
  refused. Sign-in with a password, Google or Facebook is unchanged.
- Sign-in requests of the application must carry a PKCE `S256` challenge in
  production too, as they already did in development.
- Platform administrators must enter a one-time code when they sign in with a
  password, and are asked to set up an authenticator app at their first
  sign-in. The "My account" page follows the same sign-in flow as the
  application, so it no longer offers a way around the code. Group
  administrators and sign-in with Google or Facebook are not affected.
- Access tokens last 60 minutes instead of 3 hours, so a disabled account or a
  removed role stops working on the API within 60 minutes; the session itself
  lasts as long as before.


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
