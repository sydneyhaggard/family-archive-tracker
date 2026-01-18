import React, { useState, useMemo, useRef } from 'react';
import { useRelatedPeople } from '../hooks/useRelatedPeople';
import { TableFieldEditor } from './TableFieldEditor';
import PersonDetailModal from './PersonDetailModal';

/**
 * Format a date string for display, handling partial dates (year only, year-month, etc.)
 * @param {string} dateStr - Date string in various formats
 * @returns {string} - Formatted date for display
 */
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  
  // If it's just a year (4 digits)
  if (/^\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  // If it's year-month format (YYYY-MM)
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
  }
  
  // Try to parse as a full date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString();
  }
  
  // Return original if can't parse
  return dateStr;
}

function RelatedPeoplePage({ user }) {
  const { 
    peopleList, 
    loading, 
    error, 
    addPerson, 
    updatePerson, 
    deletePerson,
    uploadProfilePhoto,
    deleteProfilePhoto
  } = useRelatedPeople();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    birthDate: '',
    birthLocation: '',
    deathDate: '',
    deathLocation: '',
    burialDate: '',
    burialLocation: '',
    marriageDate: '',
    marriageLocation: '',
    photoURL: '',
    residences: [],
    militaryService: []
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const fileInputRef = useRef(null);
  
  // Detail modal state
  const [viewingPerson, setViewingPerson] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Bulk delete state
  const [selectedPeople, setSelectedPeople] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Sort people by birth date descending (newest first)
  // People without birth dates go to the end
  const sortedPeople = useMemo(() => {
    return [...peopleList].sort((a, b) => {
      // If both have birth dates, compare them (descending)
      if (a.birthDate && b.birthDate) {
        return new Date(b.birthDate) - new Date(a.birthDate);
      }
      // If only a has birth date, a comes first
      if (a.birthDate && !b.birthDate) {
        return -1;
      }
      // If only b has birth date, b comes first
      if (!a.birthDate && b.birthDate) {
        return 1;
      }
      // If neither has birth date, sort by name
      return a.name.localeCompare(b.name);
    });
  }, [peopleList]);

  // Filter people based on search term
  const filteredPeople = useMemo(() => {
    return sortedPeople.filter(person => 
      person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (person.description && person.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [sortedPeople, searchTerm]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredPeople.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPeople = filteredPeople.slice(startIndex, endIndex);

  // Reset to first page when search term changes or items per page changes
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleOpenModal = (person = null) => {
    if (person) {
      setEditingPerson(person);
      setFormData({
        name: person.name || '',
        description: person.description || '',
        birthDate: person.birthDate || '',
        birthLocation: person.birthLocation || '',
        deathDate: person.deathDate || '',
        deathLocation: person.deathLocation || '',
        burialDate: person.burialDate || '',
        burialLocation: person.burialLocation || '',
        marriageDate: person.marriageDate || '',
        marriageLocation: person.marriageLocation || '',
        photoURL: person.photoURL || '',
        residences: person.residences || [],
        militaryService: person.militaryService || []
      });
      setPhotoPreview(person.photoURL || null);
    } else {
      setEditingPerson(null);
      setFormData({
        name: '',
        description: '',
        birthDate: '',
        birthLocation: '',
        deathDate: '',
        deathLocation: '',
        burialDate: '',
        burialLocation: '',
        marriageDate: '',
        marriageLocation: '',
        photoURL: '',
        residences: [],
        militaryService: []
      });
      setPhotoPreview(null);
    }
    setSelectedPhotoFile(null);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPerson(null);
    setFormData({
      name: '',
      description: '',
      birthDate: '',
      birthLocation: '',
      deathDate: '',
      deathLocation: '',
      burialDate: '',
      burialLocation: '',
      marriageDate: '',
      marriageLocation: '',
      photoURL: '',
      residences: [],
      militaryService: []
    });
    setFormError('');
    setPhotoPreview(null);
    setSelectedPhotoFile(null);
  };

  const handleViewPerson = (person) => {
    setViewingPerson(person);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setViewingPerson(null);
  };

  const handleEditFromDetail = (person) => {
    handleOpenModal(person);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setFormError('Please select an image file');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setFormError('Profile photo must be less than 2MB');
      return;
    }

    setSelectedPhotoFile(file);
    setFormError('');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setSelectedPhotoFile(null);
    setPhotoPreview(null);
    setFormData({ ...formData, photoURL: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }

    try {
      setSaving(true);
      
      if (editingPerson) {
        // Update existing person
        await updatePerson(editingPerson.id, {
          name: formData.name,
          description: formData.description,
          birthDate: formData.birthDate,
          birthLocation: formData.birthLocation,
          deathDate: formData.deathDate,
          deathLocation: formData.deathLocation,
          marriageDate: formData.marriageDate,
          marriageLocation: formData.marriageLocation
        });

        // Handle photo upload/update
        if (selectedPhotoFile) {
          setUploadingPhoto(true);
          await uploadProfilePhoto(editingPerson.id, selectedPhotoFile);
        } else if (!photoPreview && editingPerson.photoURL) {
          // User removed the photo
          await deleteProfilePhoto(editingPerson.id, editingPerson.photoURL);
        }
      } else {
        // Add new person
        const personId = await addPerson({
          name: formData.name,
          description: formData.description,
          birthDate: formData.birthDate,
          birthLocation: formData.birthLocation,
          deathDate: formData.deathDate,
          deathLocation: formData.deathLocation,
          marriageDate: formData.marriageDate,
          marriageLocation: formData.marriageLocation,
          photoURL: ''
        });

        // Upload photo if selected
        if (selectedPhotoFile) {
          setUploadingPhoto(true);
          await uploadProfilePhoto(personId, selectedPhotoFile);
        }
      }
      
      handleCloseModal();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  };

  const handleDelete = async (personId) => {
    if (!window.confirm('Are you sure you want to delete this person? This action cannot be undone.')) {
      return;
    }

    try {
      await deletePerson(personId);
    } catch (err) {
      alert(`Error deleting person: ${err.message}`);
    }
  };

  const handleToggleSelect = (personId) => {
    setSelectedPeople(prev => {
      const newSet = new Set(prev);
      if (newSet.has(personId)) {
        newSet.delete(personId);
      } else {
        newSet.add(personId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPeople.size === paginatedPeople.length) {
      setSelectedPeople(new Set());
    } else {
      setSelectedPeople(new Set(paginatedPeople.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPeople.size === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedPeople.size} selected ${selectedPeople.size === 1 ? 'person' : 'people'}? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      setBulkDeleting(true);
      const deletePromises = Array.from(selectedPeople).map(id => deletePerson(id));
      await Promise.all(deletePromises);
      setSelectedPeople(new Set());
    } catch (err) {
      console.error('Error during bulk delete:', err);
      alert(`Error deleting people: ${err.message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-transparent shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="headline pt-10">Related People</h1>
              <p className="text-teal mt-1">Manage people related to your archive items</p>
            </div>
            <div className="flex items-center gap-3">
              {selectedPeople.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition duration-300 flex items-center gap-2 font-semibold"
                >
                  {bulkDeleting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete {selectedPeople.size}
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => handleOpenModal()}
                className="bg-secondary hover:bg-primary text-white px-2 py-2 rounded-full transition duration-300"
              >
                <img className='w-8 h-8' src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAADdElEQVR4nO2aTU8UQRCGx4CAwci3eNQjgah/QgVFAW+g3jByEQh6BTyrJxMSf4cGjSZqFCXitxcFF08qByPeRAiYxxS8Ezu6O7s79Mos4U0m2Wz3Vr01XdVdXbVBsIVNCqAW6ASuAOPANPAdWNJjn99rzOZ0ADVBEgBUAGeAu8Av8scKcAc4DZRvhAE7gAvAnENqEbgPDGtlmuyNA9v11Og7GxsBHug3Ib4AQ/Zy/pcRx4CPDoHnQC9QFUNWNXAWeOHImwXaCu1G1x2FL4HDHuW3Aq8d+WPeVwfYI+KGH8B5oMSrkjU9JcAAsOCsdqMv4fu03GjXafEiOFrnfmBGOlPGYb0CGxyBz4B6b2yz664BHku3xeSe9cRE6E6TQKV3ttk5VAJPHTfLP2acwDZ3qi0I09x41DleMRZniw0Du+AxkWPMLIhTaz6HXXhOnA8SAmDQCf7sLgZcdM4J71tsXAClwBtxG8w2uVypguFQkDAAR8VtLnJVlLyt7hBBAgFsc3bSnqiJlsUaej0qt+1z0qO8c+J4O+o+saKMtMqj4lV4PiiXgOW0PIEu6bznS2khDDEADyX2ePA3gKsaHA6Sb8glib2cbtCuoIYTRWBIl8TeSDf4QYNNRWBIs8ROpxuc12BtERhSL7Ff0w3aTmAoiyF4gviYiKGvXL9dTJIhj3wbMl9ErtUQ5VqbJtjHNdhRBIacjNp+wwNxpNgPxE4N3i+iFKU9UzIWJo3VSTWEteQ2TBp3ZZpkBWXDWY+KJ+JssZkA9InjrahJpzTpRZDci9UrcezOdtB81sQjQcIAtIvbp6xtCJX2keVJKz68Fbf+XCuMYa13IEgI+POCZ3JuCll/Qj+yotj+grPMzucg8FOc8mtlqD8RvoG6grHMLa9Kicu1OAIqVDhGlZCNKGLvBKbEYSp2n1Fvw7qzYVuhwTvb6IPviXTPrrvho0ZPynGzA97YRsdESjotK9/rS3Cj42YLKiiXehH+7xY75AS2udNu30oqnA0AFZTbPJ7Y1soIz4nVwC5o713d13DZUS32XJx/MSgO+py0I3Qlb93iXFZn0ElnUEZq6fWo6k7N6jaV6bHPLboUjWpuWCcI047+jfoHhOVmPVZQ1hUgXyzrZtq9IQakgxWUrRZrtzbgpnqP35w/1djnd3Y91ZzjGe8TWwiKH78BmFs3aLUPAL8AAAAASUVORK5CYII=" alt="add--v1"/>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search and Pagination Controls */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <label className="flex items-center gap-2 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPeople.size === paginatedPeople.length && paginatedPeople.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium">Select All</span>
            </label>
            <input
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="flex-1 px-4 py-3 input outlined focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-white">Show:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(e.target.value)}
              className="button small outlined focus:outline-none focus:ring-2 focus:ring-teal"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-white">per page</span>
          </div>
        </div>

        {/* Results Summary */}
        {!loading && filteredPeople.length > 0 && (
          <div className="mb-4 text-sm text-white">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredPeople.length)} of {filteredPeople.length} people
            {searchTerm && ` (filtered)`}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            Error loading people: {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-16">
            <p className="text-teal text-lg">Loading people...</p>
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-teal text-lg">
              {searchTerm ? 'No people found matching your search.' : 'No people added yet. Click "Add Person" to get started!'}
            </p>
          </div>
        ) : (
          <>
            {/* People Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedPeople.map(person => (
                <div
                  key={person.id}
                  className="glass-effect border-1 border-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer relative"
                  onClick={() => handleViewPerson(person)}
                >
                  <div className="absolute top-4 left-4 z-10">
                    <input
                      type="checkbox"
                      checked={selectedPeople.has(person.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(person.id);
                      }}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>
                  <div className="p-6 pl-12">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-white mb-1">
                          {person.name}
                        </h3>
                        {/* Birth Info */}
                        {(person.birthDate || person.birthLocation) && (
                          <p className="text-sm text-secondary-light">
                            🎂 {person.birthDate ? formatDisplayDate(person.birthDate) : ''}
                            {person.birthDate && person.birthLocation ? ' • ' : ''}
                            {person.birthLocation || ''}
                          </p>
                        )}
                        {/* Death Info */}
                        {(person.deathDate || person.deathLocation) && (
                          <p className="text-sm text-gray-400">
                            ✝️ {person.deathDate ? formatDisplayDate(person.deathDate) : ''}
                            {person.deathDate && person.deathLocation ? ' • ' : ''}
                            {person.deathLocation || ''}
                          </p>
                        )}
                        {/* Marriage Info */}
                        {(person.marriageDate || person.marriageLocation) && (
                          <p className="text-sm text-pink-300">
                            💒 {person.marriageDate ? formatDisplayDate(person.marriageDate) : ''}
                            {person.marriageDate && person.marriageLocation ? ' • ' : ''}
                            {person.marriageLocation || ''}
                          </p>
                        )}
                      </div>
                      {person.photoURL ? (
                        <img
                          src={person.photoURL}
                          alt={person.name}
                          className="w-14 h-14 rounded-full object-cover flex-shrink-0 ml-3 border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-blue text-white flex items-center justify-center text-xl font-bold flex-shrink-0 ml-3">
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {person.description && (
                      <p className="text-white text-sm mb-4 line-clamp-3">
                        {person.description}
                      </p>
                    )}

                    <div className="flex gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPerson(person);
                        }}
                        className="flex-1 button outlined"
                      >
                        View
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(person);
                        }}
                        className="flex-1 button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(person.id);
                        }}
                        className="flex-1 px-4 py-2 border-2 border-red-500 text-red-500 rounded-lg font-medium hover:bg-red-500 hover:text-white transition duration-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="button small outlined disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="button small outlined disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-secondary">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="button small outlined disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="button small outlined disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 glass-effect bg-opacity-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                <button
                  onClick={handleCloseModal}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
                  disabled={saving || uploadingPhoto}
                >
                  &times;
                </button>
                <h2 className="text-2xl font-bold text-primary">
                  {editingPerson ? 'Edit Person' : 'Add New Person'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {formError && (
                  <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {formError}
                  </div>
                )}

                {/* Profile Photo */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Profile Photo
                  </label>
                  <div className="flex items-center gap-4">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                        id="photo-upload"
                      />
                      <div className="flex gap-2">
                        <label
                          htmlFor="photo-upload"
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition duration-300 inline-block"
                        >
                          {photoPreview ? 'Change Photo' : 'Upload Photo'}
                        </label>
                        {photoPreview && (
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition duration-300"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-teal mt-1">Max 2MB. JPG, PNG, or GIF.</p>
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter person's name"
                  />
                </div>

                {/* Birth Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Birth Date
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Birth Location */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Birth Location
                  </label>
                  <input
                    type="text"
                    value={formData.birthLocation}
                    onChange={(e) => setFormData({ ...formData, birthLocation: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="City, State, Country"
                  />
                </div>

                {/* Death Date & Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Death Date
                    </label>
                    <input
                      type="date"
                      value={formData.deathDate}
                      onChange={(e) => setFormData({ ...formData, deathDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Death Location
                    </label>
                    <input
                      type="text"
                      value={formData.deathLocation}
                      onChange={(e) => setFormData({ ...formData, deathLocation: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="City, State, Country"
                    />
                  </div>
                </div>

                {/* Marriage Date & Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Marriage Date
                    </label>
                    <input
                      type="date"
                      value={formData.marriageDate}
                      onChange={(e) => setFormData({ ...formData, marriageDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Marriage Location
                    </label>
                    <input
                      type="text"
                      value={formData.marriageLocation}
                      onChange={(e) => setFormData({ ...formData, marriageLocation: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="City, State, Country"
                    />
                  </div>
                </div>

                {/* Burial Date & Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Burial Date
                    </label>
                    <input
                      type="date"
                      value={formData.burialDate}
                      onChange={(e) => setFormData({ ...formData, burialDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Burial Location
                    </label>
                    <input
                      type="text"
                      value={formData.burialLocation}
                      onChange={(e) => setFormData({ ...formData, burialLocation: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Cemetery, City, State"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter additional information about this person..."
                  />
                </div>

                {/* Residences */}
                <TableFieldEditor
                  title="Residences"
                  data={formData.residences}
                  onChange={(newResidences) => setFormData({ ...formData, residences: newResidences })}
                  columns={[
                    { key: 'startDate', label: 'Date', type: 'date', placeholder: 'Start date' },
                    { key: 'location', label: 'Location', type: 'text', placeholder: 'City, State, Country' }
                  ]}
                />

                {/* Military Service */}
                <TableFieldEditor
                  title="Military Service"
                  data={formData.militaryService}
                  onChange={(newMilitary) => setFormData({ ...formData, militaryService: newMilitary })}
                  columns={[
                    { key: 'enlistmentDate', label: 'Enlistment', type: 'date', placeholder: 'Enlistment date' },
                    { key: 'dischargeDate', label: 'Discharge', type: 'date', placeholder: 'Discharge date' },
                    { key: 'rank', label: 'Rank', type: 'text', placeholder: 'Rank' },
                    { key: 'company', label: 'Company/Unit', type: 'text', placeholder: 'Company or unit' },
                    { key: 'branch', label: 'Branch', type: 'text', placeholder: 'Army, Navy, etc.' }
                  ]}
                />

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={saving || uploadingPhoto}
                    className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || uploadingPhoto}
                    className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50"
                  >
                    {uploadingPhoto ? 'Uploading Photo...' : saving ? 'Saving...' : (editingPerson ? 'Update Person' : 'Add Person')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Person Detail Modal */}
      <PersonDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        person={viewingPerson}
        user={user}
        onEdit={handleEditFromDetail}
        onDelete={handleDelete}
      />
    </div>
  );
}

export default RelatedPeoplePage;
