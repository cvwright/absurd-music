/**
 * Login View - Temporary Authentication
 *
 * Form for manually entering space credentials:
 * space ID, private key, symmetric root, and optional server URL.
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getPublicKeyAsync } from '@noble/ed25519';
import { decodeBase64 } from 'reeeductio';
import type { MusicSpaceConfig } from '@/services/music-space.js';

@customElement('login-view')
export class LoginView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      width: 100vw;
      background-color: var(--color-bg-primary);
    }

    .login-card {
      background-color: var(--color-bg-elevated);
      border-radius: var(--radius-lg);
      padding: var(--spacing-xl);
      width: 100%;
      max-width: 420px;
      box-shadow: var(--shadow-lg);
    }

    h1 {
      font-size: var(--font-size-xxl);
      margin-bottom: var(--spacing-lg);
      text-align: center;
    }

    label {
      display: block;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: var(--spacing-xs);
      font-weight: 600;
    }

    input {
      box-sizing: border-box;
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      background-color: var(--color-bg-highlight);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      color: var(--color-text-primary);
      margin-bottom: var(--spacing-md);
      outline: none;
      transition: border-color var(--transition-fast);
    }

    input:focus {
      border-color: var(--color-accent);
    }

    input::placeholder {
      color: var(--color-text-subdued);
    }

    .connect-btn {
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      background-color: var(--color-accent);
      color: #000;
      font-weight: 700;
      border-radius: var(--radius-full);
      font-size: var(--font-size-lg);
      transition: background-color var(--transition-fast);
      margin-top: var(--spacing-sm);
    }

    .connect-btn:hover {
      background-color: var(--color-accent-hover);
    }

    .connect-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error {
      color: var(--color-error);
      font-size: var(--font-size-sm);
      margin-bottom: var(--spacing-md);
      text-align: center;
    }
  `;

  @state() private spaceId = '';
  @state() private privateKey = '';
  @state() private symmetricRoot = '';
  @state() private serverUrl = '';
  @state() private error = '';
  @state() private connecting = false;

  render() {
    return html`
      <div class="login-card">
        <h1>Connect to Space</h1>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}

        <label for="spaceId">Space ID</label>
        <input
          id="spaceId"
          type="text"
          .value=${this.spaceId}
          @input=${(e: Event) => this.spaceId = (e.target as HTMLInputElement).value}
          placeholder="Base64-encoded space ID"
        />

        <label for="privateKey">Private Key</label>
        <input
          id="privateKey"
          type="password"
          .value=${this.privateKey}
          @input=${(e: Event) => this.privateKey = (e.target as HTMLInputElement).value}
          placeholder="Base64-encoded Ed25519 private key"
        />

        <label for="symmetricRoot">Symmetric Root</label>
        <input
          id="symmetricRoot"
          type="password"
          .value=${this.symmetricRoot}
          @input=${(e: Event) => this.symmetricRoot = (e.target as HTMLInputElement).value}
          placeholder="Base64-encoded 32-byte symmetric key"
        />

        <label for="serverUrl">Server URL (optional)</label>
        <input
          id="serverUrl"
          type="text"
          .value=${this.serverUrl}
          @input=${(e: Event) => this.serverUrl = (e.target as HTMLInputElement).value}
          placeholder="http://localhost:8000"
        />

        <button
          class="connect-btn"
          ?disabled=${this.connecting}
          @click=${this.handleConnect}
        >
          ${this.connecting ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    `;
  }

  private async handleConnect() {
    this.error = '';
    this.connecting = true;

    try {
      const privateKeyBytes = decodeBase64(this.privateKey.trim());
      const publicKeyBytes = await getPublicKeyAsync(privateKeyBytes);
      const symmetricRootBytes = decodeBase64(this.symmetricRoot.trim());

      const config: MusicSpaceConfig = {
        spaceId: this.spaceId.trim(),
        keyPair: { privateKey: privateKeyBytes, publicKey: publicKeyBytes },
        symmetricRoot: symmetricRootBytes,
        ...(this.serverUrl.trim() && { baseUrl: this.serverUrl.trim() }),
      };

      this.dispatchEvent(new CustomEvent('login', {
        detail: config,
        bubbles: true,
        composed: true,
      }));
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Invalid credentials format';
      this.connecting = false;
    }
  }

  /** Called externally to report authentication failure. */
  showError(message: string) {
    this.error = message;
    this.connecting = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'login-view': LoginView;
  }
}
