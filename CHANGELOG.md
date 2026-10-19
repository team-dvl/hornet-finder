# Changelog

All notable changes are listed here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/): the git tag `vMAJOR.MINOR.PATCH` is
the source of truth, `./release.sh` cuts a release (see `doc/VERSIONING.md`).

Write entries under `[Unreleased]` as the work is done, in the sections `Added`,
`Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

## [Unreleased]

### Added
- Notification when a nest is destroyed: the coordinators and the owners of the apiaries within 1 km (and
  the administrators of their associations) are told, like for a new nest.
- Traps: handing a trap over. A platform admin, or the administrator of a group the owner belongs to (the trappers, a beekeeper association), hands a trap over to a member of that group: "Changer de propriétaire" in the menu of the list and in the trap sheet. The delegation is cleared with the hand-over (the new owner delegates again) and the new person is notified at once ("Pièges qui me sont transférés" in the Notifications module). A group administrator only reaches a trap delegated to their group.
- Traps: handing a trap over. A platform admin, or the administrator of a group the owner belongs to (the trappers, a beekeeper association), hands a trap over to a member of that group: "Changer de propriétaire" in the menu of the list and in the trap sheet. The delegation is cleared with the hand-over (the new owner delegates again), without ever widening who sees the trap: one restricted to its group stays restricted (its owner and the platform admins only) and one of an apiary-bound type stays private; the new person is notified at once ("Pièges qui me sont transférés" in the Notifications module). A group administrator only reaches a trap delegated to their group.
- Traps: a trap restricted to its group whose group is gone (deleted, or cleared by a hand-over) can be edited again; asking for "group" visibility still needs a group.
- Nests: "Transférer" is also in the menu of each row of the list, as in the nest sheet.
- Follow-up of a nest: each nest is followed by a person, its reporter at first. A platform
  admin hands the follow-up of any nest over to a trapper, a coordinator of the trappers
  (`/trappers/admin`) the nests they follow (one reported for someone who called): "Transférer"
  in the menu of the nest sheet. The reporter stays "Signalé par"; the sheet shows
  "Suivi par" when it is someone else. The new person sees the nest, gets its follow-up
  notifications and may declare its destruction, and is told at once ("Un nid vous a été
  transféré"); the former one no longer sees it unless they see every nest. Recorded in the audit
  trail ("Nid transféré"). Following a nest means managing it, not owning it.

### Changed
- Sign-in screen: the Google and Facebook buttons are at the top, above the identifier and password form, to encourage their use. The "Ou se connecter avec" heading is gone, a rule separates the two.
- Sign-in screen: the "Se souvenir de moi" checkbox is gone. It changed nothing for the session (same 3-day idle and 7-day maximum limits, tokens kept in `localStorage`), only whether Keycloak's own cookie outlived the browser.
- Traps: the API now says what the requester may do with each trap (`permissions`: `update`, `act`, `change_owner`), as for apiaries and nests; the app no longer works it out on its own.
- Dialogs on a large screen (object sheets such as a nest, forms): 700 px wide from 992 px instead of 500 px. Confirmations and phone layout unchanged.

### Fixed
- Restart: nginx and the API (and, in dev, Vite and the mail proxy) now wait for Keycloak to be healthy (new
  healthcheck on the realm endpoint), so the site no longer fails on the login while Keycloak is still starting.
- The "À relever" list shows the photo of the trap, else the one of its type, as a medallion (as the nests
  and the trap manager do), instead of an icon.
- Dark mode: white screen on launch or after a reactivation, until the stylesheet had loaded. The page background of the chosen palette and mode (kept locally) is now set inline in `index.html`, so the first paint already has the right colour.

## [1.5.1] - 2026-10-16

### Fixed
- Dark mode, iOS and Android: an off switch was hard to tell from an on one (Bootstrap's dark rule dimmed the off knob). The off state now has an opaque white knob and a lighter track (iOS) or a restated outline (Material), in both palettes.
- Navbar on a PC: the menu entries, the breadcrumb and the version tag overlapped between 992 and 1200 px wide. The horizontal menu now starts at 1200 px; below it the burger menu is used.
- Nests: a nest that belongs to several "À traiter" sections (to verify, near one's apiaries, one's own report) was counted once per section in the badges and listed several times. It now counts once and appears once, in the most urgent section.

## [1.5.0] - 2026-10-16

### Security
- Frontend dependencies: `npm audit fix` updates the transitive `brace-expansion` and `source-map-js` (high), `fast-uri` (moderate) and `serialize-javascript` (low) in the lockfile; `npm audit` reports 0 vulnerabilities.

### Changed
- Frontend dependencies: React and react-dom 19.3.1, `@types/react` and `@types/react-dom` 19.3.0, react-router-dom 7.18.4, Vite 8.3.4.
- Privacy policy: new article 9 "Cookies et stockage local" (what the site stores, why, how long; no tracking cookie, so no consent banner) and the map services contacted (OpenStreetMap, Esri, Nominatim, ipify) listed in article 5. The home footer link now reads "Confidentialité et cookies".

### Added
- Nest report: a phone number to call the reporter back and a comment for the coordinators,
  both optional, read only by the nest coordinators and the reporter, never on the public
  map. The number stays out of the audit trail and is erased at the end of the season
  (1 March). Coordinators see it on the nest sheet (tap to call) and can correct both.
- Pending badges for every module: the nests module now shows, like the traps module, a
  red count on its landing tile when something waits for the user (nests to verify or to
  destroy for the coordinators, active nests near one's apiaries). The same counts appear
  on the menu entries, and a red dot on the menu button. One request serves them all
  (`GET /api/pending/`), refreshed after a reading or a nest action.
- Nests module, first part of its redesign (`doc/mockups/nests-redesign.html`): a nest has a
  journal and a status, reported, confirmed, destroyed, rejected (another species, not
  found) or abandoned (empty). The module opens on "À traiter" (nests to verify or to destroy
  for the coordinators, active nests within 1 km of one's apiaries, one's own reports still
  open) and lists the nests of the season in "Nids" (search, statuses, ordering); a trapper
  sees their reports and how they stand. The map opens from the header, or on one nest.
- Nest verification (coordinators: platform admins and `/hunters/admin`), on the spot or
  not: from the photos, a call with the reporter or a look on the spot, noted as "Sur base
  de". Outcome active, empty, another species or not found, with the type (pre-chosen from the date: primary from February to
  May, secondary from July), height and size by classes. Destruction recorded by a
  coordinator (date, by whom, FixMyStreet included, means: pole, lift, nest removed) or
  reported by whoever reported the nest ("Signaler neutralisé"). The reporter can also say a nest is
  empty.
- Nest notifications, from 9:00 (10:00 on Sundays) to 20:00 like the trap reminders, a
  summary from 3 at once: "Tous les nouveaux nids" (on for coordinators and admins, a
  beekeeper turns it on), "Nids près de mes ruchers" (owners of the apiaries within 1 km and
  administrators of the associations they are shared with), "Suivi de mes signalements"
  (confirmed, rejected, found empty, destroyed). An empty nest only tells the coordinators.
- End of the nest season: on 1 March, the nests of the previous season still reported or
  confirmed become abandoned. Existing nests get their journal at the migration; those of
  past seasons left untreated become abandoned.
- Appearance: a dark mode (light, dark, or follow the system, the default) and two themes,
  Velutina (charcoal and amber, the default) and Forêt (green and ochre), chosen from the
  "Apparence" entry of the menu. The choice is kept on the device and applies before the first
  paint. Street maps are darkened in dark mode; the satellite view is unchanged.
- Trap reminders: each trap type can set a reading delay and an attractant delay (in days).
  The owner of a trap gets a notification at 9:00 (10:00 on Sundays) the day a reading or
  a renewal of the attractant is due, then every 2 days, 3 times at most; from 3 reminders
  at once, a single summary. A shelved trap has none. A scheduler service sends them
  (prod note 0025).
- Traps module: it opens on a new "À relever" tab (late, today, soon, with "Relever" and
  "Recharger"); the landing tile counts what is due.
- Notifications module: this device on or off with a test, and the kinds of notifications
  (reading and attractant reminders, group and platform messages) to turn off, with
  switches that look like the platform's (iOS or Material). A first question about
  notifications appears once per device, from the second visit.
- Trap menu: "Remiser" and "Remettre en service".
- Notifications retention: the history of sent notifications is deleted after 90 days, and
  a device on which the app was not opened for 6 months stops receiving them (it registers
  again when the app is opened). The privacy policy says so.
- Map: the position button now opens a sheet to place the crosshair either at
  the device's position or at an address (Nominatim search); the map fits the
  extent of the place found (a house, a street, a village).

### Changed
- Nests: "neutralisé" instead of "détruit" everywhere in the app, its notifications and its
  help (status, steps, lists, journal, audit labels). The actions are verbs: "Neutraliser"
  for a coordinator, "Signaler neutralisé" for the reporter (was "Détruit ?").
- Nest lists on a phone: a row with a main action puts its buttons under the text, like the
  traps and apiaries, so the address is no longer cut to a few letters.
- Recording a hornet sighting is reserved for nest hunters (trained, members of `/hunters`) and
  admins: beekeepers lose it. Reporting a nest stays open to every role and now comes first in
  the "Ajouter ici" sheet. Editing or deleting a hornet in the app follows the API: admins only.
- Nests: the map hides rejected and abandoned nests, and colours the others by status
  (reported red, confirmed orange, destroyed grey). Editing a nest no longer sets it
  destroyed: its destruction goes through its journal (the old `destroyed` field of the
  API still works and is written to the journal).
- Traps module: the former list is the "Gérer" tab; a trap is highlighted as late after
  the reading delay of its type (7 days when the type sets none).
- Profile dialog: the notifications row now leads to the Notifications module.
- Address search: says when no address matches, and the suggestions no longer
  scroll inside their own box.
- Map on a touch screen: the position, layers and add buttons sit at the bottom
  right, within reach of the thumb ("+" lowest), above the trap move bar when it
  shows; with a mouse they stay at the top right.
- Trap type form: the reminder delays are picked from a native list ("Tous
  les 7 jours", "Aucun rappel"; the wheel on iOS) instead of a number field,
  with shorter labels; the two switches are settings rows (label, help, switch).
- Switches: every switch of the app takes the platform's look (iOS or Material),
  centred on its label, a finger's height.

### Fixed
- Phone menu: the account row no longer overflows the screen on a narrow phone (320 px,
  iPhone in zoomed display): the name is truncated and "Déconnexion" stays fully visible.
- iPhone: a button no longer looks pressed after a tap left the finger over it, which made
  "À traiter" and "Nids" both look selected on opening the nests module (buttons keep no
  hover look on touch screens).
- Desktop menu bar: a module and its pending count stay on one line (the count wrapped below
  the label and made the bar taller, out of line with "Aide" and "Apparence").
- The menu button is read "Menu" by screen readers (it was "Toggle navigation").
- Map: the "+" additions go to the crosshair placed from the position sheet (a trap
  at the crosshair; a hornet "vu d'ici" at the crosshair when it was placed at an
  address, otherwise at the GPS position), instead of the map centre or the GPS.

### Security
- Archived hornet sightings and nests are deleted for good 5 years after they were reported
  (`OBSERVATIONS_RETENTION_DAYS`, run by the scheduler, `manage.py purge_observations --dry-run`
  to preview); a nest takes its journal and photos with it. The privacy policy says so.
- The list of hornet sightings no longer shows who reported them to anonymous visitors nor to
  trappers (personal data, GDPR); nest hunters, beekeepers and admins still see the author.
- The public list of destroyed nests no longer carries the address and comments of a nest on
  private ground. The privacy policy says what is visible without signing in.

## [1.4.0] - 2026-10-13

### Security
- Django 6.1.1 → 6.1.2: security release (CVE-2026-87890, bytes in spatial
  lookups; CVE-2026-15830, WKB geometry collection limits; CVE-2026-84429 and
  CVE-2026-77050, header parsing and memory exhaustion; CVE-2026-87975, model
  formsets).
- Django REST framework 3.18.1 → 3.18.3: hardened content negotiation against
  large `Accept` headers (GHSA-33wh-fxxf-88vv), non-text charsets refused
  (GHSA-3547-9m27-7rxg); 3.18.3 fixes a regression of 3.18.2.

### Added
- Release script: `release.sh` now accepts short argument (`-n`) for dry run.
- Notifications: a group administrator writes a push notification to a member or to the
  whole group of an association, and a platform admin to anyone (from the members list,
  "Notifier"). Everyone turns notifications on or off per device in their profile, with a
  test button; on iPhone and iPad the app must be added to the home screen first (iOS
  16.4 or later). Platform admins follow the deliveries, device by device, in
  Administration → Notifications. The app icon shows a badge counting the notifications
  received since the app was last opened (iPhone and desktop; Android draws its own dot).
  Needs VAPID keys in `.env` (prod note 0024). The service
  worker is now written by hand (`injectManifest`).
- Map: it reopens where you left it (centre and zoom, on this device, for 30 days after
  the last move). Only a drag by hand is remembered, never a locate fix or a jump to an
  object. "Position par défaut" in the layers sheet forgets it and recentres on the
  default position.
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
- Audit trail: every business action (reports, edits, deletions, hand-overs,
  sharings, delegations, trap journal, QR codes, group members, invitations,
  statistics exports and their downloads) is recorded with its author, time and
  changes, append-only, kept 1 year (`AUDIT_RETENTION_DAYS`). Platform
  administrators read it in Administration → "Journal d'audit": list by day,
  filters (period, domains, action, person, source, text), detail with the
  changes before → after, history of an object (🕘 "Historique" in the nest,
  hornet, apiary and trap sheets), of a person or of a request, CSV export. The
  last year is rebuilt from the dated facts of the existing data at deployment.
  The help (Administration module, new) tells every user what is recorded, who
  sees it and for how long. See `doc/AUDIT_TRAIL.md`.
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
- Trap reading, trap that accumulates: a third answer, "Vidé en partie", for a trap
  that could not be emptied entirely. It asks what stayed of each species found
  (counters at zero, at most what the trap held, an estimate will do); the next
  reading counts its new catches beyond that. "Vidé" counted the remainder twice,
  "Laissé en place" lost the next catches. The journal shows "Vidé en partie" and
  what stayed of each species.

### Changed
- Default map position: the church of Vedrin Centre (50.5034, 4.8728441) replaces the
  previous point, for the map and the compass.
- Privacy policy: new article 8 on the audit trail (what is recorded, who reads
  it, kept one year, kept after an account deletion under the former account's
  technical identifier), its legal basis and retention; the "last update" date
  is fixed instead of showing today's date. The data deletion page says what the
  audit trail keeps. Both pages name the Belgian data protection authority
  (APD) instead of the CNIL.
- Help tips: with a mouse, the popover stays open while the pointer moves onto it,
  so that a link inside it can be reached.

### Removed
- The Documentation module (tile of the home page, `/docs` pages): the former
  addresses open the home page with the help panel on the module concerned.

### Fixed
- Species: "Autre / indéterminé" always closes the list. A species added later
  went after it; it now goes just before, the order arrows never move "Autre"
  nor put anything below it, and the server keeps it last whatever order it
  receives. The deploy moves it back to the end where needed (migration 0024).
- Audit trail: events sharing the same time (one request, a rebuilt batch) were
  repeated or shown out of order from one page to the next; the list is now
  strictly newest first, and an icon reverses it (oldest first), the CSV export
  included.
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

[Unreleased]: https://github.com/team-dvl/hornet-finder/compare/v1.5.1...HEAD
[1.5.1]: https://github.com/team-dvl/hornet-finder/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/team-dvl/hornet-finder/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/team-dvl/hornet-finder/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/team-dvl/hornet-finder/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/team-dvl/hornet-finder/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/team-dvl/hornet-finder/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/team-dvl/hornet-finder/releases/tag/v1.0.0
