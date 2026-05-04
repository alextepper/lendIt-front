/**
 * Shorten a free-text address (e.g. Nominatim display_name) for public UI:
 * keep region/state, city, and street-level parts; drop country, postcodes, etc.
 * Output order: state, city, street (street omitted if empty).
 */

const COUNTRY_NAMES = new Set(
  [
    'israel',
    'ישראל',
    'state of israel',
    'palestine',
    'פלסטין',
    'jordan',
    'egypt',
    'lebanon',
    'syria',
    'united states',
    'united states of america',
    'usa',
    'canada',
    'united kingdom',
    'uk',
    'great britain',
    'england',
    'scotland',
    'wales',
    'ireland',
    'france',
    'germany',
    'italy',
    'spain',
    'portugal',
    'netherlands',
    'belgium',
    'switzerland',
    'austria',
    'greece',
    'poland',
    'czechia',
    'czech republic',
    'romania',
    'bulgaria',
    'hungary',
    'turkey',
    'russia',
    'ukraine',
    'australia',
    'new zealand',
    'india',
    'china',
    'japan',
    'south korea',
    'mexico',
    'brazil',
    'argentina',
    'chile',
    'colombia',
    'south africa',
    'morocco',
    'tunisia',
    'cyprus',
    'malta',
  ].map((s) => normalizeToken(s))
);

function normalizeToken(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function isCountryToken(token) {
  const n = normalizeToken(token);
  if (!n) return false;
  return COUNTRY_NAMES.has(n);
}

function looksLikePostcodeOnly(token) {
  const t = String(token).trim();
  if (!t) return false;
  if (/^\d{5}(-\d{4})?$/.test(t)) return true;
  if (/^\d{5,7}$/.test(t)) return true;
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(t)) return true;
  if (/^il-?\s*\d{5,7}$/i.test(t.replace(/\s+/g, ''))) return true;
  return false;
}

/**
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function formatPublicLocation(raw) {
  if (raw == null) return '';
  const str = String(raw).trim();
  if (!str) return '';

  let parts = str
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return str;

  while (parts.length > 0) {
    const last = parts[parts.length - 1];
    if (isCountryToken(last) || looksLikePostcodeOnly(last)) {
      parts.pop();
      continue;
    }
    break;
  }

  if (parts.length === 0) return str;

  if (parts.length <= 2) {
    return parts.join(', ');
  }

  const state = parts[parts.length - 1];
  const city = parts[parts.length - 2];
  let streetParts = parts.slice(0, parts.length - 2);
  if (streetParts.length > 2) {
    streetParts = streetParts.slice(0, 2);
  }
  const street = streetParts.join(', ').trim();
  return [state, city, street].filter(Boolean).join(', ');
}
