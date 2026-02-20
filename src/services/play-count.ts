/**
 * Play Count Service
 *
 * Records how many times each track has been played, persisting counts to
 * encrypted per-user storage at user/{user_id}/play_counts/{track_id}.
 *
 * Uses a three-tier rolling window (daily / monthly / yearly) with lazy
 * compaction on each write so the stored object stays bounded in size.
 *
 * A play is counted once per track session after the listener crosses:
 *   - 30 seconds, for tracks longer than 60 s
 *   - 50% of duration, for tracks 60 s or shorter
 * The `ended` event also triggers a count (catches very short tracks).
 */

import type { TrackPlayCount, RecentlyPlayed } from '@/types/user.js';
import type { PlaybackEvent, PlaybackService } from './playback.js';
import type { MusicSpaceService } from './music-space.js';

// ---------------------------------------------------------------------------
// Date key helpers — all UTC for cross-device consistency
// ---------------------------------------------------------------------------

function todayKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function thisMonthKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Maximum entries kept in the recently-played ring buffer. */
const MAX_RECENT_PLAYS = 300;

// ---------------------------------------------------------------------------
// Empty record factories
// ---------------------------------------------------------------------------

function emptyPlayCount(): TrackPlayCount {
  return { daily: {}, monthly: {}, yearly: {}, updated_at: 0 };
}

function emptyRecentlyPlayed(): RecentlyPlayed {
  return { entries: [], max_entries: MAX_RECENT_PLAYS };
}

// ---------------------------------------------------------------------------
// Compaction — mutates record in place, returns it
// ---------------------------------------------------------------------------

/**
 * Roll stale daily entries (> 7 days old) into monthly, and stale monthly
 * entries (> 12 months old) into yearly. Stale entries are deleted from the
 * finer tier after being merged, so there is no double-counting.
 *
 * ISO string comparison is safe here because the keys are zero-padded and
 * therefore lexicographically ordered identically to chronological order.
 */
function compact(record: TrackPlayCount, now: Date = new Date()): TrackPlayCount {
  // Cutoff for daily: date exactly 7 days ago (UTC)
  const cutoffDailyDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 7,
  ));
  const cutoffDaily = todayKey(cutoffDailyDate);

  for (const [day, count] of Object.entries(record.daily)) {
    if (day <= cutoffDaily) {
      const monthKey = day.slice(0, 7); // "YYYY-MM-DD" → "YYYY-MM"
      record.monthly[monthKey] = (record.monthly[monthKey] ?? 0) + count;
      delete record.daily[day];
    }
  }

  // Cutoff for monthly: month exactly 12 months ago (UTC)
  const cutoffMonthDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() - 12,
    1,
  ));
  const cutoffMonth = thisMonthKey(cutoffMonthDate);

  for (const [month, count] of Object.entries(record.monthly)) {
    if (month <= cutoffMonth) {
      const yearKey = month.slice(0, 4); // "YYYY-MM" → "YYYY"
      record.yearly[yearKey] = (record.yearly[yearKey] ?? 0) + count;
      delete record.monthly[month];
    }
  }

  return record;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Tracks and persists per-user, per-track play counts.
 *
 * Instantiate once after both PlaybackService and MusicSpaceService are
 * ready, and call destroy() on logout or component teardown.
 */
export class PlayCountService {
  private readonly unsubscribe: () => void;

  // Play-detection state — reset on each 'loading' event
  private currentTrackId: string | null = null;
  private currentTrackDurationMs = 0;
  private playedCurrentSession = false;

  // Per-track write serialization: maps trackId → tail of the write chain.
  // Prevents read-modify-write races when the same track is played rapidly.
  private readonly writeQueues = new Map<string, Promise<void>>();

  constructor(
    private readonly playback: PlaybackService,
    private readonly musicSpace: MusicSpaceService,
  ) {
    this.unsubscribe = this.playback.on(this.handleEvent.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Playback event handler
  // ---------------------------------------------------------------------------

  private handleEvent(event: PlaybackEvent): void {
    switch (event.type) {
      case 'loading':
        this.currentTrackId = event.trackId;
        this.currentTrackDurationMs = 0;
        this.playedCurrentSession = false;
        break;

      case 'loaded': {
        // currentTrack is set by PlaybackService before emitting 'loaded'
        const track = this.playback.getCurrentTrack();
        if (track && track.track_id === event.trackId) {
          this.currentTrackDurationMs = track.duration_ms;
        }
        break;
      }

      case 'timeupdate':
        if (
          !this.playedCurrentSession &&
          this.currentTrackId !== null &&
          this.currentTrackDurationMs > 0
        ) {
          const threshold =
            this.currentTrackDurationMs > 60_000
              ? 30_000
              : this.currentTrackDurationMs * 0.5;

          if (event.position_ms >= threshold) {
            this.playedCurrentSession = true;
            this.enqueueWrite(this.currentTrackId);
          }
        }
        break;

      case 'ended':
        // Catch tracks played to completion that never crossed the timeupdate
        // threshold (e.g. very short tracks, or threshold not reached yet).
        if (!this.playedCurrentSession && this.currentTrackId !== null) {
          this.playedCurrentSession = true;
          this.enqueueWrite(this.currentTrackId);
        }
        break;

      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Write serialization
  // ---------------------------------------------------------------------------

  private enqueueWrite(trackId: string): void {
    const prev = this.writeQueues.get(trackId) ?? Promise.resolve();
    const next = prev
      .then(() => this.persistIncrement(trackId))
      .catch((err) => {
        console.error(`[PlayCountService] Failed to record play for ${trackId}:`, err);
      });
    this.writeQueues.set(trackId, next);

    // Prune the map entry once the tail settles to avoid unbounded growth.
    next.then(() => {
      if (this.writeQueues.get(trackId) === next) {
        this.writeQueues.delete(trackId);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Core read-modify-write
  // ---------------------------------------------------------------------------

  private async persistIncrement(trackId: string): Promise<void> {
    const path = `play_counts/${trackId}`;
    const now = new Date();

    let record: TrackPlayCount;
    try {
      record = await this.musicSpace.getUserState<TrackPlayCount>(path);
    } catch {
      // Path doesn't exist yet (first play) or unreadable — start fresh.
      record = emptyPlayCount();
    }

    const day = todayKey(now);
    record.daily[day] = (record.daily[day] ?? 0) + 1;

    compact(record, now);

    record.updated_at = Date.now();

    await this.musicSpace.setUserState<TrackPlayCount>(path, record);

    // Best-effort: append to the ring buffer for recently-popular queries.
    // A failed write here is non-fatal — per-track counts remain accurate.
    await this.appendToRecentlyPlayed(trackId, record.updated_at).catch((err) => {
      console.warn('[PlayCountService] Could not update recently_played:', err);
    });
  }

  private async appendToRecentlyPlayed(trackId: string, playedAt: number): Promise<void> {
    let log: RecentlyPlayed;
    try {
      log = await this.musicSpace.getUserState<RecentlyPlayed>('recently_played');
    } catch {
      log = emptyRecentlyPlayed();
    }

    log.entries.unshift({ track_id: trackId, played_at: playedAt });
    if (log.entries.length > log.max_entries) {
      log.entries = log.entries.slice(0, log.max_entries);
    }

    await this.musicSpace.setUserState<RecentlyPlayed>('recently_played', log);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Return the total number of plays for a track across all time tiers.
   * Returns 0 if the track has never been played or the record is unreadable.
   */
  async getPlayCount(trackId: string): Promise<number> {
    const path = `play_counts/${trackId}`;
    let record: TrackPlayCount;
    try {
      record = await this.musicSpace.getUserState<TrackPlayCount>(path);
    } catch {
      return 0;
    }

    let total = 0;
    for (const n of Object.values(record.daily))   total += n;
    for (const n of Object.values(record.monthly)) total += n;
    for (const n of Object.values(record.yearly))  total += n;
    return total;
  }

  /**
   * Return the most-played tracks within the last `days` days, ordered by
   * play count descending. Reads a single document (the ring buffer), so
   * it does not scale with library size.
   *
   * @param days  - Lookback window in days (default 7)
   * @param limit - Maximum number of results to return (default 10)
   */
  async getRecentlyPopular(
    days = 7,
    limit = 10,
  ): Promise<Array<{ track_id: string; play_count: number }>> {
    let log: RecentlyPlayed;
    try {
      log = await this.musicSpace.getUserState<RecentlyPlayed>('recently_played');
    } catch {
      return [];
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const counts = new Map<string, number>();

    for (const entry of log.entries) {
      // Entries are newest-first; once we pass the cutoff all remaining are older.
      if (entry.played_at < cutoff) break;
      counts.set(entry.track_id, (counts.get(entry.track_id) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([track_id, play_count]) => ({ track_id, play_count }))
      .sort((a, b) => b.play_count - a.play_count)
      .slice(0, limit);
  }

  /**
   * Unsubscribe from playback events. Call on logout or component teardown.
   */
  destroy(): void {
    this.unsubscribe();
  }
}
