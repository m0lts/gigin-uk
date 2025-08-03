import { storage } from '@lib/firebase';
import { deleteObject,
    listAll,
    ref,
    uploadBytes,
    getDownloadURL,
    uploadBytesResumable
} from 'firebase/storage';

/*** CREATE OPERATIONS ***/

/**
 * Uploads a single file to Firebase Storage and returns the download URL.
 * 
 * @param {File} file - The file to upload.
 * @param {string} path - The storage path (e.g., `musicians/{id}/profileImg/filename.png`).
 * @returns {Promise<string>} - Download URL of the uploaded file.
 */
export const uploadFileToStorage = async (file, path) => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

/**
 * Uploads an array of images and returns an array of all image URLs (existing + uploaded).
 *
 * @param {Array<string | File>} images - Mixed array of image URLs and new File objects.
 * @param {string} folderPath - Firebase storage path for uploads.
 * @returns {Promise<string[]>} - Array of all image URLs.
 */
export const uploadImageArrayWithFallback = async (images, folderPath) => {
  const urls = images.filter(img => typeof img === 'string');
  const files = images.filter(img => typeof img !== 'string');
  const uploadedUrls = await Promise.all(
    files.map(file => uploadFileToStorage(file, `${folderPath}/${file.name}`))
  );
  return [...urls, ...uploadedUrls];
};

/**
 * Generates a thumbnail image from a video file.
 * @param {File} file
 * @returns {Promise<File>}
 */
export const generateVideoThumbnail = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.addEventListener('loadeddata', () => {
      video.currentTime = 1;
    });
    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        const thumbnailFile = new File([blob], `${file.name}_thumbnail.png`, {
          type: 'image/png',
          lastModified: Date.now(),
        });
        resolve(thumbnailFile);
      }, 'image/png');
    });
  });
};

/**
 * Uploads videos and thumbnails to Firebase Storage.
 * @param {Array} mediaFiles - Each with `{ file, title, thumbnail }`
 * @param {string} musicianId
 * @param {string} folder
 * @param {Function} onProgress
 * @returns {Promise<Array<{ videoUrl, thumbnailUrl }>>}
 */
export const uploadVideosWithThumbnails = async (mediaFiles, musicianId, folder, onProgress) => {
  let totalTransferred = 0;
  const totalSize = mediaFiles.reduce((acc, media) => acc + media.file.size + (media.thumbnail?.size || 0), 0);

  const uploadOne = async ({ file, title, thumbnail }) => {
    let videoUrl = typeof file === 'string' ? file : await uploadAndTrack(file, `musicians/${musicianId}/${folder}/${title}`);
    let thumbnailUrl = typeof thumbnail === 'string' ? thumbnail : await uploadAndTrack(thumbnail, `musicians/${musicianId}/${folder}/thumbnails/${title}_thumbnail`);
    return { videoUrl, thumbnailUrl };
  };

  const uploadAndTrack = (file, path) => {
    return new Promise((resolve, reject) => {
      const fileRef = ref(storage, path);
      const task = uploadBytesResumable(fileRef, file);
      task.on(
        'state_changed',
        (snapshot) => {
          totalTransferred += snapshot.bytesTransferred;
          onProgress?.(Math.min((totalTransferred / totalSize) * 100, 100));
        },
        reject,
        async () => resolve(await getDownloadURL(fileRef))
      );
    });
  };

  return Promise.all(mediaFiles.map(uploadOne));
};

export const uploadFileWithProgress = (file, path, onProgress) => {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      reject,
      async () => {
        const downloadUrl = await getDownloadURL(task.snapshot.ref);
        resolve(downloadUrl);
      }
    );
  });
};

/**
 * Uploads track files to Firebase Storage and returns their download URLs.
 * @param {Array<{ file: File, title: string }>} mediaFiles
 * @param {string} musicianId
 * @param {string} folder
 * @param {Function} onProgress
 * @returns {Promise<string[]>}
 */
export const uploadTracks = async (mediaFiles, musicianId, folder, onProgress) => {
  let totalTransferred = 0;
  const totalSize = mediaFiles.reduce((acc, m) => acc + m.file.size, 0);

  const uploadOne = ({ file, title }) => {
    if (typeof file === 'string') return Promise.resolve(file);

    return new Promise((resolve, reject) => {
      const fileRef = ref(storage, `musicians/${musicianId}/${folder}/${title}`);
      const task = uploadBytesResumable(fileRef, file);
      task.on(
        'state_changed',
        (snapshot) => {
          totalTransferred += snapshot.bytesTransferred;
          onProgress?.(Math.min((totalTransferred / totalSize) * 100, 100));
        },
        reject,
        async () => resolve(await getDownloadURL(fileRef))
      );
    });
  };

  return Promise.all(mediaFiles.map(uploadOne));
};

/**
 * Uploads a profile picture to Firebase Storage and returns the download URL.
 * @param {File|string} picture - File object or existing string URL.
 * @param {string} musicianId
 * @returns {Promise<string>}
 */
export const uploadProfilePicture = async (picture, musicianId) => {
  if (typeof picture === 'string') return picture;
  const storageRef = ref(storage, `musicians/${musicianId}/profileImg/${picture.name}`);
  await uploadBytes(storageRef, picture);
  return getDownloadURL(storageRef);
};

/*** DELETE OPERATIONS ***/

/**
 * Deletes all files within a given folder path in Firebase Storage.
 *
 * @param {string} path - The storage path to the folder (e.g., "venues/venueId" or "musicians/musicianId").
 * @returns {Promise<void>}
 */
export const deleteFolderFromStorage = async (path) => {
    try {
      const folderRef = ref(storage, path);
      const snapshot = await listAll(folderRef);
      for (const file of snapshot.items) {
        await deleteObject(file);
      }
    } catch (error) {
      console.error(`Failed to delete storage folder at ${path}:`, error);
    }
  };


/**
 * Deletes a file from Firebase Cloud Storage given its public URL.
 * @param {string} fileUrl - The full download URL of the file to delete.
 * @returns {Promise<void>} Resolves when deletion is successful.
 */
export const deleteFileFromStorage = async (fileUrl) => {
  if (!fileUrl) throw new Error('No file URL provided');

  try {
    // Convert the public URL to a Storage path
    const { pathname } = new URL(fileUrl);
    const pathSegments = pathname.split('/o/')[1]; // everything after `/o/`
    const cleanPath = decodeURIComponent(pathSegments.split('?')[0]); // remove query string

    const fileRef = ref(storage, cleanPath);
    await deleteObject(fileRef);
  } catch (error) {
    console.error('Failed to parse or delete storage path:', error);
    throw error;
  }
};