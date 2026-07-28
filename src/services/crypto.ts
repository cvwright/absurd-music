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
 * Service for cryptographic operations specific to the music player.
 *
 * Handles:
 * - PRF-based deterministic ID generation
 */
export class CryptoService {
  private symmetricRoot: Uint8Array;
  private prfKey: CryptoKey | null = null;

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
    const normalized = artistName.trim().toLowerCase();
    const nameBytes = new TextEncoder().encode(normalized);
    return this.applyPRF(nameBytes, 'artist');
  }

  /**
   * Generate deterministic album ID from artist and album name.
   *
   * album_id = PRF(space_key, SHA256(lowercase(artist_name)|lowercase(album_name)))
   */
  async generateAlbumId(artistName: string, albumName: string): Promise<string> {
    const combined = `${artistName.trim().toLowerCase()}|${albumName.trim().toLowerCase()}`;
    const combinedBytes = new TextEncoder().encode(combined);
    return this.applyPRF(combinedBytes, 'album');
  }
}
