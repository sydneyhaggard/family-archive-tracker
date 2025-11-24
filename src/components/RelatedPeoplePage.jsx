import React, { useState, useMemo, useRef } from 'react';
import { useRelatedPeople } from '../hooks/useRelatedPeople';

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
    photoURL: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const fileInputRef = useRef(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sort people by birth date ascending (oldest first)
  // People without birth dates go to the end
  const sortedPeople = useMemo(() => {
    return [...peopleList].sort((a, b) => {
      // If both have birth dates, compare them
      if (a.birthDate && b.birthDate) {
        return new Date(a.birthDate) - new Date(b.birthDate);
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
        photoURL: person.photoURL || ''
      });
      setPhotoPreview(person.photoURL || null);
    } else {
      setEditingPerson(null);
      setFormData({
        name: '',
        description: '',
        birthDate: '',
        photoURL: ''
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
      photoURL: ''
    });
    setFormError('');
    setPhotoPreview(null);
    setSelectedPhotoFile(null);
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
          birthDate: formData.birthDate
        });

        // Handle photo upload/update
        if (selectedPhotoFile) {
          setUploadingPhoto(true);
          await uploadProfilePhoto(editingPerson.id, selectedPhotoFile);
          setUploadingPhoto(false);
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
          photoURL: ''
        });

        // Upload photo if selected
        if (selectedPhotoFile) {
          setUploadingPhoto(true);
          await uploadProfilePhoto(personId, selectedPhotoFile);
          setUploadingPhoto(false);
        }
      }
      
      handleCloseModal();
    } catch (err) {
      setFormError(err.message);
      setUploadingPhoto(false);
    } finally {
      setSaving(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-primary">Related People</h1>
              <p className="text-gray-600 mt-1">Manage people related to your archive items</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              + Add Person
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search and Pagination Controls */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <input
            type="text"
            placeholder="Search by name or description..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Show:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-gray-600">per page</span>
          </div>
        </div>

        {/* Results Summary */}
        {!loading && filteredPeople.length > 0 && (
          <div className="mb-4 text-sm text-gray-600">
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
            <p className="text-gray-500 text-lg">Loading people...</p>
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">
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
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-800 mb-1">
                          {person.name}
                        </h3>
                        {person.birthDate && (
                          <p className="text-sm text-gray-500">
                            Born: {new Date(person.birthDate).toLocaleDateString()}
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
                        <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold flex-shrink-0 ml-3">
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {person.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {person.description}
                      </p>
                    )}

                    <div className="flex gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleOpenModal(person)}
                        className="flex-1 px-4 py-2 bg-secondary text-white rounded-lg font-medium hover:bg-primary transition duration-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(person.id)}
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
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
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
                      <p className="text-xs text-gray-500 mt-1">Max 2MB. JPG, PNG, or GIF.</p>
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
    </div>
  );
}

export default RelatedPeoplePage;
