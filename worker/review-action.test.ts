import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from './index';
import type { Env } from './env';
import { COOKIE_NAME, createSessionToken } from '../cf/lib/session';

const SOURCE_FILE = {
  name: '1. 004 BI CWA Тал ХХК 20260413.pdf',
  webUrl: 'https://upcmn.sharepoint.com/sites/heiwa/Shared%20Documents/004.pdf',
  itemId: '01ABCDEF1234567890',
};

/** Minimal Contract the dashboard's own schema accepts. */
const FINAL_RECORD = {
  key: 'BI/900', system: 'BI', docNo: '900', contractNo: null, party: 'Тал ХХК',
  partyRole: null, category: 'Ажил гүйцэтгэгч', categoryNo: '1', typeCode: 'CWA',
  typeLabel: 'Ажил гүйцэтгэх гэрээ', filename: 'x.pdf', path: 'x/x.pdf',
  signedDate: null, start: null, end: null, periodSource: 'гэрээ', value: null,
  valueBasis: 'нийт', valueBasisNote: null, baseValue: null, currency: 'MNT',
  vatIncluded: null, advancePercent: null, retentionPercent: null, scope: null,
  notes: null, amendments: [], paid: 0, paymentCount: 0, paidPercent: null,
  rateBased: false,
};

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response('asset') } as unknown as Env['ASSETS'],
    USERS_DB: {
      prepare: () => { throw new Error('USERS_DB not stubbed in this test'); },
    } as unknown as Env['USERS_DB'],
    SESSION_SECRET: 'session-secret',
    SYNC_PASSWORD: 'p', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'pw',
    ADMIN_SESSION_SECRET: 'admin-secret', GITHUB_PAT: 'pat',
    GITHUB_OWNER: 'owner', GITHUB_REPO: 'repo',
    VIEW_USERNAME: 'viewer', VIEW_PASSWORD: 'vpw', VIEW_SESSION_SECRET: 'view-secret',
    MS_OAUTH_CLIENT_ID: 'id', MS_OAUTH_TENANT_ID: 't',
    MS_OAUTH_CLIENT_SECRET: 's', OAUTH_SESSION_SECRET: 'o',
    ...overrides,
  };
}

const b64 = (o: unknown) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))));

/**
 * Stands in for the Contents API: serves the two files the handler reads and
 * records what it writes back.
 */
function stubGithub(pending: unknown[], dataset: Record<string, unknown[]>) {
  const writes: Record<string, Record<string, unknown[]>> = {};
  vi.stubGlobal('fetch', async (url: string, opts?: RequestInit) => {
    const path = String(url).split('/contents/')[1]?.split('?')[0] ?? '';
    if (!opts || opts.method !== 'PUT') {
      const body = path.includes('pending-review') ? pending : dataset;
      return new Response(JSON.stringify({ sha: `sha-${path}`, content: b64(body) }), { status: 200 });
    }
    const sent = JSON.parse(opts.body as string) as { content: string };
    writes[path] = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(sent.content), (c) => c.charCodeAt(0)),
    ));
    return new Response('{}', { status: 200 });
  });
  return writes;
}

const approve = async (env: Env) => {
  const token = await createSessionToken('admin', env.ADMIN_SESSION_SECRET);
  return worker.fetch(
    new Request('https://dash.example.com/api/review-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${COOKIE_NAME}=${token}` },
      body: JSON.stringify({ recordId: 'rec-1', decision: 'approve', finalRecord: FINAL_RECORD }),
    }),
    env,
  );
};

afterEach(() => vi.unstubAllGlobals());

describe('approving a pending record', () => {
  it('carries the source file into the dataset, so the row can link back to its PDF', async () => {
    const writes = stubGithub(
      [{ id: 'rec-1', status: 'pending', sourceFile: SOURCE_FILE, extracted: { targetCollection: 'contracts' } }],
      { contracts: [] },
    );

    const res = await approve(makeEnv());
    expect(res.status).toBe(200);

    const saved = writes['worker/data/heiwa.json'].contracts[0] as typeof FINAL_RECORD & {
      sourceFile: typeof SOURCE_FILE;
    };
    expect(saved.key).toBe('BI/900');
    // Taken from the pending record, not from the submitted form.
    expect(saved.sourceFile).toEqual(SOURCE_FILE);
  });

  it('ignores a sourceFile the form tried to supply — the sync-captured one wins', async () => {
    const writes = stubGithub(
      [{ id: 'rec-1', status: 'pending', sourceFile: SOURCE_FILE, extracted: { targetCollection: 'contracts' } }],
      { contracts: [] },
    );
    const env = makeEnv();
    const token = await createSessionToken('admin', env.ADMIN_SESSION_SECRET);
    await worker.fetch(
      new Request('https://dash.example.com/api/review-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `${COOKIE_NAME}=${token}` },
        body: JSON.stringify({
          recordId: 'rec-1',
          decision: 'approve',
          finalRecord: { ...FINAL_RECORD, sourceFile: { name: 'wrong.pdf', webUrl: 'https://evil.example/x', itemId: 'nope' } },
        }),
      }),
      env,
    );

    const saved = writes['worker/data/heiwa.json'].contracts[0] as { sourceFile: typeof SOURCE_FILE };
    expect(saved.sourceFile).toEqual(SOURCE_FILE);
  });

  it('still approves a record the sync captured no source file for', async () => {
    const writes = stubGithub(
      [{ id: 'rec-1', status: 'pending', extracted: { targetCollection: 'contracts' } }],
      { contracts: [] },
    );

    const res = await approve(makeEnv());
    expect(res.status).toBe(200);
    const saved = writes['worker/data/heiwa.json'].contracts[0] as Record<string, unknown>;
    expect(saved.key).toBe('BI/900');
    expect(saved.sourceFile).toBeUndefined();
  });
});
