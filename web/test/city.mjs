import test from 'node:test';
import assert from 'node:assert/strict';
import { citySeed, cityFromSearch, cityUrl, cityDisplay, normalizeCityName, MONEY, setMoneySymbol, setMoneyRate, fmt } from '../js/city.js';
import { seedCityNames, seedCastNames, castName, CANON_CAST, NAME_POOLS, WalkinPool } from '../js/identity.js';

test('citySeed — same city, same street, every machine', () => {
  assert.equal(citySeed('lisbon'), citySeed('lisbon'));
  assert.equal(citySeed('Lisbon'), citySeed('lisbon'), 'case-insensitive: shared links must not fork the street');
  assert.equal(citySeed('são paulo'), citySeed('são paulo'));
  assert.notEqual(citySeed('lisbon'), citySeed('london'));
  for (const name of ['lisbon', 'tokyo', 'london', 'são paulo', 'x']) {
    const s = citySeed(name);
    assert.ok(Number.isInteger(s) && s >= 1 && s <= 4294967295, `seed ${s} in uint32 range`);
  }
});

test('cityFromSearch — ?city= parses, normalizes, derives the seed', () => {
  const c = cityFromSearch('?city=lisbon');
  assert.deepEqual(c, { name: 'lisbon', seed: citySeed('lisbon') });
  assert.equal(cityFromSearch('?city=  São   Paulo &demo=1').name, 'são paulo');
  assert.equal(cityFromSearch('?seed=99'), null);
  assert.equal(cityFromSearch('?city='), null);
  assert.equal(cityFromSearch(''), null);
  assert.equal(cityFromSearch('?city=' + 'a'.repeat(80)).name.length, 60, 'names cap at 60 chars');
});

test('cityUrl — ?city= is the canonical share form; ?seed drops', () => {
  const u = new URL(cityUrl('Mexico City', 'https://example.com/play?seed=99&demo=1'));
  assert.equal(u.searchParams.get('city'), 'mexico city');
  assert.equal(u.searchParams.get('seed'), null, 'seed must not shadow the derived city seed');
  assert.equal(u.searchParams.get('demo'), '1', 'other params ride along');
});

test('display + normalize helpers', () => {
  assert.equal(cityDisplay('são paulo'), 'São Paulo');
  assert.equal(normalizeCityName('  Tokyo   Metropolis  '), 'tokyo metropolis');
});

test('boot wires the city end to end (source contracts)', async () => {
  const fs = await import('node:fs/promises');
  const read = p => fs.readFile(new URL(p, import.meta.url), 'utf8');
  const main = await read('../js/main.js');
  assert.match(main, /cityFromSearch\(location\.search\)/, 'main parses ?city=');
  assert.match(main, /seed.*:.*city \? city\.seed : 7/s, 'city seed feeds both SEED sites');
  assert.match(main, /initDistrictGen\(\{[^}]*city: city\?\.name/s, 'district gen receives the city');
  assert.match(main, /buildWorld\([^)]*district: city/s, 'street decal wears the city name');
  assert.match(main, /cityUrl\(v\)/, 'licence go-city builds a canonical link');
  const gen = await read('../js/districtGen.js');
  assert.match(gen, /district\/kit\?seed=\$\{seed\}\$\{cityQ\}/, 'kit polls carry ?city');
  assert.match(gen, /district\/ensure\?seed=\$\{seed\}\$\{cityQ\}/, 'ensure posts carry ?city');
  const http = await read('../../convex/http.ts');
  assert.match(http, /path: "\/city\/pack"/, 'the pack route is live');
  assert.match(http, /api\.city\.pack/, 'the route calls the pack action');
  const district = await read('../../convex/district.ts');
  assert.match(district, /kitSpecForSeed\(args\.seed, args\.city\)/, 'kit + ensure thread the city through');
  const cityTs = await read('../../convex/city.ts');
  assert.match(cityTs, /SANDBASE_API_KEY/, 'the pack is key-gated like the other providers');
  assert.match(cityTs, /claimDaily/, 'uncached calls claim a daily-budget slot');
  assert.match(cityTs, /registerLit/, 'a minted pack claims the city on the lit map');
  const httpSrc = await read('../../convex/http.ts');
  assert.match(httpSrc, /path: "\/city\/list"/, 'the lit map is served');
  const schema = await read('../../convex/schema.ts');
  assert.match(schema, /cities: defineTable/, 'the cities registry is schemaed');
  const card = await read('../js/shareCard.js');
  assert.match(card, /\?city=' \+ encodeURIComponent\(city\)/, 'the share card prints the canonical city link');
  const streets = await read('../streets.html');
  assert.match(streets, /\/city\/list/, 'the gallery lists lit cities');
  const html = await read('../index.html');
  const iCity = html.indexOf('id="lic-city"'), iStreets = html.indexOf('id="lic-streets"');
  assert.ok(iCity > 0 && iCity < iStreets, 'the city field is a first-class licence field, not folded');
  assert.match(main, /location\.assign\(cityUrl\(typedCity\)\)/, 'signing with a typed city re-seats the pitch');
});

test('fmt — default money is byte-identical; a pack price scales + restyles', () => {
  assert.equal(fmt(4.8), '£4.80');
  assert.equal(fmt(-37), '£-37.00');
  assert.equal(fmt(2900), '£2900.00');
  assert.equal(fmt(2900, 2, true), '£2,900.00', 'grouped opt-in matches the books copy');
  assert.equal(fmt(0, 0), '£0');
  assert.equal(fmt(42, 0), '£42');
  setMoneySymbol('€');
  setMoneyRate('4', 4.8);            // Lisbon: a matcha there runs about €4
  assert.equal(fmt(4.8), '€4.00', 'the house matcha reads the quoted local price');
  assert.equal(fmt(2900), '€2416.67');
  assert.equal(fmt(2900, 2, true), '€2,416.67');
  assert.equal(fmt(-37), '€-30.83');
  setMoneySymbol('¥');
  setMoneyRate(4000, 4.8);           // Tokyo: rate ≈833 → whole-yen display
  assert.equal(MONEY.dp, 0);
  assert.equal(fmt(4.8, 0, true), '¥4,000');
  assert.equal(fmt(-0.03), '¥-25');
  setMoneyRate(null, 4.8);           // no pack price → rate 1, symbol only
  setMoneySymbol('£');
  assert.equal(MONEY.rate, 1);
  assert.equal(fmt(4.8), '£4.80');
});

test('seedCityNames — ≥6 local names own the pools; thin packs only append', () => {
  const backup = JSON.parse(JSON.stringify(NAME_POOLS));
  try {
    const local = ['Ada', 'Tunde', 'Aisha', 'Femi', 'Tolu', 'Chidi', 'Ngozi', 'Emeka'];
    seedCityNames(local);
    for (const [cohort, pool] of Object.entries(NAME_POOLS)) {
      assert.deepEqual(pool, local, `${cohort} pool is fully local`);
    }
    // Replacing names never changes the RNG budget: one draw per dealt head,
    // same stream seed — the head count and draw sites are identical.
    const pool = new WalkinPool(7);
    const heads = pool.ensureDay(1);
    assert.equal(heads.length, 24, 'pool still deals the same head count');
    assert.ok(heads.every(h => h.name.split(' ')[0].split('.')[0] !== 'Ash'), 'no stock names survive');
    assert.ok(heads.every(h => local.some(n => h.name.startsWith(n))), 'every walk-in name is local');
    // A thin pack (<6) appends instead of emptying the street.
    for (const k of Object.keys(NAME_POOLS)) NAME_POOLS[k].length = 0, NAME_POOLS[k].push(...backup[k]);
    const before = NAME_POOLS.commuters.length;
    seedCityNames(['Ines', 'Rui', 'Marta']);
    assert.ok(NAME_POOLS.commuters.length > before, 'thin list appends');
    assert.ok(NAME_POOLS.commuters.includes('Ines'));
  } finally {
    for (const k of Object.keys(NAME_POOLS)) { NAME_POOLS[k].length = 0; NAME_POOLS[k].push(...backup[k]); }
  }
});

test('seedCastNames — canon-order map, avoid-list honored, all-or-nothing', () => {
  const local = ['Zé', 'Inês', 'Rui', 'Marta', 'Nuno', 'Lúcia', 'Tiago', 'Bia'];
  seedCastNames(local, ['Inês', 'joão']);
  // 7 usable after Inês is avoided → nothing applies, every name is identity.
  for (const c of CANON_CAST) assert.equal(castName(c), c, `${c} unaliased on a thin list`);

  seedCastNames(local, ['joão', 'maria']);
  assert.equal(castName('Mara'), 'Zé', 'maps in CANON_CAST order');
  assert.equal(castName('Esther'), 'Bia');
  assert.equal(castName('Sam'), 'Sam', 'canon key outside the cast untouched');
  // Case-insensitive avoid.
  seedCastNames([...local], ['ZÉ']);
  assert.equal(castName('Mara'), 'Mara', 'avoided first name → under 8 → no alias');
  // Round-trip: keys stay canon, only the display differs.
  const roster = CANON_CAST.map(name => ({ name, visits: 1 }));
  assert.deepEqual(roster.map(r => r.name), CANON_CAST, 'canon keys unchanged');
  seedCastNames([]);
  assert.equal(castName('Mara'), 'Mara', 'empty map → identity');
});
