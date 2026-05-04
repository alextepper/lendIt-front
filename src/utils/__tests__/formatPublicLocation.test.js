import { describe, it, expect } from 'vitest';
import { formatPublicLocation } from '../formatPublicLocation';

describe('formatPublicLocation', () => {
  it('returns empty for null/empty', () => {
    expect(formatPublicLocation(null)).toBe('');
    expect(formatPublicLocation('')).toBe('');
  });

  it('strips trailing country and postcode', () => {
    const s =
      'Rothschild Boulevard 12, Tel Aviv-Yafo, Tel Aviv District, 6688103, Israel';
    const out = formatPublicLocation(s);
    expect(out).toContain('Tel Aviv-Yafo');
    expect(out).not.toMatch(/6688103/);
    expect(out.toLowerCase()).not.toContain('israel');
    expect(out).not.toMatch(/district/i);
  });

  it('keeps short addresses as-is', () => {
    expect(formatPublicLocation('Tel Aviv')).toBe('Tel Aviv');
    expect(formatPublicLocation('Haifa, Israel')).toBe('Haifa');
  });

  it('drops district and uses street then city', () => {
    const s = 'Dizengoff Street 5, Old North, Tel Aviv-Yafo, Tel Aviv District, Israel';
    const out = formatPublicLocation(s);
    expect(out).not.toMatch(/district/i);
    expect(out).toContain('Tel Aviv-Yafo');
    expect(out).toContain('Dizengoff');
    expect(out.startsWith('Dizengoff')).toBe(true);
  });
});
