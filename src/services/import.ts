/**
 * Import Service
 *
 * Handles file selection and metadata extraction for music import.
 */

import { parseBuffer } from 'music-metadata';
import type { ParsedTrackMetadata } from '@/types/index.js';

/** Supported audio MIME types */
const SUPPORTED_TYPES = [
  'audio/mpeg',      // MP3
  'audio/mp4',       // AAC/M4A
  'audio/x-m4a',     // M4A alternate
  'audio/aac',       // AAC
  'audio/flac',      // FLAC
  'audio/ogg',       // OGG Vorbis
  'audio/wav',       // WAV
  'audio/x-wav',     // WAV alternate
];

/** File extensions to accept in picker */
const ACCEPT_EXTENSIONS = '.mp3,.m4a,.aac,.flac,.ogg,.wav';

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
    // Check MIME type first
    if (SUPPORTED_TYPES.includes(file.type)) {
      return true;
    }
    // Fall back to extension check (some browsers report empty type)
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['mp3', 'm4a', 'aac', 'flac', 'ogg', 'wav'].includes(ext ?? '');
  }

  /**
   * Parses metadata from a single audio file.
   */
  async parseFile(file: File): Promise<ParsedTrackMetadata> {
    // Determine MIME type, fixing m4a files (some browsers report audio/x-m4a or empty)
    let mimeType = file.type || 'application/octet-stream';
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'm4a' && (!file.type || file.type === 'audio/x-m4a')) {
      console.log("Setting mime type to audio/mp4");
      mimeType = 'audio/mp4';
    }

    // Read file and parse with explicit MIME type
    const buffer = new Uint8Array(await file.arrayBuffer());
    const metadata = await parseBuffer(buffer, mimeType);
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
      genre: common.genre?.[0],
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
    return Promise.all(files.map((f) => this.parseFile(f)));
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
}

/** Singleton instance */
export const ImportService = new ImportServiceImpl();
