/**
 * Album View Component
 *
 * Detail page showing album info with full track listing.
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { MusicSpaceService, CacheService, ImportService } from '@/services/index.js';
import type { Album, Track } from '@/types/index.js';

@customElement('album-view')
export class AlbumView extends LitElement {
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

    .album-header {
      display: flex;
      gap: var(--spacing-xl);
      margin-bottom: var(--spacing-xl);
    }

    .album-artwork {
      width: 232px;
      height: 232px;
      flex-shrink: 0;
      background-color: var(--color-bg-highlight);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 60px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }

    .album-artwork img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .album-info {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding-bottom: var(--spacing-sm);
    }

    .album-type {
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: var(--spacing-sm);
    }

    .album-title {
      font-size: clamp(var(--font-size-xxl), 5vw, 72px);
      font-weight: 900;
      line-height: 1.1;
      margin-bottom: var(--spacing-md);
    }

    .album-meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    .album-meta .menu-container {
      margin-left: var(--spacing-sm);
    }

    .artist-link {
      color: var(--color-text-primary);
      font-weight: 600;
      cursor: pointer;
    }

    .artist-link:hover {
      text-decoration: underline;
    }

    .meta-dot {
      color: var(--color-text-subdued);
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

    .play-btn:hover {
      transform: scale(1.04);
      background-color: var(--color-accent-hover);
    }

    .play-btn svg {
      width: 24px;
      height: 24px;
      margin-left: 2px;
    }

    /* Track list */
    .track-list {
      display: flex;
      flex-direction: column;
    }

    .track-header {
      display: grid;
      grid-template-columns: 40px 1fr 100px;
      gap: var(--spacing-md);
      padding: var(--spacing-sm) var(--spacing-md);
      border-bottom: 1px solid var(--color-bg-highlight);
      color: var(--color-text-subdued);
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .track-item {
      display: grid;
      grid-template-columns: 40px 1fr 100px;
      gap: var(--spacing-md);
      padding: var(--spacing-sm) var(--spacing-md);
      align-items: center;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .track-item:hover {
      background-color: var(--color-bg-highlight);
    }

    .track-number {
      color: var(--color-text-subdued);
      text-align: center;
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

    .track-artist {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .track-duration {
      color: var(--color-text-subdued);
      text-align: right;
    }

    .loading, .error {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--color-text-secondary);
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
      min-width: 200px;
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

    .menu-item:disabled {
      color: var(--color-text-subdued);
      cursor: not-allowed;
    }

    .menu-item svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
  `;

  @property({ type: String })
  albumId = '';

  @property({ attribute: false })
  musicSpace: MusicSpaceService | null = null;

  @property({ attribute: false })
  cacheService: CacheService | null = null;

  @state()
  private album: Album | null = null;

  @state()
  private tracks: Track[] = [];

  @state()
  private loading = true;

  @state()
  private error = '';

  @state()
  private artworkUrl = '';

  @state()
  private menuOpen = false;

  @state()
  private fetchingArtwork = false;

  @state()
  private uploadingArtwork = false;

  override updated(changedProperties: Map<string, unknown>) {
    if ((changedProperties.has('albumId') || changedProperties.has('musicSpace')) && this.albumId && this.musicSpace) {
      this.loadAlbum();
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
    if (this.artworkUrl) {
      URL.revokeObjectURL(this.artworkUrl);
    }
  }

  private handleClickOutside(e: MouseEvent) {
    if (this.menuOpen) {
      const path = e.composedPath();
      const menuContainer = this.shadowRoot?.querySelector('.menu-container');
      if (menuContainer && !path.includes(menuContainer)) {
        this.menuOpen = false;
      }
    }
  }

  private async loadAlbum() {
    if (!this.musicSpace || !this.albumId) return;

    this.loading = true;
    this.error = '';

    try {
      // Try to load album metadata directly
      try {
        this.album = await this.musicSpace.getAlbum(this.albumId);
      } catch {
        // Album object may not exist, build from search index
        const index = await this.musicSpace.getSearchIndex();
        const albumTracks = index.tracks.filter(t => {
          // albumId is formatted as "artist|album"
          const parts = this.albumId.split('|');
          return parts.length === 2 && t.artist === parts[0] && t.album === parts[1];
        });

        if (albumTracks.length === 0) {
          throw new Error('Album not found');
        }

        const parts = this.albumId.split('|');
        this.album = {
          album_id: this.albumId,
          title: parts[1] || 'Unknown Album',
          artist_id: parts[0] || '',
          artist_name: parts[0] || 'Unknown Artist',
          track_ids: albumTracks.map(t => t.id),
        };
      }

      // Load full track data
      const trackIds = this.album.track_ids.length > 0
        ? this.album.track_ids
        : (await this.musicSpace.getSearchIndex()).tracks
            .filter(t => t.artist === this.album!.artist_name && t.album === this.album!.title)
            .map(t => t.id);

      this.tracks = await Promise.all(
        trackIds.map(id => this.musicSpace!.getTrack(id))
      );

      // Sort by disc/track number
      this.tracks.sort((a, b) => {
        const discA = a.disc_number ?? 1;
        const discB = b.disc_number ?? 1;
        if (discA !== discB) return discA - discB;
        return (a.track_number ?? 0) - (b.track_number ?? 0);
      });

      // Load artwork
      await this.loadArtwork();
    } catch (err) {
      console.error('Failed to load album:', err);
      this.error = err instanceof Error ? err.message : 'Failed to load album';
    } finally {
      this.loading = false;
    }
  }

  private async loadArtwork() {
    const artworkBlobId = this.album?.artwork_blob_id || this.tracks[0]?.artwork_blob_id;
    const artworkKey = this.album?.artwork_encryption?.key || this.tracks[0]?.artwork_encryption?.key;
    const artworkMimeType = this.album?.artwork_mime_type || this.tracks[0]?.artwork_mime_type || 'image/jpeg';

    if (!artworkBlobId || !artworkKey || !this.musicSpace) return;

    try {
      // Check cache first
      if (this.cacheService) {
        const cached = await this.cacheService.getArtwork(artworkBlobId);
        if (cached) {
          const blob = new Blob([cached.imageData], { type: cached.mimeType });
          this.artworkUrl = URL.createObjectURL(blob);
          return;
        }
      }

      // Download from server
      const data = await this.musicSpace.downloadArtworkBlob(artworkBlobId, artworkKey);

      // Cache for future
      if (this.cacheService) {
        await this.cacheService.cacheArtwork(artworkBlobId, data, artworkMimeType);
      }

      const blob = new Blob([data], { type: artworkMimeType });
      this.artworkUrl = URL.createObjectURL(blob);
    } catch (err) {
      console.warn('Failed to load album artwork:', err);
    }
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading album...</div>`;
    }

    if (this.error) {
      return html`
        <button class="back-btn" @click=${this.goBack}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
          Back
        </button>
        <div class="error">${this.error}</div>
      `;
    }

    if (!this.album) {
      return html`<div class="error">Album not found</div>`;
    }

    const totalDuration = this.tracks.reduce((sum, t) => sum + t.duration_ms, 0);

    return html`
      <button class="back-btn" @click=${this.goBack}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
        Back
      </button>

      <div class="album-header">
        <div class="album-artwork">
          ${this.artworkUrl ? html`<img src=${this.artworkUrl} alt="" />` : ''}
        </div>
        <div class="album-info">
          <div class="album-type">Album</div>
          <h1 class="album-title">${this.album.title}</h1>
          <div class="album-meta">
            <span class="artist-link" @click=${this.goToArtist}>${this.album.artist_name}</span>
            ${this.album.year ? html`
              <span class="meta-dot">•</span>
              <span>${this.album.year}</span>
            ` : ''}
            <span class="meta-dot">•</span>
            <span>${this.tracks.length} songs, ${this.formatTotalDuration(totalDuration)}</span>

            <div class="menu-container">
              <button class="menu-btn" @click=${this.toggleMenu}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
              ${this.menuOpen ? html`
                <div class="menu-dropdown">
                  <button
                    class="menu-item"
                    @click=${this.downloadArtwork}
                    ?disabled=${this.fetchingArtwork || !!this.artworkUrl}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    ${this.fetchingArtwork ? 'Downloading...' : this.artworkUrl ? 'Artwork present' : 'Download artwork'}
                  </button>
                  <button
                    class="menu-item"
                    @click=${this.uploadArtwork}
                    ?disabled=${this.uploadingArtwork}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    ${this.uploadingArtwork ? 'Uploading...' : 'Upload artwork'}
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="play-controls">
        <button class="play-btn" @click=${this.playAlbum}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      </div>

      <div class="track-list">
        <div class="track-header">
          <span>#</span>
          <span>Title</span>
          <span>Duration</span>
        </div>
        ${this.tracks.map((track, index) => html`
          <div class="track-item" @click=${() => this.playTrack(track.track_id, index)}>
            <span class="track-number">${track.track_number ?? index + 1}</span>
            <div class="track-info">
              <span class="track-title">${track.title}</span>
              <span class="track-artist">${track.artist_name}</span>
            </div>
            <span class="track-duration">${this.formatDuration(track.duration_ms)}</span>
          </div>
        `)}
      </div>
    `;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { view: 'library' },
      bubbles: true,
      composed: true,
    }));
  }

  private goToArtist() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { view: 'artist', params: { id: this.album?.artist_id || this.album?.artist_name } },
      bubbles: true,
      composed: true,
    }));
  }

  private playAlbum() {
    if (this.tracks.length === 0) return;
    this.playTrack(this.tracks[0].track_id, 0);
  }

  private playTrack(_trackId: string, index: number) {
    // Dispatch event with the full album queue
    this.dispatchEvent(new CustomEvent('play-album', {
      detail: {
        trackIds: this.tracks.map(t => t.track_id),
        startIndex: index,
      },
      bubbles: true,
      composed: true,
    }));
  }

  private toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  private async downloadArtwork() {
    if (!this.album || !this.musicSpace || this.fetchingArtwork) return;

    this.fetchingArtwork = true;
    this.menuOpen = false;

    try {
      // Use ImportService to fetch artwork from iTunes
      const result = await ImportService.fetchArtworkFromItunes(
        this.album.artist_name,
        this.album.title,
        this.musicSpace
      );

      if (result) {
        // Update album with new artwork
        this.album.artwork_blob_id = result.blobId;
        this.album.artwork_mime_type = result.mimeType;
        this.album.artwork_encryption = { method: 'file', key: result.encryptionKey };
        await this.musicSpace.setAlbum(this.album);

        // Update tracks to reference the album artwork
        for (const track of this.tracks) {
          if (!track.artwork_blob_id) {
            track.artwork_blob_id = result.blobId;
            track.artwork_mime_type = result.mimeType;
            track.artwork_encryption = { method: 'file', key: result.encryptionKey };
            await this.musicSpace.setTrack(track);
          }
        }

        // Load and display the new artwork
        await this.loadArtwork();
      } else {
        console.warn('No artwork found on iTunes for this album');
      }
    } catch (err) {
      console.error('Failed to download artwork:', err);
    } finally {
      this.fetchingArtwork = false;
    }
  }

  private async uploadArtwork() {
    if (!this.album || !this.musicSpace || this.uploadingArtwork) return;

    this.menuOpen = false;

    // Create file input and trigger selection
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;

      this.uploadingArtwork = true;

      try {
        const imageData = await file.arrayBuffer();
        const mimeType = file.type || 'image/jpeg';

        // Upload encrypted artwork
        const result = await this.musicSpace!.uploadArtworkBlob(imageData);

        // Update album with new artwork
        this.album!.artwork_blob_id = result.blobId;
        this.album!.artwork_mime_type = mimeType;
        this.album!.artwork_encryption = { method: 'file', key: result.encryptionKey };
        await this.musicSpace!.setAlbum(this.album!);

        // Update tracks to reference the album artwork
        for (const track of this.tracks) {
          if (!track.artwork_blob_id) {
            track.artwork_blob_id = result.blobId;
            track.artwork_mime_type = mimeType;
            track.artwork_encryption = { method: 'file', key: result.encryptionKey };
            await this.musicSpace!.setTrack(track);
          }
        }

        // Load and display the new artwork
        await this.loadArtwork();
      } catch (err) {
        console.error('Failed to upload artwork:', err);
      } finally {
        this.uploadingArtwork = false;
      }
    });

    input.click();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'album-view': AlbumView;
  }
}
