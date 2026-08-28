/**
 * Crypto Service
 *
 * Handles PRF-based deterministic ID generation for the music player.
 * Blob encryption/decryption is handled by the reeeductio SDK
 * (see MusicSpaceService.uploadAudioBlob / downloadAudioBlob).
 */

import { encodeBase64 } from 'reeeductio';

const TRACK_ID_SALT = 'reeeductio-music-track-id';

/**
 * Normalize a name (artist, album title) before it is fed to the PRF.
 *
 * Every local grouping key must use this same normalization, otherwise two
 * spellings that produce one PRF ID would be treated as two distinct
 * collections in the UI (and vice versa).
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Local grouping key for an album, matching {@link CryptoService.generateAlbumId}'s
 * input exactly. Use this — never the raw `artist|album` string, and never the
 * album's PRF ID — whenever tracks need to be grouped without an async PRF call.
 */
export function albumGroupKey(artistName: string, albumTitle: string): string {
  return `${normalizeName(artistName)}|${normalizeName(albumTitle)}`;
}

/**
 * Service for cryptographic operations specific to the music player.
 *
 * Handles:
 * - PRF-based deterministic ID generation
 */
export class CryptoService {
  private symmetricRoot: Uint8Array;
  private prfKey: CryptoKey | null = null;

  /**
   * Memoized name→ID results, keyed by `${prefix}:${normalized input}`.
   *
   * Artist and album IDs are derived from short, highly repeated strings —
   * the same handful of names is hashed again on every collection rebuild and
   * every ID→name resolution. Track IDs are keyed by whole-file bytes and are
   * derived once per import, so they are not memoized.
   */
  private readonly nameIdCache = new Map<string, string>();

  constructor(symmetricRoot: Uint8Array) {
    if (symmetricRoot.length !== 32) {
      throw new Error('symmetricRoot must be exactly 32 bytes');
    }
    this.symmetricRoot = symmetricRoot;
  }

  /**
   * Derive the PRF key from the space's symmetric root.
   * Cached after first derivation.
   */
  /**
   * Convert Uint8Array to ArrayBuffer for Web Crypto API compatibility.
   */
  private toArrayBuffer(data: Uint8Array): ArrayBuffer {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }

  private async getPRFKey(): Promise<CryptoKey> {
    if (this.prfKey) {
      return this.prfKey;
    }

    // Import as HKDF key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(this.symmetricRoot),
      'HKDF',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive HMAC key for PRF
    this.prfKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode(TRACK_ID_SALT),
        info: new TextEncoder().encode('v1'),
      },
      keyMaterial,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    return this.prfKey;
  }

  /**
   * Apply PRF to generate a deterministic, privacy-preserving ID.
   */
  private async applyPRF(data: Uint8Array, prefix: string): Promise<string> {
    const prfKey = await this.getPRFKey();

    // Hash the input data first
    const inputHash = await crypto.subtle.digest('SHA-256', this.toArrayBuffer(data));

    // Apply HMAC-SHA256 as PRF
    const prfOutput = await crypto.subtle.sign('HMAC', prfKey, inputHash);

    // Take first 16 bytes (128 bits) for collision resistance
    const idBytes = new Uint8Array(prfOutput).slice(0, 16);

    // Encode and add prefix
    return `${prefix}_${encodeBase64(idBytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
  }

  /**
   * Generate deterministic track ID from audio file bytes.
   *
   * track_id = PRF(space_key, SHA256(file_bytes))
   */
  async generateTrackId(audioFileBytes: ArrayBuffer): Promise<string> {
    return this.applyPRF(new Uint8Array(audioFileBytes), 'track');
  }

  /**
   * Generate deterministic artist ID from artist name.
   *
   * artist_id = PRF(space_key, SHA256(lowercase(artist_name)))
   */
  async generateArtistId(artistName: string): Promise<string> {
    return this.memoizedPRF('artist', normalizeName(artistName));
  }

  /**
   * Generate deterministic album ID from artist and album name.
   *
   * album_id = PRF(space_key, SHA256(lowercase(artist_name)|lowercase(album_name)))
   */
  async generateAlbumId(artistName: string, albumName: string): Promise<string> {
    return this.memoizedPRF('album', albumGroupKey(artistName, albumName));
  }

  /** Apply the PRF to an already-normalized string, caching the result. */
  private async memoizedPRF(prefix: string, normalized: string): Promise<string> {
    const cacheKey = `${prefix}:${normalized}`;
    const hit = this.nameIdCache.get(cacheKey);
    if (hit) return hit;

    const id = await this.applyPRF(new TextEncoder().encode(normalized), prefix);
    this.nameIdCache.set(cacheKey, id);
    return id;
  }
}
