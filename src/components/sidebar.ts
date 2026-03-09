/**
 * Sidebar Component
 *
 * Navigation sidebar with library sections and playlists.
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PlaylistIndexEntry } from '@/types/index.js';

@customElement('app-sidebar')
export class Sidebar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: var(--spacing-md);
      box-sizing: border-box;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
    }

    .logo svg {
      width: 32px;
      height: 32px;
    }

    .logo-text {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--color-text-primary);
    }

    nav {
      flex: 1;
    }

    .nav-section {
      margin-bottom: var(--spacing-lg);
    }

    .nav-section-title {
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-subdued);
      padding: var(--spacing-sm) var(--spacing-md);
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-sm);
      color: var(--color-text-secondary);
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .nav-item:hover {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .nav-item.active {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .nav-item svg {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    .divider {
      height: 1px;
      background-color: var(--color-bg-highlight);
      margin: var(--spacing-md) 0;
    }

    .playlists {
      flex: 1;
      overflow-y: auto;
    }

    .playlist-item {
      padding: var(--spacing-xs) var(--spacing-md);
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      border-radius: var(--radius-sm);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .playlist-item:hover {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .playlist-item.active {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .nav-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-right: var(--spacing-sm);
    }

    .create-playlist-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      color: var(--color-text-subdued);
      cursor: pointer;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    }

    .create-playlist-btn:hover {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .create-playlist-btn svg {
      width: 16px;
      height: 16px;
    }

    .empty-playlists {
      padding: var(--spacing-sm) var(--spacing-md);
      color: var(--color-text-subdued);
      font-size: var(--font-size-sm);
      font-style: italic;
    }

    .create-playlist-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .create-playlist-btn:disabled:hover {
      color: var(--color-text-subdued);
      background-color: transparent;
    }

    .offline-indicator {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: var(--font-size-xs);
      color: var(--color-warning);
    }

    .offline-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--color-warning);
      flex-shrink: 0;
    }

    .settings-area {
      position: relative;
      margin-top: auto;
      padding-top: var(--spacing-sm);
    }

    .settings-btn {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--color-text-subdued);
      font-family: inherit;
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .settings-btn:hover {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .settings-btn svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .settings-menu {
      position: absolute;
      bottom: calc(100% + 4px);
      left: var(--spacing-md);
      right: var(--spacing-md);
      background-color: var(--color-bg-elevated);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      overflow: hidden;
      z-index: 100;
    }

    .settings-menu-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      border: none;
      background: transparent;
      color: var(--color-text-secondary);
      font-family: inherit;
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
      text-align: left;
    }

    .settings-menu-item:hover {
      color: var(--color-text-primary);
      background-color: var(--color-bg-highlight);
    }

    .settings-menu-item svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
  `;

  @property({ type: String })
  currentView = 'library';

  @property({ type: String })
  currentPlaylistId = '';

  @property({ type: Boolean })
  offline = false;

  @property({ attribute: false })
  playlists: PlaylistIndexEntry[] = [];

  @state()
  private showSettings = false;

  render() {
    return html`
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="var(--color-accent)">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        <span class="logo-text">Music</span>
      </div>

      <nav>
        <div class="nav-section">
          <div
            class="nav-item ${this.currentView === 'library' ? 'active' : ''}"
            @click=${() => this.navigate('library')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <span>Library</span>
          </div>

          <div
            class="nav-item ${this.currentView === 'search' ? 'active' : ''}"
            @click=${() => this.navigate('search')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <span>Search</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="nav-section">
          <div class="nav-section-title">Your Library</div>
          <div class="nav-item" @click=${() => this.navigate('library', { tab: 'albums' })}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
            </svg>
            <span>Albums</span>
          </div>
          <div class="nav-item" @click=${() => this.navigate('library', { tab: 'artists' })}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span>Artists</span>
          </div>
          <div class="nav-item" @click=${() => this.navigate('library', { tab: 'songs' })}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <span>Songs</span>
          </div>
          <div
            class="nav-item ${this.currentView === 'popular' ? 'active' : ''}"
            @click=${() => this.navigate('popular')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
            </svg>
            <span>Most Played</span>
          </div>
          <div class="nav-item ${this.currentView === 'recent' ? 'active' : ''}" @click=${() => this.navigate('recent')}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
            <span>Recently Added</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="nav-section playlists">
          <div class="nav-section-header">
            <div class="nav-section-title">Playlists</div>
            <button
              class="create-playlist-btn"
              @click=${this.openCreatePlaylist}
              title="Create playlist"
              ?disabled=${this.offline}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
          </div>
          ${this.playlists.length === 0
            ? html`<div class="empty-playlists">No playlists yet</div>`
            : this.playlists.map(
                (p) => html`
                  <div
                    class="playlist-item ${this.currentView === 'playlist' && this.currentPlaylistId === p.playlist_id ? 'active' : ''}"
                    @click=${() => this.navigate('playlist', { id: p.playlist_id })}
                  >
                    ${p.name}
                  </div>
                `
              )}
        </div>
      </nav>

      <div class="settings-area">
        ${this.offline ? html`
          <div class="offline-indicator">
            <span class="offline-dot"></span>
            <span>Offline</span>
          </div>
        ` : ''}
        ${this.showSettings ? html`
          <div class="settings-menu">
            <button class="settings-menu-item" @click=${this.handleLogout}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
              Log out
            </button>
          </div>
        ` : ''}
        <button class="settings-btn" @click=${() => { this.showSettings = !this.showSettings; }}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
          Settings
        </button>
      </div>
    `;
  }

  private navigate(view: string, params?: Record<string, string>) {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { view, params },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleLogout() {
    this.showSettings = false;
    this.dispatchEvent(
      new CustomEvent('logout', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private openCreatePlaylist() {
    this.dispatchEvent(
      new CustomEvent('open-create-playlist', {
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-sidebar': Sidebar;
  }
}
