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
import { loadCredentials, saveCredentials, clearCredentials } from '@/services/credentials.js';

import { setLogLevel } from 'reeeductio';
setLogLevel('debug');


// Import child components
import './player-bar.js';
import './sidebar.js';
import './library-view.js';
import './login-view.js';
import './album-view.js';
import './artist-view.js';

type View = 'library' | 'album' | 'artist' | 'playlist' | 'search';

@customElement('music-app')
export class MusicApp extends LitElement {
  static styles = css`
    :host {
      display: grid;
      grid-template-columns: var(--sidebar-width) 1fr;
      grid-template-rows: 1fr var(--player-height);
      height: 100vh;
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

    /* Responsive: collapse sidebar on small screens */
    @media (max-width: 768px) {
      :host {
        grid-template-columns: 1fr;
      }

      .sidebar {
        display: none;
      }
    }
  `;

  @state()
  private authenticated = false;

  private musicSpace: MusicSpaceService | null = null;
  private playbackService = new PlaybackService();
  private cacheService = new CacheService();

  @state()
  private currentView: View = 'library';

  @state()
  private viewParams: Record<string, string> = {};

  override connectedCallback() {
    super.connectedCallback();
    this.tryAutoLogin();
  }

  private async tryAutoLogin() {
    const savedConfig = await loadCredentials();
    if (savedConfig) {
      try {
        this.musicSpace = new MusicSpaceService(savedConfig);
        await this.musicSpace.authenticate();
        await this.initServices();
        this.authenticated = true;
      } catch {
        // Saved credentials failed, clear them and show login
        clearCredentials();
      }
    }
  }

  private async initServices() {
    if (!this.musicSpace) return;
    await this.cacheService.init();
    this.playbackService.init(this.musicSpace, this.cacheService);
  }

  render() {
    if (!this.authenticated) {
      return html`<login-view @login=${this.handleLogin}></login-view>`;
    }

    return html`
      <aside class="sidebar">
        <app-sidebar
          .currentView=${this.currentView}
          @navigate=${this.handleNavigate}
        ></app-sidebar>
      </aside>

      <main class="main-content" @play-track=${this.handlePlayTrack} @play-album=${this.handlePlayAlbum} @navigate=${this.handleNavigate}>
        ${this.renderView()}
      </main>

      <footer class="player-bar">
        <player-bar .playbackService=${this.playbackService}></player-bar>
      </footer>
    `;
  }

  private renderView() {
    switch (this.currentView) {
      case 'library':
        return html`<library-view .musicSpace=${this.musicSpace} .cacheService=${this.cacheService}></library-view>`;
      case 'album':
        return html`<album-view
          .albumId=${this.viewParams.id}
          .musicSpace=${this.musicSpace}
          .cacheService=${this.cacheService}
        ></album-view>`;
      case 'artist':
        return html`<artist-view
          .artistId=${this.viewParams.id}
          .musicSpace=${this.musicSpace}
          .cacheService=${this.cacheService}
        ></artist-view>`;
      case 'playlist':
        return html`<div>Playlist view: ${this.viewParams.id}</div>`;
      case 'search':
        return html`<div>Search view</div>`;
      default:
        return html`<library-view .musicSpace=${this.musicSpace} .cacheService=${this.cacheService}></library-view>`;
    }
  }

  private async handleLogin(e: CustomEvent<MusicSpaceConfig>) {
    try {
      this.musicSpace = new MusicSpaceService(e.detail);
      await this.musicSpace.authenticate();
      await this.initServices();
      saveCredentials(e.detail);
      this.authenticated = true;
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

  private async handlePlayTrack(e: CustomEvent<{ trackId: string }>) {
    if (!this.musicSpace) return;

    try {
      const track = await this.musicSpace.getTrack(e.detail.trackId);

      // Set queue from library and play the selected track
      const index = await this.musicSpace.getSearchIndex();
      const trackIds = index.tracks.map(t => t.id);
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
}

declare global {
  interface HTMLElementTagNameMap {
    'music-app': MusicApp;
  }
}
