/**
 * Music Space Service
 *
 * High-level wrapper around the reeeductio Space client,
 * providing music-specific operations for library management.
 */

import { Space, type KeyPair, bytesToString, stringToBytes, decryptAesGcm, decodeBase64 } from 'reeeductio';
import type { MessageQuery, MessagesResponse, MessageCreated } from 'reeeductio';
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
    const data = await this.space.getEncryptedData('library/index');
    return JSON.parse(bytesToString(data)) as SearchIndex;
  }

  /**
   * Update the search index.
   */
  async setSearchIndex(index: SearchIndex): Promise<void> {
    await this.space.setEncryptedData('library/index', stringToBytes(JSON.stringify(index)));
  }

  /**
   * Get track metadata by ID.
   */
  async getTrack(trackId: string): Promise<Track> {
    const data = await this.space.getEncryptedData(`library/tracks/${trackId}`);
    return JSON.parse(bytesToString(data)) as Track;
  }

  /**
   * Save track metadata.
   */
  async setTrack(track: Track): Promise<void> {
    await this.space.setEncryptedData(
      `library/tracks/${track.track_id}`,
      stringToBytes(JSON.stringify(track))
    );
  }

  /**
   * Get album metadata by ID.
   */
  async getAlbum(albumId: string): Promise<Album> {
    const data = await this.space.getEncryptedData(`library/albums/${albumId}`);
    return JSON.parse(bytesToString(data)) as Album;
  }

  /**
   * Save album metadata.
   */
  async setAlbum(album: Album): Promise<void> {
    await this.space.setEncryptedData(
      `library/albums/${album.album_id}`,
      stringToBytes(JSON.stringify(album))
    );
  }

  /**
   * Get artist metadata by ID.
   */
  async getArtist(artistId: string): Promise<Artist> {
    const data = await this.space.getEncryptedData(`library/artists/${artistId}`);
    return JSON.parse(bytesToString(data)) as Artist;
  }

  /**
   * Save artist metadata.
   */
  async setArtist(artist: Artist): Promise<void> {
    await this.space.setEncryptedData(
      `library/artists/${artist.artist_id}`,
      stringToBytes(JSON.stringify(artist))
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
    // FIXME: Should just use this.space.encryptAndUploadBlob()
    
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
    return JSON.parse(bytesToString(data)) as T;
  }

  /**
   * Set user state at a path.
   */
  async setUserState<T>(path: string, data: T): Promise<void> {
    const fullPath = `user/${this.userId}/${path}`;
    await this.space.setEncryptedState(fullPath, stringToBytes(JSON.stringify(data)));
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

  // ============================================================
  // Message Operations
  // ============================================================

  /**
   * Post an encrypted message to a topic.
   *
   * @param topicId - Topic identifier (e.g., "imports")
   * @param msgType - Message type/category (e.g., "import_batch")
   * @param data - Message data object (will be JSON serialized and encrypted)
   * @returns MessageCreated with message_hash and server_timestamp
   */
  async postMessage<T>(topicId: string, msgType: string, data: T): Promise<MessageCreated> {
    const dataBytes = stringToBytes(JSON.stringify(data));
    return this.space.postEncryptedMessage(topicId, msgType, dataBytes);
  }

  /**
   * Get messages from a topic.
   *
   * @param topicId - Topic identifier
   * @param query - Optional query parameters (from, to, limit)
   * @returns MessagesResponse with messages array
   */
  async getMessages(topicId: string, query?: MessageQuery): Promise<MessagesResponse> {
    return this.space.getMessages(topicId, query);
  }

  /**
   * Decrypt and parse a message's data field.
   *
   * @param topicId - Topic identifier (needed to derive decryption key)
   * @param encryptedData - Base64-encoded encrypted data from message
   * @returns Parsed JSON object
   */
  decryptMessageData<T>(topicId: string, encryptedData: string): T {
    const topicKey = this.space.deriveTopicKey(topicId);
    const encrypted = decodeBase64(encryptedData);
    const decrypted = decryptAesGcm(encrypted, topicKey);
    return JSON.parse(bytesToString(decrypted)) as T;
  }
}
