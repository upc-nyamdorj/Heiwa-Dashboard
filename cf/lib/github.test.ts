import { describe, it, expect } from 'vitest';
import { decodeBase64Json, encodeJsonBase64 } from './github';

describe('encodeJsonBase64 / decodeBase64Json', () => {
  it('round-trips a plain object', () => {
    const value = { a: 1, b: 'two', c: [1, 2, 3], d: null };
    expect(decodeBase64Json(encodeJsonBase64(value))).toEqual(value);
  });

  it('round-trips Mongolian (non-ASCII) text correctly', () => {
    const value = { party: 'Дельта Констракшн ХХК', note: 'А1–А6 блок' };
    expect(decodeBase64Json(encodeJsonBase64(value))).toEqual(value);
  });

  it('decodes base64 content with embedded newlines the way GitHub returns it', () => {
    const value = { x: 1 };
    const base64 = encodeJsonBase64(value);
    const withNewlines = base64.match(/.{1,20}/g)!.join('\n');
    expect(decodeBase64Json(withNewlines)).toEqual(value);
  });
});
