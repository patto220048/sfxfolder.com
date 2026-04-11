import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';
import { convertToSlug } from './stringUtils';

/**
 * Upload a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} path - Storage path (e.g., "resources/sound-effects/whoosh.mp3")
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<string>} Download URL
 */
export async function uploadFile(file, path, onProgress = null) {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}

/**
 * Get download URL for a file
 * @param {string} path - Storage path
 * @returns {Promise<string>} Download URL
 */
export async function getFileUrl(path) {
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}

/**
 * Delete a file from Firebase Storage
 * @param {string} path - Storage path
 */
export async function deleteFile(path) {
  const storageRef = ref(storage, path);
  return deleteObject(storageRef);
}

/**
 * Generate storage path for a resource file
 * @param {string} category - Category slug
 * @param {string} filename - Original filename
 * @returns {string} Storage path
 */
export function generateStoragePath(category, filename) {
  const timestamp = Date.now();
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const ext = filename.includes(".") ? "." + filename.split(".").pop() : "";
  const safeBase = convertToSlug(nameWithoutExt);
  return `resources/${category}/${timestamp}-${safeBase}${ext}`;
}
