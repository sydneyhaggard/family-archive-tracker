import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import ItemDetailModal from './ItemDetailModal';

function PersonDetailModal({ isOpen, onClose, person, user, onEdit, onDelete }) {
  const [linkedItems, setLinkedItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

  // Add ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen && !isItemModalOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose, isItemModalOpen]);

  // Fetch archive items linked to this person
  useEffect(() => {
    const fetchLinkedItems = async () => {
      if (!isOpen || !person?.id) return;
      
      setLoadingItems(true);
      try {
        // Query archive items where relatedPeopleIds contains this person's ID
        const itemsQuery = query(
          collection(db, 'archiveItems'),
          where('relatedPeopleIds', 'array-contains', person.id)
        );
        
        const snapshot = await getDocs(itemsQuery);
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setLinkedItems(items);
      } catch (error) {
        console.error('Error fetching linked items:', error);
        setLinkedItems([]);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchLinkedItems();
  }, [isOpen, person?.id]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLinkedItems([]);
      setSelectedItem(null);
      setIsItemModalOpen(false);
    }
  }, [isOpen]);

  if (!isOpen || !person) return null;

  const formatDate = (dateString) => {
    if (!dateString) return null;
    
    // If it's just a year (4 digits)
    if (/^\d{4}$/.test(dateString)) {
      return dateString;
    }
    
    // If it's year-month format (YYYY-MM)
    if (/^\d{4}-\d{2}$/.test(dateString)) {
      const [year, month] = dateString.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
    }
    
    // Try to parse as a full date
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    // Return original if can't parse
    return dateString;
  };

  const calculateAge = () => {
    if (!person.birthDate) return null;
    
    const birthDate = new Date(person.birthDate);
    const endDate = person.deathDate ? new Date(person.deathDate) : new Date();
    
    let age = endDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = endDate.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const age = calculateAge();

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${person.name}? This action cannot be undone.`)) {
      onDelete(person.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 glass-effect bg-opacity-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
            >
              &times;
            </button>
          </div>

          <div className="p-6">
            {/* Person Header Section */}
            <div className="flex items-start gap-6 mb-6 pb-6 border-b border-gray-200">
              {/* Photo */}
              <div className="flex-shrink-0">
                {person.photoURL ? (
                  <img
                    src={person.photoURL}
                    alt={person.name}
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-blue text-white flex items-center justify-center text-5xl font-bold border-4 border-gray-200 shadow-lg">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name and Quick Info */}
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-accent mb-2">{person.name}</h2>
                
                {/* Life Span */}
                {(person.birthDate || person.deathDate) && (
                  <p className="text-lg text-gray-600 mb-2">
                    {person.birthDate ? new Date(person.birthDate).getFullYear() : '?'}
                    {' – '}
                    {person.deathDate ? new Date(person.deathDate).getFullYear() : 'Present'}
                    {age !== null && (
                      <span className="text-gray-500 ml-2">
                        ({age} {person.deathDate ? 'years old' : 'years old'})
                      </span>
                    )}
                  </p>
                )}

                {/* GEDCOM ID if present */}
                {person.gedcomId && (
                  <span className="inline-block px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                    GEDCOM: {person.gedcomId}
                  </span>
                )}

                {/* Tags */}
                {person.tags && person.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {person.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Life Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Birth Info */}
              {(person.birthDate || person.birthLocation) && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <span>🎂</span> Birth
                  </h3>
                  {person.birthDate && (
                    <p className="text-gray-700">{formatDate(person.birthDate)}</p>
                  )}
                  {person.birthLocation && (
                    <p className="text-gray-600 text-sm mt-1">📍 {person.birthLocation}</p>
                  )}
                </div>
              )}

              {/* Death Info */}
              {(person.deathDate || person.deathLocation) && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <span>✝️</span> Death
                  </h3>
                  {person.deathDate && (
                    <p className="text-gray-700">{formatDate(person.deathDate)}</p>
                  )}
                  {person.deathLocation && (
                    <p className="text-gray-600 text-sm mt-1">📍 {person.deathLocation}</p>
                  )}
                </div>
              )}

              {/* Marriage Info */}
              {(person.marriageDate || person.marriageLocation) && (
                <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
                  <h3 className="text-sm font-semibold text-pink-800 mb-2 flex items-center gap-2">
                    <span>💒</span> Marriage
                  </h3>
                  {person.marriageDate && (
                    <p className="text-gray-700">{formatDate(person.marriageDate)}</p>
                  )}
                  {person.marriageLocation && (
                    <p className="text-gray-600 text-sm mt-1">📍 {person.marriageLocation}</p>
                  )}
                </div>
              )}

              {/* Burial Info */}
              {(person.burialDate || person.burialLocation) && (
                <div className="bg-stone-50 rounded-lg p-4 border border-stone-200">
                  <h3 className="text-sm font-semibold text-stone-800 mb-2 flex items-center gap-2">
                    <span>🪦</span> Burial
                  </h3>
                  {person.burialDate && (
                    <p className="text-gray-700">{formatDate(person.burialDate)}</p>
                  )}
                  {person.burialLocation && (
                    <p className="text-gray-600 text-sm mt-1">📍 {person.burialLocation}</p>
                  )}
                </div>
              )}
            </div>

            {/* Placeholder Indicator */}
            {person.isPlaceholder && (
              <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 flex items-center gap-2">
                  <span>ℹ️</span>
                  This person was created from GEDCOM data as a placeholder for parent/sibling relationships.
                </p>
              </div>
            )}

            {/* Description */}
            {person.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary mb-3">About</h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {person.description}
                </p>
              </div>
            )}

            {/* Residences */}
            {person.residences?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                  <span>🏠</span> Residences
                </h3>
                <div className="space-y-2">
                  {person.residences.map((residence, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      {residence.startDate && (
                        <span className="font-medium text-gray-700">{formatDate(residence.startDate)}: </span>
                      )}
                      {residence.location && (
                        <span className="text-gray-700">{residence.location}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Military Service */}
            {person.militaryService?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                  <span>🎖️</span> Military Service
                </h3>
                <div className="space-y-3">
                  {person.militaryService.map((service, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {service.enlistmentDate && (
                          <div>
                            <span className="font-medium text-gray-700">Enlistment:</span>{' '}
                            <span className="text-gray-900">{formatDate(service.enlistmentDate)}</span>
                          </div>
                        )}
                        {service.dischargeDate && (
                          <div>
                            <span className="font-medium text-gray-700">Discharge:</span>{' '}
                            <span className="text-gray-900">{formatDate(service.dischargeDate)}</span>
                          </div>
                        )}
                        {service.rank && (
                          <div>
                            <span className="font-medium text-gray-700">Rank:</span>{' '}
                            <span className="text-gray-900">{service.rank}</span>
                          </div>
                        )}
                        {service.company && (
                          <div>
                            <span className="font-medium text-gray-700">Unit:</span>{' '}
                            <span className="text-gray-900">{service.company}</span>
                          </div>
                        )}
                        {service.branch && (
                          <div>
                            <span className="font-medium text-gray-700">Branch:</span>{' '}
                            <span className="text-gray-900">{service.branch}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked Archive Items */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
                <span>📦</span> Linked Archive Items
                <span className="text-sm font-normal text-gray-500">
                  ({linkedItems.length} {linkedItems.length === 1 ? 'item' : 'items'})
                </span>
              </h3>
              
              {loadingItems ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : linkedItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {linkedItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedItem(item);
                        setIsItemModalOpen(true);
                      }}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary hover:bg-blue-50 transition-colors text-left w-full cursor-pointer"
                    >
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-200">
                        {item.files?.[0]?.type?.startsWith('image') ? (
                          <img
                            src={item.files[0].url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">
                            {item.files?.[0]?.type?.startsWith('video') ? '🎬' :
                             item.files?.[0]?.type?.startsWith('audio') ? '🎵' :
                             item.files?.[0] ? '📄' : '📦'}
                          </div>
                        )}
                      </div>
                      
                      {/* Item Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="px-2 py-0.5 bg-gray-200 rounded">{item.itemType}</span>
                          {item.relatedDate && (
                            <span>{new Date(item.relatedDate).getFullYear()}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-6 bg-gray-50 rounded-lg">
                  No archive items linked to this person yet.
                </p>
              )}
            </div>

            {/* Metadata */}
            {person.createdAt && (
              <div className="text-sm text-gray-500 mb-6">
                Added: {new Date(person.createdAt.seconds * 1000).toLocaleDateString()}
                {person.updatedAt && (
                  <span className="ml-4">
                    Updated: {new Date(person.updatedAt.seconds * 1000).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  onEdit(person);
                  onClose();
                }}
                className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition duration-300"
              >
                Delete
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Item Detail Modal */}
      <ItemDetailModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        user={user}
        onEdit={() => {}}
        onDelete={() => {
          // Refresh linked items after deletion
          setIsItemModalOpen(false);
          setSelectedItem(null);
          // Re-fetch linked items
          const fetchItems = async () => {
            if (!person?.id) return;
            try {
              const itemsQuery = query(
                collection(db, 'archiveItems'),
                where('relatedPeopleIds', 'array-contains', person.id)
              );
              const snapshot = await getDocs(itemsQuery);
              const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
              setLinkedItems(items);
            } catch (error) {
              console.error('Error refreshing linked items:', error);
            }
          };
          fetchItems();
        }}
      />
    </div>
  );
}

export default PersonDetailModal;
