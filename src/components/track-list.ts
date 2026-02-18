/**
 * Track List Component
 *
 * Shared component for rendering track lists with configurable columns.
 * Used by library-view, playlist-view, and album-view.
 */

import { LitElement, html, css, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@lit-labs/virtualizer';
import type { TrackListItem } from '@/types/index.js';

@customElement('track-list')
export class TrackList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .track-header {
      display: grid;
      grid-template-columns: var(--grid-columns);
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-xs) var(--spacing-sm) var(--spacing-xs);
      border-bottom: 1px solid var(--color-bg-highlight);
      color: var(--color-text-subdued);
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .track-item {
      display: grid;
      grid-template-columns: var(--grid-columns);
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-xs) var(--spacing-sm) var(--spacing-xs);
      align-items: center;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background-color var(--transition-fast);
      width: 100%;
      box-sizing: border-box;
    }

    .track-item:hover {
      background-color: var(--color-bg-highlight);
    }

    .track-item:has(.track-menu-dropdown) {
      position: relative;
      z-index: 10;
    }

    .track-number {
      color: var(--color-text-subdued);
      text-align: center;
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

    .track-downloaded {
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .downloaded-icon {
      width: 14px;
      height: 14px;
      color: var(--color-text-subdued);
    }

    .downloading-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--color-bg-highlight);
      border-top-color: var(--color-text-subdued);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .track-subtitle {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .track-album {
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .track-duration {
      color: var(--color-text-subdued);
      text-align: right;
    }

    .track-action {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Action button pattern: hidden, revealed on row hover */
    .track-action-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: transparent;
      border: none;
      color: var(--color-text-subdued);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .track-item:hover .track-action-btn {
      opacity: 1;
    }

    .track-action-btn:hover {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .track-action-btn svg {
      width: 16px;
      height: 16px;
    }

    /* Dropdown menu (used by actionRenderer) */
    .track-menu-container {
      position: relative;
    }

    .track-menu-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: var(--spacing-xs);
      min-width: 200px;
      background-color: var(--color-bg-elevated, #282828);
      border-radius: var(--radius-sm);
      box-shadow: 0 16px 24px rgba(0, 0, 0, 0.3);
      padding: var(--spacing-xs) 0;
      z-index: 100;
    }

    .track-menu-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      background: transparent;
      border: none;
      color: var(--color-text-primary);
      font-family: inherit;
      font-size: var(--font-size-sm);
      text-align: left;
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .track-menu-item:hover {
      background-color: var(--color-bg-highlight);
    }

    .track-menu-item svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .track-menu-section-title {
      padding: var(--spacing-xs) var(--spacing-md);
      font-size: var(--font-size-xs);
      color: var(--color-text-subdued);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .track-menu-divider {
      height: 1px;
      background-color: var(--color-bg-highlight);
      margin: var(--spacing-xs) 0;
    }

    .track-menu-item.danger {
      color: var(--color-error, #e74c3c);
    }

    /* Responsive: hide album column at narrow widths */
    @media (max-width: 600px) {
      :host([show-album]) .track-header,
      :host([show-album]) .track-item {
        grid-template-columns: var(--grid-columns-narrow);
      }

      :host([show-album]) .track-album,
      :host([show-album]) .header-album {
        display: none;
      }
    }
  `;

  /** The track items to display */
  @property({ attribute: false })
  items: TrackListItem[] = [];

  /** Whether to show the artwork column */
  @property({ type: Boolean, reflect: true, attribute: 'show-artwork' })
  showArtwork = false;

  /** Whether to show the album column */
  @property({ type: Boolean, reflect: true, attribute: 'show-album' })
  showAlbum = false;

  /** Set of track IDs that are downloaded/cached. Shows a downloaded indicator. */
  @property({ attribute: false })
  downloadedIds: Set<string> = new Set();

  /** Set of track IDs currently being downloaded. Shows a spinner. */
  @property({ attribute: false })
  downloadingIds: Set<string> = new Set();

  /** Render callback for the action column. If provided, an action column is shown. */
  @property({ attribute: false })
  actionRenderer?: (item: TrackListItem, index: number) => TemplateResult;

  /** Whether to show the downloaded indicator column */
  private showDownloaded = false;

  override willUpdate(changed: PropertyValues) {
    const hasDownloads = this.downloadedIds.size > 0 || this.downloadingIds.size > 0;
    if (
      changed.has('showArtwork') || changed.has('showAlbum') ||
      changed.has('actionRenderer') || hasDownloads !== this.showDownloaded
    ) {
      this.showDownloaded = hasDownloads;
      this.style.setProperty('--grid-columns', this.buildColumns(true));
      this.style.setProperty('--grid-columns-narrow', this.buildColumns(false));
    }
  }

  private buildColumns(includeAlbum: boolean): string {
    const cols: string[] = ['28px']; // track number
    if (this.showArtwork) cols.push('40px');
    cols.push('1fr'); // title/info
    if (this.showAlbum && includeAlbum) cols.push('1fr');
    if (this.showDownloaded) cols.push('14px'); // downloaded indicator
    cols.push('44px'); // duration
    if (this.actionRenderer) cols.push('32px');
    return cols.join(' ');
  }

  render() {
    return html`
      <div class="track-header">
        <span class="track-number">#</span>
        ${this.showArtwork ? html`<span></span>` : nothing}
        <span>Title</span>
        ${this.showAlbum ? html`<span class="header-album">Album</span>` : nothing}
        ${this.showDownloaded ? html`<span></span>` : nothing}
        <span class="track-duration">Time</span>
        ${this.actionRenderer ? html`<span></span>` : nothing}
      </div>
      <lit-virtualizer
        .items=${this.items}
        .renderItem=${(item: TrackListItem, index: number) => this.renderTrackItem(item, index)}
      ></lit-virtualizer>
    `;
  }

  private renderTrackItem(item: TrackListItem, index: number) {
    return html`
      <div class="track-item" @click=${(e: Event) => this.handleTrackClick(e, item, index)}>
        <span class="track-number">${item.displayNumber ?? index + 1}</span>
        ${this.showArtwork ? html`
          <div class="track-artwork">
            ${item.artworkUrl ? html`<img src=${item.artworkUrl} alt="" loading="lazy" />` : nothing}
          </div>
        ` : nothing}
        <div class="track-info">
          <span class="track-title">${item.title}</span>
          <span class="track-subtitle">${item.subtitle}</span>
        </div>
        ${this.showAlbum ? html`<span class="track-album">${item.album ?? ''}</span>` : nothing}
        ${this.showDownloaded ? html`
          <span class="track-downloaded">
            ${this.downloadingIds.has(item.id)
              ? html`<div class="downloading-spinner" title="Downloading..."></div>`
              : this.downloadedIds.has(item.id) ? html`
                <svg class="downloaded-icon" viewBox="0 0 24 24" fill="currentColor" title="Downloaded">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 13l-3-3 1.41-1.41L10 12.17l5.59-5.59L17 8l-7 7z"/>
                </svg>
              ` : nothing}
          </span>
        ` : nothing}
        <span class="track-duration">${this.formatDuration(item.durationMs)}</span>
        ${this.actionRenderer
          ? html`<div class="track-action" @click=${(e: Event) => e.stopPropagation()}>
              ${this.actionRenderer(item, index)}
            </div>`
          : nothing}
      </div>
    `;
  }

  private handleTrackClick(_e: Event, item: TrackListItem, index: number) {
    this.dispatchEvent(new CustomEvent('track-click', {
      detail: { item, index },
      bubbles: true,
      composed: true,
    }));
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
    'track-list': TrackList;
  }
}
