import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@lib/firebase';

/**
 * Creates a new artist CRM entry in the user's artistCRM subcollection
 * @param {string} userId - The user's UID
 * @param {Object} data - The CRM entry data
 * @param {string} [data.artistId] - The artist profile ID (null for artists not on Gigin)
 * @param {string} data.name - Artist name (required)
 * @param {string} [data.notes] - Notes about the artist
 * @param {string} [data.email] - Contact email
 * @param {string} [data.phone] - Contact phone
 * @param {string[]} [data.tags] - Custom tags
 * @returns {Promise<string>} - The document ID of the created entry
 */
export const createArtistCRMEntry = async (userId, data) => {
  if (!userId) throw new Error('[createArtistCRMEntry] userId is required');
  if (!data.name || !data.name.trim()) {
    throw new Error('[createArtistCRMEntry] name is required');
  }

  const crmRef = collection(firestore, 'users', userId, 'artistCRM');
  const docRef = doc(crmRef);
  
  const entryData = {
    artistId: data.artistId || null,
    name: data.name.trim(),
    notes: data.notes || '',
    email: data.email || null,
    phone: data.phone || null,
    instagram: data.instagram || null,
    facebook: data.facebook || null,
    other: data.other || null,
    tags: data.tags || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, entryData);
  return docRef.id;
};

/**
 * Updates an existing artist CRM entry
 * @param {string} userId - The user's UID
 * @param {string} entryId - The CRM entry document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateArtistCRMEntry = async (userId, entryId, updates) => {
  if (!userId) throw new Error('[updateArtistCRMEntry] userId is required');
  if (!entryId) throw new Error('[updateArtistCRMEntry] entryId is required');

  const entryRef = doc(firestore, 'users', userId, 'artistCRM', entryId);
  
  // Clean up updates - remove undefined values and trim strings
  const cleanedUpdates = {};
  if (updates.name !== undefined) cleanedUpdates.name = updates.name.trim();
  if (updates.notes !== undefined) cleanedUpdates.notes = updates.notes || '';
  if (updates.email !== undefined) cleanedUpdates.email = updates.email || null;
  if (updates.phone !== undefined) cleanedUpdates.phone = updates.phone || null;
  if (updates.instagram !== undefined) cleanedUpdates.instagram = updates.instagram || null;
  if (updates.facebook !== undefined) cleanedUpdates.facebook = updates.facebook || null;
  if (updates.other !== undefined) cleanedUpdates.other = updates.other || null;
  if (updates.tags !== undefined) cleanedUpdates.tags = updates.tags || [];
  if (updates.artistId !== undefined) cleanedUpdates.artistId = updates.artistId || null;
  
  cleanedUpdates.updatedAt = serverTimestamp();

  await updateDoc(entryRef, cleanedUpdates);
};

/**
 * Deletes an artist CRM entry
 * @param {string} userId - The user's UID
 * @param {string} entryId - The CRM entry document ID
 * @returns {Promise<void>}
 */
export const deleteArtistCRMEntry = async (userId, entryId) => {
  if (!userId) throw new Error('[deleteArtistCRMEntry] userId is required');
  if (!entryId) throw new Error('[deleteArtistCRMEntry] entryId is required');

  const entryRef = doc(firestore, 'users', userId, 'artistCRM', entryId);
  await deleteDoc(entryRef);
};

/**
 * Fetches all artist CRM entries for a user
 * @param {string} userId - The user's UID
 * @returns {Promise<Array>} - Array of CRM entries with id field
 */
export const getArtistCRMEntries = async (userId) => {
  if (!userId) throw new Error('[getArtistCRMEntries] userId is required');

  const crmRef = collection(firestore, 'users', userId, 'artistCRM');
  const q = query(crmRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * Fetches a single artist CRM entry
 * @param {string} userId - The user's UID
 * @param {string} entryId - The CRM entry document ID
 * @returns {Promise<Object|null>} - The CRM entry or null if not found
 */
export const getArtistCRMEntry = async (userId, entryId) => {
  if (!userId) throw new Error('[getArtistCRMEntry] userId is required');
  if (!entryId) throw new Error('[getArtistCRMEntry] entryId is required');

  const entryRef = doc(firestore, 'users', userId, 'artistCRM', entryId);
  const snapshot = await getDoc(entryRef);
  
  if (!snapshot.exists()) return null;
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

/**
 * Migrates existing savedArtists array to artistCRM subcollection
 * Creates CRM entries for artists that don't already exist in CRM
 * @param {string} userId - The user's UID
 * @param {string[]} savedArtistIds - Array of saved artist profile IDs
 * @param {Function} getArtistProfileById - Function to fetch artist profile data
 * @returns {Promise<number>} - Number of entries created
 */
export const migrateSavedArtistsToCRM = async (userId, savedArtistIds, getArtistProfileById) => {
  if (!userId) throw new Error('[migrateSavedArtistsToCRM] userId is required');
  if (!Array.isArray(savedArtistIds) || savedArtistIds.length === 0) {
    return 0;
  }

  // Get existing CRM entries to avoid duplicates
  const existingEntries = await getArtistCRMEntries(userId);
  const existingArtistIds = new Set(
    existingEntries
      .map(entry => entry.artistId)
      .filter(Boolean)
  );

  let created = 0;
  
  // Process each saved artist
  for (const artistId of savedArtistIds) {
    // Skip if already in CRM
    if (existingArtistIds.has(artistId)) continue;

    try {
      // Try to fetch artist profile to get name
      const artistProfile = await getArtistProfileById(artistId);
      const artistName = artistProfile?.name || 'Unknown Artist';
      
      // Create CRM entry
      await createArtistCRMEntry(userId, {
        artistId,
        name: artistName,
        notes: '',
      });
      
      created++;
    } catch (error) {
      console.error(`[migrateSavedArtistsToCRM] Failed to migrate artist ${artistId}:`, error);
      // Still create entry with unknown name
      try {
        await createArtistCRMEntry(userId, {
          artistId,
          name: 'Unknown Artist',
          notes: '',
        });
        created++;
      } catch (createError) {
        console.error(`[migrateSavedArtistsToCRM] Failed to create entry for ${artistId}:`, createError);
      }
    }
  }

  return created;
};

/**
 * Checks if an artist is saved in the user's CRM
 * @param {string} userId - The user's UID
 * @param {string} artistId - The artist profile ID to check
 * @returns {Promise<boolean>} - True if artist is saved in CRM
 */
export const isArtistSavedInCRM = async (userId, artistId) => {
  if (!userId || !artistId) return false;
  
  try {
    const entries = await getArtistCRMEntries(userId);
    return entries.some(entry => entry.artistId === artistId);
  } catch (error) {
    console.error('[isArtistSavedInCRM] Error checking if artist is saved:', error);
    return false;
  }
};

/**
 * Gets a CRM entry by artistId
 * @param {string} userId - The user's UID
 * @param {string} artistId - The artist profile ID
 * @returns {Promise<Object|null>} - The CRM entry or null if not found
 */
export const getArtistCRMEntryByArtistId = async (userId, artistId) => {
  if (!userId || !artistId) return null;
  
  try {
    const entries = await getArtistCRMEntries(userId);
    return entries.find(entry => entry.artistId === artistId) || null;
  } catch (error) {
    console.error('[getArtistCRMEntryByArtistId] Error fetching CRM entry:', error);
    return null;
  }
};

/**
 * Removes an artist from CRM by artistId (for Gigin artists)
 * Note: This only removes entries that have an artistId matching the provided ID
 * Non-Gigin artists (without artistId) are not affected
 * @param {string} userId - The user's UID
 * @param {string} artistId - The artist profile ID to remove
 * @returns {Promise<boolean>} - True if entry was found and deleted
 */
export const removeArtistFromCRMByArtistId = async (userId, artistId) => {
  if (!userId || !artistId) return false;
  
  try {
    const entries = await getArtistCRMEntries(userId);
    const entryToDelete = entries.find(entry => entry.artistId === artistId);
    
    if (entryToDelete) {
      await deleteArtistCRMEntry(userId, entryToDelete.id);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[removeArtistFromCRMByArtistId] Error removing artist from CRM:', error);
    return false;
  }
};
