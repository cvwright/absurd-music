/**
 * User Types
 *
 * Data models for playlists, favorites, and user preferences.
 */

/**
 * Playlist stored at /user/{user_id}/playlists/{playlist_id}
 */
export interface Playlist {
  /** Unique playlist identifier */
  playlist_id: string;
  /** Playlist name */
  name: string;
  /** Optional description */
  description?: string;
  /** Ordered list of track IDs */
  track_ids: string[];
  /** Unix timestamp when created */
  created_at: number;
  /** Unix timestamp when last modified */
  updated_at: number;
  /** Optional custom artwork blob ID */
  artwork_blob_id?: string;
}

/**
 * Favorites list stored at /user/{user_id}/favorites
 */
export interface Favorites {
  /** Set of favorite track IDs */
  track_ids: string[];
  /** Unix timestamp when last modified */
  updated_at: number;
}

/**
 * Recently played entry
 */
export interface RecentlyPlayedEntry {
  /** Track ID */
  track_id: string;
  /** When it was played (Unix timestamp) */
  played_at: number;
}

/**
 * Recently played stored at /user/{user_id}/recently_played
 * Implemented as a ring buffer with fixed max size.
 */
export interface RecentlyPlayed {
  /** Recent tracks (most recent first) */
  entries: RecentlyPlayedEntry[];
  /** Maximum entries to keep */
  max_entries: number;
}

/**
 * Cache preferences stored at /user/{user_id}/preferences/cache
 */
export interface CachePreferences {
  /** Maximum cache size in bytes */
  max_size_bytes: number;
  /** Maximum age of cached tracks in days */
  max_age_days: number;
  /** Whether to auto-prefetch next tracks */
  auto_prefetch: boolean;
  /** Number of tracks to prefetch */
  prefetch_count: number;
}

/**
 * Cached track metadata for IndexedDB
 */
export interface CachedTrack {
  /** Track ID */
  trackId: string;
  /** Decrypted audio data */
  audioData: ArrayBuffer;
  /** Essential metadata for offline display */
  metadata: {
    title: string;
    artist_name: string;
    album_name: string;
    duration_ms: number;
    file_format: string;
  };
  /** When cached (Unix timestamp) */
  cachedAt: number;
  /** When last accessed (for LRU eviction) */
  lastAccessed: number;
  /** Size in bytes */
  size: number;
}
