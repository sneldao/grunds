import assert from 'node:assert/strict';
import {
  calculateCampaignBadge,
  formatShareText,
  openShareToX,
  BASE_URL,
} from '../js/share.js';

console.log('Testing Viral Hooks & Social Share Cards...');

// 1. Badge Assignment Tests
{
  const master = calculateCampaignBadge({
    netWorth: 32000,
    reputation: 72,
    served: 4000,
    balked: 100,
    debt: 0,
  });
  assert.equal(master.title, 'Master Roaster', 'Flawless run should award Master Roaster');

  const debtFree = calculateCampaignBadge({
    netWorth: 22000,
    reputation: 65,
    served: 3000,
    balked: 300,
    debt: 0,
  });
  assert.equal(debtFree.title, 'Debt Free', 'Zero debt with good net worth should award Debt Free');

  const strategist = calculateCampaignBadge({
    netWorth: 18000,
    reputation: 64,
    served: 2000,
    balked: 120, // 6% balk ratio
    debt: 50,
  });
  assert.equal(strategist.title, 'Matcha Strategist', 'Low balk ratio should award Matcha Strategist');

  console.log('BADGES  badge evaluation criteria verified');
}

// 2. Share Text Formatting & Seed Verification
{
  const text = formatShareText({
    day: 3,
    maxDays: 5,
    till: 14280.50,
    reputation: 68,
    verdict: 'Held the line when it mattered.',
    seed: 1337,
    badge: { title: 'Matcha Strategist', icon: '🍵' },
  });

  assert(text.includes('Day 3/5'), 'Text must include day progression');
  assert(text.includes('Seed #1337'), 'Text must include seed');
  assert(text.includes('Till: £14280.50'), 'Text must format till value');
  assert(text.includes(`${BASE_URL}?seed=1337`), 'Text must contain seed URL');
  assert(text.includes('Matcha Strategist'), 'Text must display badge');

  console.log('SHARE   share card text & link formatting verified');
}

// 3. X Intent URL Encoding Test
{
  const xUrl = openShareToX({
    day: 1,
    till: 5000,
    seed: 42,
  });

  assert(xUrl.startsWith('https://x.com/intent/tweet?text='), 'X intent URL must be valid');
  assert(xUrl.includes('seed%3D42') || xUrl.includes('seed=42'), 'X intent URL must encode seed param');

  console.log('INTENT  X share intent encoding verified');
}

console.log('\nPASS — social share card generator, badge logic, and seed links all hold.');
