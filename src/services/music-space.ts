/**
 * Music Space Service
 *
 * High-level wrapper around the reeeductio Space client,
 * providing music-specific operations for library management.
 */

import { Space, type KeyPair } from 'reeeductio';
import type { Track, Album, Artist, SearchIndex } from '@/types/index.js';
import { CryptoService } from './crypto.js';

export interface MusicSpaceConfig {
  spaceId: string;
  keyPair: KeyPair;
  symmetricRoot: Uint8Array;
  baseUrl?: string;
}

/**
 * Service for interacting with the music space.
 *
 * Handles all reeeductio operations: authentication, state management,
 * blob storage, and message posting.
 */
export class MusicSpaceService {
  private space: Space;
  private crypto: CryptoService;
  private _authenticated = false;

  constructor(config: MusicSpaceConfig) {
    this.space = new Space({
      spaceId: config.spaceId,
      keyPair: config.keyPair,
      symmetricRoot: config.symmetricRoot,
      baseUrl: config.baseUrl ?? 'http://localhost:8000',
      fetch: fetch.bind(window),
    });

    this.crypto = new CryptoService(config.symmetricRoot);
  }

  /**
   * Authenticate with the reeeductio server.
   */
  async authenticate(): Promise<void> {
    await this.space.authenticate();
    this._authenticated = true;
  }

  get isAuthenticated(): boolean {
    return this._authenticated;
  }

  get userId(): string {
    return this.space.getUserId();
  }

  // ============================================================
  // Library Operations
  // ============================================================

  /**
   * Get the search index for fast client-side filtering.
   */
  async getSearchIndex(): Promise<SearchIndex> {
    const data = await this.space.getEncryptedState('library/index');
    return JSON.parse(data) as SearchIndex;
  }

  /**
   * Update the search index.
   */
  async setSearchIndex(index: SearchIndex): Promise<void> {
    await this.space.setEncryptedState('library/index', JSON.stringify(index));
  }

  /**
   * Get track metadata by ID.
   */
  async getTrack(trackId: string): Promise<Track> {
    const data = await this.space.getEncryptedState(`library/tracks/${trackId}`);
    return JSON.parse(data) as Track;
  }

  /**
   * Save track metadata.
   */
  async setTrack(track: Track): Promise<void> {
    await this.space.setEncryptedState(
      `library/tracks/${track.track_id}`,
      JSON.stringify(track)
    );
  }

  /**
   * Get album metadata by ID.
   */
  async getAlbum(albumId: string): Promise<Album> {
    const data = await this.space.getEncryptedState(`library/albums/${albumId}`);
    return JSON.parse(data) as Album;
  }

  /**
   * Save album metadata.
   */
  async setAlbum(album: Album): Promise<void> {
    await this.space.setEncryptedState(
      `library/albums/${album.album_id}`,
      JSON.stringify(album)
    );
  }

  /**
   * Get artist metadata by ID.
   */
  async getArtist(artistId: string): Promise<Artist> {
    const data = await this.space.getEncryptedState(`library/artists/${artistId}`);
    return JSON.parse(data) as Artist;
  }

  /**
   * Save artist metadata.
   */
  async setArtist(artist: Artist): Promise<void> {
    await this.space.setEncryptedState(
      `library/artists/${artist.artist_id}`,
      JSON.stringify(artist)
    );
  }

  // ============================================================
  // Blob Operations
  // ============================================================

  /**
   * Download and decrypt an audio blob.
   *
   * @param blobId - The blob identifier
   * @param encryptionKey - Base64-encoded DEK from track metadata
   * @returns Decrypted audio data
   */
  async downloadAudioBlob(blobId: string, encryptionKey: string): Promise<ArrayBuffer> {
    // Download encrypted blob
    const encryptedBlob = await this.space.downloadPlaintextBlob(blobId);

    // Decrypt using the track's DEK
    const decrypted = await this.crypto.decryptBlob(encryptedBlob, encryptionKey);

    return decrypted.buffer;
  }

  /**
   * Encrypt and upload an audio blob.
   *
   * @param audioData - Raw audio file bytes
   * @returns Object with blobId and base64-encoded DEK
   */
  async uploadAudioBlob(audioData: ArrayBuffer): Promise<{ blobId: string; encryptionKey: string }> {
    // Generate random DEK and encrypt
    const { encrypted, key } = await this.crypto.encryptBlob(new Uint8Array(audioData));

    // Upload encrypted blob
    const result = await this.space.uploadPlaintextBlob(encrypted);

    return {
      blobId: result.blob_id,
      encryptionKey: key,
    };
  }

  /**
   * Download and decrypt an artwork blob.
   */
  async downloadArtworkBlob(blobId: string, encryptionKey: string): Promise<ArrayBuffer> {
    return this.downloadAudioBlob(blobId, encryptionKey);
  }

  /**
   * Encrypt and upload an artwork blob.
   */
  async uploadArtworkBlob(imageData: ArrayBuffer): Promise<{ blobId: string; encryptionKey: string }> {
    return this.uploadAudioBlob(imageData);
  }

  // ============================================================
  // User State Operations
  // ============================================================

  /**
   * Get user state at a path.
   */
  async getUserState<T>(path: string): Promise<T> {
    const fullPath = `user/${this.userId}/${path}`;
    const data = await this.space.getEncryptedState(fullPath);
    return JSON.parse(data) as T;
  }

  /**
   * Set user state at a path.
   */
  async setUserState<T>(path: string, data: T): Promise<void> {
    const fullPath = `user/${this.userId}/${path}`;
    await this.space.setEncryptedState(fullPath, JSON.stringify(data));
  }

  // ============================================================
  // ID Generation
  // ============================================================

  /**
   * Generate a deterministic track ID from file bytes.
   */
  async generateTrackId(audioFileBytes: ArrayBuffer): Promise<string> {
    return this.crypto.generateTrackId(audioFileBytes);
  }

  /**
   * Generate a deterministic artist ID from artist name.
   */
  async generateArtistId(artistName: string): Promise<string> {
    return this.crypto.generateArtistId(artistName);
  }

  /**
   * Generate a deterministic album ID from artist and album name.
   */
  async generateAlbumId(artistName: string, albumName: string): Promise<string> {
    return this.crypto.generateAlbumId(artistName, albumName);
  }

  // ============================================================
  // WebSocket
  // ============================================================

  /**
   * Get WebSocket connection URL for real-time updates.
   */
  async getWebSocketUrl(): Promise<string> {
    return this.space.getWebSocketConnectionUrl();
  }
}
