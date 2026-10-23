import test from 'node:test';
import assert from 'node:assert/strict';
import { citySeed, cityFromSearch, cityUrl, cityDisplay, normalizeCityName } from '../js/city.js';

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
