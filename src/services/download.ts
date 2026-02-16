/**
 * Download Helper
 *
 * Downloads a track's audio (and artwork) into the IndexedDB cache
 * for offline playback.
 */

import type { MusicSpaceService } from './music-space.js';
import type { CacheService } from './cache.js';

/**
 * Download a track for offline playback.
 *
 * Fetches the track metadata, downloads and decrypts the audio blob,
 * caches it in IndexedDB, and optionally caches the artwork.
 */
export async function downloadTrackForOffline(
  musicSpace: MusicSpaceService,
  cacheService: CacheService,
  trackId: string
): Promise<void> {
  if (cacheService.cachedTrackIds.has(trackId)) return;

  const track = await musicSpace.getTrack(trackId);

  const audioData = await musicSpace.downloadAudioBlob(
    track.audio_blob_id,
    track.encryption.key
  );

  await cacheService.cacheTrack(trackId, audioData, {
    title: track.title,
    artist_name: track.artist_name,
    album_name: track.album_name,
    duration_ms: track.duration_ms,
    file_format: track.file_format,
  });

  // Cache artwork if present
  if (track.artwork_blob_id && track.artwork_encryption?.key) {
    const hasArtwork = await cacheService.hasArtwork(track.artwork_blob_id);
    if (!hasArtwork) {
      const artworkData = await musicSpace.downloadArtworkBlob(
        track.artwork_blob_id,
        track.artwork_encryption.key
      );
      await cacheService.cacheArtwork(
        track.artwork_blob_id,
        artworkData,
        track.artwork_mime_type ?? 'image/jpeg'
      );
    }
  }
}
