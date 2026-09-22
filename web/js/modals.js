const OWNED = ['brief', 'offer', 'letter', 'licence', 'paywall', 'desk', 'receipt', 'tutorial', 'title', 'evening'];
const FOCUSABLE = 'a[href],button,input,textarea,select,summary,[tabindex],[contenteditable="true"],[contenteditable=""]';
const INTERACTIVE = 'button,a,input,textarea,select,summary,[contenteditable="true"],[contenteditable=""]';

export function createModalController({ document: doc = globalThis.document, onEscape = () => {}, onShortcut = () => {}, onActiveChange = () => {} } = {}) {
  const stack = [];
  const savedFocus = new Map();
  const savedInert = new Map();

  const el = id => { try { return doc.getElementById(id); } catch { return null; } };
  const panel = root => {
    if (!root) return null;
    try {
      return (root.querySelector && root.querySelector('.modal-panel')) || root.firstElementChild || root;
    } catch { return root; }
  };
  const shown = id => { const e = el(id); return !!(e && e.classList && e.classList.contains('show')); };

  function isHidden(node) {
    try {
      const cs = doc.defaultView && doc.defaultView.getComputedStyle ? doc.defaultView.getComputedStyle(node) : (typeof getComputedStyle === 'function' ? getComputedStyle(node) : null);
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return true;
    } catch {}
    if (node.style && (node.style.display === 'none' || node.style.visibility === 'hidden')) return true;
    return false;
  }

  function inFirstSummary(node, det) {
    let sum = null;
    for (const c of det.children || []) {
      if (c.tagName && String(c.tagName).toLowerCase() === 'summary') { sum = c; break; }
    }
    if (!sum) return false;
    let a = node;
    while (a && a !== doc.body) { if (a === sum) return true; a = a.parentElement || a._parent; }
    return false;
  }

  function isFocusable(node) {
    if (!node || node.disabled || node.hidden) return false;
    if (node.inert === true || (node.hasAttribute && node.hasAttribute('inert'))) return false;
    if (node.tabIndex != null && node.tabIndex < 0) return false;
    if (isHidden(node)) return false;
    let p = node.parentElement || node._parent;
    while (p && p !== doc.body) {
      if (p.hidden || isHidden(p)) return false;
      if (p.tagName && String(p.tagName).toLowerCase() === 'details' && p.open === false && !inFirstSummary(node, p)) return false;
      if (p.tagName && String(p.tagName).toLowerCase() === 'fieldset' && p.disabled === true) return false;
      if (p.inert === true || (p.hasAttribute && p.hasAttribute('inert'))) return false;
      p = p.parentElement || p._parent;
    }
    return true;
  }

  function focusables(id) {
    const root = el(id); if (!root || !root.querySelectorAll) return [];
    let list = [];
    try { list = [...root.querySelectorAll(FOCUSABLE)]; } catch { return []; }
    return list.filter(isFocusable);
  }

  function applyA11y() {
    const t = top();
    for (const id of OWNED) {
      const e = el(id); if (!e) continue;
      const isTop = id === t;
      const inStack = stack.includes(id);
      try {
        if (e.setAttribute) {
          e.setAttribute('aria-hidden', isTop ? 'false' : 'true');
          if (isTop) e.setAttribute('aria-modal', 'true');
          else if (e.removeAttribute) e.removeAttribute('aria-modal');
          if (isTop) { if (e.removeAttribute) e.removeAttribute('inert'); e.inert = false; }
          else { if (e.setAttribute) e.setAttribute('inert', ''); e.inert = true; }
        }
        if (e.style) e.style.zIndex = inStack ? String(60 + stack.indexOf(id)) : '';
      } catch {}
    }
    const bg = doc.body && doc.body.children ? [...doc.body.children] : [];
    for (const child of bg) {
      if (!child || OWNED.includes(child.id)) continue;
      try {
        if (t) {
          if (!savedInert.has(child)) savedInert.set(child, { attr: !!(child.hasAttribute && child.hasAttribute('inert')), prop: child.inert === true });
          if (child.setAttribute) child.setAttribute('inert', ''); child.inert = true;
        } else if (savedInert.has(child)) {
          const s = savedInert.get(child); savedInert.delete(child);
          if (s.attr) { if (child.setAttribute) child.setAttribute('inert', ''); } else if (child.removeAttribute) child.removeAttribute('inert');
          child.inert = s.prop;
        }
      } catch {}
    }
    try { onActiveChange(t); } catch {}
  }

  function focusTop() {
    const t = top(); if (!t) return;
    const p = panel(el(t)); if (!p) return;
    let target = null;
    try { target = el(t).querySelector && el(t).querySelector('[data-modal-autofocus]'); } catch {}
    if (!target || !isFocusable(target)) target = focusables(t)[0] || null;
    try {
      if (target) target.focus();
      else { if (p.setAttribute) p.setAttribute('tabindex', '-1'); p.focus && p.focus(); }
    } catch {}
  }

  function open(id) {
    if (!OWNED.includes(id)) return false;
    const e = el(id); if (!e) return false;
    if (stack[stack.length - 1] === id) { try { e.classList.add('show'); } catch {} return true; }
    const i = stack.indexOf(id);
    if (i >= 0) stack.splice(i, 1);
    const prev = top();
    if (prev !== id) {
      try { const ae = doc.activeElement; if (ae && ae !== doc.body && ae.focus) savedFocus.set(id, ae); } catch {}
    }
    stack.push(id);
    try { e.classList.add('show'); } catch {}
    applyA11y();
    focusTop();
    return true;
  }

  function close(id) {
    const i = stack.indexOf(id);
    const e = el(id);
    if (i < 0) { if (e && e.classList) { try { e.classList.remove('show'); } catch {} } return false; }
    const wasTop = stack[stack.length - 1] === id;
    stack.splice(i, 1);
    try { if (e) e.classList.remove('show'); } catch {}
    applyA11y();
    if (!wasTop) return true;
    let restore = savedFocus.get(id); savedFocus.delete(id);
    if (!restore) restore = savedFocus.get(top());
    const ok = restore && restore.focus && (restore.isConnected !== false) && !isInerted(restore) && isFocusable(restore);
    try { if (ok) restore.focus(); else { const p = panel(el(top())); if (p && p.focus) { if (p.setAttribute) p.setAttribute('tabindex', '-1'); p.focus(); } } } catch {}
    return true;
  }

  function isInerted(node) {
    let p = node;
    while (p && p !== doc.body) {
      if (p.inert === true || (p.hasAttribute && p.hasAttribute('inert'))) return true;
      p = p.parentElement || p._parent;
    }
    return false;
  }

  function closeAll() {
    for (const id of [...stack].reverse()) {
      const e = el(id);
      try { if (e) e.classList.remove('show'); } catch {}
    }
    stack.length = 0;
    savedFocus.clear();
    applyA11y();
  }

  function top() {
    while (stack.length) {
      const id = stack[stack.length - 1];
      const e = el(id);
      if (e && e.isConnected !== false && shown(id)) return id;
      stack.pop();
    }
    return null;
  }

  function closestOf(node, sel) {
    let a = node;
    while (a && a !== doc.body) {
      try { if (a.matches && a.matches(sel)) return a; } catch {}
      a = a.parentElement || a._parent;
    }
    return null;
  }

  function isEditable(node) {
    if (!node || node === doc.body) return false;
    if (node.isContentEditable === true) return true;
    if (closestOf(node, 'input,textarea,select')) return true;
    if (closestOf(node, '[contenteditable="true"],[contenteditable=""]')) return true;
    return false;
  }

  function handleKey(ev) {
    const t = top();
    if (!t) return false;
    const key = ev.key;
    const target = ev.target || (doc && doc.activeElement);
    if (key === 'Tab') {
      const items = focusables(t);
      if (!items.length) { const p = panel(el(t)); try { p && p.focus && p.focus(); } catch {} ev.preventDefault && ev.preventDefault(); return true; }
      const idx = items.indexOf(target);
      if (ev.shiftKey && (idx <= 0)) { items[items.length - 1].focus(); ev.preventDefault && ev.preventDefault(); return true; }
      if (!ev.shiftKey && (idx === -1 || idx === items.length - 1)) { items[0].focus(); ev.preventDefault && ev.preventDefault(); return true; }
      return true;
    }
    if (key === 'Escape') {
      ev.preventDefault && ev.preventDefault();
      try { onEscape(t); } catch {}
      return true;
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return true;
    if (isEditable(target)) return true;
    const interactive = target && target !== doc.body && closestOf(target, INTERACTIVE);
    if (interactive && (key === 'Enter' || key === ' ' || /^[0-9]$/.test(key))) return true;
    try { onShortcut(t, ev); } catch {}
    return true;
  }

  function refresh() { applyA11y(); }
  function dispose() { closeAll(); stack.length = 0; savedFocus.clear(); savedInert.clear(); }

  return { open, close, closeAll, top, handleKey, refresh, dispose, isOpen: shown };
}
