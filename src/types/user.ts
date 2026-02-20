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
  /** Optional artwork encryption key (base64) */
  artwork_blob_key?: string;
}

/**
 * Lightweight playlist entry for the sidebar index.
 */
export interface PlaylistIndexEntry {
  /** Playlist ID */
  playlist_id: string;
  /** Playlist name */
  name: string;
  /** Number of tracks in playlist */
  track_count: number;
  /** Unix timestamp when last modified */
  updated_at: number;
}

/**
 * Index of all user playlists stored at /user/{user_id}/playlist_index
 */
export interface PlaylistIndex {
  /** List of playlist entries */
  playlists: PlaylistIndexEntry[];
  /** Unix timestamp when index was last updated */
  updated_at: number;
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
 * Cached metadata entry for IndexedDB.
 * Generic key-value store keyed by the server storage path.
 */
export interface CachedMetadata {
  /** Storage path (e.g. "library/index", "library/tracks/abc123") */
  path: string;
  /** JSON-serialized data */
  data: string;
  /** When cached (Unix timestamp) */
  cachedAt: number;
  /** When last accessed (for LRU eviction) */
  lastAccessed: number;
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

/**
 * Cached artwork for IndexedDB
 */
export interface CachedArtwork {
  /** Artwork blob ID (shared across tracks on same album) */
  blobId: string;
  /** Decrypted image data */
  imageData: ArrayBuffer;
  /** MIME type (e.g., 'image/jpeg') */
  mimeType: string;
  /** When cached (Unix timestamp) */
  cachedAt: number;
  /** When last accessed (for LRU eviction) */
  lastAccessed: number;
  /** Size in bytes */
  size: number;
}

/**
 * Per-track play count data stored at user/{user_id}/play_counts/{track_id}.
 *
 * Uses a three-tier rolling window with automatic compaction on each write:
 *   - daily:   last 7 calendar days    (keys: "YYYY-MM-DD")
 *   - monthly: last 12 calendar months (keys: "YYYY-MM")
 *   - yearly:  all years, never evicted (keys: "YYYY")
 *
 * Stale daily entries are rolled into monthly on write; stale monthly entries
 * are rolled into yearly. The all-time total is the sum of all three tiers.
 */
export interface TrackPlayCount {
  /** Play counts keyed by ISO date string "YYYY-MM-DD" (last 7 days only) */
  daily: Record<string, number>;
  /** Play counts keyed by year-month string "YYYY-MM" (last 12 months only) */
  monthly: Record<string, number>;
  /** Play counts keyed by year string "YYYY" (all years) */
  yearly: Record<string, number>;
  /** Unix timestamp of last write */
  updated_at: number;
}
