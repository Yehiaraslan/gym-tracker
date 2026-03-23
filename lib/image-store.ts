// ============================================================
// IMAGE STORE — Persist images to permanent app document directory
// Expo ImagePicker returns temporary cache URIs that are cleared
// on app restart. This utility copies them to the permanent
// documentDirectory so they survive across sessions.
// ============================================================
import * as FileSystem from 'expo-file-system/legacy';

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

  const ext = tempUri.split('.').pop()?.split('?')[0] ?? 'jpg';
  const name = filename ?? `${Date.now()}.${ext}`;
  const destUri = `${dir}${name}`;

  await FileSystem.copyAsync({ from: tempUri, to: destUri });
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
