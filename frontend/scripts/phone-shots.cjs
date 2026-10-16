/**
 * Walk of the main screens on phone sizes, run by ui-shots.sh inside the
 * Playwright Docker image. Dialogs are opened, never submitted.
 *
 * Every screenshot also checks for horizontal overflow: the page must not
 * scroll sideways, and nothing visible in an open dialog or sheet may stick
 * out of the screen. Findings are printed as WARN lines.
 */
const crypto = require('crypto');
const { webkit, chromium, devices } = require('playwright');

const BASE = process.env.BASE_URL;
const LAT = Number(process.env.LAT);
const LNG = Number(process.env.LNG);

const DEFAULT_DEVICES = ['ip14', 'pixel7'];
const DEVICES = {
  ip14: { engine: webkit, profile: devices['iPhone 14'] },
  se: { engine: webkit, profile: devices['iPhone SE'] },
  w320: { engine: webkit, profile: { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } },
  pixel7: { engine: chromium, profile: devices['Pixel 7'] },
  galaxy: { engine: chromium, profile: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } } },
};

/**
 * TOTP code of the test admin (RFC 6238: base32 secret, HmacSHA1, 6 digits,
 * 30 s, the realm OTP policy). Keycloak refuses a code it already accepted, so
 * this waits for a window later than the last one used, by the API token
 * request of ui-shots.sh first (KC_TOTP_USED_STEP) and by each login after it.
 */
let lastOtpStep = Number(process.env.KC_TOTP_USED_STEP || 0);
const nextOtp = async () => {
  while (Math.floor(Date.now() / 30000) <= lastOtpStep) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const step = Math.floor(Date.now() / 30000);
  lastOtpStep = step;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of process.env.KC_TOTP_SECRET.replace(/[\s=]/g, '').toUpperCase()) {
    bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  }
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, '0');
};

// Step filter (ui-shots.sh -s / -x): substrings of step labels. The sign-in
// always runs, the other steps need the page the previous ones left open
const ONLY = (process.env.STEPS || '').split(/\s+/).filter(Boolean);
const SKIP = (process.env.SKIP || '').split(/\s+/).filter(Boolean);
const wanted = (label) => label === 'login'
  || ((!ONLY.length || ONLY.some((p) => label.includes(p))) && !SKIP.some((p) => label.includes(p)));
let ranSteps = 0;

let warnings = 0;
let failures = 0;

/** A 64x64 orange PNG, the photo given to the file inputs */
const SAMPLE_PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeklEQVR4nO3PUQkAIBTAwBfC2IY1giH8OITBAtzm7PV1wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWPHYBSf8BeLDobygAAAAASUVORK5CYII=',
  'base64',
);

async function walk(name) {
  const { engine, profile } = DEVICES[name];
  // Behind an HTTPS proxy that re-signs TLS (Claude Code web), Chromium needs
  // the proxy and does not trust its CA (no certutil in the image)
  const proxy = process.env.PROXY_SERVER;
  const browser = await engine.launch(proxy
    ? { proxy: { server: proxy }, ...(engine === chromium ? { args: ['--ignore-certificate-errors'] } : {}) }
    : {});
  const context = await browser.newContext({
    ...profile,
    geolocation: { latitude: LAT, longitude: LNG },
    permissions: ['geolocation'],
    ignoreHTTPSErrors: true,
    locale: 'fr-BE',
  });
  const page = await context.newPage();
  let index = 0;

  // Requests that fail or answer >= 400, by host: a blocked host (tiles behind
  // a filtering proxy, say) otherwise only shows up as empty screens
  const netErrors = new Map();
  const noteNetError = (url, reason) => {
    const host = new URL(url).host;
    const entry = netErrors.get(host) || { count: 0, reason };
    entry.count += 1;
    netErrors.set(host, entry);
  };
  page.on('requestfailed', (request) => noteNetError(request.url(), request.failure()?.errorText || 'failed'));
  page.on('response', (response) => {
    if (response.status() >= 400) noteNetError(response.url(), `HTTP ${response.status()}`);
  });

  const overflow = () => page.evaluate(() => {
    const width = window.innerWidth;
    const found = [];
    if (document.documentElement.scrollWidth > width + 1) {
      found.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
    }
    // A box scrolling sideways hides part of its content just as well
    document.querySelectorAll('body *').forEach((el) => {
      if (!el.clientWidth || el.closest('.leaflet-container')) return;
      const overflowX = getComputedStyle(el).overflowX;
      if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) {
        found.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`);
      }
    });
    document.querySelectorAll('.modal.show .modal-content *, .offcanvas.show *').forEach((el) => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || box.right <= width + 1) return;
      // Content of a horizontal scroller is allowed to extend past the edge
      for (let up = el.parentElement; up; up = up.parentElement) {
        const style = getComputedStyle(up);
        if (['auto', 'scroll', 'hidden'].includes(style.overflowX) && up.getBoundingClientRect().right <= width + 1) return;
      }
      found.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')} right=${Math.round(box.right)}`);
    });
    return found.slice(0, 5);
  });

  const shot = async (label, wait = 900) => {
    await page.waitForTimeout(wait);
    index += 1;
    const file = `${name}-${String(index).padStart(2, '0')}-${label}.png`;
    await page.screenshot({ path: `/out/${file}` });
    const problems = await overflow();
    problems.forEach((problem) => { warnings += 1; console.log(`WARN ${file}: ${problem}`); });
  };
  /** Waits for what a page loads to be done (no spinner left), then `floor` ms for the render, instead of a fixed delay */
  const settled = async (floor = 300) => {
    await page.locator('.spinner-border:visible').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(floor);
  };
  const shotSettled = async (label, floor) => {
    await settled(floor);
    await shot(label, 0);
  };
  const step = async (label, action) => {
    if (!wanted(label)) return;
    if (label !== 'login') ranSteps += 1;
    try {
      await action();
    } catch (error) {
      failures += 1;
      console.log(`FAIL ${name} ${label}: ${String(error).split('\n')[0]}`);
    }
  };
  const tap = async (locator) => {
    await locator.first().waitFor({ state: 'visible', timeout: 8000 });
    if (profile.hasTouch) await locator.first().tap();
    else await locator.first().click();
  };
  const tapAt = async (x, y) => {
    if (profile.hasTouch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  };
  const scrollDown = () => page.evaluate(() => {
    document.querySelectorAll('.modal.show .modal-body, .modal.show, .offcanvas.show .offcanvas-body').forEach((el) => {
      el.scrollTop = el.scrollHeight;
    });
  });
  const escape = async () => {
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
    }
  };
  const open = async (path) => {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
  };
  /** Screen position of a map marker, by its icon class: the leftmost one on screen, where the fixtures are */
  const markerAt = async (selector) => {
    const boxes = await page.locator(selector).evaluateAll((els) => els.map((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }));
    const visible = boxes
      .filter((box) => box.x > 0 && box.x < viewport.width && box.y > 60 && box.y < viewport.height)
      .sort((a, b) => a.x - b.x);
    if (!visible.length) throw new Error(`no ${selector} on screen`);
    return [visible[0].x, visible[0].y];
  };
  const viewport = page.viewportSize();

  await step('home-anon', async () => {
    await open('/');
    await shot('home-anon');
  });

  await step('login', async () => {
    // home-anon opens the home page; without it (step filter) open it here
    if (!page.url().startsWith(BASE)) await open('/');
    await tap(page.getByText('Se connecter'));
    await page.fill('input[name=username]', process.env.KC_USER);
    // Identifier-first flow: the password comes on a second screen
    if (!(await page.locator('input[name=password]').isVisible())) {
      await page.locator('#kc-login').click();
      await page.waitForSelector('input[name=password]');
    }
    await page.fill('input[name=password]', process.env.KC_PASS);
    await page.locator('#kc-login').click();
    // mfa-required (admin role): the second factor comes on its own screen
    await page.waitForSelector('input[name=otp]', { timeout: 10000 });
    await page.fill('input[name=otp]', await nextOtp());
    await page.locator('#kc-login').click();
    await page.waitForURL(`${BASE}/**`);
    await page.waitForLoadState('networkidle');
    await shot('home');
  });

  await step('menu', async () => {
    await tap(page.locator('.navbar-toggler'));
    await shot('menu');
  });

  await step('profile', async () => {
    await tap(page.locator('[aria-label="Mon profil"], button:has-text("Bienvenue")'));
    await shot('profile');
    await escape();
  });

  await step('map', async () => {
    await open('/map');
    await shot('map', 2500);
    await tap(page.locator('[aria-label="Couches"]'));
    await shot('map-layers');
    await scrollDown();
    await shot('map-layers-bottom', 400);
    await escape();
    await tapAt(viewport.width / 2, 10);
  });

  await step('add-menu', async () => {
    const add = page.locator('[aria-label="Ajouter"]');
    if (!(await add.count())) return;
    await tap(add);
    await shot('add-menu');
    await escape();
  });

  // Position sheet: the device's position or an address (a real Nominatim search, one request)
  await step('position-sheet', async () => {
    await tap(page.locator('[aria-label="Position"]'));
    await shot('map-position');
    await tap(page.locator('.bottom-sheet input'));
    await page.locator('.bottom-sheet input').fill('rue de Bruxelles Namur');
    await shot('map-position-search', 2500);
    await escape();
  });

  /** Tap the fixture traps on the map: through their cluster first when they are grouped */
  const tapFixtureTrap = async (label) => {
    if (await page.locator('.map-cluster').count()) {
      await tapAt(...(await markerAt('.map-cluster')));
      await page.waitForTimeout(1500);
      if (label) await shot(label, 300);
    }
    await tapAt(...(await markerAt('.trap-icon')));
  };

  // Nests, apiaries and traps share one cluster group: the map module shows them together
  await step('clusters', async () => {
    if (await page.locator('.map-cluster').count()) await shot('map-clusters');
  });

  await step('overlap', async () => {
    await tapFixtureTrap('cluster-fanned-out');
    await shot('overlap', 1500);
    await escape();
  });

  // Trap manager, narrowed to the fixtures (their comment) so real traps never get in the way
  const FIXTURE_TRAPS = '/traps?q=ui-shots&active=all';
  /** Runs a secondary action of an object sheet: they sit behind its "⋯" button (SheetActions) */
  const sheetMenu = async (label) => {
    await tap(page.locator('.modal.show [aria-label="Autres actions"]'));
    await tap(page.locator(`.sheet-menu-item:has-text("${label}")`));
  };
  const openFixtureSheet = async () => {
    if (!page.url().includes('/traps')) {
      await open(FIXTURE_TRAPS);
      await page.waitForTimeout(1500);
    }
    await tap(page.locator('[aria-label^="Fiche du piège"]').first());
    await page.waitForTimeout(1500);
  };

  await step('traps-list', async () => {
    await open(FIXTURE_TRAPS);
    await shot('traps-list', 2000);
  });

  await step('trap-filters', async () => {
    await tap(page.locator('[aria-label="Filtres"]'));
    await shot('trap-filters', 600);
    await tap(page.locator('[aria-label="Filtres"]'));
  });

  await step('trap-row-actions', async () => {
    await tap(page.locator('[aria-label="Plus d\'actions"]').first());
    await shot('trap-row-actions', 800);
    await escape();
  });

  await step('trap-sheet', async () => {
    await openFixtureSheet();
    await shot('trap-sheet', 1500);
    await scrollDown();
    await shot('trap-sheet-bottom', 400);
  });

  await step('back-closes-sheet', async () => {
    await page.goBack();
    await shot('after-back', 1200);
  });

  await step('catch-form', async () => {
    if (!(await page.locator('.modal.show').count())) await openFixtureSheet();
    await tap(page.locator('.modal.show [aria-label="Enregistrer un relevé"]'));
    await shot('catch-form', 1500);
    await scrollDown();
    await shot('catch-form-bottom', 400);
    // A photo taken for a species must show at once in its card (blob: preview)
    await page.locator('.modal.show input[type=file]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: SAMPLE_PHOTO });
    await page.waitForTimeout(1500);
    const previewShown = await page.evaluate(() => [...document.querySelectorAll('.modal.show img')]
      .some((img) => img.src.startsWith('blob:') && img.complete && img.naturalWidth > 0));
    if (!previewShown) { warnings += 1; console.log(`WARN ${name}: the photo preview does not show`); }
    await shot('catch-photo', 300);
    // Only the Asian hornet counted: saving asks about the other insects first,
    // "Les compter" goes back to the reading with the species picker open
    await tap(page.locator('.modal.show button[type=submit]'));
    await shot('bycatch-question', 800);
    await tap(page.locator('.offcanvas.show').getByText('Les compter'));
    await shot('species-picker', 1500);
    await tap(page.locator('.modal.show button:has-text("Retour"), .modal.show [aria-label="Retour"]'));
    await tap(page.locator('.modal.show button:has-text("Annuler"), .modal.show .btn-close'));
    await page.waitForTimeout(800);
  });

  await step('action-form', async () => {
    if (!(await page.locator('.modal.show').count())) await openFixtureSheet();
    await tap(page.locator('.modal.show button:has-text("action"), .modal.show [aria-label="Ajouter une action"]'));
    await shot('action-form', 1500);
    await tap(page.locator('.modal.show button:has-text("Annuler"), .modal.show .btn-close'));
    await page.waitForTimeout(800);
  });

  await step('trap-edit', async () => {
    if (!(await page.locator('.modal.show').count())) await openFixtureSheet();
    await sheetMenu('Modifier');
    await shot('trap-edit', 1500);
    await scrollDown();
    await shot('trap-edit-bottom', 400);
    await tap(page.locator('.modal.show button:has-text("Annuler"), .modal.show .btn-close'));
    await page.waitForTimeout(800);
  });

  await step('trap-delete', async () => {
    if (!(await page.locator('.modal.show').count())) await openFixtureSheet();
    await sheetMenu('Supprimer');
    await shot('trap-delete-confirm', 1200);
    await tap(page.locator('.modal.show button:has-text("Annuler")'));
    await escape();
  });

  // "Voir sur la carte": the map module on the trap, with a way back to the list
  await step('trap-locate', async () => {
    await open(FIXTURE_TRAPS);
    await page.waitForTimeout(1500);
    await tap(page.locator('.manager-list-actions [aria-label="Voir sur la carte"]').first());
    await shot('trap-locate', 2500);
    await tap(page.locator('.map-back-button'));
    await shot('trap-locate-back', 1500);
  });

  // The nest manager: what waits for an action ("À traiter"), then the season's list
  await step('nests-todo', async () => {
    await open('/nests');
    await shot('nests-todo', 2000);
  });

  await step('nests-list', async () => {
    await open('/nests/list');
    await shot('nests-list', 2000);
  });

  // The markers and the add button live on the map page, no longer on /nests
  await step('nests-map', async () => {
    await open('/map');
    await shot('nests-map', 2500);
  });

  await step('nest-sheet', async () => {
    await tapAt(...(await markerAt('.nest-icon')));
    await shot('nest-sheet', 1500);
    await scrollDown();
    await shot('nest-sheet-bottom', 400);
    await escape();
  });

  await step('hornet-sheet', async () => {
    // The overview hides the hornet sightings: switch them on from the layers sheet
    await tap(page.locator('[aria-label="Couches"]'));
    if (!(await page.locator('#layer-hornets').isChecked())) await tap(page.locator('label[for="layer-hornets"]'));
    await escape();
    await page.waitForTimeout(1500);
    await tapAt(...(await markerAt('.hornet-icon')));
    await shot('hornet-sheet', 1500);
    await scrollDown();
    await shot('hornet-sheet-bottom', 400);
    await escape();
  });

  await step('add-selector', async () => {
    await tapAt(viewport.width * 0.2, viewport.height * 0.8);
    await shot('add-selector', 1200);
    await scrollDown();
    await shot('add-selector-bottom', 400);
  });

  await step('add-hornet', async () => {
    await tap(page.locator('.show button:has-text("frelon"), .show button:has-text("Frelon")'));
    await shot('add-hornet', 1200);
    await scrollDown();
    await shot('add-hornet-bottom', 400);
    await escape();
  });

  await step('add-nest', async () => {
    await tapAt(viewport.width * 0.2, viewport.height * 0.8);
    await page.waitForTimeout(1000);
    await tap(page.locator('.show button:has-text("nid"), .show button:has-text("Nid")'));
    await shot('add-nest', 1200);
    await scrollDown();
    await shot('add-nest-bottom', 400);
    await escape();
  });

  // The apiary manager: a list, the map reached through "Voir sur la carte"
  const FIXTURE_APIARIES = '/apiaries?q=ui-shots';
  await step('apiaries-list', async () => {
    await open('/apiaries');
    await shot('apiaries-list', 2000);
    await tap(page.locator('[aria-label="Filtres"]'));
    await shot('apiaries-filters', 600);
  });

  await step('apiary-sheet', async () => {
    await open(FIXTURE_APIARIES);
    await page.waitForTimeout(1500);
    await tap(page.locator('.manager-list-open').first());
    await shot('apiary-sheet', 2000);
    await tap(page.locator('.modal.show .accordion-button').filter({ hasText: 'Partage' }));
    await scrollDown();
    await shot('apiary-sharing', 800);
  });

  await step('apiary-edit', async () => {
    await sheetMenu('Modifier');
    await shot('apiary-edit', 1200);
    await scrollDown();
    await shot('apiary-edit-bottom', 400);
    await escape();
  });

  await step('apiary-actions', async () => {
    await open(FIXTURE_APIARIES);
    await page.waitForTimeout(1500);
    await tap(page.locator('.manager-list-actions [aria-label="Plus d\'actions"]').first());
    await shot('apiary-actions', 800);
    await escape();
  });

  await step('apiary-locate', async () => {
    await open(FIXTURE_APIARIES);
    await page.waitForTimeout(1500);
    await tap(page.locator('.manager-list-actions [aria-label="Voir sur la carte"]').first());
    await shot('apiary-locate', 2500);
    await tap(page.locator('.map-back-button'));
    await shot('apiary-locate-back', 1500);
  });

  await step('add-apiary', async () => {
    await open('/apiaries');
    await page.waitForTimeout(1500);
    await tap(page.locator('[aria-label="Ajouter"]').first());
    await page.waitForSelector('.modal.show', { timeout: 20000 });
    await shot('add-apiary', 1500);
    await escape();
  });

  // Statistics: catalogue, the catches table with its sheets, each table in
  // list and chart view (the export sheet is opened, nothing is emailed)
  await step('stats', async () => {
    await open('/stats');
    await shotSettled('stats', 300);
    await open('/stats/traps-catches');
    await shotSettled('stats-catches', 300);
    await scrollDown();
    await shot('stats-catches-bottom', 400);
    await tap(page.locator('[aria-label="Filtres"]').first());
    await shot('stats-filters', 800);
    await escape();
    await tap(page.locator('[aria-label="Exporter"]').first());
    await shotSettled('stats-export', 500);
    await escape();
    await open('/stats/traps-catches?view=chart');
    await shotSettled('stats-catches-chart', 600);
    await open('/stats/traps-species');
    await shotSettled('stats-species', 300);
    await open('/stats/traps-species?view=chart');
    await shotSettled('stats-species-chart', 600);
    await open('/stats/trap-types');
    await shotSettled('stats-trap-types', 300);
    await open('/stats/trap-types?view=chart');
    await shotSettled('stats-trap-types-chart', 600);
    await open('/stats/traps-ranking');
    await shotSettled('stats-ranking', 300);
    await open('/stats/traps-ranking?view=chart');
    await shotSettled('stats-ranking-chart', 600);
    await open('/stats/traps-coverage');
    await shotSettled('stats-coverage', 1500);
    await open('/stats/traps-pressure');
    await shotSettled('stats-pressure', 1500);
  });

  for (const [path, label] of [
    ['/admin', 'admin'],
    ['/admin/species', 'admin-species'],
    ['/admin/trap-types', 'admin-trap-types'],
    ['/admin/archiving', 'admin-archiving'],
    ['/admin/tags', 'admin-tags'],
    ['/admin/tags?tab=print', 'admin-tags-print'],
    ['/docs', 'docs'],
    ['/docs/traps', 'docs-traps'],
    ['/docs/apiaries', 'docs-apiaries'],
  ]) {
    await step(label, async () => {
      await open(path);
      await shot(label, 1000);
    });
  }

  await step('tag-object-link', async () => {
    await open('/admin/tags');
    const link = page.locator('a[href^="/traps?trap="]').filter({ visible: true });
    if (!(await link.count())) return;
    await tap(link);
    await shot('tag-object-sheet', 3000);
    await escape();
  });

  await step('page-scrolled', async () => {
    await open('/admin/tags');
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await shot('admin-tags-scrolled', 800);
  });

  await step('account-console', async () => {
    // The console is a single-page app that never goes network-idle: wait for the page, then let it render
    await page.goto(`${BASE.replace('://', '://auth.')}/realms/hornet-finder-dev/account`, { waitUntil: 'load' });
    // It renders after a silent SSO round trip (a few seconds)
    await page.getByText('Informations personnelles').first().waitFor({ timeout: 20000 });
    await shot('account-console', 800);
  });

  await step('admin-menu', async () => {
    await open('/admin/trap-types');
    await tap(page.locator('.navbar-toggler'));
    await shot('admin-trap-types-menu');
  });

  netErrors.forEach((entry, host) => console.log(`NET ${name} ${host}: ${entry.count} request(s), ${entry.reason}`));
  await browser.close();
}

(async () => {
  const names = (process.env.DEVICES || '').split(/\s+/).filter(Boolean);
  for (const name of names.length ? names : DEFAULT_DEVICES) {
    if (!DEVICES[name]) {
      console.log(`Unknown device ${name}: ${Object.keys(DEVICES).join(', ')}`);
      continue;
    }
    console.log(`== ${name}`);
    await walk(name);
  }
  if (ONLY.length && !ranSteps) {
    failures += 1;
    console.log(`FAIL no step matches "${ONLY.join(' ')}": use a substring of a step label (see the screenshot names)`);
  }
  console.log(`${warnings} overflow warning(s), ${failures} failed step(s)`);
  if (failures) process.exitCode = 1;
})();
