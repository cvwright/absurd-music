/**
 * Playlist Service
 *
 * Manages playlist CRUD operations with automatic index synchronization.
 */

import type { Playlist, PlaylistIndexEntry } from '@/types/index.js';
import type { MusicSpaceService } from './music-space.js';

/**
 * Service for managing playlists.
 *
 * Handles creation, modification, and deletion of playlists,
 * automatically keeping the playlist index in sync.
 */
export class PlaylistService {
  constructor(private musicSpace: MusicSpaceService) {}

  /**
   * Create a new playlist.
   */
  async createPlaylist(name: string, description?: string): Promise<Playlist> {
    const playlistId = this.musicSpace.generatePlaylistId();
    const now = Date.now();

    const playlist: Playlist = {
      playlist_id: playlistId,
      name,
      description,
      track_ids: [],
      created_at: now,
      updated_at: now,
    };

    await this.musicSpace.setPlaylist(playlist);
    await this.updateIndex(playlist);

    return playlist;
  }

  /**
   * Get a playlist by ID.
   */
  async getPlaylist(playlistId: string): Promise<Playlist> {
    return this.musicSpace.getPlaylist(playlistId);
  }

  /**
   * Add tracks to a playlist. Duplicates are ignored.
   */
  async addTracks(playlistId: string, trackIds: string[]): Promise<Playlist> {
    const playlist = await this.musicSpace.getPlaylist(playlistId);

    // Avoid duplicates
    const existingSet = new Set(playlist.track_ids);
    const newTracks = trackIds.filter((id) => !existingSet.has(id));

    playlist.track_ids.push(...newTracks);
    playlist.updated_at = Date.now();

    await this.musicSpace.setPlaylist(playlist);
    await this.updateIndex(playlist);

    return playlist;
  }

  /**
   * Remove a track from a playlist.
   */
  async removeTrack(playlistId: string, trackId: string): Promise<Playlist> {
    const playlist = await this.musicSpace.getPlaylist(playlistId);
    playlist.track_ids = playlist.track_ids.filter((id) => id !== trackId);
    playlist.updated_at = Date.now();

    await this.musicSpace.setPlaylist(playlist);
    await this.updateIndex(playlist);

    return playlist;
  }

  /**
   * Reorder tracks in a playlist.
   */
  async reorderTracks(playlistId: string, trackIds: string[]): Promise<Playlist> {
    const playlist = await this.musicSpace.getPlaylist(playlistId);
    playlist.track_ids = trackIds;
    playlist.updated_at = Date.now();

    await this.musicSpace.setPlaylist(playlist);
    return playlist;
  }

  /**
   * Update playlist metadata (name, description).
   */
  async updatePlaylist(
    playlistId: string,
    updates: { name?: string; description?: string }
  ): Promise<Playlist> {
    const playlist = await this.musicSpace.getPlaylist(playlistId);

    if (updates.name !== undefined) playlist.name = updates.name;
    if (updates.description !== undefined) playlist.description = updates.description;
    playlist.updated_at = Date.now();

    await this.musicSpace.setPlaylist(playlist);
    await this.updateIndex(playlist);

    return playlist;
  }

  /**
   * Delete a playlist.
   */
  async deletePlaylist(playlistId: string): Promise<void> {
    await this.musicSpace.deletePlaylist(playlistId);
    await this.removeFromIndex(playlistId);
  }

  /**
   * Get all playlists (lightweight index entries).
   */
  async listPlaylists(): Promise<PlaylistIndexEntry[]> {
    const index = await this.musicSpace.getPlaylistIndex();
    return index.playlists;
  }

  /**
   * Update a playlist entry in the index.
   */
  private async updateIndex(playlist: Playlist): Promise<void> {
    const index = await this.musicSpace.getPlaylistIndex();

    const entry: PlaylistIndexEntry = {
      playlist_id: playlist.playlist_id,
      name: playlist.name,
      track_count: playlist.track_ids.length,
      updated_at: playlist.updated_at,
    };

    const existingIdx = index.playlists.findIndex(
      (p) => p.playlist_id === playlist.playlist_id
    );
    if (existingIdx >= 0) {
      index.playlists[existingIdx] = entry;
    } else {
      index.playlists.push(entry);
    }

    // Sort by updated_at descending (most recently modified first)
    index.playlists.sort((a, b) => b.updated_at - a.updated_at);
    index.updated_at = Date.now();

    await this.musicSpace.setPlaylistIndex(index);
  }

  /**
   * Remove a playlist from the index.
   */
  private async removeFromIndex(playlistId: string): Promise<void> {
    const index = await this.musicSpace.getPlaylistIndex();
    index.playlists = index.playlists.filter((p) => p.playlist_id !== playlistId);
    index.updated_at = Date.now();
    await this.musicSpace.setPlaylistIndex(index);
  }
}
