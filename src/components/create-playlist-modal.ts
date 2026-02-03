/**
 * Create Playlist Modal
 *
 * Modal dialog for creating a new playlist with name and optional description.
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('create-playlist-modal')
export class CreatePlaylistModal extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background-color: var(--color-bg-elevated);
      border-radius: var(--radius-lg);
      padding: var(--spacing-xl);
      width: 400px;
      max-width: 90vw;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    .modal-title {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-lg) 0;
    }

    .form-group {
      margin-bottom: var(--spacing-md);
    }

    .form-label {
      display: block;
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text-secondary);
      margin-bottom: var(--spacing-xs);
    }

    .form-input {
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      background-color: var(--color-bg-highlight);
      border: 1px solid var(--color-bg-highlight);
      border-radius: var(--radius-sm);
      color: var(--color-text-primary);
      font-size: var(--font-size-base);
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color var(--transition-fast);
    }

    .form-input:focus {
      outline: none;
      border-color: var(--color-accent);
    }

    .form-input::placeholder {
      color: var(--color-text-subdued);
    }

    textarea.form-input {
      resize: vertical;
      min-height: 80px;
    }

    .button-row {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-lg);
    }

    .btn {
      padding: var(--spacing-sm) var(--spacing-lg);
      border-radius: var(--radius-full);
      font-size: var(--font-size-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      border: none;
    }

    .btn-secondary {
      background-color: transparent;
      color: var(--color-text-primary);
    }

    .btn-secondary:hover {
      background-color: var(--color-bg-highlight);
    }

    .btn-primary {
      background-color: var(--color-accent);
      color: var(--color-text-on-accent);
    }

    .btn-primary:hover {
      transform: scale(1.02);
      filter: brightness(1.1);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      filter: none;
    }
  `;

  @property({ type: Boolean })
  open = false;

  @state()
  private name = '';

  @state()
  private description = '';

  render() {
    if (!this.open) return null;

    return html`
      <div class="overlay" @click=${this.handleOverlayClick}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <h2 class="modal-title">Create Playlist</h2>

          <div class="form-group">
            <label class="form-label" for="playlist-name">Name</label>
            <input
              id="playlist-name"
              class="form-input"
              type="text"
              placeholder="My Playlist"
              .value=${this.name}
              @input=${this.handleNameInput}
              @keydown=${this.handleKeyDown}
              autofocus
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="playlist-description">Description (optional)</label>
            <textarea
              id="playlist-description"
              class="form-input"
              placeholder="Add an optional description"
              .value=${this.description}
              @input=${this.handleDescriptionInput}
            ></textarea>
          </div>

          <div class="button-row">
            <button class="btn btn-secondary" @click=${this.handleCancel}>
              Cancel
            </button>
            <button
              class="btn btn-primary"
              ?disabled=${!this.name.trim()}
              @click=${this.handleCreate}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private handleOverlayClick() {
    this.handleCancel();
  }

  private handleNameInput(e: Event) {
    this.name = (e.target as HTMLInputElement).value;
  }

  private handleDescriptionInput(e: Event) {
    this.description = (e.target as HTMLTextAreaElement).value;
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && this.name.trim()) {
      this.handleCreate();
    } else if (e.key === 'Escape') {
      this.handleCancel();
    }
  }

  private handleCancel() {
    this.name = '';
    this.description = '';
    this.dispatchEvent(
      new CustomEvent('close', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleCreate() {
    if (!this.name.trim()) return;

    this.dispatchEvent(
      new CustomEvent('create', {
        detail: {
          name: this.name.trim(),
          description: this.description.trim() || undefined,
        },
        bubbles: true,
        composed: true,
      })
    );

    this.name = '';
    this.description = '';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'create-playlist-modal': CreatePlaylistModal;
  }
}
