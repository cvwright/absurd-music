/**
 * Playback Service
 *
 * Manages audio playback, queue management, and state synchronization.
 * Uses HTML5 Audio API with download-then-play strategy.
 */

import type { Track, QueueState, PlaybackState, RepeatMode } from '@/types/index.js';
import type { MusicSpaceService } from './music-space.js';
import type { CacheService } from './cache.js';

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
  }

  private setupAudioListeners(): void {
    this.audio.addEventListener('play', () => {
      this.emit({ type: 'play' });
    });

    this.audio.addEventListener('pause', () => {
      this.emit({ type: 'pause' });
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
      const blob = new Blob([audioData], { type: `audio/${track.file_format}` });
      this.currentBlobUrl = URL.createObjectURL(blob);
      this.currentTrack = track;

      this.audio.src = this.currentBlobUrl;
      this.audio.volume = this.volume;
      await this.audio.play();

      this.emit({ type: 'loaded', trackId: track.track_id });

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

    const nextIndex = this.getNextIndex();
    if (nextIndex === null) {
      // End of queue
      this.pause();
      return;
    }

    this.queue.current_index = nextIndex;
    this.queue.updated_at = Date.now();

    const trackId = this.queue.track_ids[nextIndex];
    const track = await this.space.getTrack(trackId);
    await this.playTrack(track);
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

    const prevIndex = this.getPreviousIndex();
    if (prevIndex === null) {
      this.seek(0);
      return;
    }

    this.queue.current_index = prevIndex;
    this.queue.updated_at = Date.now();

    const trackId = this.queue.track_ids[prevIndex];
    const track = await this.space.getTrack(trackId);
    await this.playTrack(track);
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
    await this.next();
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
    this.audio.pause();
    this.eventHandlers.clear();
  }
}
