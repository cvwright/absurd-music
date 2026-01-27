/**
 * Crypto Service
 *
 * Handles encryption, decryption, and PRF-based ID generation
 * for the music player. Uses Web Crypto API directly for
 * application-level encryption (blob DEKs).
 */

import { encodeBase64, decodeBase64 } from 'reeeductio';

const TRACK_ID_SALT = 'reeeductio-music-track-id';

/**
 * Service for cryptographic operations specific to the music player.
 *
 * Handles:
 * - PRF-based deterministic ID generation
 * - Blob encryption/decryption with per-blob DEKs
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

  // ============================================================
  // Blob Encryption
  // ============================================================

  /**
   * Encrypt a blob with a random DEK.
   *
   * Format: [16-byte IV][AES-GCM ciphertext with auth tag]
   *
   * @returns encrypted blob and base64-encoded DEK
   */
  async encryptBlob(plaintext: Uint8Array): Promise<{ encrypted: Uint8Array; key: string }> {
    // Generate random 256-bit DEK
    const dek = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(16));

    // Import DEK as CryptoKey
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(dek),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: this.toArrayBuffer(iv) },
      cryptoKey,
      this.toArrayBuffer(plaintext)
    );

    // Prepend IV to ciphertext
    const encrypted = new Uint8Array(16 + ciphertext.byteLength);
    encrypted.set(iv, 0);
    encrypted.set(new Uint8Array(ciphertext), 16);

    return {
      encrypted,
      key: encodeBase64(dek),
    };
  }

  /**
   * Decrypt a blob using its DEK.
   *
   * @param encrypted - Blob in format [16-byte IV][ciphertext]
   * @param keyBase64 - Base64-encoded DEK
   */
  async decryptBlob(encrypted: Uint8Array, keyBase64: string): Promise<Uint8Array> {
    // Decode DEK
    const dek = decodeBase64(keyBase64);

    // Extract IV and ciphertext
    const iv = encrypted.slice(0, 16);
    const ciphertext = encrypted.slice(16);

    // Import DEK as CryptoKey
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(dek),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.toArrayBuffer(iv) },
      cryptoKey,
      this.toArrayBuffer(ciphertext)
    );

    return new Uint8Array(plaintext);
  }
}
