/**
 * Music Space Service
 *
 * High-level wrapper around the reeeductio Space client,
 * providing music-specific operations for library management.
 */

import { Space, IndexedDBMessageStore, type KeyPair, bytesToString, stringToBytes, decryptAesGcm, decodeBase64, extractFromTypedId } from 'reeeductio';

import type { MessageQuery, MessagesResponse, MessageCreated, Capability } from 'reeeductio';
import type { Track, Album, Artist, SearchIndex, Playlist, PlaylistIndex } from '@/types/index.js';
import { CryptoService } from './crypto.js';
import type { CacheService } from './cache.js';

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
  private cache: CacheService | null = null;
  private _authenticated = false;
  private readonly spaceId: string;

  constructor(config: MusicSpaceConfig) {
    this.spaceId = config.spaceId;
    this.space = new Space({
      spaceId: config.spaceId,
      keyPair: config.keyPair,
      symmetricRoot: config.symmetricRoot,
      baseUrl: config.baseUrl ?? import.meta.env.VITE_DEFAULT_SERVER_URL ?? 'http://localhost:8000',
      fetch: fetch.bind(window),
      localStore: new IndexedDBMessageStore("music"),
    });

    this.crypto = new CryptoService(config.symmetricRoot);
  }

  /**
   * Authenticate with the reeeductio server.
   *
   * If the current user is the space root (same keypair as the space),
   * also runs one-time setup: ensures the "listener" role exists with the
   * correct capabilities, and enables OPAQUE for password-based login.
   */
  async authenticate(): Promise<void> {
    await this.space.authenticate();
    this._authenticated = true;
    await this.runRootSetup();
  }

  // ============================================================
  // Root User Setup
  // ============================================================

  /** Role granted to listeners (read-only library access + own user state). */
  private static readonly LISTENER_ROLE_ID = 'listener';

  /** Capabilities required on the listener role. */
  private static readonly LISTENER_CAPABILITIES: Record<string, Capability> = {
    cap_read_library:   { op: 'read',  path: 'data/library/' },
    cap_read_blobs:     { op: 'read',  path: 'blobs/' },
    cap_write_user_data: { op: 'write', path: 'data/user/{self}/' },
  };

  /**
   * Returns true if the authenticated user is the space root — i.e. the
   * keypair used to connect has the same public key as the space itself.
   */
  isRootUser(): boolean {
    const spaceKey = extractFromTypedId(this.spaceId);
    const userKey  = extractFromTypedId(this.userId);
    return spaceKey.length === userKey.length &&
      spaceKey.every((v: number, i: number) => v === userKey[i]);
  }

  /**
   * Ensure the "listener" role exists with the required capabilities.
   * Each step is idempotent — already-present roles/capabilities are skipped.
   */
  private async ensureListenerRole(): Promise<void> {
    const roleId = MusicSpaceService.LISTENER_ROLE_ID;

    // Create role if it doesn't exist yet.
    try {
      await this.space.getPlaintextState(`auth/roles/${roleId}`);
    } catch {
      await this.space.createRole(roleId, 'Read-only access to the music library');
    }

    // Grant each capability if not already present.
    for (const [capId, capability] of Object.entries(MusicSpaceService.LISTENER_CAPABILITIES)) {
      try {
        await this.space.getPlaintextState(`auth/roles/${roleId}/rights/${capId}`);
      } catch {
        await this.space.grantCapabilityToRole(roleId, capId, capability);
      }
    }
  }

  /**
   * Run one-time space setup for the root user.
   * Ensures the listener role is configured and OPAQUE is enabled.
   * No-ops if the current user is not root.
   */
  private async runRootSetup(): Promise<void> {
    if (!this.isRootUser()) return;

    console.log('[music-space] Root user detected — running space setup');
    await this.ensureListenerRole();
    await this.space.enableOpaque();
  }

  /**
   * Set the cache service for offline metadata support.
   */
  setCache(cache: CacheService): void {
    this.cache = cache;
  }

  /** Namespace a cache key under the current space to prevent cross-space pollution. */
  private cacheKey(path: string): string {
    return `${this.spaceId}/${path}`;
  }

  /** Best-effort cache write — never throws. */
  private cacheWrite(key: string, value: unknown): void {
    if (!this.cache) return;
    this.cache.setMetadata(this.cacheKey(key), JSON.stringify(value)).catch(() => {});
  }

  /** Best-effort cache remove — never throws. */
  private cacheRemove(key: string): void {
    if (!this.cache) return;
    this.cache.removeMetadata(this.cacheKey(key)).catch(() => {});
  }

  get isAuthenticated(): boolean {
    return this._authenticated;
  }

  get userId(): string {
    return this.space.getUserId();
  }

  /**
   * Invalidate cached index entries so they're re-fetched from the server.
   * Call after reconnecting to ensure fresh data.
   */
  invalidateIndexCache(): void {
    this.cacheRemove('library/index');
    this.cacheRemove(`user/${this.userId}/playlist_index`);
  }

  // ============================================================
  // Library Operations
  // ============================================================

  /**
   * Get the search index for fast client-side filtering.
   */
  async getSearchIndex(): Promise<SearchIndex> {
    const key = 'library/index';
    try {
      if (this.cache) {
        const cached = await this.cache.getMetadata(this.cacheKey(key));
        if (cached) return JSON.parse(cached) as SearchIndex;
      }
    } catch { /* cache miss is fine */ }
    const data = await this.space.getEncryptedData(key);
    const result = JSON.parse(bytesToString(data)) as SearchIndex;
    this.cacheWrite(key, result);
    return result;
  }

  /**
   * Update the search index.
   */
  async setSearchIndex(index: SearchIndex): Promise<void> {
    const json = JSON.stringify(index);
    await this.space.setEncryptedData('library/index', stringToBytes(json));
    this.cacheWrite('library/index', index);
  }

  /**
   * Get track metadata by ID.
   */
  async getTrack(trackId: string): Promise<Track> {
    const key = `library/tracks/${trackId}`;
    try {
      if (this.cache) {
        const cached = await this.cache.getMetadata(this.cacheKey(key));
        if (cached) {
          const track = JSON.parse(cached) as Track | null;
          if (track) return track;
        }
      }
    } catch { /* cache miss is fine */ }
    const data = await this.space.getEncryptedData(key);
    const track = JSON.parse(bytesToString(data)) as Track | null;
    if (!track) throw new Error(`Track not found: ${trackId}`);
    this.cacheWrite(key, track);
    return track;
  }

  /**
   * Save track metadata.
   */
  async setTrack(track: Track): Promise<void> {
    const json = JSON.stringify(track);
    await this.space.setEncryptedData(
      `library/tracks/${track.track_id}`,
      stringToBytes(json)
    );
    this.cacheWrite(`library/tracks/${track.track_id}`, track);
  }

  /**
   * Get album metadata by ID.
   */
  async getAlbum(albumId: string): Promise<Album> {
    const key = `library/albums/${albumId}`;
    try {
      if (this.cache) {
        const cached = await this.cache.getMetadata(this.cacheKey(key));
        if (cached) {
          const album = JSON.parse(cached) as Album | null;
          if (album) return album;
        }
      }
    } catch { /* cache miss is fine */ }
    const data = await this.space.getEncryptedData(key);
    const album = JSON.parse(bytesToString(data)) as Album | null;
    if (!album) throw new Error(`Album not found: ${albumId}`);
    this.cacheWrite(key, album);
    return album;
  }

  /**
   * Save album metadata.
   */
  async setAlbum(album: Album): Promise<void> {
    const json = JSON.stringify(album);
    await this.space.setEncryptedData(
      `library/albums/${album.album_id}`,
      stringToBytes(json)
    );
    this.cacheWrite(`library/albums/${album.album_id}`, album);
  }

  /**
   * Get artist metadata by ID.
   */
  async getArtist(artistId: string): Promise<Artist> {
    const key = `library/artists/${artistId}`;
    try {
      if (this.cache) {
        const cached = await this.cache.getMetadata(this.cacheKey(key));
        if (cached) {
          const artist = JSON.parse(cached) as Artist | null;
          if (artist) return artist;
        }
      }
    } catch { /* cache miss is fine */ }
    const data = await this.space.getEncryptedData(key);
    const artist = JSON.parse(bytesToString(data)) as Artist | null;
    if (!artist) throw new Error(`Artist not found: ${artistId}`);
    this.cacheWrite(key, artist);
    return artist;
  }

  /**
   * Save artist metadata.
   */
  async setArtist(artist: Artist): Promise<void> {
    const json = JSON.stringify(artist);
    await this.space.setEncryptedData(
      `library/artists/${artist.artist_id}`,
      stringToBytes(json)
    );
    this.cacheWrite(`library/artists/${artist.artist_id}`, artist);
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

    return decrypted.buffer as ArrayBuffer;
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

  /**
   * Get encrypted KV data at a user-scoped path.
   *
   * @param useCache - When true (default), returns cached value if available.
   */
  async getUserData<T>(path: string, useCache = true): Promise<T> {
    const fullPath = `user/${this.userId}/${path}`;
    if (useCache) {
      try {
        if (this.cache) {
          const cached = await this.cache.getMetadata(this.cacheKey(fullPath));
          if (cached) return JSON.parse(cached) as T;
        }
      } catch { /* cache miss is fine */ }
    }
    const data = await this.space.getEncryptedData(fullPath);
    const result = JSON.parse(bytesToString(data)) as T;
    this.cacheWrite(fullPath, result);
    return result;
  }

  /**
   * Set encrypted KV data at a user-scoped path.
   */
  async setUserData<T>(path: string, value: T): Promise<void> {
    const fullPath = `user/${this.userId}/${path}`;
    await this.space.setEncryptedData(fullPath, stringToBytes(JSON.stringify(value)));
    this.cacheWrite(fullPath, value);
  }

  /**
   * Delete encrypted KV data at a user-scoped path by writing null.
   */
  async deleteUserData(path: string): Promise<void> {
    const fullPath = `user/${this.userId}/${path}`;
    await this.space.setEncryptedData(fullPath, stringToBytes('null'));
    this.cacheRemove(fullPath);
  }

  // ============================================================
  // Playlist Operations
  // ============================================================

  /**
   * Generate a random playlist ID.
   */
  generatePlaylistId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const base64 = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return `playlist_${base64}`;
  }

  /**
   * Get the playlist index (list of all playlists).
   */
  async getPlaylistIndex(): Promise<PlaylistIndex> {
    try {
      return await this.getUserData<PlaylistIndex>('playlist_index');
    } catch {
      return { playlists: [], updated_at: Date.now() };
    }
  }

  /**
   * Update the playlist index.
   */
  async setPlaylistIndex(index: PlaylistIndex): Promise<void> {
    await this.setUserData('playlist_index', index);
  }

  /**
   * Get a playlist by ID.
   */
  async getPlaylist(playlistId: string): Promise<Playlist> {
    const playlist = await this.getUserData<Playlist | null>(`playlists/${playlistId}`);
    if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);
    return playlist;
  }

  /**
   * Save a playlist.
   */
  async setPlaylist(playlist: Playlist): Promise<void> {
    await this.setUserData(`playlists/${playlist.playlist_id}`, playlist);
  }

  /**
   * Delete a playlist by setting it to null.
   */
  async deletePlaylist(playlistId: string): Promise<void> {
    await this.deleteUserData(`playlists/${playlistId}`);
  }

  // ============================================================
  // Delete Operations
  // ============================================================

  /**
   * Delete a blob from storage.
   */
  async deleteBlob(blobId: string): Promise<void> {
    await this.space.deleteBlob(blobId);
  }

  /**
   * Delete a track and clean up related data.
   *
   * Removes the track from: kv storage, search index, its album's track list,
   * and deletes the audio blob. Artwork blob is only deleted if it differs
   * from the album's artwork (to avoid breaking shared artwork references).
   *
   * Playlist cleanup and cache cleanup are the caller's responsibility.
   */
  async deleteTrack(trackId: string): Promise<void> {
    const track = await this.getTrack(trackId);

    // Delete audio blob
    try {
      await this.deleteBlob(track.audio_blob_id);
    } catch (err) {
      console.warn('Failed to delete audio blob:', err);
    }

    // Delete artwork blob only if it differs from the album's
    if (track.artwork_blob_id) {
      try {
        const album = await this.getAlbum(track.album_id);
        if (track.artwork_blob_id !== album.artwork_blob_id) {
          await this.deleteBlob(track.artwork_blob_id);
        }
      } catch {
        // Album may not exist; safe to delete artwork blob
        try {
          await this.deleteBlob(track.artwork_blob_id);
        } catch (err) {
          console.warn('Failed to delete artwork blob:', err);
        }
      }
    }

    // Remove track from its album's track_ids
    try {
      const album = await this.getAlbum(track.album_id);
      album.track_ids = album.track_ids.filter(id => id !== trackId);
      await this.setAlbum(album);
    } catch {
      // Album may not exist
    }

    // Remove from search index
    try {
      const index = await this.getSearchIndex();
      index.tracks = index.tracks.filter(t => t.id !== trackId);
      index.last_updated = Date.now();
      await this.setSearchIndex(index);
    } catch (err) {
      console.warn('Failed to update search index:', err);
    }

    // Delete track kv data
    await this.space.setEncryptedData(
      `library/tracks/${trackId}`,
      stringToBytes('null')
    );
    this.cacheRemove(`library/tracks/${trackId}`);
  }

  /**
   * Delete an album and all its tracks.
   *
   * Accepts an Album object directly since the caller may have a
   * synthetic album (built from search index) that doesn't exist in kv.
   *
   * Removes every track in the album (including their audio blobs),
   * then deletes the album artwork blob, album kv data, and updates
   * the artist's album list.
   *
   * Playlist cleanup and cache cleanup are the caller's responsibility.
   *
   * @returns The list of deleted track IDs for caller cleanup.
   */
  async deleteAlbum(album: Album): Promise<string[]> {
    const albumId = album.album_id;
    const deletedTrackIds = [...album.track_ids];

    // Delete all tracks (this skips shared artwork blob deletion)
    for (const trackId of album.track_ids) {
      try {
        await this.deleteTrack(trackId);
      } catch (err) {
        console.warn(`Failed to delete track ${trackId}:`, err);
      }
    }

    // Delete album artwork blob
    if (album.artwork_blob_id) {
      try {
        await this.deleteBlob(album.artwork_blob_id);
      } catch (err) {
        console.warn('Failed to delete album artwork blob:', err);
      }
    }

    // Update artist's album_ids
    try {
      const artist = await this.getArtist(album.artist_id);
      artist.album_ids = artist.album_ids.filter(id => id !== albumId);
      await this.setArtist(artist);
    } catch {
      // Artist may not exist
    }

    // Delete album kv data
    await this.space.setEncryptedData(
      `library/albums/${albumId}`,
      stringToBytes('null')
    );
    this.cacheRemove(`library/albums/${albumId}`);

    return deletedTrackIds;
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

  private ws: WebSocket | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wsReconnectDelay = 1000;
  private static readonly WS_MAX_RECONNECT_DELAY = 30000;

  /**
   * Get WebSocket connection URL for real-time updates.
   */
  async getWebSocketUrl(): Promise<string> {
    return this.space.getWebSocketConnectionUrl();
  }

  /**
   * Connect to the WebSocket stream and keep the local message store in sync.
   *
   * Automatically reconnects with exponential backoff on disconnection.
   * Call {@link disconnectWebSocket} to stop.
   */
  async connectWebSocket(): Promise<void> {
    if (this.ws) return;

    const url = await this.getWebSocketUrl();
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[music-space] WebSocket connected');
      this.wsReconnectDelay = 1000;
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        // The stream may send the Message directly or wrapped in { message: ... }
        const message = data.message ?? data;
        if (!message.message_hash) {
          // Not a message event (e.g. heartbeat) — ignore
          return;
        }
        await this.space.handleIncomingMessage(message);
      } catch (err) {
        console.warn('[music-space] Failed to handle WebSocket message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('[music-space] WebSocket closed:', event.code, event.reason);
      this.ws = null;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after onerror, which handles reconnection
    };

    this.ws = ws;
  }

  /**
   * Disconnect the WebSocket stream and stop reconnection attempts.
   */
  disconnectWebSocket(): void {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.wsReconnectTimer) return;

    this.wsReconnectTimer = setTimeout(async () => {
      this.wsReconnectTimer = null;
      try {
        await this.connectWebSocket();
      } catch (err) {
        console.warn('[music-space] WebSocket reconnect failed:', err);
        this.wsReconnectDelay = Math.min(
          this.wsReconnectDelay * 2,
          MusicSpaceService.WS_MAX_RECONNECT_DELAY
        );
        this.scheduleReconnect();
      }
    }, this.wsReconnectDelay);
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
