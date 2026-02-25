/**
 * Login View - Temporary Authentication
 *
 * Form for manually entering space credentials:
 * space ID, private key, symmetric root, and optional server URL.
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getPublicKeyAsync } from '@noble/ed25519';
import { performOpaqueLogin } from 'reeeductio';
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

    .prefilled-value {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      font-family: monospace;
      word-break: break-all;
      margin-bottom: var(--spacing-md);
    }

    .error {
      color: var(--color-error);
      font-size: var(--font-size-sm);
      margin-bottom: var(--spacing-md);
      text-align: center;
    }
  `;

  @property() spaceId = '';
  @property({ type: Boolean }) spaceIdFromUrl = false;
  @state() private username = '';
  @state() private combinedKey = '';
  @state() private serverUrl = import.meta.env.VITE_DEFAULT_SERVER_URL ?? '';
  @state() private error = '';
  @state() private connecting = false;

  render() {
    return html`
      <div class="login-card">
        <h1>Connect to Space</h1>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}

        ${this.spaceIdFromUrl ? html`
          <label>Space</label>
          <div class="prefilled-value">${this.spaceId}</div>
        ` : html`
          <label for="spaceId">Space ID</label>
          <input
            id="spaceId"
            type="text"
            .value=${this.spaceId}
            @input=${(e: Event) => this.spaceId = (e.target as HTMLInputElement).value}
            placeholder="Base64-encoded space ID"
          />
        `}

        <label for="username">Username or User ID</label>
        <input
          id="username"
          type="text"
          .value=${this.username}
          @input=${(e: Event) => this.username = (e.target as HTMLInputElement).value}
          placeholder="Email, username, or reeeductio user ID"
          autocomplete="username"
        />

        <label for="combinedKey">Password or Secret Key</label>
        <input
          id="combinedKey"
          type="password"
          .value=${this.combinedKey}
          @input=${(e: Event) => this.combinedKey = (e.target as HTMLInputElement).value}
          placeholder="Password, or 128 hex characters (private key + symmetric root)"
          autocomplete="current-password"
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

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  /** Returns true if the inputs look like a direct raw-key login. */
  private isDirectKeyLogin(username: string, password: string): boolean {
    return /^U[A-Za-z0-9_-]{43}$/.test(username) && /^[0-9a-fA-F]{128}$/.test(password);
  }

  private async handleConnect() {
    this.error = '';
    this.connecting = true;

    try {
      const username = this.username.trim();
      const password = this.combinedKey.trim();
      const spaceId = this.spaceId.trim();
      const baseUrl = this.serverUrl.trim();

      let privateKeyBytes: Uint8Array;
      let symmetricRootBytes: Uint8Array;

      if (this.isDirectKeyLogin(username, password)) {
        // Direct key login: first 64 hex chars = private key, next 64 = symmetric root
        privateKeyBytes = this.hexToBytes(password.slice(0, 64));
        symmetricRootBytes = this.hexToBytes(password.slice(64));
      } else {
        // OPAQUE login: recover keys from username + password
        const creds = await performOpaqueLogin({
          fetchFn: fetch,
          baseUrl,
          spaceId,
          username,
          password,
        });
        privateKeyBytes = creds.privateKey;
        symmetricRootBytes = creds.symmetricRoot;
      }

      const publicKeyBytes = await getPublicKeyAsync(privateKeyBytes);

      // Request persistent storage so IndexedDB isn't evicted
      navigator.storage.persist();

      const config: MusicSpaceConfig = {
        spaceId,
        keyPair: { privateKey: privateKeyBytes, publicKey: publicKeyBytes },
        symmetricRoot: symmetricRootBytes,
        ...(baseUrl && { baseUrl }),
      };

      this.dispatchEvent(new CustomEvent('login', {
        detail: config,
        bubbles: true,
        composed: true,
      }));
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Invalid credentials';
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
