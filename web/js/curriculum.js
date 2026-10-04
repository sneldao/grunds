export const TOOL_IDS = ['coffee', 'menu', 'street', 'insurance', 'tab'];

// Loseable day 1, easy-by-default: the menu tool is visible from day 1 so a
// player CAN gouge prices or gut the menu on the first morning (and lose for
// it). Nothing else changes on day 1 — the tool is present but quiet, the
// Brief still teaches prep first. Later days unlock the rest on schedule.
// (Day-1 presence is hard-coded in planTools; SCHEDULE still gates the card.)
const SCHEDULE = { coffee: 2, menu: 3, street: 4, insurance: 5 };

export function planTools({
  day = 1, introduced = [], houseStock = 0, lastPour = 0,
  debt = 0, contract = false, threatToday = false, threatYesterday = false,
  unlockAll = false,
} = {}) {
  const intro = introduced instanceof Set ? introduced : new Set(introduced);
  if (unlockAll) return { visible: new Set(TOOL_IDS), newToday: null, essentialNew: [] };
  const visible = new Set();
  const essentialNew = [];
  let newToday = null;
  // Loseable day 1, easy-by-default: the menu tool is present from the first
  // morning (a player CAN gouge or gut the menu and lose for it), but it
  // never takes the day-1 card — the Brief still teaches prep first.
  if (day === 1) return { visible: new Set(['menu']), newToday: null, essentialNew };
  if (day >= 2) {
    visible.add('menu');
    for (const t of intro) if (TOOL_IDS.includes(t)) visible.add(t);
    const needCoffee = houseStock <= 0 || (lastPour > 0 && houseStock < lastPour);
    const needTab = debt > 0;
    const threat = threatToday || threatYesterday || contract;
    const eligible = t => !intro.has(t)
      && (t === 'coffee' ? true
        : t === 'menu' ? day >= SCHEDULE.menu
        : t === 'street' ? day >= SCHEDULE.street
        : day >= SCHEDULE.insurance || threat);
    const order = threat && eligible('insurance')
      ? ['insurance', 'coffee', 'menu', 'street'].filter(eligible)
      : ['coffee', 'menu', 'street', 'insurance'].filter(eligible);
    newToday = order[0] || null;
    if (newToday) visible.add(newToday);
    if (needCoffee) {
      visible.add('coffee');
      if (!intro.has('coffee') && newToday !== 'coffee') essentialNew.push('coffee');
    }
    if (needTab) { visible.add('tab'); if (!intro.has('tab')) essentialNew.push('tab'); }
  }
  return { visible, newToday, essentialNew };
}

export function toolCopy(id, ctx = {}) {
  switch (id) {
    case 'coffee': {
      const lots = Object.entries(ctx.lots || {})
        .filter(([, def]) => def && def.unlocked !== false)
        .map(([id, def]) => {
          let fav = null;
          for (const [cohort, v] of Object.entries(def.affinity || {})) {
            if (fav === null || v > def.affinity[fav]) fav = cohort;
          }
          return `${def.name || id} · ${def.origin || ''} — ${def.blurb || ''} · favoured by ${fav || 'regulars'}`;
        });
      return {
        title: 'Your coffee',
        voice: 'Idris: “Three coffees are in your cellar, and each has its own crowd.”',
        why: 'Choose today’s house coffee. Fresh beans keep regulars happy — restock before the sack runs dry.',
        lots,
      };
    }
    case 'menu':
      return {
        title: 'Your menu',
        voice: 'Ruth: “Some drinks take longer than others.”',
        why: 'Slower drinks hold up the line during a rush. Nudge a price or take a drink off — today’s menu is ready as it is.',
      };
    case 'street':
      return {
        title: 'Your street',
        voice: 'The street forgets you a little overnight.',
        why: 'Street work costs today and brings people in tomorrow.',
      };
    case 'insurance':
      return {
        title: 'Covering bean prices',
        voice: ctx.threat ? 'Idris: “The bean market may move.”' : 'Idris: “When the market turns, you can lock today’s price.”',
        why: 'Insurance fixes the bean price for a set number of cups. It costs a fee and doesn’t add stock.',
      };
    case 'tab':
      return { note: essentialNote('tab', ctx) };
    default:
      return null;
  }
}

export function essentialNote(id, ctx = {}) {
  if (id === 'coffee') return 'Your house coffee is running low — choose a coffee and restock it. Supplies go on Idris’s tab.';
  if (id === 'tab') return `You owe Idris £${(+ctx.debt || 0).toFixed(2)}. Interest is added each day (${(((+ctx.rate) || 0) * 100).toFixed(1)}%) until you settle.`;
  return null;
}
