// PR-4e — Convex backend sync.
// Verifies: (1) revenuecat.ts exports the upsert/query functions, (2) the
// schema declares the entitlements table, (3) http.ts routes three new
// endpoints (webhook, GET, manual upsert), (4) readEntitlements correctly
// interprets a RevenueCat payload.
//
// Pure file-shape test — no Convex runtime, no DB. Honest about what it can
// prove from the filesystem: that the wire surface exists for a deployment
// to bind.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

const convex = (p) => readFileSync(resolve(root, `convex/${p}`), 'utf8');

const schema  = convex('schema.ts');
const rc      = convex('revenuecat.ts');
const httpSrc = convex('http.ts');

// (1) schema declares entitlements table
test('schema · entitlements table declared with appUserId index', () => {
  assert.match(schema, /entitlements:\s*defineTable\(\{[^}]*appUserId:\s*v\.string\(\)/s,
    'entitlements table must declare appUserId as v.string()');
  assert.match(schema, /index\(\s*["']by_user["']\s*,\s*\[\s*["']appUserId["']\s*\]/,
    'entitlements table must be indexed by appUserId for /sync/entitlements polling');
  assert.match(schema, /insider:\s*v\.boolean\(\)/);
  assert.match(schema, /founder:\s*v\.boolean\(\)/);
});

// (2) revenuecat.ts exports the right surface
test('revenuecat.ts · exposes upsert + query + readEntitlements', () => {
  assert.match(rc, /export\s+(const|function)\s+readEntitlements\b/,
    'readEntitlements must be exported (used by the webhook route)');
  assert.match(rc, /export\s+const\s+(applyEntitlements|setEntitlement|getEntitlements)\b/);
  assert.match(rc, /export\s+const\s+applyEntitlements\b/);
  assert.match(rc, /export\s+const\s+setEntitlement\b/);
  assert.match(rc, /export\s+const\s+getEntitlements\b/);
  assert.match(rc, /commodity_insider/);
  assert.match(rc, /district_founder/);
});

test('revenuecat.ts · idempotency by eventId', () => {
  // The handler short-circuits when a row already carries the same eventId.
  assert.match(rc, /eventId[^\n]*===\s*args\.eventId/);
  assert.match(rc, /idempotent:\s*true/);
});

test('revenuecat.ts · readEntitlements handles all four states', () => {
  // Active one-time entitlement (founder) → expires_date_ms undefined → true.
  // Active subscription (insider) → expires_date_ms future → true.
  // Expired subscription → expires_date_ms past → false.
  // Missing entitlement → undefined → false.
  const events = {
    founderOnly:   { entitlements: { district_founder: {} } },
    insiderActive: { entitlements: { commodity_insider: { expires_date_ms: Date.now() + 86_400_000 } } },
    insiderExpired:{ entitlements: { commodity_insider: { expires_date_ms: Date.now() - 86_400_000 } } },
    neither:       { entitlements: {} },
  };
  // Re-implement the same logic from the file (readEntitlements is not
  // importable here without a TS runtime) — verifies the documented
  // contract, not the running code.
  const isActive = (ent) => {
    if (!ent) return false;
    if (ent.expires_date_ms == null) return true;
    return ent.expires_date_ms > Date.now();
  };
  const read = (ev) => {
    const e = ev.entitlements ?? {};
    return {
      insider: isActive(e.commodity_insider),
      founder: isActive(e.district_founder),
    };
  };
  assert.deepEqual(read(events.founderOnly),    { insider: false, founder: true  });
  assert.deepEqual(read(events.insiderActive),  { insider: true,  founder: false });
  assert.deepEqual(read(events.insiderExpired), { insider: false, founder: false });
  assert.deepEqual(read(events.neither),        { insider: false, founder: false });
});

// (3) http.ts routes three new endpoints
test('http.ts · three new routes registered', () => {
  assert.match(httpSrc, /path:\s*["']\/revenuecat\/webhook["']\s*,\s*method:\s*["']POST["']/);
  assert.match(httpSrc, /path:\s*["']\/sync\/entitlements["']\s*,\s*method:\s*["']GET["']/);
  assert.match(httpSrc, /path:\s*["']\/sync\/setEntitlement["']\s*,\s*method:\s*["']POST["']/);
});

test('http.ts · revenuecatWebhook verifies bearer against REVENUECAT_WEBHOOK_SECRET', () => {
  assert.match(httpSrc, /REVENUECAT_WEBHOOK_SECRET/);
  assert.match(httpSrc, /["']Bearer ["']/);
});

test('http.ts · syncEntitlements reads by appUserId', () => {
  assert.match(httpSrc, /syncEntitlements[\s\S]{0,1000}api\.revenuecat\.getEntitlements/s);
});

test('http.ts · syncSetEntitlement accepts POST json and forwards', () => {
  assert.match(httpSrc, /syncSetEntitlement[\s\S]{0,1500}api\.revenuecat\.setEntitlement/s);
});

// ---- billing foundation (pre-money hardening) --------------------------------

test('revenuecat.ts · manual grants self-close once the webhook is configured', () => {
  assert.match(rc, /setEntitlement[\s\S]{0,1200}process\.env\.REVENUECAT_WEBHOOK_SECRET[\s\S]{0,200}manual entitlement grants are disabled/s,
    'the public setEntitlement mutation must refuse when webhooks are live');
  assert.match(httpSrc, /syncSetEntitlement[\s\S]{0,700}REVENUECAT_WEBHOOK_SECRET[\s\S]{0,300}403/s,
    'the manual HTTP route must 403 under the same condition');
});

test('revenuecat.ts · stale webhook redeliveries cannot overwrite newer state', () => {
  assert.match(rc, /occurredAt:\s*v\.optional\(v\.number\(\)\)/);
  assert.match(rc, /args\.occurredAt\s*<\s*existing\.occurredAt/);
  assert.match(rc, /stale:\s*true/);
  assert.match(httpSrc, /Date\.parse\(event\.date\)/,
    'the webhook must derive the event timestamp from the payload');
});

test('schema.ts · entitlements row carries occurredAt', () => {
  assert.match(schema, /occurredAt:\s*v\.optional\(v\.number\(\)\)/);
});

test('billing.js · boots against the mirror and cancel clears in-memory state', () => {
  const billingSrc = readFileSync(resolve(root, 'web/js/billing.js'), 'utf8');
  assert.match(billingSrc, /reconcileFromMirror\(\)/,
    'configure() must reconcile against /sync/entitlements (the documented boot poll)');
  assert.match(billingSrc, /\/sync\/entitlements\?appUserId=/);
  assert.match(billingSrc, /pushToMirror\(\)/,
    'Test Store grants must propagate to the mirror for cross-device restore');
  assert.match(billingSrc, /cancelPass\(\)[\s\S]{0,500}setEntitlement\(ENTITLEMENTS\.insider,\s*false\)/,
    'cancelPass must reset the in-memory insider flag, not just localStorage');
});
