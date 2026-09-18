/** base64url, shared by everything here that has to put bytes in a string. */

export function b64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(value: string): Uint8Array {
  const padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
