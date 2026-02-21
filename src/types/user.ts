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
 * Play count document stored at user/{user_id}/play_counts/{date}.
 *
 * Maps track_id → play count for all plays that fall within that date period.
 * The date key determines the granularity:
 *   - "YYYY-MM-DD"  daily bucket   (last 7 days; older ones compacted into monthly)
 *   - "YYYY-MM"     monthly bucket (last 12 months; older ones compacted into yearly)
 *   - "YYYY"        yearly bucket  (all years, never evicted)
 */
export type PlayCountMap = Record<string, number>;
