// ============================================================
// IMAGE STORE — Persist images to permanent app document directory
// Expo ImagePicker returns temporary cache URIs that are cleared
// on app restart. This utility copies them to the permanent
// documentDirectory so they survive across sessions.
//
// Handles:
// - file:// URIs (standard temp files)
// - content:// URIs (Android media picker)
// - ph:// URIs (iOS photo library — need MediaLibrary.getAssetInfoAsync)
// ============================================================
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Copy a temporary image URI (from ImagePicker) to the app's permanent
 * document directory and return the permanent URI.
 *
 * @param tempUri  The temporary URI from ImagePicker
 * @param folder   Sub-folder name, e.g. 'profile' or 'progress'
 * @param filename Optional filename; defaults to a timestamp-based name
 */
export async function persistImage(
  tempUri: string,
  folder: 'profile' | 'progress',
  filename?: string
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

  // On iOS, ph:// URIs need special handling via MediaLibrary
  if (tempUri.startsWith('ph://')) {
    try {
      const MediaLibrary = require('expo-media-library');
      const assetId = tempUri.replace('ph://', '').split('/')[0];
      const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
      if (assetInfo?.localUri) {
        await FileSystem.copyAsync({ from: assetInfo.localUri, to: destUri });
        return destUri;
      }
    } catch (e) {
      console.warn('[image-store] Failed to resolve ph:// URI:', e);
    }
    // Fallback: try direct copy anyway
    await FileSystem.copyAsync({ from: tempUri, to: destUri });
    return destUri;
  }

  // On Android, content:// URIs from the picker can be read by FileSystem
  // but copyAsync may fail. Use downloadAsync as a reliable fallback.
  if (tempUri.startsWith('content://')) {
    try {
      // Try copyAsync first (works in most cases)
      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      // Verify the copy succeeded
      const info = await FileSystem.getInfoAsync(destUri);
      if (info.exists && (info as any).size > 0) {
        return destUri;
      }
    } catch (_) {
      // copyAsync failed — fall through to readAsStringAsync approach
    }

    // Fallback: read as base64 and write to destination
    try {
      const base64 = await FileSystem.readAsStringAsync(tempUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(destUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return destUri;
    } catch (e) {
      console.error('[image-store] Failed to persist content:// URI:', e);
      throw e;
    }
  }

  // Standard file:// or https:// URI — direct copy
  try {
    await FileSystem.copyAsync({ from: tempUri, to: destUri });
  } catch (e) {
    console.error('[image-store] copyAsync failed for URI:', tempUri, e);
    // Last resort: try base64 round-trip
    try {
      const base64 = await FileSystem.readAsStringAsync(tempUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(destUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (e2) {
      console.error('[image-store] base64 fallback also failed:', e2);
      throw e2;
    }
  }
  return destUri;
}

/**
 * Delete a persisted image file from the permanent store.
 */
export async function deletePersistedImage(uri: string): Promise<void> {
  try {
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
    // Only return known image extensions
    if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp'].includes(ext)) {
      return ext;
    }
  }
  return 'jpg';
}
