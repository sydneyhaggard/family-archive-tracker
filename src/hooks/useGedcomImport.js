import { useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  writeBatch,
  serverTimestamp,
  doc
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

/**
 * Custom hook for importing GEDCOM data into the relatedPeople collection
 */
export function useGedcomImport() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);

  /**
   * Check for duplicate people in the user's collection
   * @param {Object[]} parsedPeople - Array of people from GEDCOM file
   * @returns {Promise<Object>} - { newPeople, duplicates }
   */
  const checkForDuplicates = async (parsedPeople) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated');
      }

      // Get all existing people for this user
      const q = query(
        collection(db, 'relatedPeople'),
        where('ownerId', '==', auth.currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      const existingPeople = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Create a set of normalized existing names for comparison
      const existingNames = new Set(
        existingPeople.map(p => normalizeName(p.name))
      );

      // Separate new people from duplicates
      const newPeople = [];
      const duplicates = [];

      for (const person of parsedPeople) {
        const normalizedName = normalizeName(person.name);
        
        if (existingNames.has(normalizedName)) {
          duplicates.push(person);
        } else {
          newPeople.push(person);
          // Add to existing names to catch duplicates within the import file
          existingNames.add(normalizedName);
        }
      }

      return { newPeople, duplicates };
    } catch (err) {
      console.error('Error checking for duplicates:', err);
      throw err;
    }
  };

  /**
   * Import people into Firestore using batch writes
   * @param {Object[]} people - Array of people to import
   * @returns {Promise<number>} - Number of people successfully imported
   */
  const processGedcomImport = async (people) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated');
      }

      if (!people || people.length === 0) {
        return 0;
      }

      setImporting(true);
      setProgress({ current: 0, total: people.length });
      setError(null);

      const userId = auth.currentUser.uid;
      let importedCount = 0;

      // Firestore batch writes are limited to 500 operations
      const batchSize = 450; // Leave some room for safety
      const batches = [];

      for (let i = 0; i < people.length; i += batchSize) {
        batches.push(people.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = writeBatch(db);
        const currentBatch = batches[batchIndex];

        for (const person of currentBatch) {
          const docRef = collection(db, 'relatedPeople');
          const newDocRef = doc(docRef);
          
          batch.set(newDocRef, {
            name: person.name,
            birthDate: person.birthDate || '',
            description: person.description || '',
            gedcomId: person.gedcomId || null,
            ownerId: userId,
            sourceIds: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        await batch.commit();
        importedCount += currentBatch.length;
        setProgress({ 
          current: importedCount, 
          total: people.length 
        });
      }

      return importedCount;
    } catch (err) {
      console.error('Error importing GEDCOM data:', err);
      setError(err.message);
      throw err;
    } finally {
      setImporting(false);
    }
  };

  /**
   * Full import process with duplicate detection
   * @param {Object[]} parsedPeople - Array of people from GEDCOM file
   * @param {boolean} skipDuplicates - Whether to skip duplicates (default: true)
   * @returns {Promise<Object>} - { imported, skipped }
   */
  const importPeople = async (parsedPeople, skipDuplicates = true) => {
    try {
      setError(null);
      
      if (skipDuplicates) {
        const { newPeople, duplicates } = await checkForDuplicates(parsedPeople);
        const importedCount = await processGedcomImport(newPeople);
        
        return {
          imported: importedCount,
          skipped: duplicates.length,
          duplicates
        };
      } else {
        const importedCount = await processGedcomImport(parsedPeople);
        return {
          imported: importedCount,
          skipped: 0,
          duplicates: []
        };
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    importing,
    progress,
    error,
    checkForDuplicates,
    processGedcomImport,
    importPeople
  };
}

/**
 * Normalize a name for comparison
 * @param {string} name - Name to normalize
 * @returns {string} - Normalized name (lowercase, trimmed, single spaces)
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
