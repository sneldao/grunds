// Morning stock loan. A lump from the supplier, separate from Idris's tab.
// Optional, once a morning, before the doors open. Cash can buy the case,
// the lot, or the sponsor; whatever is still in the purse when the doors
// open goes back to the lender. 18% is due at close from the till, before
// the pitch and before the tab. The tab's £4 floor, 2.5% rate, and £3,500
// cap do not apply here.
//
// The case's return stays capped at 48%. The loan does not raise that cap,
// the loyalty return cap, or the milk van.

export const LOAN_STEP = 400;
export const LOAN_MAX = 1600;
export const LOAN_RATE = 0.18;
export const CASE_COST = 400;
export const CASE_RETURN_CAP = 0.48;

const SPENDS = new Set(['case', 'lot', 'sponsor']);

export function pence(n) {
  return Math.round((n || 0) * 100) / 100;
}

// £0 or a whole step up to £1,600. Anything else is not a draw.
export function loanAmount(raw) {
  if (raw === 0) return 0;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
  const steps = raw / LOAN_STEP;
  if (Math.abs(steps - Math.round(steps)) > 1e-9) return null;
  const n = Math.round(steps) * LOAN_STEP;
  if (n > LOAN_MAX) return null;
  return n;
}

// 18% of whatever is still outstanding, in pence. Not the tab's max(£4, 2.5%).
export function loanDue(balance) {
  const principal = Math.max(0, pence(balance));
  const interest = Math.round(Math.round(principal * 100) * LOAN_RATE) / 100;
  return { principal, interest, due: pence(principal + interest) };
}

export function caseRevenue(cost) {
  const base = Math.max(0, pence(cost));
  return Math.round(Math.round(base * 100) * (1 + CASE_RETURN_CAP)) / 100;
}

export function takeLoanPayment(balance, cash) {
  const { due, interest, principal } = loanDue(balance);
  const loanPaid = Math.min(Math.max(0, cash), due);
  return { principal, interest, due, loanPaid: pence(loanPaid), loanUnpaid: pence(due - loanPaid) };
}

// Lender, then the pitch on what's left, then the tab. Pitch is the floor
// (or the turnover rate) against the till after the loan has been paid.
export function quoteClose({ till = 0, cash = null, balance = 0, pitchMin = 0, pitchPct = 0, tabDue = 0 } = {}) {
  const pot = Math.max(0, till);
  const reachable = cash == null ? pot : Math.min(pot, Math.max(0, cash));
  const pay = takeLoanPayment(balance, reachable);
  const tillAfterLoan = pence(pot - pay.loanPaid);
  const pitch = Math.max(pitchMin, Math.max(0, tillAfterLoan) * pitchPct);
  const afterPitch = Math.max(0, tillAfterLoan - pitch);
  const tabPaid = Math.min(afterPitch, Math.max(0, tabDue));
  return {
    ...pay,
    tillAfterLoan,
    pitch,
    tabPaid: pence(tabPaid),
    tabUnpaid: pence(Math.max(0, tabDue) - tabPaid),
  };
}

export class MorningLoan {
  constructor() { this.reset(); }

  reset() {
    this.balance = 0;
    this.missedCloses = 0;
    this.seized = false;
    this.beginMorning();
    this.dueToday = 0;
    this.paidToday = 0;
    this.unpaidToday = 0;
    this.returnedToday = 0;
  }

  beginMorning() {
    this.chose = false;
    this.opened = false;
    this.drawn = 0;
    this.purse = 0;
    this.spent = { case: 0, lot: 0, sponsor: 0 };
  }

  borrow(amount) {
    if (this.opened) return { ok: false, why: 'doors are open' };
    if (this.chose) return { ok: false, why: 'once per morning' };
    const n = loanAmount(amount);
    if (n == null || n <= 0) return { ok: false, why: 'not a step' };
    this.chose = true;
    this.drawn = n;
    this.purse = n;
    return { ok: true, amount: n };
  }

  skip() {
    if (this.opened) return { ok: false, why: 'doors are open' };
    if (this.chose) return { ok: false, why: 'once per morning' };
    this.chose = true;
    return { ok: true, amount: 0 };
  }

  spend(kind, amount) {
    if (this.opened) return { ok: false, spent: 0, why: 'doors are open' };
    if (!SPENDS.has(kind)) return { ok: false, spent: 0, why: 'the loan only buys the case, the lot, or the sponsor' };
    if (kind === 'case' && this.seized) return { ok: false, spent: 0, why: 'no case' };
    const want = Math.max(0, amount);
    let take = Math.min(this.purse, want);
    if (kind === 'case') take = Math.floor(take / CASE_COST) * CASE_COST;
    take = pence(take);
    this.purse = pence(this.purse - take);
    this.spent[kind] = pence((this.spent[kind] || 0) + take);
    return { ok: true, spent: take, purse: this.purse };
  }

  // Unspent purse goes back. Only what was spent joins the balance.
  open() {
    const returned = pence(this.purse);
    const kept = pence(this.drawn - returned);
    this.returnedToday = returned;
    this.purse = 0;
    this.drawn = 0;
    this.balance = pence(this.balance + kept);
    this.opened = true;
    this.chose = true;
    return { returned, kept, balance: this.balance };
  }

  refund(amount) {
    const n = pence(amount);
    if (n <= 0) return;
    this.balance = Math.max(0, pence(this.balance - n));
  }

  // 18% on the outstanding lump. Unpaid due rolls, already re-rated.
  // Two missed closes, or a week-end where the loan is still bigger than
  // the cash offered to it, and the next delivery is taken.
  settle(cash, { weekEnd = false } = {}) {
    const pay = takeLoanPayment(this.balance, cash);
    this.dueToday = pay.due;
    this.paidToday = pay.loanPaid;
    this.unpaidToday = pay.loanUnpaid;
    if (pay.loanUnpaid > 0.001) {
      this.missedCloses += 1;
      this.balance = pay.loanUnpaid;
    } else if (pay.due > 0) {
      this.missedCloses = 0;
      this.balance = 0;
      this.seized = false;
    }
    const cashLeft = Math.max(0, pence(Math.max(0, cash) - pay.loanPaid));
    if (this.missedCloses >= 2) this.seized = true;
    if (weekEnd && this.balance > cashLeft + 0.001) this.seized = true;
    return {
      ...pay,
      cashLeft,
      balance: this.balance,
      missedCloses: this.missedCloses,
      seized: this.seized,
    };
  }
}
