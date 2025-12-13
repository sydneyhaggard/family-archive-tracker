import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../config/firebase';

/**
 * Custom hook for managing Related People in Firestore
 * Provides CRUD operations and real-time updates for the relatedPeople collection
 */
export function useRelatedPeople() {
  const [peopleList, setPeopleList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real-time listener for people owned by current user
  useEffect(() => {
    if (!auth.currentUser) {
      setPeopleList([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'relatedPeople'),
      where('ownerId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const people = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPeopleList(people);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching related people:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Add a new person to the collection
   * @param {Object} personData - { name, description?, birthDate?, birthLocation?, deathDate?, deathLocation?, marriageDate?, marriageLocation?, photoURL? }
   * @returns {Promise<string>} - ID of the created document
   */
  const addPerson = async ({ 
    name, 
    description = '', 
    birthDate = '', 
    birthLocation = '',
    deathDate = '',
    deathLocation = '',
    marriageDate = '',
    marriageLocation = '',
    photoURL = '' 
  }) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to add a person');
      }

      if (!name || !name.trim()) {
        throw new Error('Name is required');
      }

      const docRef = await addDoc(collection(db, 'relatedPeople'), {
        name: name.trim(),
        description: description.trim(),
        birthDate: birthDate,
        birthLocation: birthLocation?.trim() || '',
        deathDate: deathDate,
        deathLocation: deathLocation?.trim() || '',
        marriageDate: marriageDate,
        marriageLocation: marriageLocation?.trim() || '',
        photoURL: photoURL,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return docRef.id;
    } catch (err) {
      console.error('Error adding person:', err);
      throw err;
    }
  };

  /**
   * Update an existing person's details
   * @param {string} personId - Document ID of the person to update
   * @param {Object} newData - Object containing fields to update
   * @returns {Promise<void>}
   */
  const updatePerson = async (personId, newData) => {
    try {
      if (!personId) {
        throw new Error('Person ID is required');
      }

      const personRef = doc(db, 'relatedPeople', personId);
      
      // Verify ownership before updating
      const personDoc = await getDoc(personRef);
      if (!personDoc.exists()) {
        throw new Error('Person not found');
      }
      
      if (personDoc.data().ownerId !== auth.currentUser.uid) {
        throw new Error('Not authorized to update this person');
      }

      const updateData = {
        ...newData,
        updatedAt: serverTimestamp()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await updateDoc(personRef, updateData);
    } catch (err) {
      console.error('Error updating person:', err);
      throw err;
    }
  };

  /**
   * Delete a person from the collection
   * @param {string} personId - Document ID of the person to delete
   * @returns {Promise<void>}
   */
  const deletePerson = async (personId) => {
    try {
      if (!personId) {
        throw new Error('Person ID is required');
      }

      const personRef = doc(db, 'relatedPeople', personId);
      
      // Verify ownership before deleting
      const personDoc = await getDoc(personRef);
      if (!personDoc.exists()) {
        throw new Error('Person not found');
      }
      
      if (personDoc.data().ownerId !== auth.currentUser.uid) {
        throw new Error('Not authorized to delete this person');
      }

      await deleteDoc(personRef);
    } catch (err) {
      console.error('Error deleting person:', err);
      throw err;
    }
  };

  /**
   * Link people to an archive item by updating its relatedPeopleIds array
   * @param {string} itemId - Document ID of the archive item
   * @param {string[]} peopleIds - Array of person document IDs to link
   * @returns {Promise<void>}
   */
  const linkPeopleToItem = async (itemId, peopleIds) => {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      if (!Array.isArray(peopleIds)) {
        throw new Error('peopleIds must be an array');
      }

      const itemRef = doc(db, 'archiveItems', itemId);
      
      // Verify item exists and user owns it
      const itemDoc = await getDoc(itemRef);
      if (!itemDoc.exists()) {
        throw new Error('Archive item not found');
      }
      
      if (itemDoc.data().ownerId !== auth.currentUser.uid) {
        throw new Error('Not authorized to update this item');
      }

      // Update the relatedPeopleIds array
      await updateDoc(itemRef, {
        relatedPeopleIds: peopleIds,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error linking people to item:', err);
      throw err;
    }
  };

  /**
   * Add a person to an item's relatedPeopleIds array
   * @param {string} itemId - Document ID of the archive item
   * @param {string} personId - Person document ID to add
   * @returns {Promise<void>}
   */
  const addPersonToItem = async (itemId, personId) => {
    try {
      const itemRef = doc(db, 'archiveItems', itemId);
      await updateDoc(itemRef, {
        relatedPeopleIds: arrayUnion(personId),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error adding person to item:', err);
      throw err;
    }
  };

  /**
   * Remove a person from an item's relatedPeopleIds array
   * @param {string} itemId - Document ID of the archive item
   * @param {string} personId - Person document ID to remove
   * @returns {Promise<void>}
   */
  const removePersonFromItem = async (itemId, personId) => {
    try {
      const itemRef = doc(db, 'archiveItems', itemId);
      await updateDoc(itemRef, {
        relatedPeopleIds: arrayRemove(personId),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error removing person from item:', err);
      throw err;
    }
  };

  /**
   * Upload a profile photo for a person
   * @param {string} personId - Document ID of the person
   * @param {File} file - Image file to upload
   * @returns {Promise<string>} - Download URL of the uploaded photo
   */
  const uploadProfilePhoto = async (personId, file) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to upload a photo');
      }

      if (!personId) {
        throw new Error('Person ID is required');
      }

      if (!file) {
        throw new Error('File is required');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      // Validate file size (2MB max for profile photos)
      const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
      if (file.size > MAX_PHOTO_SIZE) {
        throw new Error('Profile photo must be less than 2MB');
      }

      // Create storage reference
      const fileExtension = file.name.split('.').pop();
      const storageRef = ref(storage, `users/${auth.currentUser.uid}/people/${personId}/photo.${fileExtension}`);

      // Upload file
      await uploadBytes(storageRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update person document with photo URL
      await updatePerson(personId, { photoURL: downloadURL });

      return downloadURL;
    } catch (err) {
      console.error('Error uploading profile photo:', err);
      throw err;
    }
  };

  /**
   * Delete a profile photo for a person
   * @param {string} personId - Document ID of the person
   * @param {string} photoURL - Current photo URL to delete (unused, kept for backward compatibility)
   * @returns {Promise<void>}
   */
  const deleteProfilePhoto = async (personId, photoURL) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to delete a photo');
      }

      if (!personId) {
        throw new Error('Person ID is required');
      }

      // Try to delete the file from storage
      // We construct the path based on our known storage structure
      // rather than trying to parse the download URL
      const possibleExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      
      for (const ext of possibleExtensions) {
        try {
          const storagePath = `users/${auth.currentUser.uid}/people/${personId}/photo.${ext}`;
          const storageRef = ref(storage, storagePath);
          await deleteObject(storageRef);
          // Successfully deleted, break the loop
          break;
        } catch (storageErr) {
          // File with this extension doesn't exist, try next
          continue;
        }
      }

      // Update person document to remove photo URL
      await updatePerson(personId, { photoURL: '' });
    } catch (err) {
      console.error('Error deleting profile photo:', err);
      throw err;
    }
  };

  return {
    peopleList,
    loading,
    error,
    addPerson,
    updatePerson,
    deletePerson,
    linkPeopleToItem,
    addPersonToItem,
    removePersonFromItem,
    uploadProfilePhoto,
    deleteProfilePhoto
  };
}
