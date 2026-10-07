// Deed titles for the Streets gallery. A franchise prompt is usually the
// player's words. A pasted photo is stored as the image URL (that string is
// the asset key), which is the wrong thing to print on the deed.

export function isPhotoDeed(prompt) {
  return /^https?:\/\/\S+$/i.test(String(prompt ?? '').trim());
}

export function deedLabel(prompt) {
  const text = String(prompt ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return 'a stand';
  if (isPhotoDeed(text)) return 'a stand grown from a photo';
  return text;
}

// Words stay in quotes. A photo link becomes the label, not the URL.
export function deedQuote(prompt) {
  const label = deedLabel(prompt);
  return isPhotoDeed(prompt) ? label : `“${label}”`;
}
