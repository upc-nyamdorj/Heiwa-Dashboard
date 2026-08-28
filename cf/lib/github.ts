/**
 * Minimal GitHub REST client for the two things the Cloudflare Functions
 * need: reading/writing repo files via the Contents API (with SHA-based
 * optimistic concurrency) and firing a workflow_dispatch. Deliberately not
 * an SDK dependency — this runs in the Workers runtime via plain fetch.
 */

const GITHUB_API = 'https://api.github.com';

export class GithubConflictError extends Error {
  constructor(path: string) {
    super(`Concurrent update conflict writing ${path} (stale sha) — re-fetch and retry.`);
    this.name = 'GithubConflictError';
  }
}

interface GithubAuth {
  owner: string;
  repo: string;
  token: string;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'heiwa-dashboard-sync',
  };
}

export interface GithubFile {
  path: string;
  sha: string;
  contentBase64: string;
}

export async function getFile(
  { owner, repo, token, path, ref = 'main' }: GithubAuth & { path: string; ref?: string },
): Promise<GithubFile> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    throw new Error(`GitHub getFile(${path}) failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { sha: string; content: string };
  return { path, sha: data.sha, contentBase64: data.content };
}

export async function putFile(
  { owner, repo, token, path, contentBase64, sha, message, branch = 'main' }:
    GithubAuth & { path: string; contentBase64: string; sha?: string; message: string; branch?: string },
): Promise<void> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: contentBase64, sha, branch }),
  });
  if (!res.ok) {
    if (res.status === 409) throw new GithubConflictError(path);
    throw new Error(`GitHub putFile(${path}) failed: ${res.status} ${await res.text()}`);
  }
}

export async function triggerWorkflowDispatch(
  { owner, repo, token, workflowFile, ref = 'main' }: GithubAuth & { workflowFile: string; ref?: string },
): Promise<void> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref }),
  });
  if (!res.ok) {
    throw new Error(`GitHub workflow_dispatch failed: ${res.status} ${await res.text()}`);
  }
}

/** GitHub's Contents API returns content as base64 with embedded newlines. */
export function decodeBase64Json<T>(base64: string): T {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8').decode(bytes)) as T;
}

export function encodeJsonBase64(value: unknown): string {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
