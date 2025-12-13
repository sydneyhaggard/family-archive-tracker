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
 * Custom hook for managing Recipes in Firestore
 * Provides CRUD operations and real-time updates for the recipes collection
 */
export function useRecipes(cookbookId = null) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real-time listener for recipes - either all user's recipes or filtered by cookbook
  useEffect(() => {
    if (!auth.currentUser) {
      setRecipes([]);
      setLoading(false);
      return;
    }

    let q;
    if (cookbookId) {
      // Get recipes for a specific cookbook
      q = query(
        collection(db, 'recipes'),
        where('cookbookId', '==', cookbookId),
        where('ownerId', '==', auth.currentUser.uid)
      );
    } else {
      // Get all recipes owned by user
      q = query(
        collection(db, 'recipes'),
        where('ownerId', '==', auth.currentUser.uid)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const recipesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort by createdAt descending
        recipesList.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        setRecipes(recipesList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching recipes:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [cookbookId]);

  /**
   * Upload recipe image to Firebase Storage
   * @param {string} recipeId - ID of the recipe
   * @param {File} file - Image file to upload
   * @returns {Promise<string>} - Download URL of the uploaded image
   */
  const uploadRecipeImage = async (recipeId, file) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to upload an image');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      const storagePath = `recipes/${recipeId}/image.jpg`;
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (err) {
      console.error('Error uploading recipe image:', err);
      throw err;
    }
  };

  /**
   * Delete recipe image from Firebase Storage
   * @param {string} recipeId - ID of the recipe
   * @returns {Promise<void>}
   */
  const deleteRecipeImage = async (recipeId) => {
    try {
      const storagePath = `recipes/${recipeId}/image.jpg`;
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      // Ignore error if file doesn't exist
      if (err.code !== 'storage/object-not-found') {
        console.error('Error deleting recipe image:', err);
        throw err;
      }
    }
  };

  /**
   * Add a new recipe to the collection
   * @param {Object} recipeData - Recipe data object
   * @returns {Promise<string>} - ID of the created document
   */
  const addRecipe = async ({ 
    name,
    cookbookId,
    transcription = '',
    ingredients = [], // Array of { amount: string, item: string }
    directions = [], // Array of strings (steps)
    imageFile = null
  }) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to add a recipe');
      }

      if (!name || !name.trim()) {
        throw new Error('Recipe name is required');
      }

      if (!cookbookId) {
        throw new Error('Cookbook ID is required');
      }

      // Create the recipe document first
      const docRef = await addDoc(collection(db, 'recipes'), {
        name: name.trim(),
        cookbookId: cookbookId,
        transcription: transcription,
        ingredients: ingredients,
        directions: directions,
        imageUrl: '',
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Upload image if provided
      if (imageFile) {
        const imageUrl = await uploadRecipeImage(docRef.id, imageFile);
        await updateDoc(docRef, { imageUrl });
      }

      return docRef.id;
    } catch (err) {
      console.error('Error adding recipe:', err);
      throw err;
    }
  };

  /**
   * Update an existing recipe's details
   * @param {string} recipeId - Document ID of the recipe to update
   * @param {Object} newData - Object containing fields to update
   * @param {File} imageFile - Optional new image file
   * @returns {Promise<void>}
   */
  const updateRecipe = async (recipeId, newData, imageFile = null) => {
    try {
      if (!recipeId) {
        throw new Error('Recipe ID is required');
      }

      const recipeRef = doc(db, 'recipes', recipeId);
      
      // Verify ownership before updating
      const recipeDoc = await getDoc(recipeRef);
      if (!recipeDoc.exists()) {
        throw new Error('Recipe not found');
      }
      
      if (recipeDoc.data().ownerId !== auth.currentUser.uid) {
        throw new Error('Not authorized to update this recipe');
      }

      const updateData = {
        ...newData,
        updatedAt: serverTimestamp()
      };

      // Upload new image if provided
      if (imageFile) {
        const imageUrl = await uploadRecipeImage(recipeId, imageFile);
        updateData.imageUrl = imageUrl;
      }

      await updateDoc(recipeRef, updateData);
    } catch (err) {
      console.error('Error updating recipe:', err);
      throw err;
    }
  };

  /**
   * Delete a recipe and its image
   * @param {string} recipeId - Document ID of the recipe to delete
   * @returns {Promise<void>}
   */
  const deleteRecipe = async (recipeId) => {
    try {
      if (!recipeId) {
        throw new Error('Recipe ID is required');
      }

      const recipeRef = doc(db, 'recipes', recipeId);
      
      // Verify ownership before deleting
      const recipeDoc = await getDoc(recipeRef);
      if (!recipeDoc.exists()) {
        throw new Error('Recipe not found');
      }
      
      if (recipeDoc.data().ownerId !== auth.currentUser.uid) {
        throw new Error('Not authorized to delete this recipe');
      }

      // Delete image from storage
      try {
        await deleteRecipeImage(recipeId);
      } catch (imgErr) {
        console.warn('Could not delete recipe image:', imgErr);
      }

      // Delete the recipe document
      await deleteDoc(recipeRef);
    } catch (err) {
      console.error('Error deleting recipe:', err);
      throw err;
    }
  };

  /**
   * Get recipes for a specific cookbook (one-time fetch)
   * @param {string} targetCookbookId - ID of the cookbook
   * @returns {Promise<Array>} - Array of recipe objects
   */
  const getRecipesByCookbook = useCallback(async (targetCookbookId) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated');
      }

      const recipesQuery = query(
        collection(db, 'recipes'),
        where('cookbookId', '==', targetCookbookId),
        where('ownerId', '==', auth.currentUser.uid)
      );
      
      const snapshot = await getDocs(recipesQuery);
      const recipesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by createdAt descending
      recipesList.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      return recipesList;
    } catch (err) {
      console.error('Error fetching recipes by cookbook:', err);
      throw err;
    }
  }, []);

  return {
    recipes,
    loading,
    error,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    getRecipesByCookbook,
    uploadRecipeImage
  };
}
