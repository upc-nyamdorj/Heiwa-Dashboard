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

/** Files (not subfolders) directly inside the sync folder, paginated via @odata.nextLink. */
export async function listFolderChildren({ accessToken, driveId, folderId, fetchImpl = fetch }) {
  let url = `${GRAPH_BASE}/drives/${driveId}/items/${folderId}/children`
    + '?$select=id,name,eTag,lastModifiedDateTime,size,webUrl,file';
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
  return items.filter((i) => i.file);
}

/**
 * Every file under the sync folder, recursively, each tagged with the folder
 * path it was found in (relative to the sync folder, "" at the top).
 *
 * listFolderChildren above is deliberately shallow — the daily sync only looks
 * at the top level. The one-off backfill needs the whole tree, because the
 * paths recorded in the dataset are nested.
 */
export async function listFolderTree({ accessToken, driveId, folderId, fetchImpl = fetch }) {
  const out = [];
  const queue = [{ id: folderId, path: '' }];

  while (queue.length) {
    const { id, path: folderPath } = queue.shift();
    let url = `${GRAPH_BASE}/drives/${driveId}/items/${id}/children`
      + '?$select=id,name,webUrl,file,folder';
    while (url) {
      const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        throw new Error(`Graph list children failed: ${res.status} ${await res.text()}`);
      }
      const data = await res.json();
      for (const item of data.value ?? []) {
        const childPath = folderPath ? `${folderPath}/${item.name}` : item.name;
        if (item.folder) queue.push({ id: item.id, path: childPath });
        else if (item.file) out.push({ id: item.id, name: item.name, webUrl: item.webUrl, folderPath });
      }
      url = data['@odata.nextLink'] ?? null;
    }
  }
  return out;
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
