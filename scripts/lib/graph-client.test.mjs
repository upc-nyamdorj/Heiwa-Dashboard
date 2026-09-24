import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFolderChildren, listFolderTree, getAppOnlyToken } from './graph-client.mjs';

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

const CHILDREN = (id) => `https://graph.microsoft.com/v1.0/drives/drive-1/items/${id}/children`;
const folder = (id, name) => ({ id, name, folder: { childCount: 1 } });
const file = (id, name) => ({ id, name, eTag: `"{${id}},1"`, webUrl: `https://x/${id}`, file: { mimeType: 'application/pdf' } });

describe('listFolderChildren', () => {
  it('returns top-level files and descends into subfolders', async () => {
    const fetchImpl = fakeFetch({
      [CHILDREN('folder-1')]: sample,
      [CHILDREN('01ABCDEF345678')]: { value: [file('arch-1', 'old.pdf')] },
    });
    const files = await listFolderChildren({
      accessToken: 'tok', driveId: 'drive-1', folderId: 'folder-1', fetchImpl,
    });
    const topLevel = sample.value.filter((v) => v.file).map((v) => v.name);
    expect(files.map((f) => f.path)).toEqual([...topLevel, 'Archive/old.pdf']);
    expect(files.every((f) => f.file)).toBe(true);
  });

  it('finds files that live only in nested subfolders, tagging each with its full path', async () => {
    // Mirrors the real sync folder: nothing at the top, PDFs one or two levels down.
    const fetchImpl = fakeFetch({
      [CHILDREN('root')]: { value: [folder('c1', '1. Ажил гүйцэтгэгч'), folder('c2', '5. Зураг зохиогч')] },
      [CHILDREN('c1')]: { value: [file('f1', 'гэрээ.pdf'), folder('c1a', '2026')] },
      [CHILDREN('c1a')]: { value: [file('f2', 'акт.pdf')] },
      [CHILDREN('c2')]: { value: [file('f3', 'зураг.pdf'), folder('empty', 'Хоосон')] },
      [CHILDREN('empty')]: { value: [] },
    });
    const files = await listFolderChildren({
      accessToken: 'tok', driveId: 'drive-1', folderId: 'root', fetchImpl,
    });
    expect(files.map((f) => [f.id, f.path]).sort()).toEqual([
      ['f1', '1. Ажил гүйцэтгэгч/гэрээ.pdf'],
      ['f2', '1. Ажил гүйцэтгэгч/2026/акт.pdf'],
      ['f3', '5. Зураг зохиогч/зураг.pdf'],
    ]);
    expect(files.find((f) => f.id === 'f2').eTag).toBe('"{f2},1"');
  });

  it('stops at maxDepth and warns about each folder it did not enter', async () => {
    const fetchImpl = fakeFetch({
      [CHILDREN('root')]: { value: [file('f0', 'top.pdf'), folder('d1', 'a')] },
      [CHILDREN('d1')]: { value: [file('f1', 'one.pdf'), folder('d2', 'b')] },
      [CHILDREN('d2')]: { value: [file('f2', 'two.pdf')] },
    });
    const warnings = [];
    const files = await listFolderChildren({
      accessToken: 'tok', driveId: 'drive-1', folderId: 'root', maxDepth: 2, fetchImpl,
      onWarn: (m) => warnings.push(m),
    });
    expect(files.map((f) => f.path)).toEqual(['top.pdf', 'a/one.pdf']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/"a\/b".*2-level limit/);
  });

  it('follows @odata.nextLink to collect a paginated listing', async () => {
    const page1 = {
      value: [sample.value[0]],
      '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next-page',
    };
    const page2 = { value: sample.value.slice(1) };
    const fetchImpl = fakeFetch({
      [CHILDREN('folder-1')]: page1,
      'https://graph.microsoft.com/v1.0/next-page': page2,
      [CHILDREN('01ABCDEF345678')]: { value: [] },
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

describe('listFolderTree', () => {
  it('reports each file with the folder path it was found in', async () => {
    const fetchImpl = fakeFetch({
      [CHILDREN('root')]: { value: [file('f0', 'top.pdf'), folder('d1', 'a')] },
      [CHILDREN('d1')]: { value: [file('f1', 'one.pdf')] },
    });
    const files = await listFolderTree({ accessToken: 'tok', driveId: 'drive-1', folderId: 'root', fetchImpl });
    expect(files).toEqual([
      { id: 'f0', name: 'top.pdf', webUrl: 'https://x/f0', folderPath: '' },
      { id: 'f1', name: 'one.pdf', webUrl: 'https://x/f1', folderPath: 'a' },
    ]);
  });
});
