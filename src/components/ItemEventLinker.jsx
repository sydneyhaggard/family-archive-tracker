import React, { useState, useEffect } from 'react';
import { useArchiveEvents } from '../hooks/useArchiveEvents';

/**
 * Component for linking/unlinking an archive item to/from an event
 * To be used in the ItemDetailModal or archive item details view
 */
function ItemEventLinker({ item, onUpdate }) {
  const { userEvents, linkItemToEvent, loading } = useArchiveEvents();
  const [selectedEventId, setSelectedEventId] = useState(item?.eventId || '');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');
  const [linkedEvent, setLinkedEvent] = useState(null);

  // Find the linked event details
  useEffect(() => {
    if (item?.eventId && userEvents.length > 0) {
      const event = userEvents.find(e => e.id === item.eventId);
      setLinkedEvent(event);
      setSelectedEventId(item.eventId);
    } else {
      setLinkedEvent(null);
      setSelectedEventId('');
    }
  }, [item?.eventId, userEvents]);

  const handleLink = async () => {
    if (!item?.id) {
      setError('No item selected');
      return;
    }

    try {
      setLinking(true);
      setError('');
      
      // If selectedEventId is empty, we're unlinking
      const eventIdToLink = selectedEventId || null;
      
      await linkItemToEvent(item.id, eventIdToLink);
      
      // Notify parent component of the update
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('Are you sure you want to unlink this item from the event?')) {
      return;
    }

    try {
      setLinking(true);
      setError('');
      
      await linkItemToEvent(item.id, null);
      setSelectedEventId('');
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  };

  const formatDateRange = (dateStart, dateEnd) => {
    const start = dateStart?.toDate ? dateStart.toDate() : new Date(dateStart);
    const end = dateEnd?.toDate ? dateEnd.toDate() : new Date(dateEnd);
    
    const startStr = start.toLocaleDateString();
    const endStr = end.toLocaleDateString();
    
    if (startStr === endStr) {
      return startStr;
    }
    return `${startStr} - ${endStr}`;
  };

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-500 text-sm">Loading collections...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Collection Association</h3>
      
      {error && (
        <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {/* Display linked event if exists */}
      {linkedEvent && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">{linkedEvent.title}</h4>
              <div className="flex items-center text-sm text-blue-700 mb-1">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDateRange(linkedEvent.dateStart, linkedEvent.dateEnd)}
              </div>
              {linkedEvent.location && (
                <div className="flex items-center text-sm text-blue-700">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {linkedEvent.location}
                </div>
              )}
              {linkedEvent.description && (
                <p className="text-sm text-blue-600 mt-2">{linkedEvent.description}</p>
              )}
            </div>
            <button
              onClick={handleUnlink}
              disabled={linking}
              className="ml-3 px-3 py-1 text-sm border-2 border-red-500 text-red-500 rounded-lg font-medium hover:bg-red-500 hover:text-white transition duration-300 disabled:opacity-50"
            >
              Unlink
            </button>
          </div>
        </div>
      )}

      {/* Dropdown and Link button */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {linkedEvent ? 'Change Collection' : 'Link to Collection'}
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            disabled={linking}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
          >
            <option value="">-- Select a collection --</option>
            {userEvents.map(event => (
              <option key={event.id} value={event.id}>
                {event.title} ({formatDateRange(event.dateStart, event.dateEnd)})
              </option>
            ))}
          </select>
        </div>

        {userEvents.length === 0 && (
          <p className="text-sm text-gray-500">
            No collections available. Create a collection first to link items.
          </p>
        )}

        {selectedEventId && selectedEventId !== item?.eventId && (
          <button
            onClick={handleLink}
            disabled={linking}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-secondary transition duration-300 disabled:opacity-50"
          >
            {linking ? 'Linking...' : (linkedEvent ? 'Change Collection Link' : 'Link to Collection')}
          </button>
        )}

        {!selectedEventId && linkedEvent && (
          <button
            onClick={handleUnlink}
            disabled={linking}
            className="w-full px-4 py-2 border-2 border-red-500 text-red-500 rounded-lg font-medium hover:bg-red-500 hover:text-white transition duration-300 disabled:opacity-50"
          >
            {linking ? 'Unlinking...' : 'Unlink from Collection'}
          </button>
        )}
      </div>
    </div>
  );
}

export default ItemEventLinker;
