// ============================================================
// IMAGE STORE — Persist images to permanent app document directory
//
// Strategy (most reliable across iOS + Android):
//   1. If the picker returned base64 data directly → write it straight to disk
//   2. If the URI is a file:// → copyAsync (fast, always works)
//   3. If the URI is content:// (Android) → base64 read → write
//   4. If the URI is ph:// (iOS photo library) → resolve via MediaLibrary
//      getAssetInfoAsync to get a real file:// localUri, then copyAsync
//
// IMPORTANT: Always request MEDIA_LIBRARY permission before calling this
// when dealing with ph:// URIs. The callers (profile.tsx, progress-gallery.tsx,
// progress-pictures.tsx) already do this via ImagePicker permission requests.
// ============================================================
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Copy a temporary image URI (from ImagePicker) to the app's permanent
 * document directory and return the permanent URI.
 *
 * @param tempUri  The temporary URI from ImagePicker (file://, ph://, content://)
 * @param folder   Sub-folder name, e.g. 'profile' or 'progress'
 * @param filename Optional filename; defaults to a timestamp-based name
 * @param base64   Optional base64 string (from ImagePicker base64 option) — fastest path
 */
export async function persistImage(
  tempUri: string,
  folder: 'profile' | 'progress',
  filename?: string,
  base64?: string | null,
): Promise<string> {
  const dir = `${FileSystem.documentDirectory}images/${folder}/`;

  // Ensure directory exists
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const ext = getExtension(tempUri);
  const name = filename ?? `${Date.now()}.${ext}`;
  const destUri = `${dir}${name}`;

  // ── Path 1: Caller provided base64 directly (most reliable) ──────────────
  if (base64) {
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return destUri;
  }

  // ── Path 2: iOS ph:// URI — resolve via MediaLibrary ─────────────────────
  if (tempUri.startsWith('ph://')) {
    try {
      // Dynamic import to avoid requiring the module on web
      const MediaLibrary = require('expo-media-library');
      // The asset ID is the part before the first '/' after 'ph://'
      const assetId = tempUri.replace('ph://', '').split('/')[0];
      const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
      if (assetInfo?.localUri) {
        await FileSystem.copyAsync({ from: assetInfo.localUri, to: destUri });
        const info = await FileSystem.getInfoAsync(destUri);
        if (info.exists && (info as any).size > 0) return destUri;
      }
    } catch (e) {
      console.warn('[image-store] MediaLibrary.getAssetInfoAsync failed for ph:// URI:', e);
    }

    // Fallback: read as base64 (works for some ph:// URIs in newer Expo SDK)
    try {
      const b64 = await FileSystem.readAsStringAsync(tempUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(destUri, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const info = await FileSystem.getInfoAsync(destUri);
      if (info.exists && (info as any).size > 0) return destUri;
    } catch (e) {
      console.warn('[image-store] base64 read of ph:// URI failed:', e);
    }

    // Last resort: direct copy (may fail but worth trying)
    try {
      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      return destUri;
    } catch (e) {
      console.error('[image-store] All strategies failed for ph:// URI:', e);
      throw new Error(`Cannot persist ph:// URI: ${tempUri}`);
    }
  }

  // ── Path 3: Android content:// URI ───────────────────────────────────────
  if (tempUri.startsWith('content://')) {
    // Try copyAsync first (works on most Android versions)
    try {
      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      const info = await FileSystem.getInfoAsync(destUri);
      if (info.exists && (info as any).size > 0) return destUri;
    } catch (_) {
      // Fall through to base64 approach
    }

    // Fallback: base64 read → write
    try {
      const b64 = await FileSystem.readAsStringAsync(tempUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(destUri, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return destUri;
    } catch (e) {
      console.error('[image-store] Failed to persist content:// URI:', e);
      throw e;
    }
  }

  // ── Path 4: Standard file:// or https:// URI ─────────────────────────────
  try {
    await FileSystem.copyAsync({ from: tempUri, to: destUri });
    // Verify the copy succeeded and file has content
    const info = await FileSystem.getInfoAsync(destUri);
    if (info.exists && (info as any).size > 0) return destUri;
    throw new Error('Copied file is empty');
  } catch (e) {
    console.warn('[image-store] copyAsync failed, trying base64 round-trip:', e);
    // Base64 round-trip fallback
    const b64 = await FileSystem.readAsStringAsync(tempUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(destUri, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return destUri;
  }
}

/**
 * Delete a persisted image file from the permanent store.
 */
export async function deletePersistedImage(uri: string): Promise<void> {
  try {
    // Only delete local file:// URIs — don't attempt to delete ph:// or content://
    if (!uri.startsWith('file://') && !uri.startsWith('/')) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Ignore deletion errors
  }
}

/** Extract file extension from a URI, defaulting to 'jpg' */
function getExtension(uri: string): string {
  // Remove query params and fragments
  const clean = uri.split('?')[0].split('#')[0];
  const parts = clean.split('.');
  if (parts.length > 1) {
    const ext = parts.pop()!.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp'].includes(ext)) {
      return ext;
    }
  }
  return 'jpg';
}
