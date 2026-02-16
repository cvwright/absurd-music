/**
 * Playlist View Component
 *
 * Detail page showing playlist info with full track listing.
 * Supports editing, removing tracks, and playing.
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { TemplateResult } from 'lit';
import type { MusicSpaceService, CacheService, PlaylistService } from '@/services/index.js';
import { downloadTrackForOffline } from '@/services/download.js';
import type { Playlist, Track, TrackListItem } from '@/types/index.js';
import './track-list.js';

@customElement('playlist-view')
export class PlaylistView extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--spacing-lg);
    }

    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-xs) var(--spacing-sm);
      margin-bottom: var(--spacing-lg);
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      background: transparent;
      border-radius: var(--radius-sm);
      transition: color var(--transition-fast);
    }

    .back-btn:hover {
      color: var(--color-text-primary);
    }

    .back-btn svg {
      width: 16px;
      height: 16px;
    }

    .playlist-header {
      display: flex;
      gap: var(--spacing-xl);
      margin-bottom: var(--spacing-xl);
    }

    .playlist-artwork {
      width: 232px;
      height: 232px;
      flex-shrink: 0;
      background-color: var(--color-bg-highlight);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 60px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .playlist-artwork img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .playlist-artwork svg {
      width: 80px;
      height: 80px;
      color: var(--color-text-subdued);
    }

    .playlist-info {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding-bottom: var(--spacing-sm);
      flex: 1;
    }

    .playlist-type {
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: var(--spacing-sm);
    }

    .playlist-title {
      font-size: clamp(var(--font-size-xxl), 5vw, 72px);
      font-weight: 900;
      line-height: 1.1;
      margin-bottom: var(--spacing-md);
    }

    .playlist-title-input {
      font-size: clamp(var(--font-size-xxl), 5vw, 72px);
      font-weight: 900;
      line-height: 1.1;
      margin-bottom: var(--spacing-md);
      background: transparent;
      border: none;
      border-bottom: 2px solid var(--color-accent);
      color: var(--color-text-primary);
      width: 100%;
      padding: 0;
      font-family: inherit;
    }

    .playlist-title-input:focus {
      outline: none;
    }

    .playlist-description {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: var(--spacing-md);
      max-width: 600px;
    }

    .playlist-description-input {
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      margin-bottom: var(--spacing-md);
      max-width: 600px;
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--color-accent);
      padding: var(--spacing-xs) 0;
      font-family: inherit;
      width: 100%;
      resize: none;
    }

    .playlist-description-input:focus {
      outline: none;
    }

    .playlist-meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    .playlist-meta .menu-container {
      margin-left: var(--spacing-sm);
    }

    .play-controls {
      display: flex;
      align-items: center;
      gap: var(--spacing-lg);
      margin-top: var(--spacing-xl);
      margin-bottom: var(--spacing-lg);
    }

    .play-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background-color: var(--color-accent);
      color: var(--color-bg-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform var(--transition-fast), background-color var(--transition-fast);
    }

    .play-btn:hover:not(:disabled) {
      transform: scale(1.04);
      background-color: var(--color-accent-hover);
    }

    .play-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .play-btn svg {
      width: 24px;
      height: 24px;
      margin-left: 2px;
    }

    .shuffle-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: transparent;
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    }

    .shuffle-btn:hover {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .shuffle-btn svg {
      width: 24px;
      height: 24px;
    }

    .loading, .error {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--color-text-secondary);
    }

    .empty-state {
      text-align: center;
      padding: var(--spacing-xxl);
      color: var(--color-text-secondary);
    }

    .empty-state svg {
      width: 64px;
      height: 64px;
      margin-bottom: var(--spacing-md);
      color: var(--color-text-subdued);
    }

    /* Menu button and dropdown */
    .menu-container {
      position: relative;
    }

    .menu-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: transparent;
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    }

    .menu-btn:hover {
      background-color: var(--color-bg-highlight);
      color: var(--color-text-primary);
    }

    .menu-btn svg {
      width: 20px;
      height: 20px;
    }

    .menu-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: var(--spacing-xs);
      min-width: 180px;
      background-color: var(--color-bg-elevated, #282828);
      border-radius: var(--radius-sm);
      box-shadow: 0 16px 24px rgba(0, 0, 0, 0.3);
      padding: var(--spacing-xs) 0;
      z-index: 100;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      background: transparent;
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      text-align: left;
      transition: background-color var(--transition-fast);
    }

    .menu-item:hover:not(:disabled) {
      background-color: var(--color-bg-highlight);
    }

    .menu-item.danger {
      color: var(--color-error, #e74c3c);
    }

    .menu-item svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
  `;

  @property({ type: String })
  playlistId = '';

  @property({ attribute: false })
  musicSpace: MusicSpaceService | null = null;

  @property({ attribute: false })
  cacheService: CacheService | null = null;

  @property({ type: Boolean })
  offline = false;

  @property({ attribute: false })
  playlistService: PlaylistService | null = null;

  @state()
  private playlist: Playlist | null = null;

  @state()
  private tracks: Track[] = [];

  @state()
  private loading = true;

  @state()
  private error = '';

  @state()
  private artworkUrls = new Map<string, string>();

  @state()
  private menuOpen = false;

  @state()
  private editing = false;

  @state()
  private editName = '';

  @state()
  private editDescription = '';

  @state()
  private trackMenuOpen: string | null = null;

  @state()
  private downloadingAll = false;

  private get allTracksDownloaded(): boolean {
    if (!this.cacheService || this.tracks.length === 0) return false;
    return this.tracks.every(t => this.cacheService!.cachedTrackIds.has(t.track_id));
  }

  override updated(changedProperties: Map<string, unknown>) {
    if (
      (changedProperties.has('playlistId') || changedProperties.has('musicSpace')) &&
      this.playlistId &&
      this.musicSpace
    ) {
      this.loadPlaylist();
    }
    // Reload playlist data when coming back online
    if (changedProperties.has('offline') && changedProperties.get('offline') === true && !this.offline) {
      this.loadPlaylist();
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    this.handleClickOutside = this.handleClickOutside.bind(this);
    document.addEventListener('click', this.handleClickOutside);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleClickOutside);
    // Revoke all artwork URLs
    for (const url of this.artworkUrls.values()) {
      URL.revokeObjectURL(url);
    }
  }

  private handleClickOutside(e: MouseEvent) {
    const path = e.composedPath();
    if (this.menuOpen) {
      const menuContainer = this.shadowRoot?.querySelector('.menu-container');
      if (menuContainer && !path.includes(menuContainer)) {
        this.menuOpen = false;
      }
    }
    if (this.trackMenuOpen) {
      const trackList = this.shadowRoot?.querySelector('track-list');
      const trackMenuContainer = trackList?.shadowRoot?.querySelector('.track-menu-container');
      if (!trackMenuContainer || !path.includes(trackMenuContainer)) {
        this.trackMenuOpen = null;
      }
    }
  }

  private async loadPlaylist() {
    if (!this.musicSpace || !this.playlistService || !this.playlistId) return;

    this.loading = true;
    this.error = '';

    try {
      this.playlist = await this.playlistService.getPlaylist(this.playlistId);

      // Load full track data
      this.tracks = await Promise.all(
        this.playlist.track_ids.map((id) => this.musicSpace!.getTrack(id))
      );

      // Load artwork for tracks
      await this.loadArtwork();
    } catch (err) {
      console.error('Failed to load playlist:', err);
      this.error = err instanceof Error ? err.message : 'Failed to load playlist';
    } finally {
      this.loading = false;
    }
  }

  private async loadArtwork() {
    if (!this.musicSpace) return;

    for (const track of this.tracks) {
      const blobId = track.artwork_blob_id;
      const blobKey = track.artwork_encryption?.key;
      const mimeType = track.artwork_mime_type || 'image/jpeg';

      if (!blobId || !blobKey || this.artworkUrls.has(blobId)) continue;

      try {
        // Check cache first
        if (this.cacheService) {
          const cached = await this.cacheService.getArtwork(blobId);
          if (cached) {
            const blob = new Blob([cached.imageData], { type: cached.mimeType });
            this.artworkUrls.set(blobId, URL.createObjectURL(blob));
            this.requestUpdate();
            continue;
          }
        }

        // Download from server
        const data = await this.musicSpace.downloadArtworkBlob(blobId, blobKey);

        // Cache for future
        if (this.cacheService) {
          await this.cacheService.cacheArtwork(blobId, data, mimeType);
        }

        const blob = new Blob([data], { type: mimeType });
        this.artworkUrls.set(blobId, URL.createObjectURL(blob));
        this.requestUpdate();
      } catch (err) {
        console.warn('Failed to load track artwork:', err);
      }
    }
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading playlist...</div>`;
    }

    if (this.error) {
      return html`
        <button class="back-btn" @click=${this.goBack}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
          Back
        </button>
        <div class="error">${this.error}</div>
      `;
    }

    if (!this.playlist) {
      return html`<div class="error">Playlist not found</div>`;
    }

    const totalDuration = this.tracks.reduce((sum, t) => sum + t.duration_ms, 0);
    const headerArtwork = this.tracks[0]?.artwork_blob_id
      ? this.artworkUrls.get(this.tracks[0].artwork_blob_id)
      : null;

    return html`
      <button class="back-btn" @click=${this.goBack}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
        Back
      </button>

      <div class="playlist-header">
        <div class="playlist-artwork">
          ${headerArtwork
            ? html`<img src=${headerArtwork} alt="" />`
            : html`
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                  />
                </svg>
              `}
        </div>
        <div class="playlist-info">
          <div class="playlist-type">Playlist</div>
          ${this.editing
            ? html`
                <input
                  class="playlist-title-input"
                  type="text"
                  .value=${this.editName}
                  @input=${this.handleNameInput}
                  @keydown=${this.handleEditKeyDown}
                  autofocus
                />
                <textarea
                  class="playlist-description-input"
                  placeholder="Add a description"
                  .value=${this.editDescription}
                  @input=${this.handleDescriptionInput}
                  rows="2"
                ></textarea>
              `
            : html`
                <h1 class="playlist-title">${this.playlist.name}</h1>
                ${this.playlist.description
                  ? html`<p class="playlist-description">${this.playlist.description}</p>`
                  : ''}
              `}
          <div class="playlist-meta">
            <span>${this.tracks.length} songs, ${this.formatTotalDuration(totalDuration)}</span>

            <div class="menu-container">
              <button class="menu-btn" @click=${this.toggleMenu}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
              ${this.menuOpen
                ? html`
                    <div class="menu-dropdown">
                      ${this.editing
                        ? html`
                            <button class="menu-item" @click=${this.saveEdit}>
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                              </svg>
                              Save changes
                            </button>
                            <button class="menu-item" @click=${this.cancelEdit}>
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path
                                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                                />
                              </svg>
                              Cancel
                            </button>
                          `
                        : html`
                            ${this.allTracksDownloaded
                              ? html`
                                <button class="menu-item" disabled style="opacity: 0.5; cursor: default;">
                                  <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 13l-3-3 1.41-1.41L10 12.17l5.59-5.59L17 8l-7 7z"/>
                                  </svg>
                                  All Downloaded
                                </button>`
                              : this.downloadingAll
                              ? html`
                                <button class="menu-item" disabled style="opacity: 0.5; cursor: default;">
                                  <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                                  </svg>
                                  Downloading...
                                </button>`
                              : html`
                                <button class="menu-item" @click=${this.handleDownloadAll} ?disabled=${this.offline || this.tracks.length === 0}>
                                  <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                                  </svg>
                                  Download All
                                </button>`}
                            <div class="menu-divider"></div>
                            <button class="menu-item" @click=${this.startEdit} ?disabled=${this.offline}>
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path
                                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                                />
                              </svg>
                              Edit details
                            </button>
                            <button class="menu-item danger" @click=${this.deletePlaylist} ?disabled=${this.offline}>
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path
                                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                                />
                              </svg>
                              Delete playlist
                            </button>
                          `}
                    </div>
                  `
                : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="play-controls">
        <button class="play-btn" ?disabled=${this.tracks.length === 0} @click=${this.playPlaylist}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <button
          class="shuffle-btn"
          ?disabled=${this.tracks.length === 0}
          @click=${this.shufflePlaylist}
          title="Shuffle"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
            />
          </svg>
        </button>
      </div>

      ${this.tracks.length === 0
        ? html`
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                />
              </svg>
              <p>This playlist is empty</p>
              <p>Add tracks from your library</p>
            </div>
          `
        : html`
            <track-list
              .items=${this.getTrackListItems()}
              .downloadedIds=${this.cacheService?.cachedTrackIds ?? new Set()}
              .downloadingIds=${this.cacheService?.downloadingTrackIds ?? new Set()}
              show-artwork
              show-album
              .actionRenderer=${this.renderTrackAction}
              @track-click=${this.handleTrackListClick}
            ></track-list>
          `}
    `;
  }

  private getTrackListItems(): TrackListItem[] {
    return this.tracks.map(track => ({
      id: track.track_id,
      title: track.title,
      subtitle: track.artist_name,
      album: track.album_name,
      durationMs: track.duration_ms,
      artworkUrl: track.artwork_blob_id ? this.artworkUrls.get(track.artwork_blob_id) : undefined,
    }));
  }

  private renderTrackAction = (item: TrackListItem): TemplateResult => {
    return html`
      <div class="track-menu-container">
        <button
          class="track-action-btn"
          @click=${(e: Event) => this.toggleTrackMenu(e, item.id)}
          title="More options"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
        ${this.trackMenuOpen === item.id ? this.renderTrackMenu(item.id) : ''}
      </div>
    `;
  };

  private toggleTrackMenu(e: Event, trackId: string) {
    e.stopPropagation();
    this.trackMenuOpen = this.trackMenuOpen === trackId ? null : trackId;
  }

  private renderTrackMenu(trackId: string) {
    return html`
      <div class="track-menu-dropdown">
        ${this.cacheService?.cachedTrackIds.has(trackId)
          ? html`
            <button class="track-menu-item" disabled style="opacity: 0.5; cursor: default;">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 13l-3-3 1.41-1.41L10 12.17l5.59-5.59L17 8l-7 7z"/>
              </svg>
              Downloaded
            </button>`
          : this.cacheService?.downloadingTrackIds.has(trackId)
          ? html`
            <button class="track-menu-item" disabled style="opacity: 0.5; cursor: default;">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              Downloading...
            </button>`
          : html`
            <button class="track-menu-item" @click=${(e: Event) => this.handleDownloadTrack(e, trackId)} ?disabled=${this.offline}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              Download
            </button>`}
        <div class="track-menu-divider"></div>
        <button class="track-menu-item danger" @click=${(e: Event) => this.handleRemoveTrack(e, trackId)} ?disabled=${this.offline}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          Remove from Playlist
        </button>
      </div>
    `;
  }

  private async handleDownloadAll() {
    this.menuOpen = false;
    if (!this.musicSpace || !this.cacheService) return;

    this.downloadingAll = true;
    this.requestUpdate();

    try {
      for (const track of this.tracks) {
        await downloadTrackForOffline(this.musicSpace, this.cacheService, track.track_id);
        this.requestUpdate();
      }
    } catch (err) {
      console.error('Failed to download all tracks:', err);
    } finally {
      this.downloadingAll = false;
      this.requestUpdate();
    }
  }

  private async handleDownloadTrack(e: Event, trackId: string) {
    e.stopPropagation();
    this.trackMenuOpen = null;
    if (!this.musicSpace || !this.cacheService) return;

    try {
      const promise = downloadTrackForOffline(this.musicSpace, this.cacheService, trackId);
      this.requestUpdate();
      await promise;
      this.requestUpdate();
    } catch (err) {
      console.error('Failed to download track:', err);
      this.requestUpdate();
    }
  }

  private handleRemoveTrack(e: Event, trackId: string) {
    e.stopPropagation();
    this.trackMenuOpen = null;
    this.removeTrack(trackId);
  }

  private handleTrackListClick(e: CustomEvent<{ item: TrackListItem; index: number }>) {
    this.playTrack(e.detail.index);
  }

  private formatTotalDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours} hr ${remainingMins} min`;
  }

  private goBack() {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { view: 'library' },
        bubbles: true,
        composed: true,
      })
    );
  }

  private playPlaylist() {
    if (this.tracks.length === 0) return;
    this.playTrack(0);
  }

  private shufflePlaylist() {
    if (this.tracks.length === 0) return;
    this.dispatchEvent(
      new CustomEvent('play-album', {
        detail: {
          trackIds: this.shuffleArray([...this.tracks.map((t) => t.track_id)]),
          startIndex: 0,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private playTrack(index: number) {
    this.dispatchEvent(
      new CustomEvent('play-album', {
        detail: {
          trackIds: this.tracks.map((t) => t.track_id),
          startIndex: index,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private async removeTrack(trackId: string) {
    if (!this.playlistService || !this.playlist || this.offline) return;

    try {
      this.playlist = await this.playlistService.removeTrack(this.playlist.playlist_id, trackId);
      this.tracks = this.tracks.filter((t) => t.track_id !== trackId);

      // Notify parent to refresh sidebar
      this.dispatchEvent(
        new CustomEvent('playlist-updated', {
          bubbles: true,
          composed: true,
        })
      );
    } catch (err) {
      console.error('Failed to remove track:', err);
    }
  }

  private toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  private startEdit() {
    this.editName = this.playlist?.name || '';
    this.editDescription = this.playlist?.description || '';
    this.editing = true;
    this.menuOpen = false;
  }

  private cancelEdit() {
    this.editing = false;
    this.menuOpen = false;
  }

  private handleNameInput(e: Event) {
    this.editName = (e.target as HTMLInputElement).value;
  }

  private handleDescriptionInput(e: Event) {
    this.editDescription = (e.target as HTMLTextAreaElement).value;
  }

  private handleEditKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.saveEdit();
    } else if (e.key === 'Escape') {
      this.cancelEdit();
    }
  }

  private async saveEdit() {
    if (!this.playlistService || !this.playlist || !this.editName.trim() || this.offline) return;

    try {
      this.playlist = await this.playlistService.updatePlaylist(this.playlist.playlist_id, {
        name: this.editName.trim(),
        description: this.editDescription.trim() || undefined,
      });
      this.editing = false;
      this.menuOpen = false;

      // Notify parent to refresh sidebar
      this.dispatchEvent(
        new CustomEvent('playlist-updated', {
          bubbles: true,
          composed: true,
        })
      );
    } catch (err) {
      console.error('Failed to update playlist:', err);
    }
  }

  private async deletePlaylist() {
    if (!this.playlistService || !this.playlist || this.offline) return;

    if (!confirm(`Delete "${this.playlist.name}"?`)) return;

    try {
      await this.playlistService.deletePlaylist(this.playlist.playlist_id);
      this.menuOpen = false;

      // Navigate back and notify parent
      this.dispatchEvent(
        new CustomEvent('playlist-deleted', {
          bubbles: true,
          composed: true,
        })
      );
      this.goBack();
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'playlist-view': PlaylistView;
  }
}
