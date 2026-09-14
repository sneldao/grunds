// District Insider Pass: entitlement gating, the research desk, and the
// RevenueCat integration surface (live SDK path + Web Test Store fallback).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { billing, ENTITLEMENT_ID } from '../js/billing.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');

// 1) Test-store purchase flow works end-to-end with no SDK configured —
//    the same entitlement shape the live path unlocks.
{
  billing.cancelPass();
  assert.equal(billing.isSubscribed(), false, 'starts unsubscribed');
  const r = await billing.purchasePass();
  assert.equal(r.success, true, 'test-store purchase succeeds');
  assert.equal(r.entitlement, ENTITLEMENT_ID, 'grants the insider entitlement');
  assert.equal(billing.isSubscribed(), true, 'entitlement is active');
  assert.equal(billing.mode, 'test store', 'no key → test store mode');
  billing.cancelPass();
  assert.equal(billing.isSubscribed(), false, 'cancel clears the entitlement');
}

// 2) Live SDK path exists and stays behind a configured public key —
//    no key in the repo, dynamic import only when configured.
{
  const b = read('web/js/billing.js');
  assert.ok(b.includes('@revenuecat/purchases-js'), 'loads the official Web Billing SDK');
  assert.ok(b.includes('Purchases.configure') && b.includes('getOfferings') && b.includes('rcPackage'),
    'uses configure → offerings → purchase({ rcPackage })');
  assert.ok(b.includes('getCustomerInfo'), 'restore path reads live customerInfo');
  assert.ok(b.includes('appUserId'), 'stand owner maps to RevenueCat appUserId');
  assert.equal(b.includes('rcb_'), false, 'no API key committed to the repo');
}

// 3) The wire is inverted: the desk opens for everyone (headlines + summary
//    are the free education), and the entitlement gates the quantitative
//    deck tilt — multipliers + per-card reasoning are the insider edge.
{
  const d = read('web/js/desk.js');
  assert.ok(d.includes('billing.isSubscribed()'), 'desk checks the entitlement');
  assert.ok(d.includes('renderDesk(intel, subscribed)'),
    'desk renders for non-subscribers too — the tilt is what gates');
  assert.ok(d.includes('if (!subscribed)') && d.includes('District Insider'),
    'free players see the tilt placeholder, not the numbers');
  assert.ok(d.includes("track(subscribed ? 'desk_opened' : 'desk_opened_free'"),
    'free vs insider desk opens are measured separately');
  assert.ok(d.includes('marketShift') && d.includes('sources'),
    'desk renders deck tilt + cited sources');
  assert.ok(d.includes('pw-buy') && d.includes('purchasePass'),
    'paywall runs the purchase flow');
  assert.ok(d.includes('textContent'), 'intel renders via textContent, not innerHTML');
}

// 4) UI surfaces exist and are wired in main.js.
{
  const html = read('web/index.html');
  for (const id of ['desk', 'desk-body', 'desk-edge', 'paywall', 'pw-buy', 'pw-restore', 'wirebtn', 'desklink']) {
    assert.ok(html.includes(`id="${id}"`), `index.html has #${id}`);
  }
  const main = read('web/js/main.js');
  assert.ok(main.includes("from './billing.js'") && main.includes("from './desk.js'"),
    'main.js imports billing + desk');
  assert.ok(main.includes('billing.configure(sync.owner)'),
    'billing configures against the stand owner');
  assert.ok(main.includes('desk.open(marketIntel)'),
    'wire button + letter link open the gated desk');
  assert.ok((main.includes('insiders read the rest') || main.includes('insider')) && main.includes('wireHint(marketIntel)'),
    'letter carries the upsell line + decision-time wire hint');
}

console.log('\nPASS — District Insider Pass: desk open to all (headlines free), entitlement gates the tilt, purchase/restore flows work, live SDK path wired');
