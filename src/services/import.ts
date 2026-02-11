/**
 * Import Service
 *
 * Handles file selection and metadata extraction for music import.
 */

import { parseBuffer } from 'music-metadata';
import type {
  ParsedTrackMetadata,
  Track,
  Album,
  Artist,
  SearchIndex,
} from '@/types/index.js';
import type { MusicSpaceService } from './music-space.js';

/** Supported audio MIME types */
const SUPPORTED_TYPES = [
  'audio/mpeg',             // MP3
  'audio/mp4',              // AAC/M4A
  'audio/x-m4a',            // M4A alternate
  'audio/aac',              // AAC
  'audio/flac',             // FLAC
  'audio/ogg',              // OGG Vorbis
  'audio/wav',              // WAV
  'audio/x-wav',            // WAV alternate
  'audio/ogg; codecs=opus', // Opus
];

/** File extensions to accept in picker */
const ACCEPT_EXTENSIONS = '.mp3,.m4a,.aac,.flac,.ogg,.wav,.opus';

/** iTunes Search API endpoint */
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

/** Desired artwork size (iTunes supports up to 10000x10000) */
const ARTWORK_SIZE = 600;

/**
 * Import service for selecting and parsing audio files.
 */
class ImportServiceImpl {
  /**
   * Opens a file picker for selecting audio files.
   * @returns Array of selected files, or empty array if cancelled
   */
  async selectFiles(): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = ACCEPT_EXTENSIONS;

      input.addEventListener('change', () => {
        const files = Array.from(input.files ?? []);
        resolve(files.filter((f) => this.isSupportedType(f)));
      });

      // Handle cancel (no 'cancel' event, so we detect blur + no files)
      input.addEventListener('cancel', () => resolve([]));

      input.click();
    });
  }

  /**
   * Checks if a file has a supported audio MIME type.
   */
  private isSupportedType(file: File): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase();

    // Explicitly reject iTunes protected files
    if (ext == "m4p") {
      return false;
    }

    // Check MIME type before other extensions
    if (SUPPORTED_TYPES.includes(file.type)) {
      return true;
    }
    
    // Fall back to extension check (some browsers report empty type)
    return ACCEPT_EXTENSIONS.includes(ext ?? '');
  }

  /**
   * Parses metadata from a single audio file.
   */
  async parseFile(file: File): Promise<ParsedTrackMetadata | null> {
    // Determine MIME type, fixing m4a files (some browsers report audio/x-m4a or empty)
    let mimeType = file.type || 'application/octet-stream';
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'm4a' && (!file.type || file.type === 'audio/x-m4a')) {
      console.log("Setting mime type to audio/mp4");
      mimeType = 'audio/mp4';
    }
    // Filter out iTunes m4p
    if (ext === 'm4p') {
      console.log(`Skipping "${file.name}": can't parse iTunes m4p`);
      return null;
    }

    // Read file and parse with explicit MIME type
    const buffer = new Uint8Array(await file.arrayBuffer());
    let metadata;
    try {
      metadata = await parseBuffer(buffer, mimeType);
    } catch (e) {
      console.warn(`Skipping "${file.name}": failed to parse audio metadata`, e);
      return null;
    }
    const { common, format } = metadata;

    // Extract embedded artwork (first picture)
    let artwork: ParsedTrackMetadata['artwork'];
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      artwork = {
        data: new Uint8Array(pic.data),
        mimeType: pic.format,
      };
    }

    return {
      file,
      title: common.title ?? this.titleFromFilename(file.name),
      artist: common.artist,
      album: common.album,
      year: common.year,
      trackNumber: common.track.no ?? undefined,
      trackTotal: common.track.of ?? undefined,
      discNumber: common.disk.no ?? undefined,
      discTotal: common.disk.of ?? undefined,
      genres: common.genre ?? [],
      durationMs: format.duration ? Math.round(format.duration * 1000) : undefined,
      bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : undefined,
      format: this.normalizeFormat(format.container, file.name),
      artwork,
    };
  }

  /**
   * Parses metadata from multiple files.
   * Returns results in the same order as input.
   */
  async parseFiles(files: File[]): Promise<ParsedTrackMetadata[]> {
    const results = await Promise.all(files.map((f) => this.parseFile(f)));
    return results.filter((r): r is ParsedTrackMetadata => r !== null);
  }

  /**
   * Extracts a title from filename (removes extension).
   */
  private titleFromFilename(filename: string): string {
    return filename.replace(/\.[^.]+$/, '');
  }

  /**
   * Normalizes container format to standard extension.
   */
  private normalizeFormat(container?: string, filename?: string): string {
    if (container) {
      const lower = container.toLowerCase();
      if (lower === 'mpeg' || lower === 'mp3') return 'mp3';
      if (lower === 'mp4' || lower === 'm4a') return 'm4a';
      if (lower === 'flac') return 'flac';
      if (lower === 'ogg') return 'ogg';
      if (lower === 'wave' || lower === 'wav') return 'wav';
      return lower;
    }
    // Fall back to file extension
    return filename?.split('.').pop()?.toLowerCase() ?? 'unknown';
  }

  /**
   * Check if a track already exists in the library with the same content.
   *
   * Matches on normalized artist, title, and album, with duration within 5s.
   * Returns matches (which may differ in file format, bitrate, etc.)
   * or an empty array if no duplicates found.
   *
   * @param metadata - Parsed metadata from parseFile()
   * @param space - Authenticated MusicSpaceService instance
   * @returns Matching search index entries, empty if no duplicates
   */
  async checkForDuplicates(
    metadata: ParsedTrackMetadata,
    space: MusicSpaceService
  ): Promise<SearchIndex['tracks']> {
    const artist = (metadata.artist ?? 'Unknown Artist').trim().toLowerCase();
    const title = metadata.title.trim().toLowerCase();
    const album = (metadata.album ?? 'Unknown Album').trim().toLowerCase();
    const durationMs = metadata.durationMs ?? 0;

    let index: SearchIndex;
    try {
      index = await space.getSearchIndex();
    } catch {
      return [];
    }

    return index.tracks.filter(t =>
      t.artist.trim().toLowerCase() === artist &&
      t.title.trim().toLowerCase() === title &&
      t.album.trim().toLowerCase() === album &&
      Math.abs(t.duration_ms - durationMs) < 5000
    );
  }

  /**
   * Import a parsed track into the music space.
   *
   * This method:
   * 1. Generates deterministic IDs for track, artist, and album
   * 2. Encrypts and uploads audio blob
   * 3. Encrypts and uploads artwork blob (if present)
   * 4. Creates/updates Artist, Album, and Track records
   * 5. Updates the search index
   *
   * @param metadata - Parsed metadata from parseFile()
   * @param space - Authenticated MusicSpaceService instance
   * @returns The created Track record
   */
  async importTrack(metadata: ParsedTrackMetadata, space: MusicSpaceService): Promise<Track> {
    const artistName = metadata.artist ?? 'Unknown Artist';
    const albumName = metadata.album ?? 'Unknown Album';

    console.log("Importing track", artistName, "-", metadata.title);

    // Generate deterministic IDs
    const audioBytes = await metadata.file.arrayBuffer();
    console.log("Audio file is", audioBytes.byteLength, "bytes");

    const [trackId, artistId, albumId] = await Promise.all([
      space.generateTrackId(audioBytes),
      space.generateArtistId(artistName),
      space.generateAlbumId(artistName, albumName),
    ]);

    // Upload audio blob (encrypted)
    console.log("Uploading audio blob...");
    const { blobId: audioBlobId, encryptionKey: audioKey } =
      await space.uploadAudioBlob(audioBytes);
    console.log("Audio blob uploaded successfully");

    // Upload artwork blob if present
    let artworkBlobId: string | undefined;
    let artworkKey: string | undefined;
    let artworkMimeType: string | undefined;
    if (metadata.artwork) {
      // Copy to new ArrayBuffer to handle SharedArrayBuffer and offset cases
      const artworkBuffer = new Uint8Array(metadata.artwork.data).buffer as ArrayBuffer;
      console.log("Uploading", artworkBuffer.byteLength, "bytes of artwork blob");
      const result = await space.uploadArtworkBlob(artworkBuffer);
      console.log("Artwork blob uploaded successfully");
      artworkBlobId = result.blobId;
      artworkKey = result.encryptionKey;
      artworkMimeType = metadata.artwork.mimeType;
    } else {
      console.log("No artwork to upload");
    }

    // Create track record
    const track: Track = {
      track_id: trackId,
      title: metadata.title,
      artist_name: artistName,
      album_name: albumName,
      album_year: metadata.year,
      artist_id: artistId,
      album_id: albumId,
      audio_blob_id: audioBlobId,
      artwork_blob_id: artworkBlobId,
      artwork_mime_type: artworkMimeType,
      duration_ms: metadata.durationMs ?? 0,
      track_number: metadata.trackNumber,
      disc_number: metadata.discNumber,
      genres: metadata.genres,
      file_format: metadata.format ?? 'unknown',
      bitrate: metadata.bitrate,
      encryption: { method: 'file', key: audioKey },
      artwork_encryption: artworkKey ? { method: 'file', key: artworkKey } : undefined,
      added_at: Date.now(),
    };
    console.log("Generated track with id", trackId);

    // Fetch or create artist
    const artist = await this.getOrCreateArtist(space, artistId, artistName);
    console.log("Got artist with id =", artistId);
    if (!artist.album_ids.includes(albumId)) {
      artist.album_ids.push(albumId);
      await space.setArtist(artist);
    }

    // Fetch or create album
    const album = await this.getOrCreateAlbum(
      space,
      albumId,
      albumName,
      artistId,
      artistName,
      metadata.year,
      metadata.genres,
      artworkBlobId,
      artworkKey,
      artworkMimeType
    );
    console.log("Got album with id =", albumId);
    if (!album.track_ids.includes(trackId)) {
      album.track_ids.push(trackId);
      await space.setAlbum(album);
    }

    // If track has no artwork but album does (e.g., from iTunes), copy it to track
    if (!track.artwork_blob_id && album.artwork_blob_id) {
      track.artwork_blob_id = album.artwork_blob_id;
      track.artwork_mime_type = album.artwork_mime_type;
      track.artwork_encryption = album.artwork_encryption;
    }

    // Save track
    console.log("Saving track");
    await space.setTrack(track);
    console.log("Track saved successfully");

    // Update search index
    console.log("Updating search index");
    await this.updateSearchIndex(space, track);
    console.log("Search index updated successfully");

    return track;
  }

  /**
   * Get existing artist or create a new one.
   */
  private async getOrCreateArtist(
    space: MusicSpaceService,
    artistId: string,
    artistName: string
  ): Promise<Artist> {
    try {
      return await space.getArtist(artistId);
    } catch {
      // Artist doesn't exist, create new
      const artist: Artist = {
        artist_id: artistId,
        name: artistName,
        album_ids: [],
      };
      await space.setArtist(artist);
      return artist;
    }
  }

  /**
   * Get existing album or create a new one.
   * If no artwork is provided, attempts to fetch from iTunes.
   */
  private async getOrCreateAlbum(
    space: MusicSpaceService,
    albumId: string,
    albumName: string,
    artistId: string,
    artistName: string,
    year?: number,
    genres: string[] = [],
    artworkBlobId?: string,
    artworkKey?: string,
    artworkMimeType?: string
  ): Promise<Album> {
    try {
      const existing = await space.getAlbum(albumId);
      // Update artwork if this track has it and album doesn't
      if (artworkBlobId && !existing.artwork_blob_id) {
        existing.artwork_blob_id = artworkBlobId;
        existing.artwork_mime_type = artworkMimeType;
        existing.artwork_encryption = artworkKey ? { method: 'file', key: artworkKey } : undefined;
      }
      return existing;
    } catch {
      // Album doesn't exist, create new
      // Try to fetch artwork from iTunes if not provided
      if (!artworkBlobId && artistName !== 'Unknown Artist' && albumName !== 'Unknown Album') {
        console.log("Querying iTunes for", artistName, "-", albumName);
        const fetched = await this.fetchArtworkFromItunes(artistName, albumName, space);
        if (fetched) {
          console.log("Fetched artwork blob id =", fetched.blobId);
          artworkBlobId = fetched.blobId;
          artworkKey = fetched.encryptionKey;
          artworkMimeType = fetched.mimeType;
        } else {
          console.log("No iTunes match");
        }
      }

      const album: Album = {
        album_id: albumId,
        title: albumName,
        artist_id: artistId,
        artist_name: artistName,
        year,
        genres,
        artwork_blob_id: artworkBlobId,
        artwork_mime_type: artworkMimeType,
        artwork_encryption: artworkKey ? { method: 'file', key: artworkKey } : undefined,
        track_ids: [],
      };
      await space.setAlbum(album);
      return album;
    }
  }

  /**
   * Fetch album artwork from iTunes Search API.
   * Returns null if not found or on error.
   */
  async fetchArtworkFromItunes(
    artistName: string,
    albumName: string,
    space: MusicSpaceService
  ): Promise<{ blobId: string; encryptionKey: string; mimeType: string } | null> {
    try {
      // Search iTunes for the album
      const query = `${artistName} ${albumName}`;
      const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(query)}&entity=album&limit=5`;
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (!data.results || data.results.length === 0) {
        return null;
      }

      // Find best matching result (prefer exact album name match)
      const normalizedAlbum = albumName.toLowerCase();
      const match = data.results.find(
        (r: { collectionName?: string }) =>
          r.collectionName?.toLowerCase() === normalizedAlbum
      ) ?? data.results[0];

      // Get artwork URL and scale up to desired size
      const artworkUrl = match.artworkUrl100;
      if (!artworkUrl) {
        return null;
      }

      // iTunes URLs use "100x100" format, replace with larger size
      const highResUrl = artworkUrl.replace('100x100', `${ARTWORK_SIZE}x${ARTWORK_SIZE}`);

      // Fetch the artwork image
      const imageResponse = await fetch(highResUrl);
      if (!imageResponse.ok) {
        console.log("Failed to retrieve artwork from iTunes");
        return null;
      }

      const imageData = await imageResponse.arrayBuffer();
      const mimeType = imageResponse.headers.get('content-type') ?? 'image/jpeg';
      console.log("Received", imageData.byteLength, "bytes of artwork from iTunes, type:", mimeType);

      // Upload encrypted artwork
      const result = await space.uploadArtworkBlob(imageData);
      return { ...result, mimeType };
    } catch (err) {
      console.warn('Failed to fetch iTunes artwork:', err);
      return null;
    }
  }

  /**
   * Update the search index with a new track.
   */
  private async updateSearchIndex(space: MusicSpaceService, track: Track): Promise<void> {
    let index: SearchIndex;
    try {
      index = await space.getSearchIndex();
    } catch {
      // Index doesn't exist, create new
      index = { tracks: [], last_updated: 0 };
    }

    // Check if track already exists in index
    const existingIdx = index.tracks.findIndex((t) => t.id === track.track_id);
    const entry = {
      id: track.track_id,
      title: track.title,
      artist: track.artist_name,
      album: track.album_name,
      duration_ms: track.duration_ms,
    };

    if (existingIdx >= 0) {
      index.tracks[existingIdx] = entry;
    } else {
      index.tracks.push(entry);
    }

    index.last_updated = Date.now();
    await space.setSearchIndex(index);
  }
}

/** Singleton instance */
export const ImportService = new ImportServiceImpl();
