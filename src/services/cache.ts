/**
 * Cache Service
 *
 * IndexedDB-based caching layer for decrypted audio files.
 * Provides LRU eviction when cache size limit is reached.
 */

import type { CachedTrack, CachedArtwork, CachedMetadata, CachePreferences } from '@/types/index.js';

const DB_NAME = 'music-player-cache';
const DB_VERSION = 3;
const TRACKS_STORE = 'tracks';
const ARTWORK_STORE = 'artwork';
const METADATA_STORE = 'metadata';

const DEFAULT_PREFERENCES: CachePreferences = {
  max_size_bytes: 2 * 1024 * 1024 * 1024, // 2GB
  max_age_days: 30,
  auto_prefetch: true,
  prefetch_count: 3,
};

/**
 * Service for caching decrypted audio files in IndexedDB.
 *
 * Features:
 * - Persistent storage across browser sessions
 * - LRU eviction when size limit reached
 * - Age-based pruning
 */
export class CacheService {
  private db: IDBDatabase | null = null;
  private preferences: CachePreferences;
  private currentSize = 0;

  /** In-memory set of cached track IDs for synchronous lookup by views. */
  readonly cachedTrackIds = new Set<string>();

  constructor(preferences?: Partial<CachePreferences>) {
    this.preferences = { ...DEFAULT_PREFERENCES, ...preferences };
  }

  private static readonly REQUIRED_STORES = [TRACKS_STORE, ARTWORK_STORE, METADATA_STORE];

  /**
   * Initialize the IndexedDB database.
   *
   * If the database is missing required stores (e.g. from a partial upgrade),
   * it is deleted and recreated from scratch.
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open cache database: ${request.error?.message}`));
      };

      request.onblocked = () => {
        console.warn('[cache] DB upgrade blocked by another connection — waiting');
      };

      request.onsuccess = () => {
        const db = request.result;

        // Handle version-change events from other tabs/contexts
        db.onversionchange = () => {
          db.close();
          this.db = null;
        };

        // Verify all required stores exist — handles corrupt DB state
        const missing = CacheService.REQUIRED_STORES.filter(
          (s) => !db.objectStoreNames.contains(s)
        );
        if (missing.length > 0) {
          console.warn('[cache] DB missing stores:', missing, '— deleting and recreating');
          db.close();
          const deleteReq = indexedDB.deleteDatabase(DB_NAME);
          deleteReq.onsuccess = () => {
            this.openFreshDb().then(resolve).catch(reject);
          };
          deleteReq.onerror = () => {
            reject(new Error('Failed to delete corrupt cache database'));
          };
          return;
        }

        this.db = db;
        this.calculateCurrentSize().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    });
  }

  /**
   * Open a fresh database (after deletion). Only called from init().
   */
  private async openFreshDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open cache database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
        };
        this.calculateCurrentSize().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    });
  }

  /**
   * Create all required object stores if they don't exist.
   */
  private createStores(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(TRACKS_STORE)) {
      const store = db.createObjectStore(TRACKS_STORE, { keyPath: 'trackId' });
      store.createIndex('cachedAt', 'cachedAt', { unique: false });
      store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      store.createIndex('size', 'size', { unique: false });
    }

    if (!db.objectStoreNames.contains(ARTWORK_STORE)) {
      const store = db.createObjectStore(ARTWORK_STORE, { keyPath: 'blobId' });
      store.createIndex('cachedAt', 'cachedAt', { unique: false });
      store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
    }

    if (!db.objectStoreNames.contains(METADATA_STORE)) {
      const store = db.createObjectStore(METADATA_STORE, { keyPath: 'path' });
      store.createIndex('cachedAt', 'cachedAt', { unique: false });
      store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
    }
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('Cache not initialized. Call init() first.');
    }
    return this.db;
  }

  /**
   * Calculate current cache size.
   */
  private async calculateCurrentSize(): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readonly');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.openCursor();

      let totalSize = 0;
      this.cachedTrackIds.clear();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const track = cursor.value as CachedTrack;
          totalSize += track.size;
          this.cachedTrackIds.add(track.trackId);
          cursor.continue();
        } else {
          this.currentSize = totalSize;
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a cached track by ID.
   */
  async getTrack(trackId: string): Promise<CachedTrack | null> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.get(trackId);

      request.onsuccess = () => {
        const track = request.result as CachedTrack | undefined;
        if (track) {
          // Update last accessed time
          track.lastAccessed = Date.now();
          store.put(track);
          resolve(track);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cache a track.
   */
  async cacheTrack(
    trackId: string,
    audioData: ArrayBuffer,
    metadata: CachedTrack['metadata']
  ): Promise<void> {
    const db = this.ensureDb();
    const size = audioData.byteLength;

    // Check if we need to evict
    if (this.currentSize + size > this.preferences.max_size_bytes) {
      await this.evictLRU(size);
    }

    const track: CachedTrack = {
      trackId,
      audioData,
      metadata,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
      size,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.put(track);

      request.onsuccess = () => {
        this.currentSize += size;
        this.cachedTrackIds.add(trackId);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove a track from cache.
   */
  async removeTrack(trackId: string): Promise<void> {
    const db = this.ensureDb();

    // Get size first
    const track = await this.getTrack(trackId);
    if (!track) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.delete(trackId);

      request.onsuccess = () => {
        this.currentSize -= track.size;
        this.cachedTrackIds.delete(trackId);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if a track is cached.
   */
  async hasTrack(trackId: string): Promise<boolean> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readonly');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.count(IDBKeyRange.only(trackId));

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Evict least recently used tracks to free up space.
   */
  private async evictLRU(neededSpace: number): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const index = store.index('lastAccessed');
      const request = index.openCursor();

      let freedSpace = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor && freedSpace < neededSpace) {
          const track = cursor.value as CachedTrack;
          freedSpace += track.size;
          this.currentSize -= track.size;
          this.cachedTrackIds.delete(track.trackId);
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Prune old entries based on max age.
   */
  async pruneOld(): Promise<number> {
    const db = this.ensureDb();
    const maxAge = this.preferences.max_age_days * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const index = store.index('cachedAt');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      let prunedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          const track = cursor.value as CachedTrack;
          this.currentSize -= track.size;
          this.cachedTrackIds.delete(track.trackId);
          cursor.delete();
          prunedCount++;
          cursor.continue();
        } else {
          resolve(prunedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cached tracks.
   */
  async clear(): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS_STORE, 'readwrite');
      const store = tx.objectStore(tx.objectStoreNames[0]);
      const request = store.clear();

      request.onsuccess = () => {
        this.currentSize = 0;
        this.cachedTrackIds.clear();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get current cache size in bytes.
   */
  getCurrentSize(): number {
    return this.currentSize;
  }

  /**
   * Get cache preferences.
   */
  getPreferences(): CachePreferences {
    return { ...this.preferences };
  }

  /**
   * Update cache preferences.
   */
  setPreferences(preferences: Partial<CachePreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
  }

  // ============================================================
  // Artwork Caching
  // ============================================================

  /**
   * Get cached artwork by blob ID.
   */
  async getArtwork(blobId: string): Promise<CachedArtwork | null> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(ARTWORK_STORE, 'readwrite');
      const store = tx.objectStore(ARTWORK_STORE);
      const request = store.get(blobId);

      request.onsuccess = () => {
        const artwork = request.result as CachedArtwork | undefined;
        if (artwork) {
          // Update last accessed time
          artwork.lastAccessed = Date.now();
          store.put(artwork);
          resolve(artwork);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cache artwork.
   */
  async cacheArtwork(
    blobId: string,
    imageData: ArrayBuffer,
    mimeType: string
  ): Promise<void> {
    const db = this.ensureDb();

    const artwork: CachedArtwork = {
      blobId,
      imageData,
      mimeType,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
      size: imageData.byteLength,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(ARTWORK_STORE, 'readwrite');
      const store = tx.objectStore(ARTWORK_STORE);
      const request = store.put(artwork);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if artwork is cached.
   */
  async hasArtwork(blobId: string): Promise<boolean> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(ARTWORK_STORE, 'readonly');
      const store = tx.objectStore(ARTWORK_STORE);
      const request = store.count(IDBKeyRange.only(blobId));

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cached artwork.
   */
  async clearArtwork(): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(ARTWORK_STORE, 'readwrite');
      const store = tx.objectStore(ARTWORK_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================================
  // Metadata Caching
  // ============================================================

  /**
   * Get cached metadata by storage path.
   */
  async getMetadata(path: string): Promise<string | null> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE, 'readwrite');
      const store = tx.objectStore(METADATA_STORE);
      const request = store.get(path);

      request.onsuccess = () => {
        const entry = request.result as CachedMetadata | undefined;
        if (entry) {
          entry.lastAccessed = Date.now();
          store.put(entry);
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cache metadata at a storage path.
   */
  async setMetadata(path: string, data: string): Promise<void> {
    const db = this.ensureDb();

    const entry: CachedMetadata = {
      path,
      data,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE, 'readwrite');
      const store = tx.objectStore(METADATA_STORE);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove cached metadata at a storage path.
   */
  async removeMetadata(path: string): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE, 'readwrite');
      const store = tx.objectStore(METADATA_STORE);
      const request = store.delete(path);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cached metadata.
   */
  async clearMetadata(): Promise<void> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE, 'readwrite');
      const store = tx.objectStore(METADATA_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
