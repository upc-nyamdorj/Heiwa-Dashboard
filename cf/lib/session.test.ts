import { describe, it, expect } from 'vitest';
import {
  createSessionToken, verifySessionToken, timingSafeEqualString, parseCookie, sessionCookieHeader, COOKIE_NAME,
} from './session';

describe('timingSafeEqualString', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqualString('secret', 'secret')).toBe(true);
  });
  it('returns false for different strings of the same length', () => {
    expect(timingSafeEqualString('secret', 'secrat')).toBe(false);
  });
  it('returns false for different-length strings', () => {
    expect(timingSafeEqualString('secret', 'secrets')).toBe(false);
  });
});

describe('createSessionToken / verifySessionToken', () => {
  it('round-trips a valid token', async () => {
    const token = await createSessionToken('admin', 'my-secret');
    const session = await verifySessionToken(token, 'my-secret');
    expect(session).toEqual({ username: 'admin' });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken('admin', 'secret-a');
    const session = await verifySessionToken(token, 'secret-b');
    expect(session).toBeNull();
  });

  it('rejects a tampered payload (username changed after signing)', async () => {
    const token = await createSessionToken('admin', 'my-secret');
    const [, exp, sig] = token.split('.');
    const tampered = `attacker.${exp}.${sig}`;
    expect(await verifySessionToken(tampered, 'my-secret')).toBeNull();
  });

  it('rejects an expired token', async () => {
    const [username] = (await createSessionToken('admin', 'my-secret')).split('.');
    const pastExp = Math.floor(Date.now() / 1000) - 10;
    // Can't forge a valid signature for an arbitrary past exp without the
    // secret, so build one the same way createSessionToken does internally
    // by re-signing that exact payload.
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode('my-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const payload = `${username}.${pastExp}`;
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const expiredToken = `${payload}.${hex}`;
    expect(await verifySessionToken(expiredToken, 'my-secret')).toBeNull();
  });

  it('rejects a malformed token', async () => {
    expect(await verifySessionToken('not-a-real-token', 'my-secret')).toBeNull();
    expect(await verifySessionToken(undefined, 'my-secret')).toBeNull();
  });
});

describe('parseCookie', () => {
  it('extracts the named cookie from a Cookie header with multiple cookies', () => {
    const header = `other=1; ${COOKIE_NAME}=abc.def.ghi; another=2`;
    expect(parseCookie(header, COOKIE_NAME)).toBe('abc.def.ghi');
  });

  it('returns undefined when the cookie is absent or the header is null', () => {
    expect(parseCookie('other=1', COOKIE_NAME)).toBeUndefined();
    expect(parseCookie(null, COOKIE_NAME)).toBeUndefined();
  });
});

describe('sessionCookieHeader', () => {
  it('sets HttpOnly, Secure, SameSite=Strict, and a 1 hour Max-Age', () => {
    const header = sessionCookieHeader('tok');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Max-Age=3600');
    expect(header).toContain(`${COOKIE_NAME}=tok`);
  });
});
