/**
 * Minimal Microsoft Graph client for app-only (client credentials) access to
 * one SharePoint/OneDrive folder. Every function takes an injectable
 * `fetchImpl` so the sync logic is testable against a fixture without real
 * Azure credentials — see graph-client.test.mjs.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export async function getAppOnlyToken({ tenantId, clientId, clientSecret, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    throw new Error(`Azure AD token request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

/** Default recursion cap for listFolderChildren — deep enough for any real filing scheme. */
export const DEFAULT_MAX_DEPTH = 8;

/** Every page of one folder's children, following @odata.nextLink. */
async function fetchAllChildren({ accessToken, driveId, itemId, select, fetchImpl }) {
  let url = `${GRAPH_BASE}/drives/${driveId}/items/${itemId}/children?$select=${select}`;
  const items = [];
  while (url) {
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`Graph list children failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    items.push(...(data.value ?? []));
    url = data['@odata.nextLink'] ?? null;
  }
  return items;
}

/**
 * Every file under the sync folder, descending into subfolders — the real
 * folder keeps its PDFs in per-category subfolders ("1. Ажил гүйцэтгэгч/…"),
 * so a top-level-only listing finds nothing. Each file is tagged with `path`,
 * its location relative to the sync folder (e.g. "1. Ажил гүйцэтгэгч/x.pdf").
 *
 * Top-level children are depth 1. Folders deeper than `maxDepth` are not
 * entered; each one skipped is reported via `onWarn` so a too-low cap shows up
 * in the log instead of silently dropping files.
 */
export async function listFolderChildren({
  accessToken, driveId, folderId, maxDepth = DEFAULT_MAX_DEPTH,
  fetchImpl = fetch, onWarn = (msg) => console.warn(msg),
}) {
  const out = [];
  const queue = [{ id: folderId, path: '', depth: 1 }];

  while (queue.length) {
    const { id, path: folderPath, depth } = queue.shift();
    const items = await fetchAllChildren({
      accessToken, driveId, itemId: id, fetchImpl,
      select: 'id,name,eTag,lastModifiedDateTime,size,webUrl,file,folder',
    });
    for (const item of items) {
      const childPath = folderPath ? `${folderPath}/${item.name}` : item.name;
      if (item.file) {
        out.push({ ...item, path: childPath });
      } else if (item.folder) {
        if (depth < maxDepth) queue.push({ id: item.id, path: childPath, depth: depth + 1 });
        else onWarn(`Warning: "${childPath}" is deeper than the ${maxDepth}-level limit — its contents were not listed.`);
      }
    }
  }
  return out;
}

/**
 * Every file under the sync folder, recursively, each tagged with the folder
 * path it was found in (relative to the sync folder, "" at the top). Used by
 * the one-off backfill, which matches on folderPath.
 */
export async function listFolderTree({ accessToken, driveId, folderId, fetchImpl = fetch }) {
  const files = await listFolderChildren({ accessToken, driveId, folderId, fetchImpl });
  return files.map(({ id, name, webUrl, path: filePath }) => ({
    id, name, webUrl, folderPath: filePath.slice(0, Math.max(0, filePath.length - name.length - 1)),
  }));
}

export async function downloadFileContent({ accessToken, driveId, itemId, fetchImpl = fetch }) {
  const res = await fetchImpl(`${GRAPH_BASE}/drives/${driveId}/items/${itemId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Graph file download failed: ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
