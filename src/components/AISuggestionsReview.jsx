import React, { useState, useCallback } from 'react';
import { useRelatedPeople } from '../hooks/useRelatedPeople';

/**
 * AISuggestionsReview - Component for reviewing and applying AI-extracted metadata
 * 
 * Displays NER results in a user-friendly format with accept/reject actions
 * for each entity category (people, dates, locations, summary)
 */
function AISuggestionsReview({ 
  results, 
  onApply, 
  onDismiss, 
  itemId = null,
  isOpen = true,
  onClose
}) {
  const { addPerson, addPersonToItem } = useRelatedPeople();
  
  // Track which suggestions are accepted
  const [acceptedPeople, setAcceptedPeople] = useState(new Set());
  const [acceptedDates, setAcceptedDates] = useState(new Set());
  const [acceptedLocations, setAcceptedLocations] = useState(new Set());
  const [acceptedSummary, setAcceptedSummary] = useState(false);
  
  // Track which new people should be created
  const [newPeopleToCreate, setNewPeopleToCreate] = useState(new Set());
  
  // Track loading state
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState(null);

  // Toggle acceptance for matched people
  const toggleMatchedPerson = useCallback((index) => {
    setAcceptedPeople(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Toggle creation for new people
  const toggleNewPerson = useCallback((name) => {
    setNewPeopleToCreate(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  // Toggle date acceptance
  const toggleDate = useCallback((index) => {
    setAcceptedDates(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Toggle location acceptance
  const toggleLocation = useCallback((index) => {
    setAcceptedLocations(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Accept all suggestions
  const acceptAll = useCallback(() => {
    if (results?.matchedPeople) {
      setAcceptedPeople(new Set(results.matchedPeople.map((_, i) => i)));
    }
    if (results?.newPeople) {
      setNewPeopleToCreate(new Set(results.newPeople));
    }
    if (results?.suggestedDates) {
      setAcceptedDates(new Set(results.suggestedDates.map((_, i) => i)));
    }
    if (results?.suggestedLocations) {
      setAcceptedLocations(new Set(results.suggestedLocations.map((_, i) => i)));
    }
    if (results?.summary) {
      setAcceptedSummary(true);
    }
  }, [results]);

  // Clear all selections
  const clearAll = useCallback(() => {
    setAcceptedPeople(new Set());
    setNewPeopleToCreate(new Set());
    setAcceptedDates(new Set());
    setAcceptedLocations(new Set());
    setAcceptedSummary(false);
  }, []);

  // Apply selected suggestions
  const handleApply = useCallback(async () => {
    setApplying(true);
    setApplyError(null);

    try {
      const appliedData = {
        linkedPeopleIds: [],
        dates: [],
        locations: [],
        summary: acceptedSummary ? results.summary : null
      };

      // Link matched people to item
      for (const index of acceptedPeople) {
        const match = results.matchedPeople[index];
        if (match?.matchedPerson?.id) {
          appliedData.linkedPeopleIds.push(match.matchedPerson.id);
          
          // If we have an itemId, link the person to it
          if (itemId) {
            await addPersonToItem(itemId, match.matchedPerson.id);
          }
        }
      }

      // Create new people and link them
      for (const name of newPeopleToCreate) {
        const personId = await addPerson({ name, description: '', birthDate: '' });
        appliedData.linkedPeopleIds.push(personId);
        
        // If we have an itemId, link the person to it
        if (itemId) {
          await addPersonToItem(itemId, personId);
        }
      }

      // Collect accepted dates
      for (const index of acceptedDates) {
        appliedData.dates.push(results.suggestedDates[index]);
      }

      // Collect accepted locations
      for (const index of acceptedLocations) {
        appliedData.locations.push(results.suggestedLocations[index]);
      }

      // Call the onApply callback with the collected data
      if (onApply) {
        await onApply(appliedData);
      }

      // Close the review panel
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Error applying suggestions:', err);
      setApplyError(err.message);
    } finally {
      setApplying(false);
    }
  }, [
    acceptedPeople,
    acceptedDates,
    acceptedLocations,
    acceptedSummary,
    newPeopleToCreate,
    results,
    itemId,
    addPerson,
    addPersonToItem,
    onApply,
    onClose
  ]);

  if (!isOpen || !results) return null;

  const hasMatchedPeople = results.matchedPeople && results.matchedPeople.length > 0;
  const hasNewPeople = results.newPeople && results.newPeople.length > 0;
  const hasDates = results.suggestedDates && results.suggestedDates.length > 0;
  const hasLocations = results.suggestedLocations && results.suggestedLocations.length > 0;
  const hasSummary = results.summary && results.summary.trim().length > 0;
  
  const hasAnyResults = hasMatchedPeople || hasNewPeople || hasDates || hasLocations || hasSummary;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <h3 className="text-lg font-semibold text-purple-800">
            AI-Extracted Metadata
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={acceptAll}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Accept All
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Clear
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!hasAnyResults ? (
        <div className="text-center py-6 text-gray-500">
          <p>No entities detected in the content.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary Section */}
          {hasSummary && (
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-purple-700 flex items-center gap-2">
                  <span>📝</span> Summary
                </h4>
                <button
                  onClick={() => setAcceptedSummary(!acceptedSummary)}
                  className={`px-3 py-1 rounded-full text-sm transition ${
                    acceptedSummary
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  {acceptedSummary ? '✓ Use' : 'Use'}
                </button>
              </div>
              <p className={`text-gray-700 ${acceptedSummary ? 'bg-green-50 p-2 rounded' : ''}`}>
                {results.summary}
              </p>
            </div>
          )}

          {/* People Section */}
          {(hasMatchedPeople || hasNewPeople) && (
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <h4 className="font-medium text-purple-700 flex items-center gap-2 mb-3">
                <span>👥</span> People Mentioned
              </h4>
              
              {/* Matched People */}
              {hasMatchedPeople && (
                <div className="mb-3">
                  <p className="text-sm text-gray-500 mb-2">
                    Found matches in your Related People:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {results.matchedPeople.map((match, index) => (
                      <button
                        key={index}
                        onClick={() => toggleMatchedPerson(index)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition ${
                          acceptedPeople.has(index)
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        {match.matchedPerson.photoURL ? (
                          <img 
                            src={match.matchedPerson.photoURL} 
                            alt="" 
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center text-xs text-blue-700">
                            {match.matchedPerson.name?.charAt(0) || '?'}
                          </span>
                        )}
                        <span>
                          {match.matchedPerson.name}
                          {match.matchType === 'partial' && (
                            <span className="text-xs text-gray-500 ml-1">
                              (matches "{match.suggestedName}")
                            </span>
                          )}
                        </span>
                        {acceptedPeople.has(index) && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* New People */}
              {hasNewPeople && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    New people to create:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {results.newPeople.map((name, index) => (
                      <button
                        key={index}
                        onClick={() => toggleNewPerson(name)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition ${
                          newPeopleToCreate.has(name)
                            ? 'bg-amber-100 text-amber-700 border border-amber-300'
                            : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-xs text-amber-700">
                          +
                        </span>
                        <span>{name}</span>
                        {newPeopleToCreate.has(name) && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dates Section */}
          {hasDates && (
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <h4 className="font-medium text-purple-700 flex items-center gap-2 mb-3">
                <span>📅</span> Dates Mentioned
              </h4>
              <div className="flex flex-wrap gap-2">
                {results.suggestedDates.map((date, index) => (
                  <button
                    key={index}
                    onClick={() => toggleDate(index)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition ${
                      acceptedDates.has(index)
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <span>📅</span>
                    <span>{date}</span>
                    {acceptedDates.has(index) && <span>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Locations Section */}
          {hasLocations && (
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <h4 className="font-medium text-purple-700 flex items-center gap-2 mb-3">
                <span>📍</span> Locations Mentioned
              </h4>
              <div className="flex flex-wrap gap-2">
                {results.suggestedLocations.map((location, index) => (
                  <button
                    key={index}
                    onClick={() => toggleLocation(index)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition ${
                      acceptedLocations.has(index)
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <span>📍</span>
                    <span>{location}</span>
                    {acceptedLocations.has(index) && <span>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {applyError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Error: {applyError}
        </div>
      )}

      {/* Action Buttons */}
      {hasAnyResults && (
        <div className="mt-5 flex justify-end gap-3">
          {onDismiss && (
            <button
              onClick={onDismiss}
              disabled={applying}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
            >
              Dismiss
            </button>
          )}
          <button
            onClick={handleApply}
            disabled={applying || (
              acceptedPeople.size === 0 && 
              newPeopleToCreate.size === 0 && 
              acceptedDates.size === 0 && 
              acceptedLocations.size === 0 && 
              !acceptedSummary
            )}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {applying ? (
              <>
                <span className="animate-spin">⏳</span>
                Applying...
              </>
            ) : (
              <>
                <span>✨</span>
                Apply Selected
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default AISuggestionsReview;
