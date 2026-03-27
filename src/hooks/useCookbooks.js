import { useState, useEffect, useCallback } from 'react';
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
  getDoc,
  getDocs
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../config/firebase';

/**
 * Custom hook for managing Cookbooks in Firestore
 * Provides CRUD operations and real-time updates for the cookbooks collection
 */
export function useCookbooks() {
  const [cookbooks, setCookbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real-time listener for cookbooks owned by current user
  useEffect(() => {
    if (!auth.currentUser) {
      setCookbooks([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'cookbooks'),
      where('ownerId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const books = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort by createdAt descending
        books.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        setCookbooks(books);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching cookbooks:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Upload cover image to Firebase Storage
   * @param {string} cookbookId - ID of the cookbook
   * @param {File} file - Image file to upload
   * @returns {Promise<string>} - Download URL of the uploaded image
   */
  const uploadCoverImage = async (cookbookId, file) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to upload a cover image');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      const storagePath = `cookbooks/${cookbookId}/cover.jpg`;
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (err) {
      console.error('Error uploading cover image:', err);
      throw err;
    }
  };

  /**
   * Delete cover image from Firebase Storage
   * @param {string} cookbookId - ID of the cookbook
   * @returns {Promise<void>}
   */
  const deleteCoverImage = async (cookbookId) => {
    try {
      const storagePath = `cookbooks/${cookbookId}/cover.jpg`;
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      // Ignore error if file doesn't exist
      if (err.code !== 'storage/object-not-found') {
        console.error('Error deleting cover image:', err);
        throw err;
      }
    }
  };

  /**
   * Add a new cookbook to the collection
   * @param {Object} cookbookData - { title, author?, publicationDate?, description?, coverImageFile? }
   * @returns {Promise<string>} - ID of the created document
   */
  const addCookbook = async ({ 
    title, 
    author = '', 
    publicationDate = '', 
    description = '',
    coverImageFile = null
  }) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to add a cookbook');
      }

      if (!title || !title.trim()) {
        throw new Error('Title is required');
      }

      // Create the cookbook document first
      const docRef = await addDoc(collection(db, 'cookbooks'), {
        title: title.trim(),
        author: author.trim(),
        publicationDate: publicationDate,
        description: description.trim(),
        coverImageUrl: '',
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Upload cover image if provided
      if (coverImageFile) {
        const coverImageUrl = await uploadCoverImage(docRef.id, coverImageFile);
        await updateDoc(docRef, { coverImageUrl });
      }

      return docRef.id;
    } catch (err) {
      console.error('Error adding cookbook:', err);
      throw err;
    }
  };

  /**
   * Update an existing cookbook's details
   * @param {string} cookbookId - Document ID of the cookbook to update
   * @param {Object} newData - Object containing fields to update
   * @param {File} coverImageFile - Optional new cover image file
   * @returns {Promise<void>}
   */
  const updateCookbook = async (cookbookId, newData, coverImageFile = null) => {
    try {
      if (!cookbookId) {
        throw new Error('Cookbook ID is required');
      }

      const cookbookRef = doc(db, 'cookbooks', cookbookId);
      
      // Verify ownership before updating
      const cookbookDoc = await getDoc(cookbookRef);
      if (!cookbookDoc.exists()) {
        throw new Error('Cookbook not found');
      }
      
      if (cookbookDoc.data().ownerId !== auth.currentUser.uid) {
        throw new Error('Not authorized to update this cookbook');
      }

      const updateData = {
        ...newData,
        updatedAt: serverTimestamp()
      };

      // Upload new cover image if provided
      if (coverImageFile) {
        const coverImageUrl = await uploadCoverImage(cookbookId, coverImageFile);
        updateData.coverImageUrl = coverImageUrl;
      }

      await updateDoc(cookbookRef, updateData);
    } catch (err) {
      console.error('Error updating cookbook:', err);
      throw err;
    }
  };

  /**
   * Delete a cookbook and its cover image
   * @param {string} cookbookId - Document ID of the cookbook to delete
   * @returns {Promise<void>}
   */
  const deleteCookbook = async (cookbookId) => {
    try {
      if (!cookbookId) {
        throw new Error('Cookbook ID is required');
      }

      const cookbookRef = doc(db, 'cookbooks', cookbookId);
      
      // Verify ownership before deleting
      const cookbookDoc = await getDoc(cookbookRef);
      if (!cookbookDoc.exists()) {
        throw new Error('Cookbook not found');
      }
      
      if (cookbookDoc.data().ownerId !== auth.currentUser.uid) {
        throw new Error('Not authorized to delete this cookbook');
      }

      // Delete cover image from storage
      try {
        await deleteCoverImage(cookbookId);
      } catch (imgErr) {
        console.warn('Could not delete cover image:', imgErr);
      }

      // Delete all recipes associated with this cookbook
      const recipesQuery = query(
        collection(db, 'recipes'),
        where('cookbookId', '==', cookbookId)
      );
      const recipesSnapshot = await getDocs(recipesQuery);
      
      const deletePromises = recipesSnapshot.docs.map(recipeDoc => 
        deleteDoc(doc(db, 'recipes', recipeDoc.id))
      );
      await Promise.all(deletePromises);

      // Delete the cookbook document
      await deleteDoc(cookbookRef);
    } catch (err) {
      console.error('Error deleting cookbook:', err);
      throw err;
    }
  };

  /**
   * Get recipe count for a cookbook
   * @param {string} cookbookId - Document ID of the cookbook
   * @returns {Promise<number>} - Number of recipes in the cookbook
   */
  const getRecipeCount = useCallback(async (cookbookId) => {
    try {
      const recipesQuery = query(
        collection(db, 'recipes'),
        where('cookbookId', '==', cookbookId)
      );
      const snapshot = await getDocs(recipesQuery);
      return snapshot.size;
    } catch (err) {
      console.error('Error getting recipe count:', err);
      return 0;
    }
  }, []);

  return {
    cookbooks,
    loading,
    error,
    addCookbook,
    updateCookbook,
    deleteCookbook,
    getRecipeCount,
    uploadCoverImage
  };
}
