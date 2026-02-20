/**
 * Playback Service
 *
 * Manages audio playback, queue management, and state synchronization.
 * Uses HTML5 Audio API with download-then-play strategy.
 */

import type { Track, QueueState, PlaybackState, RepeatMode } from '@/types/index.js';
import type { MusicSpaceService } from './music-space.js';
import type { CacheService } from './cache.js';

/** Map file format extensions to valid MIME types. Mobile Safari is strict about these. */
function audioMimeType(format: string): string {
  // Stored file_format may include ftyp brand info (e.g. "m4a/mp42/isom"); use only the base.
  const base = format.split('/')[0].trim().toLowerCase();
  switch (base) {
    case 'm4a':
    case 'mp42':
    case 'isom':
    case 'iso2':
    case 'aac':
      return 'audio/mp4';
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'opus':
      return 'audio/ogg; codecs=opus';
    case 'flac':
      return 'audio/flac';
    case 'wav':
      return 'audio/wav';
    default:
      return `audio/${base}`;
  }
}

export type PlaybackEvent =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'ended' }
  | { type: 'timeupdate'; position_ms: number }
  | { type: 'loading'; trackId: string }
  | { type: 'loaded'; trackId: string }
  | { type: 'error'; error: Error }
  | { type: 'queuechange'; queue: QueueState };

export type PlaybackEventHandler = (event: PlaybackEvent) => void;

/**
 * Service for managing audio playback.
 *
 * Features:
 * - Download-then-play with progress indication
 * - Pre-fetching of next tracks
 * - Queue management with shuffle and repeat
 * - State synchronization across devices
 */
export class PlaybackService {
  private audio: HTMLAudioElement;
  private currentBlobUrl: string | null = null;
  private currentTrack: Track | null = null;
  private queue: QueueState;
  private volume = 0.8;
  private eventHandlers: Set<PlaybackEventHandler> = new Set();

  private space: MusicSpaceService | null = null;
  private cache: CacheService | null = null;

  // Prefetch state
  private prefetchingTrackIds: Set<string> = new Set();

  // Media Session artwork URL (for cleanup)
  private mediaSessionArtworkUrl: string | null = null;

  // Track ID for which Media Session artwork is being loaded (to detect stale loads)
  private loadingMediaSessionArtworkForTrackId: string | null = null;

  constructor() {
    this.audio = new Audio();
    this.setupAudioListeners();

    this.queue = {
      track_ids: [],
      current_index: 0,
      shuffle_enabled: false,
      repeat_mode: 'none',
      updated_at: Date.now(),
    };
  }

  /**
   * Initialize with services.
   */
  init(space: MusicSpaceService, cache: CacheService): void {
    this.space = space;
    this.cache = cache;
    this.setupMediaSession();
  }

  private setupAudioListeners(): void {
    this.audio.addEventListener('play', () => {
      this.emit({ type: 'play' });
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    });

    this.audio.addEventListener('pause', () => {
      this.emit({ type: 'pause' });
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    });

    this.audio.addEventListener('ended', () => {
      this.emit({ type: 'ended' });
      this.handleTrackEnded();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.emit({
        type: 'timeupdate',
        position_ms: this.audio.currentTime * 1000,
      });

      // At halfway point, ensure next track is prefetched
      if (this.currentTrack && this.audio.currentTime > this.audio.duration / 2) {
        this.prefetchNextTrack();
      }
    });

    this.audio.addEventListener('error', () => {
      const error = this.audio.error;
      this.emit({
        type: 'error',
        error: new Error(error?.message ?? 'Unknown playback error'),
      });
    });

    // Update Media Session position state when duration becomes available
    this.audio.addEventListener('loadedmetadata', () => {
      this.updateMediaSessionPositionState();
    });
  }

  /**
   * Set up Media Session API action handlers for OS-level media controls.
   */
  private setupMediaSession(): void {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      this.resume();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.pause();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      this.previous();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      this.next();
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        this.seek(details.seekTime * 1000);
      }
    });

    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skipTime = details.seekOffset ?? 10;
      this.seek(Math.max(0, this.audio.currentTime * 1000 - skipTime * 1000));
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skipTime = details.seekOffset ?? 10;
      this.seek(this.audio.currentTime * 1000 + skipTime * 1000);
    });
  }

  /**
   * Update Media Session metadata with current track info and artwork.
   */
  private async updateMediaSessionMetadata(track: Track): Promise<void> {
    if (!('mediaSession' in navigator)) return;

    const trackId = track.track_id;
    this.loadingMediaSessionArtworkForTrackId = trackId;

    // Build artwork array if we have artwork and its encryption key
    let artwork: MediaImage[] = [];
    if (track.artwork_blob_id && track.artwork_encryption && this.space) {
      try {
        // Check artwork cache first
        let artworkData: ArrayBuffer | undefined;
        const mimeType = track.artwork_mime_type ?? 'image/jpeg';

        if (this.cache) {
          const cached = await this.cache.getArtwork(track.artwork_blob_id);
          if (cached) {
            artworkData = cached.imageData;
          }
        }

        if (!artworkData) {
          artworkData = await this.space.downloadArtworkBlob(
            track.artwork_blob_id,
            track.artwork_encryption.key
          );
          // Cache for next time
          if (this.cache && artworkData) {
            this.cache.cacheArtwork(track.artwork_blob_id, artworkData, mimeType).catch(() => {});
          }
        }

        // Ignore if a newer track started loading
        if (this.loadingMediaSessionArtworkForTrackId !== trackId) return;

        // Clean up previous artwork blob URL
        if (this.mediaSessionArtworkUrl) {
          URL.revokeObjectURL(this.mediaSessionArtworkUrl);
          this.mediaSessionArtworkUrl = null;
        }

        const blob = new Blob([artworkData], { type: mimeType });
        this.mediaSessionArtworkUrl = URL.createObjectURL(blob);
        artwork = [
          { src: this.mediaSessionArtworkUrl, sizes: '512x512', type: mimeType },
        ];
      } catch (e) {
        // Ignore errors for stale requests
        if (this.loadingMediaSessionArtworkForTrackId !== trackId) return;
        // Artwork failure is non-fatal — media session still works without it
      }
    } else {
      // No artwork - clean up previous if this is still the current track
      if (this.mediaSessionArtworkUrl) {
        URL.revokeObjectURL(this.mediaSessionArtworkUrl);
        this.mediaSessionArtworkUrl = null;
      }
    }

    // Only update metadata if this is still the current track
    if (this.loadingMediaSessionArtworkForTrackId !== trackId) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist_name,
      album: track.album_name,
      artwork,
    });
  }

  /**
   * Update Media Session position state for seek bar display.
   */
  private updateMediaSessionPositionState(): void {
    if (!('mediaSession' in navigator) || !this.currentTrack) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: this.audio.duration || 0,
        playbackRate: this.audio.playbackRate,
        position: this.audio.currentTime,
      });
    } catch {
      // Position state can fail if duration is not yet available
    }
  }

  /**
   * Subscribe to playback events.
   */
  on(handler: PlaybackEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: PlaybackEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Playback event handler error:', e);
      }
    }
  }

  /**
   * Play a specific track.
   */
  async playTrack(track: Track): Promise<void> {
    if (!this.space || !this.cache) {
      throw new Error('PlaybackService not initialized');
    }

    this.emit({ type: 'loading', trackId: track.track_id });

    try {
      // Check cache first
      let audioData: ArrayBuffer;
      const cached = await this.cache.getTrack(track.track_id);

      if (cached) {
        audioData = cached.audioData;
      } else {
        // Download and decrypt
        audioData = await this.space.downloadAudioBlob(
          track.audio_blob_id,
          track.encryption.key
        );

        // Cache for later
        await this.cache.cacheTrack(track.track_id, audioData, {
          title: track.title,
          artist_name: track.artist_name,
          album_name: track.album_name,
          duration_ms: track.duration_ms,
          file_format: track.file_format,
        });
      }

      // Clean up previous blob URL
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
      }

      // Create blob URL and play
      const blob = new Blob([audioData], { type: audioMimeType(track.file_format) });
      this.currentBlobUrl = URL.createObjectURL(blob);
      this.currentTrack = track;

      this.audio.src = this.currentBlobUrl;
      this.audio.volume = this.volume;
      await this.audio.play();

      this.emit({ type: 'loaded', trackId: track.track_id });

      // Update Media Session with track info
      this.updateMediaSessionMetadata(track);

      // Start prefetching next track
      this.prefetchNextTrack();
    } catch (error) {
      this.emit({ type: 'error', error: error as Error });
      throw error;
    }
  }

  /**
   * Pause playback.
   */
  pause(): void {
    this.audio.pause();
  }

  /**
   * Resume playback.
   */
  async resume(): Promise<void> {
    await this.audio.play();
  }

  /**
   * Toggle play/pause.
   */
  async togglePlayPause(): Promise<void> {
    if (this.audio.paused) {
      await this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Seek to position.
   */
  seek(positionMs: number): void {
    this.audio.currentTime = positionMs / 1000;
    this.updateMediaSessionPositionState();
  }

  /**
   * Set volume (0.0 - 1.0).
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.audio.volume = this.volume;
  }

  /**
   * Get current volume.
   */
  getVolume(): number {
    return this.volume;
  }

  // ============================================================
  // Queue Management
  // ============================================================

  /**
   * Set the play queue.
   */
  setQueue(trackIds: string[], startIndex = 0): void {
    this.queue = {
      track_ids: trackIds,
      current_index: startIndex,
      shuffle_enabled: this.queue.shuffle_enabled,
      repeat_mode: this.queue.repeat_mode,
      updated_at: Date.now(),
    };

    this.emit({ type: 'queuechange', queue: this.queue });
  }

  /**
   * Add track to end of queue.
   */
  addToQueue(trackId: string): void {
    this.queue.track_ids.push(trackId);
    this.queue.updated_at = Date.now();
    this.emit({ type: 'queuechange', queue: this.queue });
  }

  /**
   * Play next track in queue.
   */
  async next(): Promise<void> {
    if (!this.space) return;

    const startIndex = this.queue.current_index;
    let attempts = 0;
    const maxAttempts = this.queue.track_ids.length;

    while (attempts < maxAttempts) {
      const nextIndex = this.getNextIndex();
      if (nextIndex === null) {
        this.pause();
        return;
      }

      this.queue.current_index = nextIndex;
      this.queue.updated_at = Date.now();

      try {
        const trackId = this.queue.track_ids[nextIndex];
        const track = await this.space.getTrack(trackId);
        await this.playTrack(track);
        return;
      } catch {
        // Track unavailable (offline, missing) — skip to next
        attempts++;
        if (nextIndex === startIndex) break; // looped back around
      }
    }

    // No playable track found
    this.pause();
    this.emit({ type: 'error', error: new Error('No playable tracks available') });
  }

  /**
   * Play previous track in queue.
   */
  async previous(): Promise<void> {
    if (!this.space) return;

    // If more than 3 seconds in, restart current track
    if (this.audio.currentTime > 3) {
      this.seek(0);
      return;
    }

    const startIndex = this.queue.current_index;
    let attempts = 0;
    const maxAttempts = this.queue.track_ids.length;

    while (attempts < maxAttempts) {
      const prevIndex = this.getPreviousIndex();
      if (prevIndex === null) {
        this.seek(0);
        return;
      }

      this.queue.current_index = prevIndex;
      this.queue.updated_at = Date.now();

      try {
        const trackId = this.queue.track_ids[prevIndex];
        const track = await this.space.getTrack(trackId);
        await this.playTrack(track);
        return;
      } catch {
        // Track unavailable — skip to previous
        attempts++;
        if (prevIndex === startIndex) break;
      }
    }

    // No playable track found going backwards
    this.seek(0);
  }

  /**
   * Toggle shuffle mode.
   */
  toggleShuffle(): void {
    this.queue.shuffle_enabled = !this.queue.shuffle_enabled;
    this.queue.updated_at = Date.now();
    this.emit({ type: 'queuechange', queue: this.queue });
  }

  /**
   * Cycle through repeat modes: none -> all -> one -> none
   */
  cycleRepeat(): void {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const currentIdx = modes.indexOf(this.queue.repeat_mode);
    this.queue.repeat_mode = modes[(currentIdx + 1) % modes.length];
    this.queue.updated_at = Date.now();
    this.emit({ type: 'queuechange', queue: this.queue });
  }

  private getNextIndex(): number | null {
    const { track_ids, current_index, repeat_mode, shuffle_enabled } = this.queue;

    if (repeat_mode === 'one') {
      return current_index;
    }

    if (shuffle_enabled) {
      // Random next track
      const remaining = track_ids.length - 1;
      if (remaining <= 0) return repeat_mode === 'all' ? 0 : null;
      let next = Math.floor(Math.random() * track_ids.length);
      while (next === current_index && track_ids.length > 1) {
        next = Math.floor(Math.random() * track_ids.length);
      }
      return next;
    }

    if (current_index + 1 >= track_ids.length) {
      return repeat_mode === 'all' ? 0 : null;
    }

    return current_index + 1;
  }

  private getPreviousIndex(): number | null {
    if (this.queue.current_index > 0) {
      return this.queue.current_index - 1;
    }
    return this.queue.repeat_mode === 'all' ? this.queue.track_ids.length - 1 : null;
  }

  private async handleTrackEnded(): Promise<void> {
    try {
      await this.next();
    } catch (e) {
      console.error('Failed to advance queue:', e);
    }
  }

  private async prefetchNextTrack(): Promise<void> {
    if (!this.space || !this.cache) return;

    const nextIndex = this.getNextIndex();
    if (nextIndex === null) return;

    const trackId = this.queue.track_ids[nextIndex];

    // Already prefetching or cached
    if (this.prefetchingTrackIds.has(trackId)) return;
    if (await this.cache.hasTrack(trackId)) return;

    this.prefetchingTrackIds.add(trackId);

    try {
      const track = await this.space.getTrack(trackId);
      const audioData = await this.space.downloadAudioBlob(
        track.audio_blob_id,
        track.encryption.key
      );

      await this.cache.cacheTrack(trackId, audioData, {
        title: track.title,
        artist_name: track.artist_name,
        album_name: track.album_name,
        duration_ms: track.duration_ms,
        file_format: track.file_format,
      });
    } catch (e) {
      console.error('Prefetch failed:', e);
    } finally {
      this.prefetchingTrackIds.delete(trackId);
    }
  }

  // ============================================================
  // State Accessors
  // ============================================================

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  getQueue(): QueueState {
    return { ...this.queue };
  }

  getPlaybackState(): PlaybackState {
    return {
      current_track_id: this.currentTrack?.track_id ?? null,
      position_ms: this.audio.currentTime * 1000,
      is_playing: !this.audio.paused,
      volume: this.volume,
      updated_at: Date.now(),
    };
  }

  isPlaying(): boolean {
    return !this.audio.paused;
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
    }
    if (this.mediaSessionArtworkUrl) {
      URL.revokeObjectURL(this.mediaSessionArtworkUrl);
    }
    this.audio.pause();
    this.eventHandlers.clear();
  }
}
