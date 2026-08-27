import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFolderChildren, getAppOnlyToken } from './graph-client.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(
  readFileSync(path.join(here, '../fixtures/graph-children-sample.json'), 'utf8'),
);

function fakeFetch(responsesByUrlPrefix) {
  return async (url) => {
    const key = String(url);
    const prefix = Object.keys(responsesByUrlPrefix).find((p) => key.startsWith(p));
    if (!prefix) throw new Error(`Unexpected fetch: ${key}`);
    const body = responsesByUrlPrefix[prefix];
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
}

describe('getAppOnlyToken', () => {
  it('posts a client-credentials request and returns the access token', async () => {
    const fetchImpl = async (url, opts) => {
      expect(url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token');
      expect(opts.method).toBe('POST');
      const body = new URLSearchParams(opts.body);
      expect(body.get('grant_type')).toBe('client_credentials');
      expect(body.get('scope')).toBe('https://graph.microsoft.com/.default');
      expect(body.get('client_id')).toBe('client-1');
      return { ok: true, json: async () => ({ access_token: 'fake-token', expires_in: 3600 }) };
    };
    const token = await getAppOnlyToken({
      tenantId: 'tenant-1', clientId: 'client-1', clientSecret: 'secret-1', fetchImpl,
    });
    expect(token).toBe('fake-token');
  });

  it('throws with the response status and body on a non-ok response', async () => {
    const fetchImpl = async () => ({ ok: false, status: 401, text: async () => 'invalid_client' });
    await expect(getAppOnlyToken({
      tenantId: 't', clientId: 'c', clientSecret: 's', fetchImpl,
    })).rejects.toThrow(/401/);
  });
});

describe('listFolderChildren', () => {
  it('returns only file items, skipping subfolders', async () => {
    const fetchImpl = fakeFetch({
      'https://graph.microsoft.com/v1.0/drives/drive-1/items/folder-1/children': sample,
    });
    const files = await listFolderChildren({
      accessToken: 'tok', driveId: 'drive-1', folderId: 'folder-1', fetchImpl,
    });
    const expectedNames = sample.value.filter((v) => v.file).map((v) => v.name);
    expect(files.map((f) => f.name)).toEqual(expectedNames);
    expect(files.every((f) => f.file)).toBe(true);
  });

  it('follows @odata.nextLink to collect a paginated listing', async () => {
    const page1 = {
      value: [sample.value[0]],
      '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next-page',
    };
    const page2 = { value: sample.value.slice(1) };
    const fetchImpl = fakeFetch({
      'https://graph.microsoft.com/v1.0/drives/drive-1/items/folder-1/children': page1,
      'https://graph.microsoft.com/v1.0/next-page': page2,
    });
    const files = await listFolderChildren({
      accessToken: 'tok', driveId: 'drive-1', folderId: 'folder-1', fetchImpl,
    });
    const expectedCount = sample.value.filter((v) => v.file).length;
    expect(files).toHaveLength(expectedCount);
  });

  it('throws with the response status and body on a non-ok response', async () => {
    const fetchImpl = async () => ({ ok: false, status: 403, text: async () => 'forbidden' });
    await expect(listFolderChildren({
      accessToken: 'tok', driveId: 'd', folderId: 'f', fetchImpl,
    })).rejects.toThrow(/403/);
  });
});
