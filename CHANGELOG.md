# Changelog

All notable changes are listed here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/): the git tag `vMAJOR.MINOR.PATCH` is
the source of truth, `./release.sh` cuts a release (see `doc/VERSIONING.md`).

Write entries under `[Unreleased]` as the work is done, in the sections `Added`,
`Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

## [Unreleased]

### Added
- Help panel: the documentation opens in a panel sliding in from the right, over the
  page and over any dialog (nothing typed is lost; Back or Escape close the panel
  first). A help tip linked to the documentation ends with "Documentation
  complète", which opens it at the right section (with a mouse, a click on the icon
  does the same); about thirty tips of the traps, nests, apiaries and statistics
  modules are linked. In the panel: a list of the modules of your roles, a "go to"
  list per module, a search in the page (matches highlighted, ▲▼ to step through
  them) and a search in all the documentation. The "Aide" entry of the menu opens it.
- Map: satellite view. The layers sheet starts with two exclusive switches, "Plan" and "Satellite"
  (Esri World Imagery, remembered on the device). The nginx CSP now allows
  `server.arcgisonline.com` for images: nginx must be reloaded (see
  `doc/prod-migrations/0022-satellite-basemap-csp.md`).
- Audit trail (backend): every business action (reports, edits, deletions,
  hand-overs, sharings, delegations, trap journal, QR codes, group members,
  invitations, statistics exports and their downloads) is recorded with its
  author, time and changes, append-only, kept 1 year (`AUDIT_RETENTION_DAYS`).
  Read API for platform administrators only (`/api/audit/events/`: filters,
  object history, CSV export). The last year is rebuilt from the dated facts of
  the existing data at deployment. See `doc/AUDIT_TRAIL.md`.
- Install suggestion: from the second visit, a sheet offers to pin the app on
  the home screen (an "Installer" button on Android, the share-menu steps on
  iOS). Closing it postpones the next suggestion by 30 days; the menu entry
  "Installer l'app" stays available until the app is installed.
- Apiary sheet, "Changer de propriétaire": a platform administrator, or the
  administrator of a beekeeper association (for its own members), hands an
  apiary over to a member of the association, listed by first and last name. An
  administrator can thus create an apiary for a beekeeper who is not at ease
  with the app, then transfer it. The former owner no longer sees it unless it
  is shared with their association.

### Changed
- Help tips: with a mouse, the popover stays open while the pointer moves onto it,
  so that a link inside it can be reached.

### Removed
- The Documentation module (tile of the home page, `/docs` pages): the former
  addresses open the home page with the help panel on the module concerned.

### Fixed
- Deleting a trap type still in use no longer removes its photo.

## [1.3.0] - 2026-10-09

### Added
- Nest photos: one or more photos when reporting a nest; administrators and the
  coordinators of the nest hunters (`/hunters/admin`, new Keycloak subgroup) add
  and remove them from the nest sheet. Photos are private media, shown to who
  sees every nest and to the reporter, never on the public map. Prod: note 0021.
- Nest editing by administrators and nest hunter coordinators: place, address,
  position, comment, destruction and its date.
- Map, Layers → "Nids les plus proches": the nests of the year within 5 km of
  the user, nearest first with their distance (as the crow flies, 20 at most);
  a tap opens the nest and centres the map on it. For those who see every nest
  (hunters, beekeepers, admins).
- Nest sheet: the AFSCA numbers of the apiaries within 1 km of the nest, sorted
  by number, without any distance (administrators and nest hunter coordinators).
- "Serveur injoignable" strip under the navbar when the server cannot be reached
  (no coverage, a network the edge firewall does not let through), with a retry
  button and a hint. The app probes `/api/ping` (a static answer of nginx) at
  launch, on return to the foreground, on network events and after an API call
  that got no answer; it never polls while the server answers, and retries with
  a growing delay (5 s to 60 s) while it does not. The login button no longer
  leaves for Keycloak while the server is unreachable. Its help also shows the
  device's public IP address (IPv4 and IPv6 when it has both), asked of ipify
  only when the help is opened (each address shows as soon as it is known, and
  nothing is asked when the device has no network), for whoever manages the
  firewall's allowlist.
  Prod: note 0020.
- Error screens instead of a white page when a page fails while rendering (an
  unexpected API answer, a chunk that cannot be fetched): the page's own screen
  keeps the navbar, so the user can go elsewhere; a last one covers the whole
  app. Both offer "Recharger"; the first adds the advice to retry later when
  the server is unreachable.
- Dev: a message with a "Réessayer" button replaces the white page when the dev
  server cannot be reached at launch (the dev service worker only caches
  `index.html`, not the modules Vite serves).

### Changed
- The destruction date of a nest is kept: set when it is marked destroyed (today
  by default, an earlier day can be given), and a destroyed nest can no longer be
  turned back to active, except by an administrator. Nests destroyed before this
  release keep no date.
- The reporter of a nest is always the signed-in user: `created_by` is no longer
  accepted from the client.
- AFSCA numbers are written `X.XXX.XXX.XXX` (10 digits, e.g. `9.005.577.599`)
  everywhere: one display component, a field that inserts the dots while typing
  (numeric keypad) and refuses an incomplete number. The backend stores that form
  and rewrites the recorded numbers that fit it (migration 0023); a number in
  another form is kept until it is changed. The search finds a number typed
  without dots. Prod: note 0021.

### Removed
- Apiary and trap lists: the distance from the user to each apiary or trap and
  the "Le plus proche" sort are gone, in the app and in the API
  (`ordering=distance` is now refused on `/apiaries/managed/` and
  `/traps/managed/`): of little use, and they would locate the apiaries.

### Fixed
- The trap list showed "Relevé aujourd'hui" for a visit made the evening before:
  the age was counted in 24 h slices instead of calendar days. It now follows
  the calendar (yesterday at 19:00 reads "Relevé hier" the next morning), and
  so does the 7-day "to visit" warning.

## [1.2.0] - 2026-10-06

### Security
- Keycloak 26.7.4 → 26.8.0 (`auth/Dockerfile`, builder and final image). Minor
  release with three security fixes (including the redirect URI check on
  fragments, CVE-2026-18209). Prod: note 0019.

### Changed
- Trap and nest photos: the camera button no longer forces the camera. On a
  phone it now offers the camera or the photo library.
- Module icons in colour: on the landing page and in the navbar menu, each field
  module takes the colour of what it manages on the map (nests red, traps green,
  apiaries gold, map teal, statistics violet); documentation, administration and
  account stay grey.
- One role per trade. `volunteer` is split: nest hunters (`hunter`, the former
  role renamed) record hornet sightings and releases and see every nest;
  trappers (`trapper`, new, the role of every new account) own traps and print
  their QR Codes, report nests and see the destroyed ones plus their own.
  Beekeepers keep sightings, traps and every nest. Statistics are open to all
  four roles. Tokens still carrying `volunteer` count as both trades until the
  next release. Prod: note 0018.
- A trap can only be delegated to a beekeeper association (`/beekeepers/<id>`),
  platform admins included: a trapper outside any association has no
  delegation, and the "Délégués" scope is only offered to association members.
- Trap sheet, lighter: the photo becomes a thumbnail, what the trap holds and the
  hornet count are shown as two tiles ("Frelons capturés" in the sheet and in the
  list), the delegation comes up under the actions, and the installation date,
  owner, QR code, address and comment sit in a collapsed "Détails" section. The
  journal is a panel set into the sheet and grows as it is scrolled.

### Added
- `GET /api/nests/my/`: the nests the requester reported.
- Coordinators of the trappers (`/trappers/admin`): Administration → Piégeurs
  lists every trapper by name; removing a trapper, who loses the role, is left
  to platform admins.

### Removed
- The service worker's token extension (`sw-auth-extension.js`) and its
  helpers: a service worker cannot read the tokens nor run while the app is
  closed, so it renewed nothing. The service worker now only caches the app.

### Fixed
- Trap photos (the trap's own photo, intervention and catch thumbnails, full-size
  view, list thumbnails) are loaded with the session token: a plain `<img>` sent none, so the
  media view answered 404 for every trap that is private or bound to an apiary,
  even to its owner.
- The session survives a closed or suspended app: opening the installed app
  (or a tab) with an expired access token renews it with the refresh token
  instead of showing the user signed out, and so does coming back to the
  foreground or back online. An API call renews a token about to expire first
  and is replayed once after a 401. A renewal that fails for lack of network no
  longer locks the app behind "Session expirée"; only a session ended in
  Keycloak signs the user out. The renewal now starts 10 minutes before expiry
  (the former setting had a wrong name and was ignored: 1 minute).
- The delegation endpoint accepted any group path from a platform admin.

## [1.1.0] - 2026-10-01

### Added
- Group administration (Administration → Mon groupe, "Groupes" for platform admins):
  the members of a beekeeper group, listed by name, and the invitations, now in a
  second tab. An administrator of the group removes a member; naming or dismissing
  an administrator, and removing one, is for platform admins, and a group always
  keeps at least one administrator. A removal reaches the person's connection
  within the hour at most.
- Traps that keep their catches between emptyings (electric harp, muzzle, fatal
  trap...): an administrator ticks "Accumule les captures" on the trap type.
  Their reading counts everything the trap holds, starting from what the last
  reading left, and asks whether the trap was emptied or left in place; the new
  catches are deduced from it, for the total and the statistics. The journal
  shows "Vidé" / "Laissé en place" and what the trap held; the trap sheet shows
  what it held at the last reading, under the catch total. Prod: note 0017.
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

[Unreleased]: https://github.com/team-dvl/hornet-finder/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/team-dvl/hornet-finder/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/team-dvl/hornet-finder/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/team-dvl/hornet-finder/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/team-dvl/hornet-finder/releases/tag/v1.0.0
