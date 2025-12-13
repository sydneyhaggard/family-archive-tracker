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
  getDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

/**
 * Custom hook for managing Archive Events in Firestore
 * Provides CRUD operations and real-time updates for the archiveEvents collection
 */
export function useArchiveEvents() {
  const [userEvents, setUserEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real-time listener for events owned by current user
  useEffect(() => {
    if (!auth.currentUser) {
      setUserEvents([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'archiveEvents'),
      where('ownerId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const events = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUserEvents(events);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching archive events:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Create a new archive event
   * @param {Object} data - { title, description, dateStart, dateEnd, location }
   * @returns {Promise<string>} - ID of the created event
   */
  const createEvent = async (data) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to create an event');
      }

      if (!data.title || !data.title.trim()) {
        throw new Error('Event title is required');
      }

      if (!data.dateStart) {
        throw new Error('Event start date is required');
      }

      const docRef = await addDoc(collection(db, 'archiveEvents'), {
        title: data.title.trim(),
        description: data.description?.trim() || '',
        dateStart: data.dateStart,
        dateEnd: data.dateEnd || data.dateStart,
        location: data.location?.trim() || '',
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return docRef.id;
    } catch (err) {
      console.error('Error creating event:', err);
      throw err;
    }
  };

  /**
   * Update an existing event
   * @param {string} eventId - Document ID of the event to update
   * @param {Object} newData - Object containing fields to update
   * @returns {Promise<void>}
   */
  const updateEvent = async (eventId, newData) => {
    try {
      if (!eventId) {
        throw new Error('Event ID is required');
      }

      const eventRef = doc(db, 'archiveEvents', eventId);
      
      // Verify ownership before updating
      const eventDoc = await getDoc(eventRef);
      if (!eventDoc.exists()) {
        throw new Error('Event not found');
      }
      
      if (eventDoc.data().ownerId !== auth.currentUser.uid) {
        throw new Error('Not authorized to update this event');
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

      await updateDoc(eventRef, updateData);
    } catch (err) {
      console.error('Error updating event:', err);
      throw err;
    }
  };

  /**
   * Delete an event and unlink all associated items
   * @param {string} eventId - Document ID of the event to delete
   * @returns {Promise<void>}
   */
  const deleteEvent = async (eventId) => {
    try {
      if (!eventId) {
        throw new Error('Event ID is required');
      }

      const eventRef = doc(db, 'archiveEvents', eventId);
      
      // Verify ownership before deleting
      const eventDoc = await getDoc(eventRef);
      if (!eventDoc.exists()) {
        throw new Error('Event not found');
      }
      
      if (eventDoc.data().ownerId !== auth.currentUser.uid) {
        throw new Error('Not authorized to delete this event');
      }

      // Find all items linked to this event and unlink them
      const itemsQuery = query(
        collection(db, 'archiveItems'),
        where('eventId', '==', eventId),
        where('ownerId', '==', auth.currentUser.uid)
      );
      
      const itemsSnapshot = await getDocs(itemsQuery);
      
      // Use batch to unlink items and delete event atomically
      const batch = writeBatch(db);
      
      // Unlink all items
      itemsSnapshot.docs.forEach(itemDoc => {
        batch.update(itemDoc.ref, {
          eventId: null,
          updatedAt: serverTimestamp()
        });
      });
      
      // Delete the event
      batch.delete(eventRef);
      
      await batch.commit();
    } catch (err) {
      console.error('Error deleting event:', err);
      throw err;
    }
  };

  /**
   * Get real-time list of items linked to a specific event
   * @param {string} eventId - Document ID of the event
   * @returns {Function} - Unsubscribe function
   */
  const getEventItems = (eventId, callback) => {
    if (!eventId || !auth.currentUser) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, 'archiveItems'),
      where('eventId', '==', eventId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(items);
      },
      (err) => {
        console.error('Error fetching event items:', err);
        callback([]);
      }
    );

    return unsubscribe;
  };

  /**
   * Link an archive item to an event
   * @param {string} itemId - Document ID of the archive item
   * @param {string} eventId - Document ID of the event (or null to unlink)
   * @returns {Promise<void>}
   */
  const linkItemToEvent = async (itemId, eventId) => {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
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

      // If eventId is provided, verify the event exists and user owns it
      if (eventId) {
        const eventRef = doc(db, 'archiveEvents', eventId);
        const eventDoc = await getDoc(eventRef);
        
        if (!eventDoc.exists()) {
          throw new Error('Event not found');
        }
        
        if (eventDoc.data().ownerId !== auth.currentUser.uid) {
          throw new Error('Not authorized to link to this event');
        }
      }

      // Update the item's eventId
      await updateDoc(itemRef, {
        eventId: eventId || null,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error linking item to event:', err);
      throw err;
    }
  };

  /**
   * Get count of items linked to an event
   * @param {string} eventId - Document ID of the event
   * @returns {Promise<number>} - Count of linked items
   */
  const getEventItemsCount = async (eventId) => {
    try {
      if (!eventId) {
        return 0;
      }

      const q = query(
        collection(db, 'archiveItems'),
        where('eventId', '==', eventId)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (err) {
      console.error('Error getting event items count:', err);
      return 0;
    }
  };

  /**
   * Link multiple archive items to an event (batch operation)
   * @param {string} eventId - Document ID of the event
   * @param {string[]} itemIdsToLink - Array of item IDs to link to this event
   * @param {string[]} itemIdsToUnlink - Array of item IDs to unlink from this event
   * @returns {Promise<void>}
   */
  const linkMultipleItemsToEvent = async (eventId, itemIdsToLink = [], itemIdsToUnlink = []) => {
    try {
      if (!eventId) {
        throw new Error('Event ID is required');
      }

      // Verify event exists and user owns it
      const eventRef = doc(db, 'archiveEvents', eventId);
      const eventDoc = await getDoc(eventRef);
      
      if (!eventDoc.exists()) {
        throw new Error('Event not found');
      }
      
      if (eventDoc.data().ownerId !== auth.currentUser.uid) {
        throw new Error('Not authorized to modify this event');
      }

      const batch = writeBatch(db);

      // Link items to event
      for (const itemId of itemIdsToLink) {
        const itemRef = doc(db, 'archiveItems', itemId);
        batch.update(itemRef, {
          eventId: eventId,
          updatedAt: serverTimestamp()
        });
      }

      // Unlink items from event
      for (const itemId of itemIdsToUnlink) {
        const itemRef = doc(db, 'archiveItems', itemId);
        batch.update(itemRef, {
          eventId: null,
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
    } catch (err) {
      console.error('Error linking multiple items to event:', err);
      throw err;
    }
  };

  /**
   * Get all archive items owned by the current user
   * @returns {Promise<Array>} - Array of archive items
   */
  const getAllUserItems = async () => {
    try {
      if (!auth.currentUser) {
        return [];
      }

      const q = query(
        collection(db, 'archiveItems'),
        where('ownerId', '==', auth.currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (err) {
      console.error('Error getting user items:', err);
      return [];
    }
  };

  return {
    userEvents,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventItems,
    linkItemToEvent,
    getEventItemsCount,
    linkMultipleItemsToEvent,
    getAllUserItems
  };
}
