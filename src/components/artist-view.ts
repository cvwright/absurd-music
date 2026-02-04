/**
 * Artist View Component
 *
 * Detail page showing artist info with album grid and top tracks.
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { MusicSpaceService, CacheService } from '@/services/index.js';
import type { Artist, Album, Track, SearchIndex } from '@/types/index.js';

interface AlbumWithArtwork extends Album {
  artworkUrl?: string;
}

@customElement('artist-view')
export class ArtistView extends LitElement {
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

    .artist-header {
      display: flex;
      align-items: flex-end;
      gap: var(--spacing-xl);
      margin-bottom: var(--spacing-xl);
      padding-bottom: var(--spacing-xl);
    }

    .artist-photo {
      width: 232px;
      height: 232px;
      flex-shrink: 0;
      background-color: var(--color-bg-highlight);
      border-radius: 50%;
      box-shadow: 0 4px 60px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .artist-photo svg {
      width: 100px;
      height: 100px;
      color: var(--color-text-subdued);
    }

    .artist-info {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding-bottom: var(--spacing-sm);
    }

    .artist-type {
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: var(--spacing-sm);
    }

    .artist-name {
      font-size: clamp(var(--font-size-xxl), 5vw, 72px);
      font-weight: 900;
      line-height: 1.1;
      margin-bottom: var(--spacing-md);
    }

    .artist-stats {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    .play-controls {
      display: flex;
      align-items: center;
      gap: var(--spacing-lg);
      margin-bottom: var(--spacing-xl);
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

    .section {
      margin-bottom: var(--spacing-xxl);
    }

    .section-title {
      font-size: var(--font-size-xl);
      font-weight: 700;
      margin-bottom: var(--spacing-lg);
    }

    /* Popular tracks */
    .track-list {
      display: flex;
      flex-direction: column;
    }

    .track-item {
      display: grid;
      grid-template-columns: 40px 40px 1fr 100px;
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

    .track-artwork {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-xs);
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

    .track-album {
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

    .album-year {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    .loading, .error {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--color-text-secondary);
    }
  `;

  @property({ type: String })
  artistId = '';

  @property({ attribute: false })
  musicSpace: MusicSpaceService | null = null;

  @property({ attribute: false })
  cacheService: CacheService | null = null;

  @state()
  private artist: Artist | null = null;

  @state()
  private albums: AlbumWithArtwork[] = [];

  @state()
  private topTracks: Track[] = [];

  @state()
  private loading = true;

  @state()
  private error = '';

  /** Cache of artwork object URLs by blob ID */
  private artworkUrls = new Map<string, string>();

  override updated(changedProperties: Map<string, unknown>) {
    if ((changedProperties.has('artistId') || changedProperties.has('musicSpace')) && this.artistId && this.musicSpace) {
      this.loadArtist();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const url of this.artworkUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.artworkUrls.clear();
  }

  private async loadArtist() {
    if (!this.musicSpace || !this.artistId) return;

    this.loading = true;
    this.error = '';

    try {
      const index: SearchIndex = await this.musicSpace.getSearchIndex();

      // Try to load artist metadata directly
      try {
        this.artist = await this.musicSpace.getArtist(this.artistId);
      } catch {
        // Artist object may not exist, build from search index
        const artistTracks = index.tracks.filter(t => t.artist === this.artistId);

        if (artistTracks.length === 0) {
          throw new Error('Artist not found');
        }

        this.artist = {
          artist_id: this.artistId,
          name: this.artistId,
          album_ids: [],
        };
      }

      // Build albums list from tracks
      const artistTracks = index.tracks.filter(t => t.artist === this.artist!.name);
      const albumMap = new Map<string, { title: string; year?: number; trackIds: string[] }>();

      for (const track of artistTracks) {
        const albumKey = `${this.artist!.name}|${track.album}`;
        if (!albumMap.has(albumKey)) {
          albumMap.set(albumKey, { title: track.album, trackIds: [] });
        }
        albumMap.get(albumKey)!.trackIds.push(track.id);
      }

      // Try to get full album data for year info
      this.albums = await Promise.all(
        Array.from(albumMap.entries()).map(async ([_key, data]) => {
          const albumId = await this.musicSpace!.generateAlbumId(this.artist!.name, data.title);
          try {
            const album = await this.musicSpace!.getAlbum(albumId);
            return album as AlbumWithArtwork;
          } catch {
            return {
              album_id: albumId,
              title: data.title,
              artist_id: this.artist!.artist_id,
              artist_name: this.artist!.name,
              track_ids: data.trackIds,
            } as AlbumWithArtwork;
          }
        })
      );

      // Sort albums by year (newest first)
      this.albums.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

      // Get top tracks (first 5 tracks by all albums)
      const trackIds = artistTracks.slice(0, 5).map(t => t.id);
      this.topTracks = await Promise.all(
        trackIds.map(id => this.musicSpace!.getTrack(id))
      );

      // Load album artwork
      await this.loadAlbumArtwork();
    } catch (err) {
      console.error('Failed to load artist:', err);
      this.error = err instanceof Error ? err.message : 'Failed to load artist';
    } finally {
      this.loading = false;
    }
  }

  private async loadAlbumArtwork() {
    for (const album of this.albums) {
      const artworkBlobId = album.artwork_blob_id;
      const artworkKey = album.artwork_encryption?.key;
      const artworkMimeType = album.artwork_mime_type;

      if (!artworkBlobId || !artworkKey || !this.musicSpace) {
        // Try to get artwork from first track
        if (album.track_ids.length > 0) {
          try {
            const track = await this.musicSpace!.getTrack(album.track_ids[0]);
            if (track.artwork_blob_id && track.artwork_encryption?.key) {
              await this.loadArtwork(album.album_id, track.artwork_blob_id, track.artwork_encryption.key, track.artwork_mime_type);
            }
          } catch {
            // Ignore
          }
        }
        continue;
      }

      await this.loadArtwork(album.album_id, artworkBlobId, artworkKey, artworkMimeType);
    }
  }

  private async loadArtwork(albumId: string, blobId: string, blobKey: string, mimeType?: string) {
    if (this.artworkUrls.has(albumId)) return;

    try {
      // Check cache first
      if (this.cacheService) {
        const cached = await this.cacheService.getArtwork(blobId);
        if (cached) {
          const blob = new Blob([cached.imageData], { type: cached.mimeType });
          const url = URL.createObjectURL(blob);
          this.artworkUrls.set(albumId, url);
          this.requestUpdate();
          return;
        }
      }

      // Download from server
      const data = await this.musicSpace!.downloadArtworkBlob(blobId, blobKey);
      const resolvedMimeType = mimeType ?? 'image/jpeg';

      // Cache for future
      if (this.cacheService) {
        await this.cacheService.cacheArtwork(blobId, data, resolvedMimeType);
      }

      const blob = new Blob([data], { type: resolvedMimeType });
      const url = URL.createObjectURL(blob);
      this.artworkUrls.set(albumId, url);
      this.requestUpdate();
    } catch (err) {
      console.warn('Failed to load artwork:', err);
    }
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading artist...</div>`;
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

    if (!this.artist) {
      return html`<div class="error">Artist not found</div>`;
    }

    return html`
      <button class="back-btn" @click=${this.goBack}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
        Back
      </button>

      <div class="artist-header">
        <div class="artist-photo">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        <div class="artist-info">
          <div class="artist-type">Artist</div>
          <h1 class="artist-name">${this.artist.name}</h1>
          <div class="artist-stats">
            ${this.albums.length} album${this.albums.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div class="play-controls">
        <button class="play-btn" @click=${this.playAll}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      </div>

      ${this.topTracks.length > 0 ? html`
        <div class="section">
          <h2 class="section-title">Popular</h2>
          <div class="track-list">
            ${this.topTracks.map((track, index) => html`
              <div class="track-item" @click=${() => this.playTrack(track.track_id)}>
                <span class="track-number">${index + 1}</span>
                <div class="track-artwork">
                  ${this.artworkUrls.get(track.album_id)
                    ? html`<img src=${this.artworkUrls.get(track.album_id)!} alt="" />`
                    : ''}
                </div>
                <div class="track-info">
                  <span class="track-title">${track.title}</span>
                  <span class="track-album">${track.album_name}</span>
                </div>
                <span class="track-duration">${this.formatDuration(track.duration_ms)}</span>
              </div>
            `)}
          </div>
        </div>
      ` : ''}

      ${this.albums.length > 0 ? html`
        <div class="section">
          <h2 class="section-title">Discography</h2>
          <div class="album-grid">
            ${this.albums.map(album => html`
              <div class="album-card" @click=${() => this.goToAlbum(album.album_id)}>
                <div class="album-artwork">
                  ${this.artworkUrls.get(album.album_id)
                    ? html`<img src=${this.artworkUrls.get(album.album_id)!} alt="" />`
                    : ''}
                </div>
                <div class="album-title">${album.title}</div>
                <div class="album-year">${album.year ?? 'Album'}</div>
              </div>
            `)}
          </div>
        </div>
      ` : ''}
    `;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private goBack() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { view: 'library' },
      bubbles: true,
      composed: true,
    }));
  }

  private goToAlbum(albumId: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { view: 'album', params: { id: albumId } },
      bubbles: true,
      composed: true,
    }));
  }

  private playAll() {
    if (this.topTracks.length === 0) return;
    this.playTrack(this.topTracks[0].track_id);
  }

  private playTrack(trackId: string) {
    this.dispatchEvent(new CustomEvent('play-track', {
      detail: { trackId },
      bubbles: true,
      composed: true,
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'artist-view': ArtistView;
  }
}
