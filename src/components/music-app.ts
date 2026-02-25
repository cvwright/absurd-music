/**
 * Music App - Main Application Shell
 *
 * Root component that provides the overall app layout:
 * - Sidebar for navigation
 * - Main content area
 * - Bottom player bar
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { MusicSpaceService, type MusicSpaceConfig } from '@/services/music-space.js';
import { PlaybackService } from '@/services/playback.js';
import { CacheService } from '@/services/cache.js';
import { PlaylistService } from '@/services/playlist.js';
import { PlayCountService } from '@/services/play-count.js';
import { loadCredentials, saveCredentials, clearCredentials } from '@/services/credentials.js';
import type { PlaylistIndexEntry } from '@/types/index.js';

import { setLogLevel } from 'reeeductio';
setLogLevel('debug');


// Import child components
import './player-bar.js';
import './sidebar.js';
import './library-view.js';
import './login-view.js';
import './album-view.js';
import './artist-view.js';
import './recently-added-view.js';
import './popular-view.js';
import './playlist-view.js';
import './create-playlist-modal.js';

type View = 'library' | 'album' | 'artist' | 'playlist' | 'search' | 'recent' | 'popular';

/** Distinguish network failures from server-side auth rejections. */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /fetch|network/i.test(err.message);
}

@customElement('music-app')
export class MusicApp extends LitElement {
  static styles = css`
    :host {
      display: grid;
      grid-template-columns: var(--sidebar-width) 1fr;
      grid-template-rows: 1fr var(--player-height);
      height: 100vh;
      height: 100dvh;
      width: 100vw;
      background-color: var(--color-bg-primary);
    }

    .sidebar {
      grid-row: 1;
      grid-column: 1;
      background-color: var(--color-bg-secondary);
      overflow-y: auto;
    }

    .main-content {
      grid-row: 1;
      grid-column: 2;
      overflow-y: auto;
      background: linear-gradient(
        180deg,
        var(--color-bg-elevated) 0%,
        var(--color-bg-primary) 300px
      );
    }

    .player-bar {
      grid-row: 2;
      grid-column: 1 / -1;
      background-color: var(--color-bg-elevated);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Mobile tab bar - hidden on desktop */
    .tab-bar {
      display: none;
      background-color: var(--color-bg-secondary);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .tab-bar-inner {
      display: flex;
      align-items: center;
      height: 100%;
    }

    .tab-bar-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: var(--spacing-xs) 0;
      background: none;
      border: none;
      color: var(--color-text-subdued);
      font-family: inherit;
      font-size: var(--font-size-xs);
      cursor: pointer;
      transition: color var(--transition-fast);
      -webkit-tap-highlight-color: transparent;
    }

    .tab-bar-item:hover,
    .tab-bar-item.active {
      color: var(--color-text-primary);
    }

    .tab-bar-item svg {
      width: 24px;
      height: 24px;
    }

    .loading-screen {
      grid-column: 1 / -1;
      grid-row: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      width: 100vw;
      background-color: var(--color-bg-primary);
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Responsive: collapse sidebar on small screens */
    @media (max-width: 768px) {
      :host {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr 72px var(--tab-bar-height);
      }

      .sidebar {
        display: none;
      }

      .main-content {
        grid-column: 1;
      }

      .player-bar {
        grid-row: 2;
        grid-column: 1;
      }

      .tab-bar {
        display: block;
        grid-row: 3;
        grid-column: 1;
      }
    }
  `;

  @state()
  private loading = true;

  @state()
  private authenticated = false;

  private musicSpace: MusicSpaceService | null = null;
  private playbackService = new PlaybackService();
  private cacheService = new CacheService();
  private playlistService: PlaylistService | null = null;
  private playCountService: PlayCountService | null = null;

  @state()
  private currentView: View = 'library';

  @state()
  private viewParams: Record<string, string> = {};

  @state()
  private playlists: PlaylistIndexEntry[] = [];

  @state()
  private showCreatePlaylistModal = false;

  @state()
  private urlSpaceId: string | null = null;

  @state()
  private offline = !navigator.onLine;

  @state()
  private reconnecting = false;

  private handleOnline = async () => {
    this.offline = false;

    if (!this.musicSpace) return;

    this.reconnecting = true;

    try {
      // Re-authenticate if we started offline
      if (!this.musicSpace.isAuthenticated) {
        await this.musicSpace.authenticate();
      }

      // Invalidate cached indexes so views get fresh data from server
      this.musicSpace.invalidateIndexCache();

      // Refresh sidebar playlists
      await this.loadPlaylists();
    } catch {
      // Auth still failing — will retry on next online event
    } finally {
      this.reconnecting = false;
    }
  };

  private handleOffline = () => { this.offline = true; };

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    this.urlSpaceId = this.getSpaceIdFromUrl();
    this.tryAutoLogin();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.musicSpace?.disconnectWebSocket();
    this.playCountService?.destroy();
  }

  private getSpaceIdFromUrl(): string | null {
    const match = window.location.pathname.match(/^\/space\/(.+)$/);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  }

  private updateUrlForSpace(spaceId: string) {
    const newPath = `/space/${encodeURIComponent(spaceId)}`;
    if (window.location.pathname !== newPath) {
      history.replaceState(null, '', newPath);
    }
  }

  private async tryAutoLogin() {
    try {
      const savedConfig = await loadCredentials();
      if (!savedConfig) return;

      this.musicSpace = new MusicSpaceService(savedConfig);

      try {
        await this.musicSpace.authenticate();
        await this.initServices();
        this.authenticated = true;
        this.updateUrlForSpace(savedConfig.spaceId);
      } catch (err) {
        if (isNetworkError(err)) {
          // Network unavailable — start in offline/cached mode
          await this.initServices();
          this.authenticated = true;
          this.updateUrlForSpace(savedConfig.spaceId);
        } else {
          // Auth rejected by server — clear credentials
          this.musicSpace = null;
          clearCredentials();
        }
      }
    } finally {
      this.loading = false;
    }
  }

  private async initServices() {
    if (!this.musicSpace) return;
    await this.cacheService.init();
    this.musicSpace.setCache(this.cacheService);
    this.playbackService.init(this.musicSpace, this.cacheService);
    this.playlistService = new PlaylistService(this.musicSpace);
    this.playCountService?.destroy();
    this.playCountService = new PlayCountService(this.playbackService, this.musicSpace);
    await this.loadPlaylists();
    this.musicSpace.connectWebSocket().catch((err) => {
      console.warn('WebSocket initial connection failed:', err);
    });
  }

  private async loadPlaylists() {
    if (!this.playlistService) return;
    this.playlists = await this.playlistService.listPlaylists();
  }

  render() {
    if (this.loading) {
      return html`<div class="loading-screen">
        <div class="loading-spinner"></div>
      </div>`;
    }

    if (!this.authenticated) {
      return html`<login-view
        .spaceId=${this.urlSpaceId ?? ''}
        ?spaceIdFromUrl=${!!this.urlSpaceId}
        @login=${this.handleLogin}
      ></login-view>`;
    }

    return html`
      <aside class="sidebar">
        <app-sidebar
          .currentView=${this.currentView}
          .currentPlaylistId=${this.viewParams.id || ''}
          .playlists=${this.playlists}
          ?offline=${this.offline}
          @navigate=${this.handleNavigate}
          @open-create-playlist=${this.handleOpenCreatePlaylist}
        ></app-sidebar>
      </aside>

      <main
        class="main-content"
        @play-track=${this.handlePlayTrack}
        @play-album=${this.handlePlayAlbum}
        @navigate=${this.handleNavigate}
        @playlist-updated=${this.loadPlaylists}
        @playlist-deleted=${this.loadPlaylists}
        @track-deleted=${this.loadPlaylists}
        @album-deleted=${this.loadPlaylists}
        @add-to-playlist=${this.handleAddToPlaylist}
        @create-playlist-with-track=${this.handleCreatePlaylistWithTrack}
      >
        ${this.renderView()}
      </main>

      <footer class="player-bar">
        <player-bar
          .playbackService=${this.playbackService}
          .musicSpace=${this.musicSpace}
          .cacheService=${this.cacheService}
        ></player-bar>
      </footer>

      <nav class="tab-bar">
        <div class="tab-bar-inner">
          <button
            class="tab-bar-item ${this.currentView === 'library' && this.viewParams.tab === 'albums' || this.currentView === 'album' ? 'active' : ''}"
            @click=${() => this.handleNavigate(new CustomEvent('navigate', { detail: { view: 'library', params: { tab: 'albums' } } }))}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
            </svg>
            <span>Albums</span>
          </button>
          <button
            class="tab-bar-item ${this.currentView === 'library' && this.viewParams.tab === 'artists' || this.currentView === 'artist' ? 'active' : ''}"
            @click=${() => this.handleNavigate(new CustomEvent('navigate', { detail: { view: 'library', params: { tab: 'artists' } } }))}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span>Artists</span>
          </button>
          <button
            class="tab-bar-item ${this.currentView === 'library' && (!this.viewParams.tab || this.viewParams.tab === 'songs') ? 'active' : ''}"
            @click=${() => this.handleNavigate(new CustomEvent('navigate', { detail: { view: 'library', params: { tab: 'songs' } } }))}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <span>Songs</span>
          </button>
          <button
            class="tab-bar-item ${this.currentView === 'library' && this.viewParams.tab === 'playlists' ? 'active' : ''}"
            @click=${() => this.handleNavigate(new CustomEvent('navigate', { detail: { view: 'library', params: { tab: 'playlists' } } }))}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
            </svg>
            <span>Playlists</span>
          </button>
        </div>
      </nav>

      <create-playlist-modal
        ?open=${this.showCreatePlaylistModal}
        ?offline=${this.offline}
        @close=${this.handleCloseCreatePlaylist}
        @create=${this.handleCreatePlaylist}
      ></create-playlist-modal>
    `;
  }

  private renderView() {
    switch (this.currentView) {
      case 'library':
        return html`<library-view
          .musicSpace=${this.musicSpace}
          .cacheService=${this.cacheService}
          .initialTab=${this.viewParams.tab || 'songs'}
          .playlists=${this.playlists}
          ?offline=${this.offline}
          ?reconnecting=${this.reconnecting}
        ></library-view>`;
      case 'album':
        return html`<album-view
          .albumId=${this.viewParams.id}
          .musicSpace=${this.musicSpace}
          .cacheService=${this.cacheService}
          ?offline=${this.offline}
        ></album-view>`;
      case 'artist':
        return html`<artist-view
          .artistId=${this.viewParams.id}
          .musicSpace=${this.musicSpace}
          .cacheService=${this.cacheService}
          ?offline=${this.offline}
        ></artist-view>`;
      case 'playlist':
        return html`<playlist-view
          .playlistId=${this.viewParams.id}
          .musicSpace=${this.musicSpace}
          .cacheService=${this.cacheService}
          .playlistService=${this.playlistService}
          ?offline=${this.offline}
        ></playlist-view>`;
      case 'search':
        return html`<div>Search view</div>`;
      case 'recent':
        return html`<recently-added-view
          .musicSpace=${this.musicSpace}
          .cacheService=${this.cacheService}
          ?offline=${this.offline}
        ></recently-added-view>`;
      case 'popular':
        return html`<popular-view
          .playCountService=${this.playCountService}
          .musicSpace=${this.musicSpace}
          ?offline=${this.offline}
        ></popular-view>`;
      default:
        return html`<library-view
          .musicSpace=${this.musicSpace}
          .cacheService=${this.cacheService}
          .initialTab=${this.viewParams.tab || 'songs'}
          .playlists=${this.playlists}
          ?offline=${this.offline}
          ?reconnecting=${this.reconnecting}
        ></library-view>`;
    }
  }

  private async handleLogin(e: CustomEvent<MusicSpaceConfig>) {
    try {
      this.musicSpace = new MusicSpaceService(e.detail);
      await this.musicSpace.authenticate();
      await this.initServices();
      saveCredentials(e.detail);
      this.authenticated = true;
      this.updateUrlForSpace(e.detail.spaceId);
    } catch (err) {
      this.musicSpace = null;
      const loginView = this.shadowRoot?.querySelector('login-view');
      if (loginView) {
        loginView.showError(err instanceof Error ? err.message : 'Authentication failed');
      }
    }
  }

  private handleNavigate(e: CustomEvent<{ view: View; params?: Record<string, string> }>) {
    this.currentView = e.detail.view;
    this.viewParams = e.detail.params ?? {};
  }

  private async handlePlayTrack(e: CustomEvent<{ trackId: string; queue?: string[] }>) {
    if (!this.musicSpace) return;

    try {
      const track = await this.musicSpace.getTrack(e.detail.trackId);

      // Use provided queue (e.g., filtered list) or fall back to full library
      let trackIds: string[];
      if (e.detail.queue && e.detail.queue.length > 0) {
        trackIds = e.detail.queue;
      } else {
        const index = await this.musicSpace.getSearchIndex();
        trackIds = index.tracks.map(t => t.id);
      }

      const startIndex = trackIds.indexOf(e.detail.trackId);
      this.playbackService.setQueue(trackIds, startIndex >= 0 ? startIndex : 0);
      await this.playbackService.playTrack(track);
    } catch (err) {
      console.error('Failed to play track:', err);
    }
  }

  private async handlePlayAlbum(e: CustomEvent<{ trackIds: string[]; startIndex: number }>) {
    if (!this.musicSpace) return;

    try {
      const { trackIds, startIndex } = e.detail;
      const track = await this.musicSpace.getTrack(trackIds[startIndex]);

      this.playbackService.setQueue(trackIds, startIndex);
      await this.playbackService.playTrack(track);
    } catch (err) {
      console.error('Failed to play album:', err);
    }
  }


  private handleOpenCreatePlaylist() {
    this.showCreatePlaylistModal = true;
  }

  private handleCloseCreatePlaylist() {
    this.showCreatePlaylistModal = false;
  }

  private async handleCreatePlaylist(e: CustomEvent<{ name: string; description?: string }>) {
    if (!this.playlistService) return;

    try {
      const playlist = await this.playlistService.createPlaylist(e.detail.name, e.detail.description);
      await this.loadPlaylists();
      this.showCreatePlaylistModal = false;

      // If there's a pending track to add, add it now
      if (this.pendingTrackForPlaylist) {
        await this.playlistService.addTracks(playlist.playlist_id, [this.pendingTrackForPlaylist]);
        await this.loadPlaylists();
        this.pendingTrackForPlaylist = null;
      }
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  }

  private async handleAddToPlaylist(e: CustomEvent<{ trackId: string; playlistId: string }>) {
    if (!this.playlistService) return;

    try {
      await this.playlistService.addTracks(e.detail.playlistId, [e.detail.trackId]);
      await this.loadPlaylists();
    } catch (err) {
      console.error('Failed to add track to playlist:', err);
    }
  }

  private pendingTrackForPlaylist: string | null = null;

  private handleCreatePlaylistWithTrack(e: CustomEvent<{ trackId: string }>) {
    this.pendingTrackForPlaylist = e.detail.trackId;
    this.showCreatePlaylistModal = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'music-app': MusicApp;
  }
}
