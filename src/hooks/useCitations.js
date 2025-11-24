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
  getDocs,
  documentId,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

/**
 * Custom hook for managing Citation Sources in Firestore
 * Provides CRUD operations for the citationSources collection
 */
export function useCitations() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real-time listener for sources owned by current user
  useEffect(() => {
    if (!auth.currentUser) {
      setSources([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'citationSources'),
      where('ownerId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sourceList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSources(sourceList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching citation sources:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Add a new citation source
   * @param {Object} data - { title, citationDetails, url, repository }
   * @returns {Promise<string>} - ID of the created source
   */
  const addSource = async (data) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to add a source');
      }

      if (!data.title || !data.title.trim()) {
        throw new Error('Source title is required');
      }

      const docRef = await addDoc(collection(db, 'citationSources'), {
        title: data.title.trim(),
        citationDetails: data.citationDetails?.trim() || '',
        url: data.url?.trim() || '',
        repository: data.repository?.trim() || '',
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return docRef.id;
    } catch (err) {
      console.error('Error adding citation source:', err);
      throw err;
    }
  };

  /**
   * Update an existing citation source
   * @param {string} sourceId - Document ID of the source to update
   * @param {Object} newData - Object containing fields to update
   * @returns {Promise<void>}
   */
  const updateSource = async (sourceId, newData) => {
    try {
      if (!sourceId) {
        throw new Error('Source ID is required');
      }

      const sourceRef = doc(db, 'citationSources', sourceId);
      
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

      await updateDoc(sourceRef, updateData);
    } catch (err) {
      console.error('Error updating citation source:', err);
      throw err;
    }
  };

  /**
   * Delete a citation source
   * @param {string} sourceId - Document ID of the source to delete
   * @returns {Promise<void>}
   */
  const deleteSource = async (sourceId) => {
    try {
      if (!sourceId) {
        throw new Error('Source ID is required');
      }

      const sourceRef = doc(db, 'citationSources', sourceId);
      await deleteDoc(sourceRef);
    } catch (err) {
      console.error('Error deleting citation source:', err);
      throw err;
    }
  };

  /**
   * Get sources by their IDs
   * @param {string[]} idArray - Array of source document IDs
   * @returns {Promise<Object[]>} - Array of source objects
   */
  const getSourcesByIds = async (idArray) => {
    try {
      if (!idArray || idArray.length === 0) {
        return [];
      }

      // Firestore 'in' queries are limited to 10 items, so we need to batch
      const batches = [];
      for (let i = 0; i < idArray.length; i += 10) {
        batches.push(idArray.slice(i, i + 10));
      }

      const results = [];
      for (const batch of batches) {
        const q = query(
          collection(db, 'citationSources'),
          where(documentId(), 'in', batch)
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
          results.push({
            id: doc.id,
            ...doc.data()
          });
        });
      }

      return results;
    } catch (err) {
      console.error('Error fetching sources by IDs:', err);
      throw err;
    }
  };

  /**
   * Link sources to an archive item
   * @param {string} itemId - Document ID of the archive item
   * @param {string[]} sourceIds - Array of source document IDs
   * @returns {Promise<void>}
   */
  const linkSourcesToItem = async (itemId, sourceIds) => {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const itemRef = doc(db, 'archiveItems', itemId);
      await updateDoc(itemRef, {
        sourceIds: sourceIds || [],
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error linking sources to item:', err);
      throw err;
    }
  };

  /**
   * Link sources to a related person
   * @param {string} personId - Document ID of the related person
   * @param {string[]} sourceIds - Array of source document IDs
   * @returns {Promise<void>}
   */
  const linkSourcesToPerson = async (personId, sourceIds) => {
    try {
      if (!personId) {
        throw new Error('Person ID is required');
      }

      const personRef = doc(db, 'relatedPeople', personId);
      await updateDoc(personRef, {
        sourceIds: sourceIds || [],
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error linking sources to person:', err);
      throw err;
    }
  };

  return {
    sources,
    loading,
    error,
    addSource,
    updateSource,
    deleteSource,
    getSourcesByIds,
    linkSourcesToItem,
    linkSourcesToPerson
  };
}
