/**
 * Library Types
 *
 * Data models for tracks, albums, artists, and the search index.
 */

/**
 * Encryption metadata for blobs.
 * Each blob has its own random Data Encryption Key (DEK).
 */
export interface BlobEncryption {
  /** Encryption method - currently only 'file' (whole-file AES-GCM) */
  method: 'file';
  /** Base64-encoded 256-bit AES key for this specific blob */
  key: string;
}

/**
 * Track metadata stored at /library/tracks/{track_id}
 *
 * Uses hybrid approach: denormalized for display (artist_name, album_name),
 * with IDs for rich data lookup (artist_id, album_id).
 */
export interface Track {
  /** Deterministic track ID: PRF(space_key, SHA256(file_bytes)) */
  track_id: string;

  /** Track title from ID3 tags */
  title: string;

  // Denormalized for fast display
  /** Artist name (embedded for single-fetch display) */
  artist_name: string;
  /** Album name (embedded for single-fetch display) */
  album_name: string;
  /** Album release year */
  album_year?: number;

  // IDs for rich data lookup
  /** Reference to artist: PRF(space_key, artist_name) */
  artist_id: string;
  /** Reference to album: PRF(space_key, artist_name|album_name) */
  album_id: string;

  // Blob references
  /** Blob ID for encrypted audio file */
  audio_blob_id: string;
  /** Blob ID for album artwork (shared with album) */
  artwork_blob_id?: string;
  /** MIME type of artwork (e.g., 'image/jpeg', 'image/png') */
  artwork_mime_type?: string;

  // Audio metadata
  /** Track duration in milliseconds */
  duration_ms: number;
  /** Track number on album */
  track_number?: number;
  /** Disc number for multi-disc albums */
  disc_number?: number;
  /** Genre tag */
  genre?: string;

  // File info
  /** Audio format: mp3, m4a, flac, opus, etc. */
  file_format: string;
  /** Bitrate in kbps (e.g., 320) */
  bitrate?: number;

  // Encryption keys
  /** Encryption info for audio blob */
  encryption: BlobEncryption;
  /** Encryption info for artwork blob (if different from album) */
  artwork_encryption?: BlobEncryption;

  // Provenance
  /** Where the track was purchased */
  purchased_from?: string;
  /** When the track was purchased */
  purchase_date?: string;
  /** Unix timestamp when added to library */
  added_at: number;
}

/**
 * Album metadata stored at /library/albums/{album_id}
 */
export interface Album {
  /** Deterministic album ID: PRF(space_key, artist_name|album_name) */
  album_id: string;

  /** Album title */
  title: string;

  /** Reference to artist */
  artist_id: string;
  /** Artist name (denormalized) */
  artist_name: string;

  /** Release year */
  year?: number;

  /** Blob ID for album artwork */
  artwork_blob_id?: string;
  /** MIME type of artwork (e.g., 'image/jpeg', 'image/png') */
  artwork_mime_type?: string;
  /** Encryption info for artwork blob */
  artwork_encryption?: BlobEncryption;

  /** Total number of tracks */
  total_tracks?: number;

  /** Primary genre */
  genre?: string;

  /** Track IDs in album order */
  track_ids: string[];
}

/**
 * Artist metadata stored at /library/artists/{artist_id}
 */
export interface Artist {
  /** Deterministic artist ID: PRF(space_key, artist_name) */
  artist_id: string;

  /** Artist name */
  name: string;

  /** Artist biography */
  bio?: string;

  /** Blob ID for artist photo */
  photo_blob_id?: string;

  /** Year artist/band formed */
  formed_year?: number;

  /** Genres associated with artist */
  genres?: string[];

  /** Album IDs by this artist */
  album_ids: string[];

  /** External identifiers for metadata enrichment */
  external_ids?: {
    musicbrainz_id?: string;
    lastfm_url?: string;
  };
}

/**
 * Parsed metadata from an audio file before import.
 * Contains raw ID3/M4A tag data plus the file itself.
 */
export interface ParsedTrackMetadata {
  /** The original file */
  file: File;

  /** Track title from tags, or filename if missing */
  title: string;

  /** Artist name from tags */
  artist?: string;

  /** Album name from tags */
  album?: string;

  /** Album release year */
  year?: number;

  /** Track number on album */
  trackNumber?: number;

  /** Total tracks on album (if available) */
  trackTotal?: number;

  /** Disc number for multi-disc albums */
  discNumber?: number;

  /** Total discs (if available) */
  discTotal?: number;

  /** Genre tag */
  genre?: string;

  /** Duration in milliseconds */
  durationMs?: number;

  /** Bitrate in kbps */
  bitrate?: number;

  /** Audio format: mp3, m4a, flac, etc. */
  format?: string;

  /** Embedded artwork if present */
  artwork?: {
    data: Uint8Array;
    mimeType: string;
  };
}

/**
 * Lightweight track entry for the search index.
 * Optimized for fast client-side filtering (~1-2MB for 10K tracks).
 */
export interface SearchIndexTrack {
  /** Track ID */
  id: string;
  /** Track title */
  title: string;
  /** Artist name */
  artist: string;
  /** Album name */
  album: string;
  /** Duration in milliseconds */
  duration_ms: number;
}

/**
 * Search index stored at /library/index
 */
export interface SearchIndex {
  /** All tracks in lightweight format */
  tracks: SearchIndexTrack[];
  /** Unix timestamp of last index update */
  last_updated: number;
}

/**
 * Import notification message published when tracks are added.
 * Groups tracks by album (like Apple Music's Recently Added).
 * Stored in the "imports" topic with type "import_batch".
 */
export interface ImportNotification {
  /** Map of album_id -> track_ids imported into that album */
  albums: Record<string, string[]>;
  /** Unix timestamp when import completed */
  imported_at: number;
}

/** Topic ID for import notifications */
export const IMPORTS_TOPIC_ID = 'imports';

/** Message type for import batch notifications */
export const IMPORT_BATCH_TYPE = 'import_batch';
