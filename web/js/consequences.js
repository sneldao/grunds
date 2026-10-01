export const WALKOUT_OP = { balked: -0.08, defected: -0.12 };

export const ABSENCE_WORD = {
  away: 'Stayed away today.',
  returning: 'Giving you another chance.',
  lost: 'Now goes to Glasshouse.',
};

const UNHAPPY = -0.2;

function hadBadDay(r, day) {
  return (r.events || []).some(e => e.day === day - 1 && (e.outcome === 'balked' || e.outcome === 'defected'));
}

function awayReason(r) {
  const last = r.events && r.events.length ? r.events[r.events.length - 1] : null;
  if (last && last.outcome === 'balked') return 'still annoyed about walking out of a long line';
  if (last && last.outcome === 'defected') return 'tried Glasshouse instead yesterday';
  return 'not happy with how things have been';
}

export function planAttendance(roster, { day } = {}) {
  const out = { away: [], returning: [], lost: [] };
  for (const r of roster) {
    r.justLost = false;
    r._defectShown = false;
    if (r.absence === 'lost') continue;
    const unhappy = (r.op ?? 0) < UNHAPPY;
    const bad = hadBadDay(r, day);
    if (r.absence === 'returning') {
      if (unhappy || bad) {
        r.absence = 'lost'; r.absentReason = null; r.justLost = true;
        out.lost.push(r);
      } else {
        r.absence = 'present'; r.absentReason = null;
      }
    } else if (r.absence === 'away') {
      r.absence = 'returning'; r.absentReason = null;
      out.returning.push(r);
    } else if (unhappy || bad) {
      r.absence = 'away'; r.absentReason = awayReason(r);
      out.away.push(r);
    } else {
      r.absence = 'present'; r.absentReason = null;
    }
  }
  return out;
}

export function incidentCost(base, share, till) {
  return Math.max(base, Math.round((share * till) / 5) * 5);
}
