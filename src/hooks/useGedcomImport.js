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
            burialDate: person.burialDate || '',
            burialLocation: person.burialLocation || '',
            marriageDate: person.marriageDate || '',
            marriageLocation: person.marriageLocation || '',
            description: person.description || '',
            gedcomId: person.gedcomId || null,
            importSource: 'gedcom',
            ownerId: userId,
            // Store raw relationship data from GEDCOM (will be linked in phase 2)
            gedcomParents: person.parents || [],
            gedcomSiblings: person.siblings || [],
            gedcomSpouses: person.spouses || [],
            // Initialize relationship arrays (populated in phase 2)
            parents: [],
            siblings: [],
            spouses: [],
            children: [],
            residences: person.residences || [],
            militaryService: person.militaryService || [],
            sources: person.sources || [],
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

          // Merge burial date
          if (!existing.burialDate && dup.burialDate) {
            updates.burialDate = dup.burialDate;
            hasUpdates = true;
          }

          // Merge burial location
          if (!existing.burialLocation && dup.burialLocation) {
            updates.burialLocation = dup.burialLocation;
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

          // Merge residences array
          if (dup.residences?.length > 0) {
            const existingResidences = existing.residences || [];
            updates.residences = [...existingResidences, ...dup.residences];
            hasUpdates = true;
          }

          // Merge military service array
          if (dup.militaryService?.length > 0) {
            const existingMilitary = existing.militaryService || [];
            updates.militaryService = [...existingMilitary, ...dup.militaryService];
            hasUpdates = true;
          }

          // Merge sources array
          if (dup.sources?.length > 0) {
            const existingSources = existing.sources || [];
            updates.sources = [...new Set([...existingSources, ...dup.sources])];
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
   * Full import process with duplicate detection, placeholder parent creation, 
   * and bidirectional relationship linking
   * @param {Object[]} parsedPeople - Array of people from GEDCOM file
   * @param {string} duplicateAction - 'skip', 'merge', or 'import' (default: 'skip')
   * @returns {Promise<Object>} - { imported, skipped, merged, placeholders }
   */
  const importPeople = async (parsedPeople, duplicateAction = 'skip') => {
    try {
      setError(null);
      
      const { newPeople, duplicates } = await checkForDuplicates(parsedPeople);
      
      // Phase 1: Import new people and create placeholders for missing parents
      const { importedCount, placeholderCount, gedcomIdMap } = await importWithPlaceholders(newPeople);
      
      // Phase 2: Link relationships bidirectionally using the gedcomIdMap
      await linkRelationships(gedcomIdMap);
      
      let mergedCount = 0;
      let skippedCount = duplicates.length;

      if (duplicateAction === 'merge' && duplicates.length > 0) {
        // Merge duplicates into existing records
        mergedCount = await mergeDuplicates(duplicates);
        skippedCount = 0;
      } else if (duplicateAction === 'import') {
        // Import duplicates as new records (creates duplicates)
        const { importedCount: additionalImports } = await importWithPlaceholders(
          duplicates.map(d => ({ ...d, existingRecord: undefined }))
        );
        skippedCount = 0;
      }
      
      return {
        imported: importedCount,
        merged: mergedCount,
        skipped: skippedCount,
        placeholders: placeholderCount,
        duplicates
      };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Import people and create placeholder records for missing parents
   * @param {Object[]} people - Array of people to import
   * @returns {Promise<Object>} - { importedCount, placeholderCount, gedcomIdMap }
   */
  const importWithPlaceholders = async (people) => {
    try {
      if (!auth.currentUser || !people || people.length === 0) {
        return { importedCount: 0, placeholderCount: 0, gedcomIdMap: new Map() };
      }

      setImporting(true);
      const userId = auth.currentUser.uid;
      
      // Build a set of all gedcomIds being imported
      const importedGedcomIds = new Set(people.map(p => p.gedcomId).filter(Boolean));
      
      // Find all missing parents that need placeholders
      const placeholdersToCreate = new Map(); // gedcomId -> parent object
      
      for (const person of people) {
        if (person.parents?.length > 0) {
          for (const parent of person.parents) {
            const parentGedcomId = parent.gedcomId;
            // If parent not in import and not already in placeholders map
            if (parentGedcomId && !importedGedcomIds.has(parentGedcomId) && !placeholdersToCreate.has(parentGedcomId)) {
              placeholdersToCreate.set(parentGedcomId, {
                ...parent,
                isPlaceholder: true
              });
            }
          }
        }
      }

      // Combine actual people with placeholders
      const allPeopleToImport = [
        ...people,
        ...Array.from(placeholdersToCreate.values())
      ];

      setProgress({ current: 0, total: allPeopleToImport.length });

      const gedcomIdMap = new Map(); // Maps gedcomId -> Firestore docId
      let importedCount = 0;
      let placeholderCount = 0;

      // Firestore batch writes are limited to 500 operations
      const batchSize = 450;
      const batches = [];

      for (let i = 0; i < allPeopleToImport.length; i += batchSize) {
        batches.push(allPeopleToImport.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = writeBatch(db);
        const currentBatch = batches[batchIndex];

        for (const person of currentBatch) {
          const docRef = collection(db, 'relatedPeople');
          const newDocRef = doc(docRef);
          
          // Track gedcomId -> Firestore ID mapping
          if (person.gedcomId) {
            gedcomIdMap.set(person.gedcomId, newDocRef.id);
          }

          const isPlaceholder = person.isPlaceholder === true;
          
          batch.set(newDocRef, {
            name: person.name,
            birthDate: person.birthDate || '',
            birthLocation: person.birthLocation || '',
            deathDate: person.deathDate || '',
            deathLocation: person.deathLocation || '',
            burialDate: person.burialDate || '',
            burialLocation: person.burialLocation || '',
            marriageDate: person.marriageDate || '',
            marriageLocation: person.marriageLocation || '',
            description: person.description || '',
            gedcomId: person.gedcomId || null,
            importSource: 'gedcom',
            isPlaceholder: isPlaceholder,
            ownerId: userId,
            // Store raw relationship data from GEDCOM
            gedcomParents: person.parents || [],
            gedcomSiblings: person.siblings || [],
            gedcomSpouses: person.spouses || [],
            // Initialize relationship arrays (populated in phase 2)
            parents: [],
            siblings: [],
            spouses: [],
            children: [],
            residences: person.residences || [],
            militaryService: person.militaryService || [],
            sources: person.sources || [],
            sourceIds: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          if (isPlaceholder) {
            placeholderCount++;
          } else {
            importedCount++;
          }
        }

        await batch.commit();
        setProgress({ 
          current: Math.min((batchIndex + 1) * batchSize, allPeopleToImport.length),
          total: allPeopleToImport.length
        });
      }

      return { importedCount, placeholderCount, gedcomIdMap };
    } catch (err) {
      console.error('Error importing with placeholders:', err);
      throw err;
    } finally {
      setImporting(false);
    }
  };

  /**
   * Link relationships bidirectionally using gedcomId mappings
   * @param {Map} gedcomIdMap - Maps gedcomId -> Firestore docId
   */
  const linkRelationships = async (gedcomIdMap) => {
    try {
      if (!auth.currentUser || gedcomIdMap.size === 0) {
        return;
      }

      // Query all records just created to get their gedcom relationship data
      const firestoreIds = Array.from(gedcomIdMap.values());
      
      // Process in chunks (Firestore 'in' query limited to 10 items)
      const chunkSize = 10;
      const allRecords = [];
      
      for (let i = 0; i < firestoreIds.length; i += chunkSize) {
        const chunk = firestoreIds.slice(i, i + chunkSize);
        const q = query(
          collection(db, 'relatedPeople'),
          where('__name__', 'in', chunk)
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
          allRecords.push({ id: doc.id, ...doc.data() });
        });
      }

      // Build update batches for bidirectional linking
      const updates = new Map(); // docId -> { parents, siblings, spouses, children }

      for (const record of allRecords) {
        const recordUpdates = {
          parents: [],
          siblings: [],
          spouses: [],
          children: []
        };

        // Link parents (child -> parent AND parent -> child)
        if (record.gedcomParents?.length > 0) {
          for (const parent of record.gedcomParents) {
            const parentFirestoreId = gedcomIdMap.get(parent.gedcomId);
            if (parentFirestoreId) {
              // Add parent to child's parents array
              recordUpdates.parents.push({
                personId: parentFirestoreId,
                name: parent.name,
                birthDate: parent.birthDate || '',
                deathDate: parent.deathDate || '',
                parentalStatus: parent.parentalStatus || 'biological'
              });

              // Add child to parent's children array (bidirectional)
              if (!updates.has(parentFirestoreId)) {
                updates.set(parentFirestoreId, { parents: [], siblings: [], spouses: [], children: [] });
              }
              updates.get(parentFirestoreId).children.push({
                personId: record.id,
                name: record.name,
                birthDate: record.birthDate || '',
                deathDate: record.deathDate || ''
              });
            }
          }
        }

        // Link siblings (bidirectional)
        if (record.gedcomSiblings?.length > 0) {
          for (const sibling of record.gedcomSiblings) {
            const siblingFirestoreId = gedcomIdMap.get(sibling.gedcomId);
            if (siblingFirestoreId) {
              recordUpdates.siblings.push({
                personId: siblingFirestoreId,
                name: sibling.name,
                birthDate: sibling.birthDate || '',
                deathDate: sibling.deathDate || ''
              });

              // Add reverse sibling link
              if (!updates.has(siblingFirestoreId)) {
                updates.set(siblingFirestoreId, { parents: [], siblings: [], spouses: [], children: [] });
              }
              updates.get(siblingFirestoreId).siblings.push({
                personId: record.id,
                name: record.name,
                birthDate: record.birthDate || '',
                deathDate: record.deathDate || ''
              });
            }
          }
        }

        // Link spouses (bidirectional)
        if (record.gedcomSpouses?.length > 0) {
          for (const spouse of record.gedcomSpouses) {
            const spouseFirestoreId = gedcomIdMap.get(spouse.gedcomId);
            if (spouseFirestoreId) {
              recordUpdates.spouses.push({
                personId: spouseFirestoreId,
                name: spouse.name,
                birthDate: spouse.birthDate || '',
                deathDate: spouse.deathDate || '',
                marriageDate: spouse.marriageDate || '',
                marriageLocation: spouse.marriageLocation || ''
              });

              // Add reverse spouse link
              if (!updates.has(spouseFirestoreId)) {
                updates.set(spouseFirestoreId, { parents: [], siblings: [], spouses: [], children: [] });
              }
              updates.get(spouseFirestoreId).spouses.push({
                personId: record.id,
                name: record.name,
                birthDate: record.birthDate || '',
                deathDate: record.deathDate || '',
                marriageDate: spouse.marriageDate || '',
                marriageLocation: spouse.marriageLocation || ''
              });
            }
          }
        }

        updates.set(record.id, recordUpdates);
      }

      // Write relationship updates in batches
      const updateEntries = Array.from(updates.entries());
      const batchSize = 450;
      
      for (let i = 0; i < updateEntries.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = updateEntries.slice(i, i + batchSize);

        for (const [docId, relationships] of chunk) {
          const docRef = doc(db, 'relatedPeople', docId);
          batch.update(docRef, {
            parents: relationships.parents,
            siblings: relationships.siblings,
            spouses: relationships.spouses,
            children: relationships.children,
            updatedAt: serverTimestamp()
          });
        }

        await batch.commit();
      }
    } catch (err) {
      console.error('Error linking relationships:', err);
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
