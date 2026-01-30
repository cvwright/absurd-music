/**
 * Library View Component
 *
 * Main library browser showing tracks, albums, and artists.
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ImportService } from '@/services/index.js';
import type { ParsedTrackMetadata } from '@/types/index.js';

type Tab = 'songs' | 'albums' | 'artists';

@customElement('library-view')
export class LibraryView extends LitElement {
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
      margin-bottom: var(--spacing-lg);
    }

    .tabs {
      display: flex;
      gap: var(--spacing-sm);
    }

    .tab {
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-full);
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text-secondary);
      background-color: transparent;
      transition: all var(--transition-fast);
    }

    .tab:hover {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .tab.active {
      color: var(--color-bg-primary);
      background-color: var(--color-text-primary);
    }

    .content {
      margin-top: var(--spacing-lg);
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

    .import-btn {
      margin-top: var(--spacing-lg);
      padding: var(--spacing-sm) var(--spacing-xl);
      background-color: var(--color-accent);
      color: var(--color-bg-primary);
      font-weight: 600;
      border-radius: var(--radius-full);
      transition: all var(--transition-fast);
    }

    .import-btn:hover {
      background-color: var(--color-accent-hover);
      transform: scale(1.02);
    }

    /* Track list */
    .track-list {
      display: flex;
      flex-direction: column;
    }

    .track-header {
      display: grid;
      grid-template-columns: 40px 1fr 1fr 100px;
      gap: var(--spacing-md);
      padding: var(--spacing-sm) var(--spacing-md);
      border-bottom: 1px solid var(--color-bg-highlight);
      color: var(--color-text-subdued);
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    /* Album grid */
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
    }
  `;

  @state()
  private activeTab: Tab = 'songs';

  @state()
  private isEmpty = true;

  render() {
    return html`
      <div class="header">
        <h1>Your Library</h1>
        <div class="tabs">
          <button
            class="tab ${this.activeTab === 'songs' ? 'active' : ''}"
            @click=${() => (this.activeTab = 'songs')}
          >
            Songs
          </button>
          <button
            class="tab ${this.activeTab === 'albums' ? 'active' : ''}"
            @click=${() => (this.activeTab = 'albums')}
          >
            Albums
          </button>
          <button
            class="tab ${this.activeTab === 'artists' ? 'active' : ''}"
            @click=${() => (this.activeTab = 'artists')}
          >
            Artists
          </button>
        </div>
      </div>

      <div class="content">
        ${this.isEmpty ? this.renderEmptyState() : this.renderContent()}
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        <h2>Your library is empty</h2>
        <p>
          Import your music collection to get started. We support MP3, AAC, FLAC, and more.
          All files are encrypted before upload.
        </p>
        <button class="import-btn" @click=${this.openImport}>
          Import Music
        </button>
      </div>
    `;
  }

  private renderContent() {
    switch (this.activeTab) {
      case 'songs':
        return this.renderSongsList();
      case 'albums':
        return this.renderAlbumGrid();
      case 'artists':
        return this.renderArtistList();
    }
  }

  private renderSongsList() {
    return html`
      <div class="track-list">
        <div class="track-header">
          <span>#</span>
          <span>Title</span>
          <span>Album</span>
          <span>Duration</span>
        </div>
        <!-- Track items will be rendered here -->
      </div>
    `;
  }

  private renderAlbumGrid() {
    return html`
      <div class="album-grid">
        <!-- Album cards will be rendered here -->
      </div>
    `;
  }

  private renderArtistList() {
    return html`
      <div class="album-grid">
        <!-- Artist cards will be rendered here -->
      </div>
    `;
  }

  private async openImport() {
    const files = await ImportService.selectFiles();
    if (files.length === 0) {
      return;
    }

    console.log(`Selected ${files.length} file(s), parsing metadata...`);

    const parsed: ParsedTrackMetadata[] = await ImportService.parseFiles(files);

    // Log extracted metadata for now
    for (const track of parsed) {
      console.log('Parsed track:', {
        title: track.title,
        artist: track.artist,
        album: track.album,
        year: track.year,
        trackNumber: track.trackNumber,
        durationMs: track.durationMs,
        format: track.format,
        artworkMimeType: track.artwork?.mimeType || "None",
        artworkByteSize: track.artwork?.data.length || 0,
      });
    }

    // TODO: Show import review dialog, then encrypt and upload
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'library-view': LibraryView;
  }
}
