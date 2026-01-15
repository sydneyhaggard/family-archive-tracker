import { useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  writeBatch,
  serverTimestamp,
  doc,
  updateDoc
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
   * @returns {Promise<Object>} - { newPeople, duplicates, existingPeopleMap }
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

      // Create a map using name + birth date for accurate duplicate detection
      const existingPeopleMap = new Map();
      existingPeople.forEach(p => {
        // Create a unique key using name + birth date for more accurate duplicate detection
        const nameKey = normalizeName(p.name);
        const birthKey = p.birthDate ? p.birthDate.trim().toLowerCase() : '';
        const compositeKey = `${nameKey}|${birthKey}`;
        existingPeopleMap.set(compositeKey, p);
        // Also add name-only key as fallback for people without birth dates
        if (!existingPeopleMap.has(`${nameKey}|`)) {
          existingPeopleMap.set(`${nameKey}|`, p);
        }
      });

      // Separate new people from duplicates
      const newPeople = [];
      const duplicates = [];
      const seenKeys = new Set();

      for (const person of parsedPeople) {
        const normalizedName = normalizeName(person.name);
        const birthDate = person.birthDate ? person.birthDate.trim().toLowerCase() : '';
        const compositeKey = `${normalizedName}|${birthDate}`;
        const nameOnlyKey = `${normalizedName}|`;
        
        // Check for exact match (name + birth date) first, then name-only match
        const existingRecord = existingPeopleMap.get(compositeKey) || 
                               (birthDate === '' ? existingPeopleMap.get(nameOnlyKey) : null);
        
        if (existingRecord) {
          // Found a duplicate - include the existing record for merging
          duplicates.push({
            ...person,
            existingRecord,
            matchType: existingPeopleMap.has(compositeKey) ? 'exact' : 'name-only'
          });
        } else if (!seenKeys.has(compositeKey)) {
          newPeople.push(person);
          // Track keys within the import file to avoid duplicates
          seenKeys.add(compositeKey);
        }
      }

      return { newPeople, duplicates, existingPeopleMap };
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
            birthLocation: person.birthLocation || '',
            deathDate: person.deathDate || '',
            deathLocation: person.deathLocation || '',
            marriageDate: person.marriageDate || '',
            marriageLocation: person.marriageLocation || '',
            description: person.description || '',
            gedcomId: person.gedcomId || null,
            importSource: 'gedcom',
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
   * Merge new GEDCOM data into existing records
   * Only updates fields that are empty in the existing record
   * @param {Object[]} duplicates - Array of duplicates with existingRecord attached
   * @returns {Promise<number>} - Number of records merged
   */
  const mergeDuplicates = async (duplicates) => {
    try {
      if (!auth.currentUser || !duplicates || duplicates.length === 0) {
        return 0;
      }

      setImporting(true);
      setProgress({ current: 0, total: duplicates.length });

      let mergedCount = 0;
      const batchSize = 450;
      const batches = [];

      for (let i = 0; i < duplicates.length; i += batchSize) {
        batches.push(duplicates.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = writeBatch(db);
        const currentBatch = batches[batchIndex];
        let batchHasUpdates = false;

        for (const dup of currentBatch) {
          const existing = dup.existingRecord;
          if (!existing || !existing.id) continue;

          // Build update object - only include fields that enrich existing data
          const updates = {};
          let hasUpdates = false;

          // Merge birth date if existing is empty and new has value
          if (!existing.birthDate && dup.birthDate) {
            updates.birthDate = dup.birthDate;
            hasUpdates = true;
          }

          // Merge birth location
          if (!existing.birthLocation && dup.birthLocation) {
            updates.birthLocation = dup.birthLocation;
            hasUpdates = true;
          }

          // Merge death date
          if (!existing.deathDate && dup.deathDate) {
            updates.deathDate = dup.deathDate;
            hasUpdates = true;
          }

          // Merge death location
          if (!existing.deathLocation && dup.deathLocation) {
            updates.deathLocation = dup.deathLocation;
            hasUpdates = true;
          }

          // Merge marriage date
          if (!existing.marriageDate && dup.marriageDate) {
            updates.marriageDate = dup.marriageDate;
            hasUpdates = true;
          }

          // Merge marriage location
          if (!existing.marriageLocation && dup.marriageLocation) {
            updates.marriageLocation = dup.marriageLocation;
            hasUpdates = true;
          }

          // Merge description (append if both exist)
          if (dup.description) {
            if (!existing.description) {
              updates.description = dup.description;
              hasUpdates = true;
            } else if (!existing.description.includes(dup.description)) {
              // Append new info if not already present
              updates.description = `${existing.description} ${dup.description}`.trim();
              hasUpdates = true;
            }
          }

          // Add gedcomId if not present
          if (!existing.gedcomId && dup.gedcomId) {
            updates.gedcomId = dup.gedcomId;
            hasUpdates = true;
          }

          if (hasUpdates) {
            updates.updatedAt = serverTimestamp();
            const docRef = doc(db, 'relatedPeople', existing.id);
            batch.update(docRef, updates);
            batchHasUpdates = true;
            mergedCount++;
          }
        }

        if (batchHasUpdates) {
          await batch.commit();
        }
        
        setProgress({ 
          current: Math.min((batchIndex + 1) * batchSize, duplicates.length), 
          total: duplicates.length 
        });
      }

      return mergedCount;
    } catch (err) {
      console.error('Error merging duplicates:', err);
      throw err;
    } finally {
      setImporting(false);
    }
  };

  /**
   * Full import process with duplicate detection and optional merge
   * @param {Object[]} parsedPeople - Array of people from GEDCOM file
   * @param {string} duplicateAction - 'skip', 'merge', or 'import' (default: 'skip')
   * @returns {Promise<Object>} - { imported, skipped, merged }
   */
  const importPeople = async (parsedPeople, duplicateAction = 'skip') => {
    try {
      setError(null);
      
      const { newPeople, duplicates } = await checkForDuplicates(parsedPeople);
      
      // Import new people
      const importedCount = await processGedcomImport(newPeople);
      
      let mergedCount = 0;
      let skippedCount = duplicates.length;

      if (duplicateAction === 'merge' && duplicates.length > 0) {
        // Merge duplicates into existing records
        mergedCount = await mergeDuplicates(duplicates);
        skippedCount = 0;
      } else if (duplicateAction === 'import') {
        // Import duplicates as new records (creates duplicates)
        const additionalImports = await processGedcomImport(
          duplicates.map(d => ({ ...d, existingRecord: undefined }))
        );
        skippedCount = 0;
      }
      
      return {
        imported: importedCount,
        merged: mergedCount,
        skipped: skippedCount,
        duplicates
      };
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
    mergeDuplicates,
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
