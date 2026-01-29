/**
 * Credentials Storage Service
 *
 * Persists authentication credentials to localStorage so users
 * don't have to re-enter them on every page load.
 */

import { encodeBase64, decodeBase64 } from 'reeeductio';
import { getPublicKeyAsync } from '@noble/ed25519';
import type { MusicSpaceConfig } from './music-space.js';

const STORAGE_KEY = 'absurd-music-credentials';

/**
 * Serializable form of credentials for localStorage.
 */
interface StoredCredentials {
  spaceId: string;
  privateKey: string; // base64
  symmetricRoot: string; // base64
  baseUrl?: string;
  accessToken?: string;
}

/**
 * Save credentials to localStorage.
 */
export function saveCredentials(config: MusicSpaceConfig, accessToken?: string): void {
  const stored: StoredCredentials = {
    spaceId: config.spaceId,
    privateKey: encodeBase64(config.keyPair.privateKey),
    symmetricRoot: encodeBase64(config.symmetricRoot),
    ...(config.baseUrl && { baseUrl: config.baseUrl }),
    ...(accessToken && { accessToken }),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/**
 * Load credentials from localStorage.
 * Returns null if no credentials are stored or if they're invalid.
 */
export async function loadCredentials(): Promise<MusicSpaceConfig | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const creds: StoredCredentials = JSON.parse(stored);

    const privateKey = decodeBase64(creds.privateKey);
    const publicKey = await getPublicKeyAsync(privateKey);
    const symmetricRoot = decodeBase64(creds.symmetricRoot);

    return {
      spaceId: creds.spaceId,
      keyPair: { privateKey, publicKey },
      symmetricRoot,
      ...(creds.baseUrl && { baseUrl: creds.baseUrl }),
    };
  } catch {
    // Invalid stored credentials, clear them
    clearCredentials();
    return null;
  }
}

/**
 * Get the stored access token if available.
 */
export function getStoredAccessToken(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const creds: StoredCredentials = JSON.parse(stored);
    return creds.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Clear stored credentials (logout).
 */
export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if credentials are stored.
 */
export function hasStoredCredentials(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
