/**
 * Library View Component
 *
 * Main library browser showing tracks, albums, and artists.
 */

import { LitElement, html, css } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ImportService, MusicSpaceService, CacheService } from '@/services/index.js';
import type { ParsedTrackMetadata, SearchIndex, Album, Artist, Track, ImportNotification, PlaylistIndexEntry, TrackListItem } from '@/types/index.js';
import { IMPORTS_TOPIC_ID, IMPORT_BATCH_TYPE } from '@/types/index.js';
import './track-list.js';

type Tab = 'songs' | 'albums' | 'artists' | 'playlists';
type SortField = 'title' | 'artist' | 'album' | 'duration';
type SortDirection = 'asc' | 'desc';

interface TrackEntry {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  genres: string[];
  artwork_blob_id?: string;
  artwork_blob_key?: string;
  artwork_mime_type?: string;
}

@customElement('library-view')
export class LibraryView extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--spacing-lg) var(--spacing-md);
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

    track-list {
      min-height: 200px;
      max-height: calc(100vh - 300px);
      overflow: auto;
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

    /* Sort and filter controls */
    .controls-row {
      display: flex;
      gap: var(--spacing-md);
      align-items: center;
      margin-bottom: var(--spacing-lg);
    }

    .filter-input {
      flex: 1;
      max-width: 300px;
      padding: var(--spacing-sm) var(--spacing-md);
      background-color: var(--color-bg-secondary);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      transition: all var(--transition-fast);
    }

    .filter-input:focus {
      outline: none;
      border-color: var(--color-text-subdued);
      background-color: var(--color-bg-highlight);
    }

    .filter-input::placeholder {
      color: var(--color-text-subdued);
    }

    .sort-controls {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin-left: auto;
    }

    .sort-label {
      font-size: var(--font-size-sm);
      color: var(--color-text-subdued);
    }

    .sort-select {
      padding: var(--spacing-xs) var(--spacing-sm);
      background-color: var(--color-bg-secondary);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .sort-select:hover {
      background-color: var(--color-bg-highlight);
    }

    .sort-select:focus {
      outline: none;
      border-color: var(--color-text-subdued);
    }

    .sort-direction-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      background-color: var(--color-bg-secondary);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .sort-direction-btn:hover {
      background-color: var(--color-bg-highlight);
      color: var(--color-text-primary);
    }

    .sort-direction-btn svg {
      width: 16px;
      height: 16px;
      transition: transform var(--transition-fast);
    }

    .sort-direction-btn.desc svg {
      transform: rotate(180deg);
    }

    .no-results {
      text-align: center;
      padding: var(--spacing-xl);
      color: var(--color-text-subdued);
    }

    .offline-badge {
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-warning);
    }

    /* Drop zone */
    :host {
      position: relative;
    }

    .drop-overlay {
      position: absolute;
      inset: 0;
      background-color: rgba(var(--color-accent-rgb, 29, 185, 84), 0.08);
      border: 2px dashed var(--color-accent);
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-sm);
      z-index: 50;
      pointer-events: none;
    }

    .drop-overlay svg {
      width: 48px;
      height: 48px;
      color: var(--color-accent);
    }

    .drop-overlay span {
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--color-accent);
    }
  `;

  @property({ attribute: false })
  musicSpace: MusicSpaceService | null = null;

  @property({ attribute: false })
  cacheService: CacheService | null = null;

  @property({ type: String })
  initialTab: Tab = 'songs';

  @property({ type: Boolean })
  offline = false;

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

  @state()
  private sortField: SortField = 'title';

  @state()
  private sortDirection: SortDirection = 'asc';

  @state()
  private filterText = '';

  @state()
  private genreFilter = '';

  @state()
  private draggingOver = false;

  private dragCounter = 0;

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
      const trackList = this.shadowRoot?.querySelector('track-list');
      const menuContainer = trackList?.shadowRoot?.querySelector('.track-menu-container');
      if (!menuContainer || !path.includes(menuContainer)) {
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
    if (changedProperties.has('trackMenuOpen')) {
      this.shadowRoot?.querySelector('track-list')?.requestUpdate();
    }
    // Reload library data when coming back online
    if (changedProperties.has('offline') && changedProperties.get('offline') === true && !this.offline) {
      this.loadLibrary();
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
              genres: fullTrack.genres,
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
              genres: [],
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
        albumEntries.map(async ([_key, val]) => {
          const albumId = await this.musicSpace!.generateAlbumId(val.artist, val.title);
          try {
            return await this.musicSpace!.getAlbum(albumId);
          } catch {
            const artistId = await this.musicSpace!.generateArtistId(val.artist);
            // Album record doesn't exist, return synthetic album
            return {
              album_id: albumId,
              title: val.title,
              artist_id: artistId,
              artist_name: val.artist,
              genres: [],
              track_ids: [],
            };
          }
        })
      );

      this.artists = await Promise.all(
        Array.from(artistMap.keys()).map(async name => ({
          artist_id: await this.musicSpace!.generateArtistId(name),
          name,
          album_ids: [],
        }))
      );

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
          ${!this.isEmpty ? this.offline
            ? html`<span class="offline-badge">Offline</span>`
            : html`
              <button class="header-import-btn" @click=${this.openImport} ?disabled=${this.importing}>
                ${this.importing ? 'Importing...' : 'Import'}
              </button>
            `
          : ''}
        </div>
      </div>

      <div
        class="content"
        @dragenter=${this.handleDragEnter}
        @dragover=${this.handleDragOver}
        @dragleave=${this.handleDragLeave}
        @drop=${this.handleDrop}
      >
        ${this.draggingOver ? html`
          <div class="drop-overlay">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            </svg>
            <span>Drop files to import</span>
          </div>
        ` : ''}
        ${this.isEmpty ? this.renderEmptyState() : html`
          ${this.renderControls()}
          ${this.renderContent()}
        `}
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
        <button class="import-btn" @click=${this.openImport} ?disabled=${this.importing || this.offline}>
          ${this.importing ? 'Importing...' : 'Import Music'}
        </button>
      </div>
    `;
  }

  private renderControls() {
    const sortOptions = this.getSortOptionsForTab();
    return html`
      <div class="controls-row">
        <input
          type="text"
          class="filter-input"
          placeholder="Filter ${this.activeTab}..."
          .value=${this.filterText}
          @input=${this.handleFilterInput}
        />
        <div class="sort-controls">
          ${this.availableGenres.length > 0 ? html`
            <select class="sort-select" @change=${this.handleGenreChange}>
              <option value="">All Genres</option>
              ${this.availableGenres.map(g => html`
                <option value=${g} ?selected=${this.genreFilter === g}>${g}</option>
              `)}
            </select>
          ` : ''}
          <span class="sort-label">Sort by</span>
          <select class="sort-select" @change=${this.handleSortChange}>
            ${sortOptions.map(opt => html`
              <option value=${opt.value} ?selected=${this.sortField === opt.value}>
                ${opt.label}
              </option>
            `)}
          </select>
          <button
            class="sort-direction-btn ${this.sortDirection}"
            @click=${this.toggleSortDirection}
            title="${this.sortDirection === 'asc' ? 'Ascending' : 'Descending'}"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14l5-5 5 5H7z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  private getSortOptionsForTab(): Array<{ value: SortField; label: string }> {
    switch (this.activeTab) {
      case 'songs':
        return [
          { value: 'title', label: 'Title' },
          { value: 'artist', label: 'Artist' },
          { value: 'album', label: 'Album' },
          { value: 'duration', label: 'Duration' },
        ];
      case 'albums':
        return [
          { value: 'title', label: 'Title' },
          { value: 'artist', label: 'Artist' },
        ];
      case 'artists':
        return [
          { value: 'title', label: 'Name' },
        ];
      case 'playlists':
        return [
          { value: 'title', label: 'Name' },
        ];
    }
  }

  /** Get sorted list of unique genres from loaded tracks. */
  private get availableGenres(): string[] {
    const genres = new Set<string>();
    for (const track of this.tracks) {
      for (const g of track.genres) genres.add(g);
    }
    return [...genres].sort((a, b) => a.localeCompare(b));
  }

  private handleFilterInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.filterText = input.value;
  }

  private handleGenreChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.genreFilter = select.value;
  }

  private handleSortChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.sortField = select.value as SortField;
  }

  private toggleSortDirection() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
  }

  private getFilteredAndSortedTracks(): TrackEntry[] {
    let filtered = this.tracks;

    // Filter by genre
    if (this.genreFilter) {
      filtered = filtered.filter(t => t.genres.includes(this.genreFilter));
    }

    // Filter by text
    if (this.filterText) {
      const search = this.filterText.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(search) ||
        t.artist.toLowerCase().includes(search) ||
        t.album.toLowerCase().includes(search)
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (this.sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'artist':
          cmp = a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
          break;
        case 'album':
          cmp = a.album.localeCompare(b.album) || a.title.localeCompare(b.title);
          break;
        case 'duration':
          cmp = a.duration_ms - b.duration_ms;
          break;
      }
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }

  private getFilteredAndSortedAlbums(): Album[] {
    let filtered = this.albums;

    // Filter by genres: include album if any of its tracks match
    if (this.genreFilter) {
      const albumKeysWithGenre = new Set(
        this.tracks
          .filter(t => t.genres.includes(this.genreFilter))
          .map(t => `${t.artist}|${t.album}`)
      );
      filtered = filtered.filter(a => albumKeysWithGenre.has(a.album_id));
    }

    // Filter by text
    if (this.filterText) {
      const search = this.filterText.toLowerCase();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(search) ||
        a.artist_name.toLowerCase().includes(search)
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (this.sortField) {
        case 'title':
        case 'album':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'artist':
          cmp = a.artist_name.localeCompare(b.artist_name) || a.title.localeCompare(b.title);
          break;
        default:
          cmp = a.title.localeCompare(b.title);
      }
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }

  private getFilteredAndSortedArtists(): Artist[] {
    let filtered = this.artists;

    // Filter by genres: include artist if any of their tracks match
    if (this.genreFilter) {
      const artistsWithGenre = new Set(
        this.tracks
          .filter(t => t.genres.includes(this.genreFilter))
          .map(t => t.artist)
      );
      filtered = filtered.filter(a => artistsWithGenre.has(a.name));
    }

    // Filter by text
    if (this.filterText) {
      const search = this.filterText.toLowerCase();
      filtered = filtered.filter(a => a.name.toLowerCase().includes(search));
    }

    // Sort by name
    const sorted = [...filtered].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }

  private renderContent() {
    switch (this.activeTab) {
      case 'songs':
        return this.renderSongsList();
      case 'albums':
        return this.renderAlbumGrid();
      case 'artists':
        return this.renderArtistList();
      case 'playlists':
        return this.renderPlaylistList();
    }
  }

  private renderSongsList() {
    const tracks = this.getFilteredAndSortedTracks();
    if (tracks.length === 0 && this.filterText) {
      return html`<div class="no-results">No songs match "${this.filterText}"</div>`;
    }
    return html`
      <track-list
        .items=${this.getTrackListItems(tracks)}
        show-artwork
        show-album
        .actionRenderer=${this.renderTrackAction}
        @track-click=${this.handleTrackListClick}
      ></track-list>
    `;
  }

  private getTrackListItems(tracks: TrackEntry[]): TrackListItem[] {
    return tracks.map(track => {
      // Trigger lazy artwork loading as side effect
      this.loadArtwork(track);
      return {
        id: track.id,
        title: track.title,
        subtitle: track.artist,
        album: track.album,
        durationMs: track.duration_ms,
        artworkUrl: track.artwork_blob_id ? this.artworkUrls.get(track.artwork_blob_id) || undefined : undefined,
      };
    });
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

  private handleTrackListClick(e: CustomEvent<{ item: TrackListItem; index: number }>) {
    this.playTrack(e.detail.item.id);
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
        <div class="track-menu-divider"></div>
        <button class="track-menu-item danger" @click=${(e: Event) => this.handleDeleteTrack(e, trackId)}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
          Delete
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

  private async handleDeleteTrack(e: Event, trackId: string) {
    e.stopPropagation();
    this.trackMenuOpen = null;
    if (this.offline) return;

    const track = this.tracks.find(t => t.id === trackId);
    const title = track?.title ?? 'this track';
    if (!confirm(`Delete "${title}"? This will remove the track from your library and all playlists.`)) return;
    if (!this.musicSpace) return;

    try {
      await this.musicSpace.deleteTrack(trackId);

      // Remove from all playlists
      for (const entry of this.playlists) {
        try {
          const playlist = await this.musicSpace.getPlaylist(entry.playlist_id);
          if (playlist.track_ids.includes(trackId)) {
            playlist.track_ids = playlist.track_ids.filter(id => id !== trackId);
            playlist.updated_at = Date.now();
            await this.musicSpace.setPlaylist(playlist);
          }
        } catch {
          // Playlist may not exist
        }
      }

      // Remove from local cache
      try {
        await this.cacheService?.removeTrack(trackId);
      } catch {
        // Cache cleanup is best-effort
      }

      // Update local state
      this.tracks = this.tracks.filter(t => t.id !== trackId);
      this.isEmpty = this.tracks.length === 0;

      this.dispatchEvent(new CustomEvent('track-deleted', {
        detail: { trackId },
        bubbles: true,
        composed: true,
      }));
    } catch (err) {
      console.error('Failed to delete track:', err);
    }
  }

  private playTrack(trackId: string) {
    // Get the current filtered/sorted track list as the queue context
    const filteredTracks = this.getFilteredAndSortedTracks();
    const queue = filteredTracks.map(t => t.id);

    this.dispatchEvent(new CustomEvent('play-track', {
      detail: { trackId, queue },
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
    const albums = this.getFilteredAndSortedAlbums();
    if (albums.length === 0 && this.filterText) {
      return html`<div class="no-results">No albums match "${this.filterText}"</div>`;
    }
    return html`
      <div class="album-grid">
        ${albums.map(album => {
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
    const artists = this.getFilteredAndSortedArtists();
    if (artists.length === 0 && this.filterText) {
      return html`<div class="no-results">No artists match "${this.filterText}"</div>`;
    }
    return html`
      <div class="album-grid">
        ${artists.map(artist => html`
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

  private renderPlaylistList() {
    let filtered = this.playlists as PlaylistIndexEntry[];

    if (this.filterText) {
      const search = this.filterText.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
    }

    const sorted = [...filtered].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });

    if (sorted.length === 0 && this.filterText) {
      return html`<div class="no-results">No playlists match "${this.filterText}"</div>`;
    }

    if (sorted.length === 0) {
      return html`<div class="no-results">No playlists yet</div>`;
    }

    return html`
      <div class="album-grid">
        ${sorted.map(playlist => html`
          <div class="album-card" @click=${() => this.navigateToPlaylist(playlist.playlist_id)}>
            <div class="album-artwork artist-avatar">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
              </svg>
            </div>
            <div class="album-title">${playlist.name}</div>
            <div class="album-artist">${playlist.track_count} ${playlist.track_count === 1 ? 'track' : 'tracks'}</div>
          </div>
        `)}
      </div>
    `;
  }

  private navigateToPlaylist(playlistId: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { view: 'playlist', params: { id: playlistId } },
      bubbles: true,
      composed: true,
    }));
  }

  private navigateToArtist(artistId: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { view: 'artist', params: { id: artistId } },
      bubbles: true,
      composed: true,
    }));
  }

  private handleDragEnter(e: DragEvent) {
    e.preventDefault();
    this.dragCounter++;
    this.draggingOver = true;
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  private handleDragLeave(_e: DragEvent) {
    this.dragCounter--;
    if (this.dragCounter === 0) {
      this.draggingOver = false;
    }
  }

  private async handleDrop(e: DragEvent) {
    e.preventDefault();
    this.dragCounter = 0;
    this.draggingOver = false;
    if (this.offline) return;

    const items = e.dataTransfer?.items;
    if (!items || items.length === 0) return;

    // Use webkitGetAsEntry to support recursive folder drops
    const entries: FileSystemEntry[] = [];
    for (const item of Array.from(items)) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }

    if (entries.length > 0) {
      const files = await this.collectFilesFromEntries(entries);
      if (files.length > 0) {
        await this.importFiles(files);
      }
    }
  }

  /** Recursively collect File objects from FileSystemEntry items. */
  private async collectFilesFromEntries(entries: FileSystemEntry[]): Promise<File[]> {
    const files: File[] = [];

    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          (entry as FileSystemFileEntry).file(resolve, reject);
        });
        files.push(file);
      } else if (entry.isDirectory) {
        const dirEntries = await this.readAllDirectoryEntries(entry as FileSystemDirectoryEntry);
        const nested = await this.collectFilesFromEntries(dirEntries);
        files.push(...nested);
      }
    }

    return files;
  }

  /** Read all entries from a directory, handling the 100-entry batch limit. */
  private readAllDirectoryEntries(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
    const reader = directory.createReader();
    const allEntries: FileSystemEntry[] = [];

    return new Promise((resolve, reject) => {
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...batch);
            readBatch();
          }
        }, reject);
      };
      readBatch();
    });
  }

  private async openImport() {
    const files = await ImportService.selectFiles();
    if (files.length > 0) {
      await this.importFiles(files);
    }
  }

  /** Shared import logic for both file picker and drag-and-drop. */
  private async importFiles(files: File[]) {
    if (!this.musicSpace) {
      console.error('Cannot import: not authenticated');
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
