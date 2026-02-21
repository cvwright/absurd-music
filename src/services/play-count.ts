/**
 * Play Count Service
 *
 * Records how many times each track has been played using date-keyed documents
 * stored in encrypted KV data at user/{user_id}/play_counts/{date}.
 *
 * Storage layout:
 *   play_counts/{yyyy-mm-dd}  →  { [track_id]: count }  daily, last 7 days
 *   play_counts/{yyyy-mm}     →  { [track_id]: count }  monthly rollup, last 12 months
 *   play_counts/{yyyy}        →  { [track_id]: count }  yearly rollup, all years
 *
 * Compaction runs lazily on each write:
 *   - The daily doc from 7 days ago is merged into its yyyy-mm doc and deleted.
 *   - The monthly doc from 12 months ago is merged into its yyyy doc and deleted.
 *
 * A play is counted once per track session after the listener crosses:
 *   - 30 seconds, for tracks longer than 60 s
 *   - 50% of duration, for tracks 60 s or shorter
 * The `ended` event also triggers a count (catches very short tracks).
 */

import type { PlayCountMap } from '@/types/user.js';
import type { PlaybackEvent, PlaybackService } from './playback.js';
import type { MusicSpaceService } from './music-space.js';

// ---------------------------------------------------------------------------
// Date key helpers — all UTC for cross-device consistency
// ---------------------------------------------------------------------------

function dailyKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthlyKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** "yyyy-mm-dd" → "yyyy-mm" */
function dailyToMonthly(day: string): string {
  return day.slice(0, 7);
}

/** "yyyy-mm-dd" or "yyyy-mm" → "yyyy" */
function toYearly(key: string): string {
  return key.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Tracks and persists per-user play counts using date-keyed KV documents.
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

  // Single promise chain serializes all writes to the current day's document.
  private writeQueue: Promise<void> = Promise.resolve();

  /** How many years back to scan when computing all-time play counts. */
  private static readonly MAX_HISTORY_YEARS = 20;

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
    this.writeQueue = this.writeQueue
      .then(() => this.persistIncrement(trackId))
      .catch((err) => {
        console.error(`[PlayCountService] Failed to record play for ${trackId}:`, err);
      });
  }

  // ---------------------------------------------------------------------------
  // Core read-modify-write
  // ---------------------------------------------------------------------------

  private async persistIncrement(trackId: string): Promise<void> {
    const now = new Date();
    const path = `play_counts/${dailyKey(now)}`;

    const map = await this.readMap(path);
    map[trackId] = (map[trackId] ?? 0) + 1;
    await this.musicSpace.setUserData<PlayCountMap>(path, map);

    // Best-effort compaction — failures are non-fatal.
    await this.compactDaily(now).catch((err) => {
      console.warn('[PlayCountService] Daily compaction failed:', err);
    });
    await this.compactMonthly(now).catch((err) => {
      console.warn('[PlayCountService] Monthly compaction failed:', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Read a PlayCountMap, returning {} if missing or null (deleted). */
  private async readMap(path: string): Promise<PlayCountMap> {
    try {
      const map = await this.musicSpace.getUserData<PlayCountMap | null>(path);
      return map ?? {};
    } catch {
      return {};
    }
  }

  // ---------------------------------------------------------------------------
  // Compaction
  // ---------------------------------------------------------------------------

  /**
   * Merge the daily doc from 7 days ago into its yyyy-mm doc, then delete it.
   */
  private async compactDaily(now: Date): Promise<void> {
    const cutoff = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 7,
    ));
    const dayKey = dailyKey(cutoff);
    const dailyPath = `play_counts/${dayKey}`;

    const daily = await this.readMap(dailyPath);
    if (Object.keys(daily).length === 0) return;

    const monthPath = `play_counts/${dailyToMonthly(dayKey)}`;
    const monthly = await this.readMap(monthPath);
    for (const [id, count] of Object.entries(daily)) {
      monthly[id] = (monthly[id] ?? 0) + count;
    }

    await this.musicSpace.setUserData<PlayCountMap>(monthPath, monthly);
    await this.musicSpace.deleteUserData(dailyPath);
  }

  /**
   * Merge the monthly doc from 12 months ago into its yyyy doc, then delete it.
   */
  private async compactMonthly(now: Date): Promise<void> {
    const cutoff = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - 12,
      1,
    ));
    const mKey = monthlyKey(cutoff);
    const monthPath = `play_counts/${mKey}`;

    const monthly = await this.readMap(monthPath);
    if (Object.keys(monthly).length === 0) return;

    const yearPath = `play_counts/${toYearly(mKey)}`;
    const yearly = await this.readMap(yearPath);
    for (const [id, count] of Object.entries(monthly)) {
      yearly[id] = (yearly[id] ?? 0) + count;
    }

    await this.musicSpace.setUserData<PlayCountMap>(yearPath, yearly);
    await this.musicSpace.deleteUserData(monthPath);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Return the total number of plays for a track across all date documents.
   *
   * Fetches the last 7 daily docs, last 12 monthly docs, and up to
   * MAX_HISTORY_YEARS yearly docs in parallel, then sums the count for trackId.
   */
  async getPlayCount(trackId: string): Promise<number> {
    const maps = await this.fetchAllMaps();
    return maps.reduce((sum, map) => sum + (map[trackId] ?? 0), 0);
  }

  /**
   * Return the most-played tracks within the last `days` days, ordered by
   * play count descending. Reads one document per day (at most `days` fetches
   * in parallel).
   *
   * @param days  - Lookback window in days (default 7)
   * @param limit - Maximum number of results to return (default 10)
   */
  async getRecentlyPopular(
    days = 7,
    limit = 10,
  ): Promise<Array<{ track_id: string; play_count: number }>> {
    const now = new Date();
    const fetches = Array.from({ length: days }, (_, d) => {
      const date = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - d,
      ));
      return this.readMap(`play_counts/${dailyKey(date)}`);
    });

    const maps = await Promise.all(fetches);
    const counts = new Map<string, number>();
    for (const map of maps) {
      for (const [id, count] of Object.entries(map)) {
        counts.set(id, (counts.get(id) ?? 0) + count);
      }
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

  // ---------------------------------------------------------------------------
  // Period-based queries
  // ---------------------------------------------------------------------------

  /**
   * Get the top N tracks for a given time period.
   *
   * @param period - `'week'` (last 7 days) | `'yyyy-mm'` (a calendar month) | `'yyyy'` (a calendar year)
   * @param limit  - Maximum results (default 10)
   */
  async getTopTracks(
    period: string,
    limit = 10,
  ): Promise<Array<{ track_id: string; play_count: number }>> {
    const map = await this.getMapForPeriod(period);
    return Object.entries(map)
      .map(([track_id, play_count]) => ({ track_id, play_count }))
      .sort((a, b) => b.play_count - a.play_count)
      .slice(0, limit);
  }

  /**
   * Merge play count maps for all docs that contribute to `period`.
   *
   * 'week'   → last 7 daily docs
   * 'yyyy-mm' → monthly doc + any daily docs in that month still in daily tier
   * 'yyyy'   → yearly doc + matching monthly docs still in monthly tier
   *             + matching daily docs still in daily tier
   */
  private async getMapForPeriod(period: string): Promise<PlayCountMap> {
    const now = new Date();
    const merged: PlayCountMap = {};

    const merge = (src: PlayCountMap) => {
      for (const [id, count] of Object.entries(src)) {
        merged[id] = (merged[id] ?? 0) + count;
      }
    };

    // Pre-compute the daily and monthly keys currently in the rolling tiers.
    const hotDailyKeys = Array.from({ length: 7 }, (_, d) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d));
      return dailyKey(date);
    });
    const hotMonthlyKeys = Array.from({ length: 12 }, (_, m) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
      return monthlyKey(date);
    });

    if (period === 'week') {
      const maps = await Promise.all(hotDailyKeys.map(k => this.readMap(`play_counts/${k}`)));
      maps.forEach(merge);

    } else if (period.length === 7) {
      // Monthly: compacted monthly doc + any daily docs still in this month's daily tier.
      merge(await this.readMap(`play_counts/${period}`));
      const matching = hotDailyKeys.filter(k => k.startsWith(period));
      const maps = await Promise.all(matching.map(k => this.readMap(`play_counts/${k}`)));
      maps.forEach(merge);

    } else if (period.length === 4) {
      // Yearly: compacted yearly doc + matching monthly docs + matching daily docs.
      merge(await this.readMap(`play_counts/${period}`));
      const matchingMonthly = hotMonthlyKeys.filter(k => k.startsWith(period));
      const monthlyMaps = await Promise.all(matchingMonthly.map(k => this.readMap(`play_counts/${k}`)));
      monthlyMaps.forEach(merge);
      const matchingDaily = hotDailyKeys.filter(k => k.startsWith(period));
      const dailyMaps = await Promise.all(matchingDaily.map(k => this.readMap(`play_counts/${k}`)));
      dailyMaps.forEach(merge);
    }

    return merged;
  }

  // ---------------------------------------------------------------------------
  // Internal: fetch all date-keyed docs in parallel
  // ---------------------------------------------------------------------------

  private async fetchAllMaps(): Promise<PlayCountMap[]> {
    const now = new Date();

    const dailyFetches = Array.from({ length: 7 }, (_, d) => {
      const date = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - d,
      ));
      return this.readMap(`play_counts/${dailyKey(date)}`);
    });

    const monthlyFetches = Array.from({ length: 12 }, (_, m) => {
      const date = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - m,
        1,
      ));
      return this.readMap(`play_counts/${monthlyKey(date)}`);
    });

    const currentYear = now.getUTCFullYear();
    const yearlyFetches = Array.from(
      { length: PlayCountService.MAX_HISTORY_YEARS },
      (_, y) => this.readMap(`play_counts/${currentYear - y}`),
    );

    return Promise.all([...dailyFetches, ...monthlyFetches, ...yearlyFetches]);
  }
}
