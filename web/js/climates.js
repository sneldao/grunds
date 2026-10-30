// climates.js — the week-climate envelope (roadmap item 4, first seam).
//
// One climate per campaign, seeded so a campaign replays its own weather.
// The envelope restyles the street first (density + cadence — cosmetic,
// no sim draws); demand and sky hooks ride the same descriptor so a hot
// week can later reweight iced drinks and a rain week flatten the light.
import { seeded } from './exchange.js';

export const CLIMATES = {
  fair: { id: 'fair', label: 'a fair week', streetMul: 1, everyMul: 1, cue: 'Mild light and an easy pace on the pavement.', skyTint: 0xcfe0e8, skyMix: 0, sunMul: 1, starsMul: 1, rain: 0 },
  heat: { id: 'heat', label: 'a heatwave', streetMul: 1.25, everyMul: 0.75, cue: 'Warm haze; more people linger on the pavement.', skyTint: 0xf0c58b, skyMix: 0.14, sunMul: 0.95, starsMul: 1, rain: 0 },
  rain: { id: 'rain', label: 'a wet week', streetMul: 0.55, everyMul: 1.6, cue: 'Grey skies and rain; fewer people linger outside.', skyTint: 0x8393a0, skyMix: 0.65, sunMul: 0.35, starsMul: 0.4, rain: 0.55 },
  crisp: { id: 'crisp', label: 'a cold bright week', streetMul: 0.8, everyMul: 1.2, cue: 'Cool, clear light; a quieter pavement.', skyTint: 0x8eb5d1, skyMix: 0.18, sunMul: 1, starsMul: 1, rain: 0 },
};
export const CLIMATE_IDS = Object.keys(CLIMATES);

// Seeded per campaign: same seed → same week of weather; ?city= folds in so
// "Lisbon" leans its own way. Pure so tests can pick climates headlessly.
export function pickClimate(seed, city) {
  let h = 0;
  if (city) for (const c of String(city)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  const rng = seeded(((seed >>> 0) + h + 601) >>> 0);
  const ids = CLIMATE_IDS;
  // Fair weeks still dominate; weather is a flavour, not a tax.
  const w = [0.4, 0.2, 0.2, 0.2];
  let r = rng(), acc = 0;
  for (let i = 0; i < ids.length; i++) { acc += w[i]; if (r <= acc) return CLIMATES[ids[i]]; }
  return CLIMATES.fair;
}

export function climateBrief(climate) {
  return `${climate.label} — ${climate.cue} Week weather changes the street scene only; daily events can still affect demand.`;
}
export function climateRain(climate, eventId) {
  return Math.max(climate?.rain || 0, eventId === 'rain_soak' ? 0.9 : 0);
}
