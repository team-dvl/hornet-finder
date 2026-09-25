/**
 * Walk of the main screens on phone sizes, run by ui-shots.sh inside the
 * Playwright Docker image. Dialogs are opened, never submitted.
 *
 * Every screenshot also checks for horizontal overflow: the page must not
 * scroll sideways, and nothing visible in an open dialog or sheet may stick
 * out of the screen. Findings are printed as WARN lines.
 */
const { webkit, chromium, devices } = require('playwright');

const BASE = process.env.BASE_URL;
const LAT = Number(process.env.LAT);
const LNG = Number(process.env.LNG);

const DEVICES = {
  ip14: { engine: webkit, profile: devices['iPhone 14'] },
  se: { engine: webkit, profile: devices['iPhone SE'] },
  w320: { engine: webkit, profile: { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } },
  pixel7: { engine: chromium, profile: devices['Pixel 7'] },
  galaxy: { engine: chromium, profile: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } } },
};

let warnings = 0;

async function walk(name) {
  const { engine, profile } = DEVICES[name];
  const browser = await engine.launch();
  const context = await browser.newContext({
    ...profile,
    geolocation: { latitude: LAT, longitude: LNG },
    permissions: ['geolocation'],
    ignoreHTTPSErrors: true,
    locale: 'fr-BE',
  });
  const page = await context.newPage();
  let index = 0;

  const overflow = () => page.evaluate(() => {
    const width = window.innerWidth;
    const found = [];
    if (document.documentElement.scrollWidth > width + 1) {
      found.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
    }
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
  const step = async (label, action) => {
    try {
      await action();
    } catch (error) {
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
    await tap(page.getByText('Se connecter'));
    await page.fill('input[name=username]', process.env.KC_USER);
    // Identifier-first flow: the password comes on a second screen
    if (!(await page.locator('input[name=password]').isVisible())) {
      await page.locator('#kc-login').click();
      await page.waitForSelector('input[name=password]');
    }
    await page.fill('input[name=password]', process.env.KC_PASS);
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

  await step('traps-map', async () => {
    await open('/traps');
    await shot('traps-map', 2500);
  });

  await step('layers', async () => {
    await tap(page.locator('[aria-label="Couches"], [title="Gérer les couches affichées"]'));
    await shot('layers');
    await scrollDown();
    await shot('layers-bottom', 400);
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

  /** Tap the fixture traps: through their cluster first when they are grouped */
  const tapFixtureTrap = async () => {
    if (await page.locator('.map-cluster').count()) {
      await tapAt(...(await markerAt('.map-cluster')));
      await page.waitForTimeout(1500);
    }
    await tapAt(...(await markerAt('.trap-icon')));
  };

  await step('clusters', async () => {
    if (await page.locator('.map-cluster').count()) await shot('traps-clusters');
  });

  await step('overlap', async () => {
    await tapFixtureTrap();
    await shot('overlap', 1500);
  });

  await step('trap-sheet', async () => {
    const choice = page.locator('.offcanvas.show .list-group-item, .modal.show .list-group-item').filter({ hasText: 'Piège' });
    if (await choice.count()) await tap(choice);
    await shot('trap-sheet', 2000);
    await scrollDown();
    await shot('trap-sheet-bottom', 400);
  });

  await step('back-closes-sheet', async () => {
    await page.goBack();
    await shot('after-back', 1200);
  });

  await step('catch-form', async () => {
    if (!(await page.locator('.modal.show').count())) {
      if (!(await page.locator('.leaflet-container').count())) {
        await open('/traps');
        await page.waitForTimeout(2500);
      }
      await tapFixtureTrap();
      await page.waitForTimeout(1200);
      const choice = page.locator('.offcanvas.show .list-group-item, .modal.show .list-group-item').filter({ hasText: 'Piège' });
      if (await choice.count()) await tap(choice);
      await page.waitForTimeout(1500);
    }
    await tap(page.locator('.modal.show button:has-text("capture"), .modal.show [aria-label="Enregistrer une capture"]'));
    await shot('catch-form', 1500);
    await scrollDown();
    await shot('catch-form-bottom', 400);
    await tap(page.getByText('Ajouter une espèce'));
    await shot('species-picker', 1500);
    await tap(page.locator('.modal.show button:has-text("Retour"), .modal.show [aria-label="Retour"]'));
    await tap(page.locator('.modal.show button:has-text("Annuler"), .modal.show .btn-close'));
    await page.waitForTimeout(800);
  });

  await step('action-form', async () => {
    await tap(page.locator('.modal.show button:has-text("action"), .modal.show [aria-label="Ajouter une action"]'));
    await shot('action-form', 1500);
    await tap(page.locator('.modal.show button:has-text("Annuler"), .modal.show .btn-close'));
    await page.waitForTimeout(800);
  });

  await step('trap-edit', async () => {
    await tap(page.locator('.modal.show [aria-label="Modifier"], .modal.show button:has-text("Modifier")'));
    await shot('trap-edit', 1500);
    await scrollDown();
    await shot('trap-edit-bottom', 400);
    await tap(page.locator('.modal.show button:has-text("Annuler"), .modal.show .btn-close'));
    await page.waitForTimeout(800);
  });

  await step('trap-delete', async () => {
    await tap(page.locator('.modal.show [aria-label="Supprimer"], .modal.show button:has-text("Supprimer")'));
    await shot('trap-delete-confirm', 1200);
    await tap(page.locator('.modal.show button:has-text("Annuler")'));
    await escape();
  });

  await step('nests-map', async () => {
    await open('/nests');
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

  for (const [path, label] of [
    ['/admin', 'admin'],
    ['/admin/species', 'admin-species'],
    ['/admin/trap-types', 'admin-trap-types'],
    ['/admin/tags', 'admin-tags'],
    ['/admin/tags?tab=print', 'admin-tags-print'],
    ['/docs', 'docs'],
    ['/docs/traps', 'docs-traps'],
  ]) {
    await step(label, async () => {
      await open(path);
      await shot(label, 1000);
    });
  }

  await step('admin-menu', async () => {
    await open('/admin/trap-types');
    await tap(page.locator('.navbar-toggler'));
    await shot('admin-trap-types-menu');
  });

  await browser.close();
}

(async () => {
  const names = (process.env.DEVICES || '').split(/\s+/).filter(Boolean);
  for (const name of names.length ? names : Object.keys(DEVICES)) {
    if (!DEVICES[name]) {
      console.log(`Unknown device ${name}: ${Object.keys(DEVICES).join(', ')}`);
      continue;
    }
    console.log(`== ${name}`);
    await walk(name);
  }
  console.log(`${warnings} overflow warning(s)`);
})();
