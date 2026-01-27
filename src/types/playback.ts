/**
 * Playback Types
 *
 * Data models for queue, playback state, and now playing messages.
 */

/** Repeat mode options */
export type RepeatMode = 'none' | 'all' | 'one';

/**
 * Queue state stored at /user/{user_id}/queue
 */
export interface QueueState {
  /** Ordered list of track IDs */
  track_ids: string[];
  /** Current position in queue (0-indexed) */
  current_index: number;
  /** Whether shuffle is enabled */
  shuffle_enabled: boolean;
  /** Current repeat mode */
  repeat_mode: RepeatMode;
  /** Unix timestamp of last update */
  updated_at: number;
}

/**
 * Playback state stored at /user/{user_id}/playback_state
 */
export interface PlaybackState {
  /** Currently playing track ID (null if nothing playing) */
  current_track_id: string | null;
  /** Position in track in milliseconds */
  position_ms: number;
  /** Whether playback is active */
  is_playing: boolean;
  /** Volume level 0.0 - 1.0 */
  volume: number;
  /** Unix timestamp of last update */
  updated_at: number;
}

/**
 * Now playing message posted to /topics/nowplaying/messages
 */
export interface NowPlayingMessage {
  type: 'now_playing';
  /** Track ID */
  track_id: string;
  /** Track title (denormalized for display) */
  track_title: string;
  /** Artist name */
  artist: string;
  /** Album name */
  album: string;
  /** When playback started (Unix timestamp) */
  started_at: number;
  /** Artwork blob ID for display */
  artwork_blob_id?: string;
}

/**
 * Playback context - where playback originated from
 */
export interface PlaybackContext {
  /** Type of context */
  type: 'album' | 'artist' | 'playlist' | 'search' | 'queue';
  /** ID of the context (album_id, artist_id, playlist_id) */
  id?: string;
  /** Display name of the context */
  name?: string;
}
