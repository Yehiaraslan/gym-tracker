// ============================================================
// IMAGE STORE — Persist images to permanent app storage
//
// Native (iOS + Android) strategy:
//   1. If the picker returned base64 data directly → write it straight to disk
//   2. If the URI is a file:// → copyAsync (fast, always works)
//   3. If the URI is content:// (Android) → copyAsync first, fallback base64
//   4. If the URI is ph:// (iOS photo library) → resolve via MediaLibrary
//      getAssetInfoAsync to get a real file:// localUri, then copyAsync
//
// Web strategy:
//   expo-file-system's documentDirectory is null on web, so we convert the
//   blob/file URI to a base64 data-URL and return that directly. The caller
//   stores it in AsyncStorage as a data:image/…;base64,… string, which
//   survives page refreshes and is a valid <Image> source on web.
//
// IMPORTANT: Always request MEDIA_LIBRARY permission before calling this
// when dealing with ph:// URIs.
//
// v2 — adds debug logging + post-copy verification on every path
// ============================================================
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { photoDebug } from './photo-debug';

const WEB_IMAGE_PREFIX = '@img_store_';

// ── Web helpers ─────────────────────────────────────────────

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('FileReader did not return a string'));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function persistImageWeb(
  tempUri: string,
  folder: 'profile' | 'progress',
  filename?: string,
  base64?: string | null,
): Promise<string> {
  const name = filename ?? `${Date.now()}.jpg`;
  const key = `${WEB_IMAGE_PREFIX}${folder}_${name}`;

  let dataUrl: string;

  if (base64) {
    const mime = guessMimeFromExtension(tempUri);
    dataUrl = `data:${mime};base64,${base64}`;
  } else if (tempUri.startsWith('data:')) {
    dataUrl = tempUri;
  } else {
    dataUrl = await blobUrlToDataUrl(tempUri);
  }

  await AsyncStorage.setItem(key, dataUrl);
  photoDebug('persist-web', `Saved ${folder}/${name}`, { keyLen: dataUrl.length });
  return dataUrl;
}

// ── Verification helper ─────────────────────────────────────

/**
 * Verify a native file exists and is non-empty.
 * Returns { ok, size } — ok is false if file is missing or 0 bytes.
 */
async function verifyFile(uri: string): Promise<{ ok: boolean; size: number }> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return { ok: false, size: 0 };
    const size = (info as any).size ?? 0;
    return { ok: size > 0, size };
  } catch {
    return { ok: false, size: 0 };
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Copy a temporary image URI (from ImagePicker) to the app's permanent
 * document directory and return the permanent URI.
 *
 * @param tempUri  The temporary URI from ImagePicker (file://, ph://, content://, blob://)
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
  photoDebug('persist', `Start: folder=${folder} uri=${tempUri.slice(0, 120)}`, {
    hasBase64: !!base64,
    base64Len: base64 ? base64.length : 0,
    platform: Platform.OS,
  });

  // ── Web: use data-URL persistence ────────────────────────────────────────
  if (Platform.OS === 'web') {
    return persistImageWeb(tempUri, folder, filename, base64);
  }

  // ── Native: use file system ──────────────────────────────────────────────
  const dir = `${FileSystem.documentDirectory}images/${folder}/`;

  // Ensure directory exists
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    photoDebug('persist', `Created directory: ${dir}`);
  }

  const ext = getExtension(tempUri);
  const name = filename ?? `${Date.now()}.${ext}`;
  const destUri = `${dir}${name}`;

  // ── Path 1: Caller provided base64 directly (most reliable) ──────────────
  if (base64) {
    photoDebug('persist', 'Using base64 write path');
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const v = await verifyFile(destUri);
    photoDebug('persist', `Base64 write result: ok=${v.ok} size=${v.size}`, destUri);
    if (v.ok) return destUri;
    photoDebug('persist', '⚠ Base64 write produced empty file — falling through');
  }

  // ── Path 2: iOS ph:// URI — resolve via MediaLibrary ─────────────────────
  if (tempUri.startsWith('ph://')) {
    photoDebug('persist', 'ph:// URI detected');
    try {
      const MediaLibrary = require('expo-media-library');
      const assetId = tempUri.replace('ph://', '').split('/')[0];
      const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
      if (assetInfo?.localUri) {
        await FileSystem.copyAsync({ from: assetInfo.localUri, to: destUri });
        const v = await verifyFile(destUri);
        photoDebug('persist', `ph:// MediaLibrary copy: ok=${v.ok} size=${v.size}`);
        if (v.ok) return destUri;
      }
    } catch (e) {
      photoDebug('persist', `ph:// MediaLibrary failed: ${e}`);
    }

    // Fallback: read as base64
    try {
      const b64 = await FileSystem.readAsStringAsync(tempUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(destUri, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const v = await verifyFile(destUri);
      photoDebug('persist', `ph:// base64 fallback: ok=${v.ok} size=${v.size}`);
      if (v.ok) return destUri;
    } catch (e) {
      photoDebug('persist', `ph:// base64 fallback failed: ${e}`);
    }

    // Last resort: direct copy
    try {
      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      const v = await verifyFile(destUri);
      photoDebug('persist', `ph:// direct copy: ok=${v.ok} size=${v.size}`);
      if (v.ok) return destUri;
    } catch (e) {
      photoDebug('persist', `ph:// all paths failed: ${e}`);
      throw new Error(`Cannot persist ph:// URI: ${tempUri}`);
    }
  }

  // ── Path 3: Android content:// URI ───────────────────────────────────────
  if (tempUri.startsWith('content://')) {
    photoDebug('persist', 'content:// URI detected');

    // Try copyAsync first
    try {
      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      const v = await verifyFile(destUri);
      photoDebug('persist', `content:// copyAsync: ok=${v.ok} size=${v.size}`);
      if (v.ok) return destUri;
      photoDebug('persist', '⚠ content:// copyAsync produced empty file');
    } catch (e) {
      photoDebug('persist', `content:// copyAsync failed: ${e}`);
    }

    // Fallback: base64 read → write
    try {
      photoDebug('persist', 'content:// trying base64 round-trip');
      const b64 = await FileSystem.readAsStringAsync(tempUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      photoDebug('persist', `content:// base64 read OK, length=${b64.length}`);
      await FileSystem.writeAsStringAsync(destUri, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const v = await verifyFile(destUri);
      photoDebug('persist', `content:// base64 write: ok=${v.ok} size=${v.size}`);
      if (v.ok) return destUri;
      throw new Error('base64 round-trip produced empty file');
    } catch (e) {
      photoDebug('persist', `content:// all paths failed: ${e}`);
      throw e;
    }
  }

  // ── Path 4: Standard file:// or https:// URI ─────────────────────────────
  photoDebug('persist', `Standard URI copy: ${tempUri.slice(0, 100)}`);
  try {
    await FileSystem.copyAsync({ from: tempUri, to: destUri });
    const v = await verifyFile(destUri);
    photoDebug('persist', `copyAsync result: ok=${v.ok} size=${v.size}`);
    if (v.ok) return destUri;
    throw new Error('Copied file is empty or missing');
  } catch (e) {
    photoDebug('persist', `copyAsync failed, trying base64 round-trip: ${e}`);
    const b64 = await FileSystem.readAsStringAsync(tempUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(destUri, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const v = await verifyFile(destUri);
    photoDebug('persist', `base64 fallback result: ok=${v.ok} size=${v.size}`);
    if (!v.ok) throw new Error(`All persist strategies failed for ${tempUri}`);
    return destUri;
  }
}

/**
 * Delete a persisted image file from the permanent store.
 */
export async function deletePersistedImage(uri: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const allKeys = await AsyncStorage.getAllKeys();
      const imageKeys = allKeys.filter(k => k.startsWith(WEB_IMAGE_PREFIX));
      for (const key of imageKeys) {
        const stored = await AsyncStorage.getItem(key);
        if (stored === uri) {
          await AsyncStorage.removeItem(key);
          break;
        }
      }
      return;
    }

    if (!uri.startsWith('file://') && !uri.startsWith('/')) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      photoDebug('delete', `Deleted: ${uri}`);
    }
  } catch {
    // Ignore deletion errors
  }
}

/**
 * Check if a persisted image URI is still valid (file exists & non-empty).
 * Returns false for web data-URLs that are empty or broken.
 */
export async function isImageValid(uri: string): Promise<boolean> {
  if (!uri) return false;
  if (Platform.OS === 'web') {
    return uri.startsWith('data:') && uri.length > 100;
  }
  const v = await verifyFile(uri);
  return v.ok;
}

/** Extract file extension from a URI, defaulting to 'jpg' */
function getExtension(uri: string): string {
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

/** Guess MIME type from a URI's extension */
function guessMimeFromExtension(uri: string): string {
  const ext = getExtension(uri);
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
    bmp: 'image/bmp',
  };
  return map[ext] ?? 'image/jpeg';
}
