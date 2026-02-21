/**
 * Popular View Component
 *
 * Shows the top 10 most-played tracks grouped by time period:
 *   - Past 7 days
 *   - This month / Last month
 *   - This year / Last year
 *   - Every earlier year for which play data exists
 *
 * Data comes from PlayCountService (date-keyed play count documents).
 * Track metadata is resolved from the search index for efficiency.
 */

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PlayCountService } from '@/services/play-count.js';
import type { MusicSpaceService } from '@/services/music-space.js';
import type { CacheService } from '@/services/index.js';
import type { SearchIndexTrack } from '@/types/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PopularTrack {
  track_id: string;
  play_count: number;
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  artwork_blob_id?: string;
  artwork_blob_key?: string;
  artwork_mime_type?: string;
}

interface PopularSection {
  /** Human-readable heading, e.g. "Past 7 Days", "This Month", "2024" */
  label: string;
  /** Period key passed to PlayCountService.getTopTracks */
  period: string;
  tracks: PopularTrack[];
}

// ---------------------------------------------------------------------------
// Date helpers (UTC)
// ---------------------------------------------------------------------------

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastMonthKey(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@customElement('popular-view')
export class PopularView extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--spacing-lg);
    }

    h1 {
      font-size: var(--font-size-xxxl);
      font-weight: 700;
      margin: 0 0 var(--spacing-xl);
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--color-text-secondary);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-xxl);
      text-align: center;
      color: var(--color-text-secondary);
    }

    .empty-state svg {
      width: 64px;
      height: 64px;
      color: var(--color-text-subdued);
      margin-bottom: var(--spacing-lg);
    }

    .empty-state h2 {
      font-size: var(--font-size-xl);
      font-weight: 600;
      margin-bottom: var(--spacing-sm);
      color: var(--color-text-primary);
    }

    /* Sections */
    .section {
      margin-bottom: var(--spacing-xxl);
    }

    .section-title {
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-subdued);
      margin: 0 0 var(--spacing-sm);
      padding: var(--spacing-sm) 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    /* Track rows */
    .track-row {
      display: grid;
      grid-template-columns: 28px 40px 1fr 48px 60px;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-xs);
      border-radius: var(--radius-sm);
      align-items: center;
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .track-row:hover {
      background-color: var(--color-bg-highlight);
    }

    .track-rank {
      color: var(--color-text-subdued);
      font-size: var(--font-size-sm);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .track-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }

    .track-title {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .track-subtitle {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .track-plays {
      font-size: var(--font-size-sm);
      color: var(--color-text-subdued);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .track-duration {
      font-size: var(--font-size-sm);
      color: var(--color-text-subdued);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .track-artwork {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-xs, 2px);
      background-color: var(--color-bg-highlight);
      overflow: hidden;
      flex-shrink: 0;
    }

    .track-artwork img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    @media (max-width: 480px) {
      .track-row {
        grid-template-columns: 24px 40px 1fr 44px;
      }

      .track-plays {
        display: none;
      }
    }
  `;

  @property({ attribute: false })
  playCountService: PlayCountService | null = null;

  @property({ attribute: false })
  musicSpace: MusicSpaceService | null = null;

  @property({ attribute: false })
  cacheService: CacheService | null = null;

  @property({ type: Boolean })
  offline = false;

  /** Cache of artwork object URLs by blob ID */
  private artworkUrls = new Map<string, string>();

  @state()
  private sections: PopularSection[] = [];

  @state()
  private loading = true;

  override connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const url of this.artworkUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.artworkUrls.clear();
  }

  override updated(changed: Map<string, unknown>) {
    if (
      (changed.has('playCountService') || changed.has('musicSpace')) &&
      this.playCountService && this.musicSpace
    ) {
      this.loadData();
    }
    if (changed.has('offline') && changed.get('offline') === true && !this.offline) {
      this.loadData();
    }
  }

  private async loadData() {
    if (!this.playCountService || !this.musicSpace) return;

    this.loading = true;

    try {
      // Load search index for track metadata lookup.
      const index = await this.musicSpace.getSearchIndex();
      const trackById = new Map<string, SearchIndexTrack>(
        index.tracks.map(t => [t.id, t])
      );

      // Build the ordered list of periods to query.
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const thisMonth = currentMonthKey();
      const lastMonth = lastMonthKey();

      type PeriodDef = { label: string; period: string };
      const periodDefs: PeriodDef[] = [
        { label: 'Past 7 Days', period: 'week' },
        { label: 'This Month',  period: thisMonth },
        { label: 'Last Month',  period: lastMonth },
        { label: 'This Year',   period: String(currentYear) },
        { label: 'Last Year',   period: String(currentYear - 1) },
      ];

      // Append earlier years (up to 20 years back) dynamically — only include
      // years that actually have play data.
      for (let y = currentYear - 2; y >= currentYear - 20; y--) {
        periodDefs.push({ label: String(y), period: String(y) });
      }

      // Fetch top tracks for all periods in parallel.
      const results = await Promise.all(
        periodDefs.map(({ period }) => this.playCountService!.getTopTracks(period, 10))
      );

      // Build sections, dropping any with no plays.
      const sections: PopularSection[] = [];
      for (let i = 0; i < periodDefs.length; i++) {
        const raw = results[i];
        if (raw.length === 0) continue;

        const tracks: PopularTrack[] = (await Promise.all(
          raw.map(async ({ track_id, play_count }): Promise<PopularTrack | null> => {
            const meta = trackById.get(track_id);
            if (!meta) return null;
            let artwork_blob_id: string | undefined;
            let artwork_blob_key: string | undefined;
            let artwork_mime_type: string | undefined;
            try {
              const full = await this.musicSpace!.getTrack(track_id);
              artwork_blob_id = full.artwork_blob_id;
              artwork_blob_key = full.artwork_encryption?.key;
              artwork_mime_type = full.artwork_mime_type;
            } catch { /* artwork is best-effort */ }
            return {
              track_id,
              play_count,
              title: meta.title,
              artist: meta.artist,
              album: meta.album,
              duration_ms: meta.duration_ms,
              artwork_blob_id,
              artwork_blob_key,
              artwork_mime_type,
            };
          })
        )).filter((t): t is PopularTrack => t !== null);

        if (tracks.length > 0) {
          sections.push({ label: periodDefs[i].label, period: periodDefs[i].period, tracks });
        }
      }

      this.sections = sections;
    } catch (err) {
      console.error('[PopularView] Failed to load data:', err);
      this.sections = [];
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.loading) {
      return html`
        <h1>Most Played</h1>
        <div class="loading">Loading...</div>
      `;
    }

    if (this.sections.length === 0) {
      return html`
        <h1>Popular</h1>
        ${this.renderEmptyState()}
      `;
    }

    return html`
      <h1>Popular</h1>
      ${this.sections.map(s => this.renderSection(s))}
    `;
  }

  private renderSection(section: PopularSection) {
    return html`
      <div class="section">
        <div class="section-title">${section.label}</div>
        ${section.tracks.map((track, i) => this.renderTrackRow(track, i + 1, section.tracks.map(t => t.track_id)))}
      </div>
    `;
  }

  private renderTrackRow(track: PopularTrack, rank: number, sectionTrackIds: string[]) {
    return html`
      <div class="track-row" @click=${() => this.playTrack(track.track_id, sectionTrackIds)}>
        <span class="track-rank">${rank}</span>
        <div class="track-info">
          <span class="track-title">${track.title}</span>
          <span class="track-subtitle">${track.artist}</span>
        </div>
        <span class="track-plays">${this.formatPlays(track.play_count)}</span>
        <span class="track-duration">${this.formatDuration(track.duration_ms)}</span>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
        </svg>
        <h2>No plays yet</h2>
        <p>Start listening to build up your play history.</p>
      </div>
    `;
  }

  private playTrack(trackId: string, queue: string[]) {
    this.dispatchEvent(new CustomEvent('play-track', {
      detail: { trackId, queue },
      bubbles: true,
      composed: true,
    }));
  }

  private formatPlays(n: number): string {
    return n === 1 ? '1 play' : `${n} plays`;
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'popular-view': PopularView;
  }
}
