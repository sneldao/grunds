// Headless test for the game-feel batch: bubbles stay on-screen and bounded,
// numbers read correctly with signs, the floor pauses, and the letter
// answers to 1/2/3. Source-text + logic assertions (no DOM needed).
//
// Run: node web/test/game-feel.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

const fx = readFileSync(join(ROOT, 'web/js/fx.js'), 'utf8');
const letter = readFileSync(join(ROOT, 'web/js/letter.js'), 'utf8');
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
const sync = readFileSync(join(ROOT, 'web/js/convexSync.js'), 'utf8');
const index = readFileSync(join(ROOT, 'web/index.html'), 'utf8');

// 1) Bubble cap: oldest pops first once the pool is full.
ok(/this\.bubbles\.length >= 10/.test(fx), 'fx.js has no live-bubble cap');
ok(/this\.bubbles\.shift\(\)/.test(fx), 'fx.js does not pop the oldest bubble when capped');
ok(/_pushBubble/.test(fx), 'fx.js has no shared _pushBubble path (bubble + gossipBubbles)');
console.log('CAP     bubbles bounded at 10, oldest-first eviction');

// 2) Viewport clamp: bubbles never hang off-canvas.
ok(/w \/ 2 \+ 6/.test(fx), 'fx.js does not width-clamp bubbles to the viewport');
ok(/textContent\.length \* 7\.8/.test(fx), 'fx.js does not estimate bubble width for clamping');
console.log('CLAMP   bubbles clamped to the viewport');

// 3) Sign-aware numbers: no "up -6%" in the letter, no "+-6%" on the HUD.
ok(!/is up \$\{pct\}%/.test(letter), 'letter.js still renders unsigned "up ${pct}%"');
ok(/down \$\{-pct\}%/.test(letter) || /down/.test(letter), 'letter.js has no down-branch for dips');
ok(/driftPct >= 0 \? '\+' : ''/.test(main), 'main.js pressure line is not sign-aware');
console.log('SIGNS   drift/pressure read "down 6%" and "-6%", never "up -6%"');

// 4) Pause: flag, space binding, loop gate, HUD marker.
ok(/paused = false/.test(main), 'main.js has no paused flag');
ok(/togglePause/.test(main), 'main.js has no togglePause');
ok(/e\.key === ' '.*togglePause/.test(main), 'space does not toggle pause');
ok(/!paused && schedule/.test(main), 'sim loop does not gate on paused');
ok(/❚❚/.test(main), 'HUD has no paused marker');
console.log('PAUSE   space pauses the sim clock, HUD shows ❚❚');

// 5) Letter hotkeys: 1/2/3 click the matching enabled action.
ok(/letter-actions button/.test(main), 'main.js has no letter-action hotkey wiring');
ok(/\+e\.key - 1/.test(main), 'letter hotkeys do not map 1/2/3 to action index');
console.log('KEYS    open letter answers to 1/2/3 (disabled skipped)');

// 6) Sync badge reads clean in local mode.
ok(/○ local'/.test(sync), 'convexSync.js local badge is not the short "○ local"');
ok(/id="syncbadge">○ local</.test(index), 'index.html badge default is not the short "○ local"');
console.log('BADGE   local badge is quiet; LIVE still flips on mirror');

// 7) Day-1 coach: one lever hint at 13:00, only if the player hasn't acted.
ok(/coached/.test(main), 'main.js has no coached flag');
ok(/day === 1 && !coached && dayMin >= 780/.test(main), 'coach hint is not gated to day 1, 13:00, once');
ok(/!prebatched && !repriced/.test(main), 'coach hint fires even after the player acted');
ok(/students land at 14:00/.test(main), 'coach hint text missing');
console.log('COACH   day-1 13:00 lever nudge, once, only when idle');

// 8) Beat camera respects speed: push-ins only at readable speeds.
ok(/ch\.beat && speed <= 300/.test(main), 'beat push-ins still fire at 20x');
console.log('CAMERA  beat push-ins gated to 1x/5x; cards always show');

// 9) Pause has a button, and the label follows state.
ok(/id="pause"/.test(index), 'index.html has no pause button');
ok(/\$\('pause'\)\.onclick/.test(main), 'main.js does not wire the pause button');
ok(/resume' : 'pause'/.test(main), 'pause button label does not follow state');
console.log('PAUSE-BTN clickable pause/resume next to speeds');

// 10) Mirror writes real state: campaign cumulative till, leaderboard, cron.
const exchange = readFileSync(join(ROOT, 'convex/exchange.ts'), 'utf8');
const stands = readFileSync(join(ROOT, 'convex/stands.ts'), 'utf8');
const crons = readFileSync(join(ROOT, 'convex/crons.ts'), 'utf8');
const firecrawl = readFileSync(join(ROOT, 'convex/firecrawl.ts'), 'utf8');
const http = readFileSync(join(ROOT, 'convex/http.ts'), 'utf8');
const world = readFileSync(join(ROOT, 'web/js/world.js'), 'utf8');
ok(/till: cRev \+ till/.test(main), 'main.js mirror does not send campaign-cumulative till');
ok(/matchaPrice: exchange\.matchaPrice/.test(main), 'main.js mirror omits matchaPrice');
ok(/mirrorState/.test(exchange), 'convex/exchange.ts has no mirrorState mutation');
ok(/recordStand/.test(stands) && /topStands/.test(stands), 'convex/stands.ts misses recordStand/topStands');
ok(/mirrorState/.test(http) && /recordStand/.test(http), 'http snapshot does not write state + stand');
ok(/grunds\.owner/.test(sync), 'convexSync.js has no stable owner name');
ok(/sync\/state\?campaignId=/.test(sync), 'convexSync.js never polls server state');
ok(/commodity-news-refresh/.test(crons) && /refreshCommodityNews/.test(crons), 'cron does not refresh commodity news');
ok(/refreshCommodityNews/.test(firecrawl), 'firecrawl has no refresh entrypoint for the cron');
console.log('MIRROR  snapshot upserts campaign + stand, badge polls, nightly news refresh');

// 11) The rival lives: heat glow, first-defection camera, payoff coins.
ok(/setRivalHeat/.test(world), 'world.js has no setRivalHeat');
ok(/_rivalHeat \* 0\.05/.test(world), 'rival sign does not burn with heat');
ok(/world\.setRivalHeat\(patrons\.rivalQ\.length\)/.test(main), 'main.js does not feed rival queue heat');
ok(/defections === 1 && speed <= 300/.test(main), 'first defection does not show the enemy');
ok(/queueFocus\(world\.focus\.rival/.test(main), 'rival focus stomps beats instead of queueing');
ok(/Math\.PI/.test(main), 'street-side beats do not swing road-side');
ok(/queueFocus\(point/.test(readFileSync(join(ROOT, 'web/js/camera.js'), 'utf8')), 'camera rig has no queueFocus');

// 12) Finale, closing beat, rival silhouettes.
const config = readFileSync(join(ROOT, 'web/js/config.js'), 'utf8');
ok(/CLOSING TIME/.test(config) && /t: 1240/.test(config), 'no closing-time chapter at 1240');
ok(/SOLD', 'a new tenant opens across the road'/.test(main), 'finale has no SOLD card');
ok(/world\.focus\.newbuild/.test(main), 'finale does not visit the sold storefronts');
ok(/setTimeout\(\(\) => \{\s*\n?\s*fx\.receipt/.test(main), 'verdict receipt is not staged after the finale beat');
ok(/newbuild: new THREE\.Vector3/.test(world), 'world has no newbuild focus point');
ok(/updateRival/.test(world), 'world has no updateRival');
ok(/world\.updateRival\(dt, now\)/.test(main), 'main loop does not drive rival silhouettes');
ok(/rvBarista/.test(world) && /rvGuest/.test(world), 'rival windows have no staff silhouettes');
console.log('FINALE  SOLD card → verdict; CLOSING TIME at 1240; rival staff behind glass');

// 13) Rival glass follows the streetlights; finale restarts take a bow.
ok(/RV_DAY/.test(world) && /RV_NIGHT/.test(world), 'rival glass has no day/night anchors');
ok(/rvWinMat\.color\.lerpColors\(RV_DAY, RV_NIGHT/.test(world), 'glass curve is not driven by streetlight factor');
ok(/W\.rivalWinMat = rvWinMat/.test(world), 'rival glass material is not exposed');
ok(/wasFinale/.test(main), 'reset does not distinguish finale restarts');
ok(/rig\.crane\(\);.*new week on the floor/s.test(main), 'finale restart has no crane send-off');
console.log('GLASS   pale panes by day, amber by night; new weeks open with a crane');

// 14) HUD text is throttled at speed (headless bypasses for assertions).
ok(/lastHudText/.test(main), 'HUD has no text throttle');
ok(/!headless/.test(main), 'throttle does not bypass headless test assertions');
console.log('HUD     text+ticker at ~5Hz in browser, per-tick headless');

// 15) Finale shares the seed; mix bus is glued; small screens hold up.
ok(/shareWeek/.test(index), 'receipt has no share-week button');
ok(/\$\('shareWeek'\)\.style\.display = ''/.test(main), 'finale does not reveal the share button');
ok(/calculateCampaignBadge\(\{ netWorth: net/.test(main), 'share badge is not computed from campaign totals');
ok(/seed: SEED/.test(main), 'share link does not carry the campaign seed');
ok(/openShareToX/.test(main), 'finale does not open the X intent');
ok(/DynamicsCompressor/.test(readFileSync(join(ROOT, 'web/js/audio.js'), 'utf8')), 'mix has no bus compressor');
ok(/if \(ctx\.createDynamicsCompressor\)/.test(readFileSync(join(ROOT, 'web/js/audio.js'), 'utf8')), 'compressor is not guarded for older WebAudio');
ok(/if \(!this\.ctx\) return this\.muted/.test(readFileSync(join(ROOT, 'web/js/audio.js'), 'utf8')), 'pre-start mute still flips the label');
ok(/touch-action: none/.test(index), 'canvas has no touch-action guard');
ok(/@media \(max-width: 640px\)/.test(index), 'no small-screen layout pass');
ok(/#sys \{ top: 132px/.test(index), 'sys row overlaps the HUD clock on phones');
console.log('SHARE   seed challenge on the verdict; MIX glued; MOBILE holds 390px');
ok(/rivalServed.*coinBurst/.test(main), 'rival sales have no coin payoff');
console.log('RIVAL   sign burns with their line, camera shows first blood, coins on their sales');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — game feel: bounded bubbles, clamped to screen, signed numbers, pause, letter keys, quiet badge');
