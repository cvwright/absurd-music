/**
 * Music Space Service
 *
 * High-level wrapper around the reeeductio Space client,
 * providing music-specific operations for library management.
 */

import { Space, type KeyPair, bytesToString, stringToBytes, decryptAesGcm, decodeBase64 } from 'reeeductio';
import type { MessageQuery, MessagesResponse, MessageCreated } from 'reeeductio';
import type { Track, Album, Artist, SearchIndex, Playlist, PlaylistIndex } from '@/types/index.js';
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
    const track = JSON.parse(bytesToString(data)) as Track | null;
    if (!track) throw new Error(`Track not found: ${trackId}`);
    return track;
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
    const album = JSON.parse(bytesToString(data)) as Album | null;
    if (!album) throw new Error(`Album not found: ${albumId}`);
    return album;
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
    const artist = JSON.parse(bytesToString(data)) as Artist | null;
    if (!artist) throw new Error(`Artist not found: ${artistId}`);
    return artist;
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
      const data = await this.space.getEncryptedData(`user/${this.userId}/playlist_index`);
      return JSON.parse(bytesToString(data)) as PlaylistIndex;
    } catch {
      return { playlists: [], updated_at: Date.now() };
    }
  }

  /**
   * Update the playlist index.
   */
  async setPlaylistIndex(index: PlaylistIndex): Promise<void> {
    await this.space.setEncryptedData(
      `user/${this.userId}/playlist_index`,
      stringToBytes(JSON.stringify(index))
    );
  }

  /**
   * Get a playlist by ID.
   */
  async getPlaylist(playlistId: string): Promise<Playlist> {
    const data = await this.space.getEncryptedData(`user/${this.userId}/playlists/${playlistId}`);
    const playlist = JSON.parse(bytesToString(data)) as Playlist | null;
    if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);
    return playlist;
  }

  /**
   * Save a playlist.
   */
  async setPlaylist(playlist: Playlist): Promise<void> {
    await this.space.setEncryptedData(
      `user/${this.userId}/playlists/${playlist.playlist_id}`,
      stringToBytes(JSON.stringify(playlist))
    );
  }

  /**
   * Delete a playlist by setting it to null.
   */
  async deletePlaylist(playlistId: string): Promise<void> {
    await this.space.setEncryptedData(
      `user/${this.userId}/playlists/${playlistId}`,
      stringToBytes('null')
    );
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
