import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy,
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

/**
 * Custom hook for managing Provenance Log entries for an archive item
 * Provides CRUD operations for the provenanceLog sub-collection
 * @param {string} itemId - The ID of the archive item
 */
export function useProvenanceLog(itemId) {
  const [logEntries, setLogEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real-time listener for provenance log entries
  useEffect(() => {
    if (!itemId || !auth.currentUser) {
      setLogEntries([]);
      setLoading(false);
      return;
    }

    const provenanceRef = collection(db, 'archiveItems', itemId, 'provenanceLog');
    const q = query(provenanceRef, orderBy('transferDate', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setLogEntries(entries);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching provenance log:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [itemId]);

  /**
   * Add a new provenance log entry
   * @param {Object} data - { transferDate, transferorName, method, notes }
   * @returns {Promise<string>} - ID of the created log entry
   */
  const addLogEntry = async (data) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to add a log entry');
      }

      if (!itemId) {
        throw new Error('Item ID is required');
      }

      if (!data.transferDate) {
        throw new Error('Transfer date is required');
      }

      if (!data.transferorName || !data.transferorName.trim()) {
        throw new Error('Transferor name is required');
      }

      if (!data.method || !data.method.trim()) {
        throw new Error('Transfer method is required');
      }

      const provenanceRef = collection(db, 'archiveItems', itemId, 'provenanceLog');
      
      const docRef = await addDoc(provenanceRef, {
        transferDate: data.transferDate,
        transferorName: data.transferorName.trim(),
        method: data.method.trim(),
        notes: data.notes?.trim() || '',
        addedBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });

      return docRef.id;
    } catch (err) {
      console.error('Error adding provenance log entry:', err);
      throw err;
    }
  };

  /**
   * Delete a provenance log entry
   * @param {string} logId - Document ID of the log entry to delete
   * @returns {Promise<void>}
   */
  const deleteLogEntry = async (logId) => {
    try {
      if (!logId) {
        throw new Error('Log entry ID is required');
      }

      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const logRef = doc(db, 'archiveItems', itemId, 'provenanceLog', logId);
      await deleteDoc(logRef);
    } catch (err) {
      console.error('Error deleting provenance log entry:', err);
      throw err;
    }
  };

  return {
    logEntries,
    loading,
    error,
    addLogEntry,
    deleteLogEntry
  };
}
