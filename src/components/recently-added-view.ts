/**
 * Recently Added View Component
 *
 * Displays recently imported albums in reverse chronological order,
 * similar to Apple Music's Recently Added feature.
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { MusicSpaceService } from '@/services/music-space.js';
import type { CacheService } from '@/services/cache.js';
import type { Album, ImportNotification } from '@/types/index.js';
import { IMPORTS_TOPIC_ID, IMPORT_BATCH_TYPE } from '@/types/index.js';

/** Default time range: 30 days in milliseconds */
const DEFAULT_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

interface RecentAlbum extends Album {
  /** When this album was last imported */
  imported_at: number;
  /** Number of tracks added in the most recent import */
  tracks_added: number;
}

@customElement('recently-added-view')
export class RecentlyAddedView extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--spacing-lg);
    }

    .header {
      margin-bottom: var(--spacing-xl);
    }

    h1 {
      font-size: var(--font-size-xxxl);
      font-weight: 700;
      margin: 0;
    }

    .subtitle {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      margin-top: var(--spacing-xs);
    }

    /* Album grid - same pattern as library-view */
    .album-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--spacing-lg);
    }

    .album-card {
      display: flex;
      flex-direction: column;
      padding: var(--spacing-md);
      background-color: var(--color-bg-secondary);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .album-card:hover {
      background-color: var(--color-bg-highlight);
    }

    .album-artwork {
      width: 100%;
      aspect-ratio: 1;
      background-color: var(--color-bg-highlight);
      border-radius: var(--radius-sm);
      margin-bottom: var(--spacing-md);
      overflow: hidden;
    }

    .album-artwork img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .album-title {
      font-weight: 600;
      margin-bottom: var(--spacing-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .album-artist {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .album-date {
      font-size: var(--font-size-xs);
      color: var(--color-text-subdued);
      margin-top: var(--spacing-xs);
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-xxl);
      text-align: center;
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
    }

    .empty-state p {
      color: var(--color-text-secondary);
      max-width: 400px;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--color-text-secondary);
    }
  `;

  @property({ attribute: false })
  musicSpace: MusicSpaceService | null = null;

  @property({ attribute: false })
  cacheService: CacheService | null = null;

  @property({ type: Boolean })
  offline = false;

  @state()
  private recentAlbums: RecentAlbum[] = [];

  @state()
  private loading = true;

  /** Cache of artwork object URLs by blob ID */
  private artworkUrls = new Map<string, string>();

  override connectedCallback() {
    super.connectedCallback();
    this.loadRecentlyAdded();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    // Revoke object URLs to free memory
    for (const url of this.artworkUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.artworkUrls.clear();
  }

  override updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('musicSpace') && this.musicSpace) {
      this.loadRecentlyAdded();
    }
    // Reload data when coming back online
    if (changedProperties.has('offline') && changedProperties.get('offline') === true && !this.offline) {
      this.loadRecentlyAdded();
    }
  }

  private async loadRecentlyAdded() {
    if (!this.musicSpace) return;

    this.loading = true;

    try {
      // Query import messages from last 30 days
      const fromTime = Date.now() - DEFAULT_LOOKBACK_MS;
      const response = await this.musicSpace.getMessages(IMPORTS_TOPIC_ID, {
        from: fromTime,
        limit: 100,
      });

      // Collect album imports with their timestamps and track counts
      // album_id -> { imported_at, tracks_added }
      const albumImports = new Map<string, { imported_at: number; tracks_added: number }>();

      for (const message of response.messages) {
        if (message.type !== IMPORT_BATCH_TYPE) continue;

        try {
          const notification = this.musicSpace.decryptMessageData<ImportNotification>(
            IMPORTS_TOPIC_ID,
            message.data
          );

          for (const [albumId, trackIds] of Object.entries(notification.albums)) {
            const existing = albumImports.get(albumId);
            if (!existing || notification.imported_at > existing.imported_at) {
              // Use most recent import date and track count
              albumImports.set(albumId, {
                imported_at: notification.imported_at,
                tracks_added: trackIds.length,
              });
            }
          }
        } catch (err) {
          console.warn('Failed to decrypt import notification:', err);
        }
      }

      // Fetch album metadata for each unique album
      const albumsWithDates: RecentAlbum[] = [];
      for (const [albumId, info] of albumImports) {
        try {
          const album = await this.musicSpace.getAlbum(albumId);
          albumsWithDates.push({
            ...album,
            imported_at: info.imported_at,
            tracks_added: info.tracks_added,
          });
        } catch (err) {
          console.warn(`Failed to fetch album ${albumId}:`, err);
        }
      }

      // Sort by import date, newest first
      albumsWithDates.sort((a, b) => b.imported_at - a.imported_at);

      this.recentAlbums = albumsWithDates;

      // Start loading artwork
      this.loadArtworkForAlbums();
    } catch (err) {
      console.error('Failed to load recently added:', err);
      this.recentAlbums = [];
    } finally {
      this.loading = false;
    }
  }

  private loadArtworkForAlbums() {
    for (const album of this.recentAlbums) {
      if (album.artwork_blob_id && album.artwork_encryption?.key) {
        this.loadArtworkAsync(
          album.artwork_blob_id,
          album.artwork_encryption.key,
          album.artwork_mime_type
        );
      }
    }
  }

  private async loadArtworkAsync(blobId: string, blobKey: string, mimeType?: string) {
    if (this.artworkUrls.has(blobId) || !this.musicSpace) return;

    // Mark as loading with empty string
    this.artworkUrls.set(blobId, '');

    try {
      // Check cache first
      if (this.cacheService) {
        const cached = await this.cacheService.getArtwork(blobId);
        if (cached) {
          const blob = new Blob([cached.imageData], { type: cached.mimeType });
          const url = URL.createObjectURL(blob);
          this.artworkUrls.set(blobId, url);
          this.requestUpdate();
          return;
        }
      }

      // Download from server
      const data = await this.musicSpace.downloadArtworkBlob(blobId, blobKey);
      const resolvedMimeType = mimeType ?? 'image/jpeg';

      // Cache for future use
      if (this.cacheService) {
        await this.cacheService.cacheArtwork(blobId, new Uint8Array(data), resolvedMimeType);
      }

      const blob = new Blob([data], { type: resolvedMimeType });
      const url = URL.createObjectURL(blob);
      this.artworkUrls.set(blobId, url);
      this.requestUpdate();
    } catch (err) {
      console.warn(`Failed to load artwork ${blobId}:`, err);
      this.artworkUrls.delete(blobId);
    }
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading recently added...</div>`;
    }

    return html`
      <div class="header">
        <h1>Recently Added</h1>
        <p class="subtitle">Albums you've added in the last 30 days</p>
      </div>

      ${this.recentAlbums.length === 0
        ? this.renderEmptyState()
        : this.renderAlbumGrid()}
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
        </svg>
        <h2>Nothing recently added</h2>
        <p>Import some music to see your recent additions here.</p>
      </div>
    `;
  }

  private renderAlbumGrid() {
    return html`
      <div class="album-grid">
        ${this.recentAlbums.map(album => html`
          <div class="album-card" @click=${() => this.navigateToAlbum(album.album_id)}>
            <div class="album-artwork">
              ${album.artwork_blob_id && this.artworkUrls.get(album.artwork_blob_id)
                ? html`<img src=${this.artworkUrls.get(album.artwork_blob_id)!} alt="" />`
                : ''}
            </div>
            <div class="album-title">${album.title}</div>
            <div class="album-artist">${album.artist_name}</div>
            <div class="album-date">${this.formatDate(album.imported_at)}</div>
          </div>
        `)}
      </div>
    `;
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  private navigateToAlbum(albumId: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { view: 'album', params: { id: albumId } },
      bubbles: true,
      composed: true,
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'recently-added-view': RecentlyAddedView;
  }
}
