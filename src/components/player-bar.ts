/**
 * Player Bar Component
 *
 * Bottom player controls showing current track, playback controls,
 * and volume/queue controls.
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PlaybackService, PlaybackEvent } from '@/services/playback.js';
import type { Track } from '@/types/index.js';

@customElement('player-bar')
export class PlayerBar extends LitElement {
  static styles = css`
    :host {
      display: grid;
      grid-template-columns: 1fr 2fr 1fr;
      align-items: center;
      padding: 0 var(--spacing-md);
      height: 100%;
    }

    /* Now Playing Section */
    .now-playing {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      min-width: 180px;
    }

    .artwork {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-sm);
      background-color: var(--color-bg-highlight);
      flex-shrink: 0;
    }

    .artwork img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: var(--radius-sm);
    }

    .track-info {
      min-width: 0;
    }

    .track-title {
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .track-artist {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .track-artist:hover {
      color: var(--color-text-primary);
      text-decoration: underline;
      cursor: pointer;
    }

    /* Player Controls Section */
    .player-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .controls {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }

    .control-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-full);
      color: var(--color-text-secondary);
      transition: all var(--transition-fast);
    }

    .control-btn:hover {
      color: var(--color-text-primary);
      transform: scale(1.05);
    }

    .control-btn.active {
      color: var(--color-accent);
    }

    .control-btn svg {
      width: 16px;
      height: 16px;
    }

    .play-btn {
      width: 32px;
      height: 32px;
      background-color: var(--color-text-primary);
      color: var(--color-bg-primary);
    }

    .play-btn:hover {
      transform: scale(1.06);
      background-color: var(--color-text-primary);
    }

    .play-btn svg {
      width: 16px;
      height: 16px;
    }

    .play-btn svg.loading {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .play-btn:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    /* Progress Bar */
    .progress-container {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      width: 100%;
      max-width: 600px;
    }

    .time {
      font-size: var(--font-size-xs);
      color: var(--color-text-subdued);
      min-width: 40px;
      text-align: center;
    }

    .progress-bar {
      flex: 1;
      height: 4px;
      background-color: var(--color-bg-highlight);
      border-radius: var(--radius-full);
      cursor: pointer;
      position: relative;
    }

    .progress-bar:hover {
      height: 6px;
    }

    .progress-fill {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      background-color: var(--color-text-primary);
      border-radius: var(--radius-full);
      transition: width 0.1s linear;
    }

    .progress-bar:hover .progress-fill {
      background-color: var(--color-accent);
    }

    /* Volume & Extra Controls */
    .extra-controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--spacing-md);
    }

    .volume-control {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .volume-slider {
      width: 100px;
      height: 4px;
      background-color: var(--color-bg-highlight);
      border-radius: var(--radius-full);
      cursor: pointer;
      position: relative;
    }

    .volume-fill {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      background-color: var(--color-text-primary);
      border-radius: var(--radius-full);
    }

    /* Placeholder state */
    .placeholder {
      color: var(--color-text-subdued);
      font-size: var(--font-size-sm);
    }
  `;

  @property({ attribute: false })
  playbackService: PlaybackService | null = null;

  @state()
  private isPlaying = false;

  @state()
  private isLoading = false;

  @state()
  private currentTime = 0;

  @state()
  private duration = 0;

  @state()
  private volume = 80;

  @state()
  private shuffle = false;

  @state()
  private repeat: 'none' | 'all' | 'one' = 'none';

  @state()
  private currentTrack: Track | null = null;

  private unsubscribe: (() => void) | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.subscribeToPlayback();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  override updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('playbackService')) {
      this.unsubscribe?.();
      this.subscribeToPlayback();
    }
  }

  private subscribeToPlayback() {
    if (!this.playbackService) return;

    // Sync initial state
    this.volume = this.playbackService.getVolume() * 100;
    const queue = this.playbackService.getQueue();
    this.shuffle = queue.shuffle_enabled;
    this.repeat = queue.repeat_mode;
    this.currentTrack = this.playbackService.getCurrentTrack();
    if (this.currentTrack) {
      this.duration = this.currentTrack.duration_ms;
    }

    this.unsubscribe = this.playbackService.on((event: PlaybackEvent) => {
      this.handlePlaybackEvent(event);
    });
  }

  private handlePlaybackEvent(event: PlaybackEvent) {
    switch (event.type) {
      case 'play':
        this.isPlaying = true;
        this.isLoading = false;
        break;
      case 'pause':
        this.isPlaying = false;
        break;
      case 'loading':
        this.isLoading = true;
        break;
      case 'loaded':
        this.isLoading = false;
        this.currentTrack = this.playbackService?.getCurrentTrack() ?? null;
        if (this.currentTrack) {
          this.duration = this.currentTrack.duration_ms;
        }
        break;
      case 'timeupdate':
        this.currentTime = event.position_ms;
        break;
      case 'ended':
        this.isPlaying = false;
        break;
      case 'queuechange':
        this.shuffle = event.queue.shuffle_enabled;
        this.repeat = event.queue.repeat_mode;
        break;
      case 'error':
        this.isLoading = false;
        console.error('Playback error:', event.error);
        break;
    }
  }

  render() {
    return html`
      <!-- Now Playing -->
      <div class="now-playing">
        ${this.currentTrack
          ? html`
              <div class="artwork"></div>
              <div class="track-info">
                <div class="track-title">${this.currentTrack.title}</div>
                <div class="track-artist">${this.currentTrack.artist_name}</div>
              </div>
            `
          : html`<span class="placeholder">No track playing</span>`}
      </div>

      <!-- Player Controls -->
      <div class="player-controls">
        <div class="controls">
          <button
            class="control-btn ${this.shuffle ? 'active' : ''}"
            @click=${this.toggleShuffle}
            title="Shuffle"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
            </svg>
          </button>

          <button class="control-btn" @click=${this.previous} title="Previous">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          <button class="control-btn play-btn" @click=${this.togglePlay} ?disabled=${this.isLoading}>
            ${this.isLoading
              ? html`<svg viewBox="0 0 24 24" fill="currentColor" class="loading">
                  <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
                </svg>`
              : this.isPlaying
              ? html`<svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>`
              : html`<svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>`}
          </button>

          <button class="control-btn" @click=${this.next} title="Next">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>

          <button
            class="control-btn ${this.repeat !== 'none' ? 'active' : ''}"
            @click=${this.cycleRepeat}
            title="Repeat"
          >
            ${this.repeat === 'one'
              ? html`<svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/>
                </svg>`
              : html`<svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                </svg>`}
          </button>
        </div>

        <div class="progress-container">
          <span class="time">${this.formatTime(this.currentTime)}</span>
          <div class="progress-bar" @click=${this.handleSeek}>
            <div
              class="progress-fill"
              style="width: ${this.duration ? (this.currentTime / this.duration) * 100 : 0}%"
            ></div>
          </div>
          <span class="time">${this.formatTime(this.duration)}</span>
        </div>
      </div>

      <!-- Extra Controls -->
      <div class="extra-controls">
        <div class="volume-control">
          <button class="control-btn" @click=${this.toggleMute}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              ${this.volume === 0
                ? html`<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`
                : this.volume < 50
                ? html`<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>`
                : html`<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`}
            </svg>
          </button>
          <div class="volume-slider" @click=${this.handleVolumeChange}>
            <div class="volume-fill" style="width: ${this.volume}%"></div>
          </div>
        </div>

        <button class="control-btn" title="Queue">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
          </svg>
        </button>
      </div>
    `;
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private async togglePlay() {
    if (!this.playbackService) return;
    await this.playbackService.togglePlayPause();
  }

  private async previous() {
    if (!this.playbackService) return;
    await this.playbackService.previous();
  }

  private async next() {
    if (!this.playbackService) return;
    await this.playbackService.next();
  }

  private toggleShuffle() {
    if (!this.playbackService) return;
    this.playbackService.toggleShuffle();
  }

  private cycleRepeat() {
    if (!this.playbackService) return;
    this.playbackService.cycleRepeat();
  }

  private handleSeek(e: MouseEvent) {
    if (!this.playbackService) return;
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const positionMs = percentage * this.duration;
    this.playbackService.seek(positionMs);
  }

  private handleVolumeChange(e: MouseEvent) {
    if (!this.playbackService) return;
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    this.volume = Math.round(percentage * 100);
    this.playbackService.setVolume(percentage);
  }

  private toggleMute() {
    if (!this.playbackService) return;
    if (this.volume > 0) {
      this.playbackService.setVolume(0);
      this.volume = 0;
    } else {
      this.playbackService.setVolume(0.8);
      this.volume = 80;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'player-bar': PlayerBar;
  }
}
