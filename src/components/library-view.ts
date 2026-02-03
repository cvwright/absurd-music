/**
 * Library View Component
 *
 * Main library browser showing tracks, albums, and artists.
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ImportService, MusicSpaceService, CacheService } from '@/services/index.js';
import type { ParsedTrackMetadata, SearchIndex, Album, Artist, Track, ImportNotification, PlaylistIndexEntry } from '@/types/index.js';
import { IMPORTS_TOPIC_ID, IMPORT_BATCH_TYPE } from '@/types/index.js';

type Tab = 'songs' | 'albums' | 'artists';

interface TrackEntry {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  artwork_blob_id?: string;
  artwork_blob_key?: string;
  artwork_mime_type?: string;
}

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

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-lg);
    }

    h1 {
      font-size: var(--font-size-xxxl);
      font-weight: 700;
      margin: 0;
    }

    .header-import-btn {
      padding: var(--spacing-xs) var(--spacing-md);
      background-color: transparent;
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      font-weight: 500;
      border: 1px solid var(--color-text-subdued);
      border-radius: var(--radius-full);
      transition: all var(--transition-fast);
    }

    .header-import-btn:hover:not(:disabled) {
      background-color: var(--color-bg-highlight);
      border-color: var(--color-text-secondary);
    }

    .header-import-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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

    .import-btn:hover:not(:disabled) {
      background-color: var(--color-accent-hover);
      transform: scale(1.02);
    }

    .import-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Track list */
    .track-list {
      display: flex;
      flex-direction: column;
    }

    .track-header {
      display: grid;
      grid-template-columns: 40px 40px 1fr 1fr 100px 40px;
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

    .album-artwork img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .album-artwork.artist-avatar {
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .album-artwork.artist-avatar svg {
      width: 60%;
      height: 60%;
      color: var(--color-text-subdued);
    }

    /* Track item */
    .track-item {
      display: grid;
      grid-template-columns: 40px 40px 1fr 1fr 100px 40px;
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

    .track-artist {
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

    /* Track menu */
    .track-menu-container {
      position: relative;
    }

    .track-menu-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: transparent;
      color: var(--color-text-subdued);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: all var(--transition-fast);
    }

    .track-item:hover .track-menu-btn {
      opacity: 1;
    }

    .track-menu-btn:hover {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .track-menu-btn svg {
      width: 16px;
      height: 16px;
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
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      text-align: left;
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
  `;

  @property({ attribute: false })
  musicSpace: MusicSpaceService | null = null;

  @property({ attribute: false })
  cacheService: CacheService | null = null;

  @property({ type: String })
  initialTab: Tab = 'songs';

  @property({ attribute: false })
  playlists: PlaylistIndexEntry[] = [];

  @state()
  private activeTab: Tab = 'songs';

  @state()
  private trackMenuOpen: string | null = null;

  @state()
  private isEmpty = true;

  @state()
  private importing = false;

  @state()
  private tracks: TrackEntry[] = [];

  @state()
  private albums: Album[] = [];

  @state()
  private artists: Artist[] = [];

  /** Cache of artwork object URLs by blob ID (shared across tracks on same album) */
  private artworkUrls = new Map<string, string>();

  override connectedCallback() {
    super.connectedCallback();
    this.loadLibrary();
    this.handleClickOutside = this.handleClickOutside.bind(this);
    document.addEventListener('click', this.handleClickOutside);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleClickOutside);
    // Revoke object URLs to free memory
    for (const url of this.artworkUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.artworkUrls.clear();
  }

  private handleClickOutside(e: MouseEvent) {
    if (this.trackMenuOpen) {
      const path = e.composedPath();
      const menuContainer = this.shadowRoot?.querySelector('.track-menu-container');
      if (menuContainer && !path.includes(menuContainer)) {
        this.trackMenuOpen = null;
      }
    }
  }

  override updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('musicSpace') && this.musicSpace) {
      this.loadLibrary();
    }
    if (changedProperties.has('initialTab') && this.initialTab) {
      this.activeTab = this.initialTab;
    }
  }

  /** Load library data from the search index. */
  private async loadLibrary() {
    if (!this.musicSpace) {
      return;
    }

    try {
      const index: SearchIndex = await this.musicSpace.getSearchIndex();
      this.isEmpty = index.tracks.length === 0;

      // Fetch full track data to get artwork info
      const trackEntries: TrackEntry[] = await Promise.all(
        index.tracks.map(async (t) => {
          try {
            const fullTrack: Track = await this.musicSpace!.getTrack(t.id);
            return {
              id: t.id,
              title: t.title,
              artist: t.artist,
              album: t.album,
              duration_ms: t.duration_ms,
              artwork_blob_id: fullTrack.artwork_blob_id,
              artwork_blob_key: fullTrack.artwork_encryption?.key,
              artwork_mime_type: fullTrack.artwork_mime_type,
            };
          } catch {
            // Fall back to index data if track fetch fails
            return {
              id: t.id,
              title: t.title,
              artist: t.artist,
              album: t.album,
              duration_ms: t.duration_ms,
            };
          }
        })
      );
      this.tracks = trackEntries;

      // Build albums and artists from track data
      const albumMap = new Map<string, { title: string; artist: string }>();
      const artistMap = new Map<string, string>();

      for (const track of this.tracks) {
        const albumKey = `${track.artist}|${track.album}`;
        if (!albumMap.has(albumKey)) {
          albumMap.set(albumKey, { title: track.album, artist: track.artist });
        }
        if (!artistMap.has(track.artist)) {
          artistMap.set(track.artist, track.artist);
        }
      }

      // Fetch actual album records where they exist, falling back to synthetic albums
      const albumEntries = Array.from(albumMap.entries());
      this.albums = await Promise.all(
        albumEntries.map(async ([key, val]) => {
          try {
            return await this.musicSpace!.getAlbum(key);
          } catch {
            // Album record doesn't exist, return synthetic album
            return {
              album_id: key,
              title: val.title,
              artist_id: val.artist,
              artist_name: val.artist,
              track_ids: [],
            };
          }
        })
      );

      this.artists = Array.from(artistMap.keys()).map(name => ({
        artist_id: name,
        name,
        album_ids: [],
      }));

    } catch (err) {
      // Index doesn't exist yet (empty library)
      console.log('No library index found, library is empty');
      this.isEmpty = true;
      this.tracks = [];
      this.albums = [];
      this.artists = [];
    }
  }

  render() {
    return html`
      <div class="header">
        <div class="header-row">
          <h1>Your Library</h1>
          ${!this.isEmpty ? html`
            <button class="header-import-btn" @click=${this.openImport} ?disabled=${this.importing}>
              ${this.importing ? 'Importing...' : 'Import'}
            </button>
          ` : ''}
        </div>
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
        <button class="import-btn" @click=${this.openImport} ?disabled=${this.importing}>
          ${this.importing ? 'Importing...' : 'Import Music'}
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
          <span></span>
          <span>Title</span>
          <span>Album</span>
          <span>Duration</span>
          <span></span>
        </div>
        ${this.tracks.map((track, index) => html`
          <div class="track-item">
            <span class="track-number" @click=${() => this.playTrack(track.id)}>${index + 1}</span>
            <div class="track-artwork" @click=${() => this.playTrack(track.id)}>
              ${track.artwork_blob_id && this.artworkUrls.get(track.artwork_blob_id)
                ? html`<img src=${this.artworkUrls.get(track.artwork_blob_id)!} alt="" />`
                : html`${this.loadArtwork(track)}`}
            </div>
            <div class="track-info" @click=${() => this.playTrack(track.id)}>
              <span class="track-title">${track.title}</span>
              <span class="track-artist">${track.artist}</span>
            </div>
            <span class="track-album" @click=${() => this.playTrack(track.id)}>${track.album}</span>
            <span class="track-duration" @click=${() => this.playTrack(track.id)}>${this.formatDuration(track.duration_ms)}</span>
            <div class="track-menu-container">
              <button
                class="track-menu-btn"
                @click=${(e: Event) => this.toggleTrackMenu(e, track.id)}
                title="More options"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
              ${this.trackMenuOpen === track.id ? this.renderTrackMenu(track.id) : ''}
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private toggleTrackMenu(e: Event, trackId: string) {
    e.stopPropagation();
    this.trackMenuOpen = this.trackMenuOpen === trackId ? null : trackId;
  }

  private renderTrackMenu(trackId: string) {
    return html`
      <div class="track-menu-dropdown">
        <button class="track-menu-item" @click=${(e: Event) => this.handleAddToQueue(e, trackId)}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
          </svg>
          Add to Queue
        </button>
        <div class="track-menu-divider"></div>
        <div class="track-menu-section-title">Add to Playlist</div>
        ${this.playlists.length === 0
          ? html`<div class="track-menu-item" style="color: var(--color-text-subdued); cursor: default;">No playlists</div>`
          : this.playlists.map(playlist => html`
              <button class="track-menu-item" @click=${(e: Event) => this.handleAddToPlaylist(e, trackId, playlist.playlist_id)}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                ${playlist.name}
              </button>
            `)}
        <div class="track-menu-divider"></div>
        <button class="track-menu-item" @click=${(e: Event) => this.handleCreatePlaylistWithTrack(e, trackId)}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          New Playlist...
        </button>
      </div>
    `;
  }

  private handleAddToQueue(e: Event, trackId: string) {
    e.stopPropagation();
    this.trackMenuOpen = null;
    // TODO: Implement add to queue
    console.log('Add to queue:', trackId);
  }

  private handleAddToPlaylist(e: Event, trackId: string, playlistId: string) {
    e.stopPropagation();
    this.trackMenuOpen = null;
    this.dispatchEvent(new CustomEvent('add-to-playlist', {
      detail: { trackId, playlistId },
      bubbles: true,
      composed: true,
    }));
  }

  private handleCreatePlaylistWithTrack(e: Event, trackId: string) {
    e.stopPropagation();
    this.trackMenuOpen = null;
    this.dispatchEvent(new CustomEvent('create-playlist-with-track', {
      detail: { trackId },
      bubbles: true,
      composed: true,
    }));
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private playTrack(trackId: string) {
    this.dispatchEvent(new CustomEvent('play-track', {
      detail: { trackId },
      bubbles: true,
      composed: true,
    }));
  }

  /** Trigger artwork loading for a track (returns nothing, updates cache async). */
  private loadArtwork(track: TrackEntry) {
    const blobId = track.artwork_blob_id;
    const blobKey = track.artwork_blob_key;
    const mimeType = track.artwork_mime_type;
    if (!blobId || !blobKey || !this.musicSpace) {
      return '';
    }
    // Use blob ID as key since artwork is shared across tracks on same album
    if (this.artworkUrls.has(blobId)) {
      return '';
    }

    // Mark as loading to prevent duplicate requests
    this.artworkUrls.set(blobId, '');

    this.loadArtworkAsync(blobId, blobKey, mimeType);
    return '';
  }

  private async loadArtworkAsync(blobId: string, blobKey: string, mimeType?: string) {
    try {
      // Check IndexedDB cache first
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
      const data = await this.musicSpace!.downloadArtworkBlob(blobId, blobKey);
      const resolvedMimeType = mimeType ?? 'image/jpeg';

      // Cache in IndexedDB for future sessions
      if (this.cacheService) {
        await this.cacheService.cacheArtwork(blobId, data, resolvedMimeType);
      }

      // Create object URL for display
      const blob = new Blob([data], { type: resolvedMimeType });
      const url = URL.createObjectURL(blob);
      this.artworkUrls.set(blobId, url);
      this.requestUpdate();
    } catch (err) {
      console.warn(`Failed to load artwork ${blobId}:`, err);
      this.artworkUrls.delete(blobId);
    }
  }

  private renderAlbumGrid() {
    return html`
      <div class="album-grid">
        ${this.albums.map(album => {
          const artworkUrl = this.getAlbumArtworkUrl(album);
          return html`
            <div class="album-card" @click=${() => this.navigateToAlbum(album.album_id)}>
              <div class="album-artwork">
                ${artworkUrl ? html`<img src=${artworkUrl} alt="" />` : ''}
              </div>
              <div class="album-title">${album.title}</div>
              <div class="album-artist">${album.artist_name}</div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private getAlbumArtworkUrl(album: Album): string | undefined {
    // First check if the album has its own artwork
    if (album.artwork_blob_id) {
      const url = this.artworkUrls.get(album.artwork_blob_id);
      if (url) return url;
      // Trigger loading if not yet loaded
      this.loadAlbumArtwork(album);
      return undefined;
    }

    // Fall back to track artwork
    const track = this.tracks.find(t => `${t.artist}|${t.album}` === album.album_id);
    if (track?.artwork_blob_id) {
      return this.artworkUrls.get(track.artwork_blob_id);
    }
    return undefined;
  }

  /** Load artwork for an album (if it has its own artwork). */
  private loadAlbumArtwork(album: Album) {
    const blobId = album.artwork_blob_id;
    const blobKey = album.artwork_encryption?.key;
    const mimeType = album.artwork_mime_type;

    if (!blobId || !blobKey || !this.musicSpace) {
      return;
    }

    // Check if already loading or loaded
    if (this.artworkUrls.has(blobId)) {
      return;
    }

    // Mark as loading
    this.artworkUrls.set(blobId, '');
    this.loadArtworkAsync(blobId, blobKey, mimeType);
  }

  private navigateToAlbum(albumId: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { view: 'album', params: { id: albumId } },
      bubbles: true,
      composed: true,
    }));
  }

  private renderArtistList() {
    return html`
      <div class="album-grid">
        ${this.artists.map(artist => html`
          <div class="album-card" @click=${() => this.navigateToArtist(artist.artist_id)}>
            <div class="album-artwork artist-avatar">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div class="album-title">${artist.name}</div>
            <div class="album-artist">Artist</div>
          </div>
        `)}
      </div>
    `;
  }

  private navigateToArtist(artistId: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { view: 'artist', params: { id: artistId } },
      bubbles: true,
      composed: true,
    }));
  }

  private async openImport() {
    if (!this.musicSpace) {
      console.error('Cannot import: not authenticated');
      return;
    }

    const files = await ImportService.selectFiles();
    if (files.length === 0) {
      return;
    }

    console.log(`Selected ${files.length} file(s), parsing metadata...`);
    this.importing = true;

    // Track imports grouped by album
    const albumTracks = new Map<string, string[]>();

    try {
      const parsed: ParsedTrackMetadata[] = await ImportService.parseFiles(files);

      // Import each track
      for (const metadata of parsed) {
        console.log(`Importing: ${metadata.artist ?? 'Unknown'} - ${metadata.title}`);
        const track = await ImportService.importTrack(metadata, this.musicSpace);
        console.log("Import successful");

        // Group by album
        const tracks = albumTracks.get(track.album_id) ?? [];
        tracks.push(track.track_id);
        albumTracks.set(track.album_id, tracks);
      }

      console.log(`Successfully imported ${parsed.length} track(s)`);

      // Publish import notification
      if (albumTracks.size > 0) {
        const notification: ImportNotification = {
          albums: Object.fromEntries(albumTracks),
          imported_at: Date.now(),
        };

        try {
          await this.musicSpace.postMessage(
            IMPORTS_TOPIC_ID,
            IMPORT_BATCH_TYPE,
            notification
          );
          console.log('Published import notification');
        } catch (err) {
          // Non-fatal: log but don't fail the import
          console.warn('Failed to publish import notification:', err);
        }
      }

      await this.loadLibrary();
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      this.importing = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'library-view': LibraryView;
  }
}
