import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistImage } from './image-store';

export interface ProgressPhoto {
  id: string;
  uri: string; // Local file path or base64
  date: string; // ISO date string
  notes?: string;
  category?: 'front' | 'side' | 'back' | 'other'; // Body angle
  createdAt: number;
}

export interface ProgressPhotoComparison {
  beforePhoto: ProgressPhoto;
  afterPhoto: ProgressPhoto;
  daysBetween: number;
}

const STORAGE_KEY = 'progress_photos';

/**
 * Add a new progress photo
 */
export async function addProgressPhoto(
  uri: string,
  notes?: string,
  category?: 'front' | 'side' | 'back' | 'other',
  base64?: string | null,
): Promise<ProgressPhoto> {
  try {
    const photos = await getProgressPhotos();

    // Persist image to permanent storage so it survives app restarts
    let permanentUri = uri;
    try {
      permanentUri = await persistImage(uri, 'progress', undefined, base64);
    } catch (e) {
      console.warn('[progress-photos] persistImage failed, using original URI:', e);
    }

    const newPhoto: ProgressPhoto = {
      id: `photo-${Date.now()}`,
      uri: permanentUri,
      date: new Date().toLocaleDateString('en-CA'),
      notes,
      category,
      createdAt: Date.now(),
    };

    photos.push(newPhoto);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(photos));

    return newPhoto;
  } catch (error) {
    console.error('Error adding progress photo:', error);
    throw error;
  }
}

/**
 * Get all progress photos
 */
export async function getProgressPhotos(): Promise<ProgressPhoto[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting progress photos:', error);
    return [];
  }
}

/**
 * Get progress photos by category
 */
export async function getProgressPhotosByCategory(
  category: 'front' | 'side' | 'back' | 'other'
): Promise<ProgressPhoto[]> {
  try {
    const photos = await getProgressPhotos();
    return photos.filter(p => p.category === category).sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    console.error('Error getting photos by category:', error);
    return [];
  }
}

/**
 * Delete a progress photo
 */
export async function deleteProgressPhoto(photoId: string): Promise<void> {
  try {
    const photos = await getProgressPhotos();
    const filtered = photos.filter(p => p.id !== photoId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting progress photo:', error);
    throw error;
  }
}

/**
 * Update progress photo notes
 */
export async function updateProgressPhotoNotes(
  photoId: string,
  notes: string
): Promise<ProgressPhoto | null> {
  try {
    const photos = await getProgressPhotos();
    const photo = photos.find(p => p.id === photoId);

    if (!photo) return null;

    photo.notes = notes;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(photos));

    return photo;
  } catch (error) {
    console.error('Error updating photo notes:', error);
    throw error;
  }
}

/**
 * Get progress photo comparisons (before/after pairs)
 */
export async function getProgressComparisons(
  category?: 'front' | 'side' | 'back' | 'other'
): Promise<ProgressPhotoComparison[]> {
  try {
    let photos = await getProgressPhotos();

    if (category) {
      photos = photos.filter(p => p.category === category);
    }

    // Sort by date
    photos.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const comparisons: ProgressPhotoComparison[] = [];

    // Create comparisons between consecutive photos
    for (let i = 0; i < photos.length - 1; i++) {
      const before = photos[i];
      const after = photos[i + 1];

      const beforeDate = new Date(before.date);
      const afterDate = new Date(after.date);
      const daysBetween = Math.floor(
        (afterDate.getTime() - beforeDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysBetween >= 7) {
        // Only create comparison if at least 7 days apart
        comparisons.push({
          beforePhoto: before,
          afterPhoto: after,
          daysBetween,
        });
      }
    }

    return comparisons;
  } catch (error) {
    console.error('Error getting progress comparisons:', error);
    return [];
  }
}

/**
 * Get progress timeline (all photos sorted by date)
 */
export async function getProgressTimeline(): Promise<ProgressPhoto[]> {
  try {
    const photos = await getProgressPhotos();
    return photos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error getting progress timeline:', error);
    return [];
  }
}

/**
 * Get progress statistics
 */
export async function getProgressStats() {
  try {
    const photos = await getProgressPhotos();
    const categories = new Map<string, number>();

    photos.forEach(photo => {
      const cat = photo.category || 'other';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });

    const oldestPhoto = photos.length > 0 ? photos[0] : null;
    const newestPhoto = photos.length > 0 ? photos[photos.length - 1] : null;

    const daysSinceFirst =
      oldestPhoto && newestPhoto
        ? Math.floor(
            (new Date(newestPhoto.date).getTime() - new Date(oldestPhoto.date).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

    return {
      totalPhotos: photos.length,
      categories: Object.fromEntries(categories),
      oldestPhoto,
      newestPhoto,
      daysSinceFirst,
      averagePhotosPerMonth: daysSinceFirst > 0 ? (photos.length / (daysSinceFirst / 30)).toFixed(1) : 0,
    };
  } catch (error) {
    console.error('Error getting progress stats:', error);
    return null;
  }
}
