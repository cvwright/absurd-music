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

// Import child components
import './player-bar.js';
import './sidebar.js';
import './library-view.js';

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
  private currentView: View = 'library';

  @state()
  private viewParams: Record<string, string> = {};

  render() {
    return html`
      <aside class="sidebar">
        <app-sidebar
          .currentView=${this.currentView}
          @navigate=${this.handleNavigate}
        ></app-sidebar>
      </aside>

      <main class="main-content">
        ${this.renderView()}
      </main>

      <footer class="player-bar">
        <player-bar></player-bar>
      </footer>
    `;
  }

  private renderView() {
    switch (this.currentView) {
      case 'library':
        return html`<library-view></library-view>`;
      case 'album':
        return html`<div>Album view: ${this.viewParams.id}</div>`;
      case 'artist':
        return html`<div>Artist view: ${this.viewParams.id}</div>`;
      case 'playlist':
        return html`<div>Playlist view: ${this.viewParams.id}</div>`;
      case 'search':
        return html`<div>Search view</div>`;
      default:
        return html`<library-view></library-view>`;
    }
  }

  private handleNavigate(e: CustomEvent<{ view: View; params?: Record<string, string> }>) {
    this.currentView = e.detail.view;
    this.viewParams = e.detail.params ?? {};
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'music-app': MusicApp;
  }
}
