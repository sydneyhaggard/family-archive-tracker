import React, { useState } from 'react';
import { useCitations } from '../hooks/useCitations';

/**
 * Component for managing citation sources
 * Displays a list of sources with add/edit/delete functionality
 */
function SourceManager({ user }) {
  const { sources, loading, error, addSource, updateSource, deleteSource } = useCitations();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    citationDetails: '',
    url: '',
    repository: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter sources based on search term
  const filteredSources = sources.filter(source => 
    source.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (source.citationDetails && source.citationDetails.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (source.repository && source.repository.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenModal = (source = null) => {
    if (source) {
      setEditingSource(source);
      setFormData({
        title: source.title || '',
        citationDetails: source.citationDetails || '',
        url: source.url || '',
        repository: source.repository || ''
      });
    } else {
      setEditingSource(null);
      setFormData({
        title: '',
        citationDetails: '',
        url: '',
        repository: ''
      });
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSource(null);
    setFormData({
      title: '',
      citationDetails: '',
      url: '',
      repository: ''
    });
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Source title is required');
      return;
    }

    try {
      setSaving(true);

      if (editingSource) {
        await updateSource(editingSource.id, formData);
      } else {
        await addSource(formData);
      }
      
      handleCloseModal();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sourceId) => {
    if (!window.confirm('Are you sure you want to delete this source? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteSource(sourceId);
    } catch (err) {
      alert(`Error deleting source: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-primary">Citation Sources</h1>
              <p className="text-gray-600 mt-1">Manage sources for your archive items and related people</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              + Add Source
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search sources by title, details, or repository..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            Error loading sources: {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">Loading sources...</p>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No sources found matching your search.' : 'No sources created yet. Click "Add Source" to get started!'}
            </p>
          </div>
        ) : (
          /* Sources Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSources.map(source => (
              <div
                key={source.id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {source.title}
                  </h3>
                  
                  {source.repository && (
                    <div className="flex items-center text-sm text-gray-500 mb-2">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {source.repository}
                    </div>
                  )}

                  {source.citationDetails && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                      {source.citationDetails}
                    </p>
                  )}

                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-4"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Source
                    </a>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleOpenModal(source)}
                      className="flex-1 px-4 py-2 bg-secondary text-white rounded-lg font-medium hover:bg-primary transition duration-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(source.id)}
                      className="flex-1 px-4 py-2 border-2 border-red-500 text-red-500 rounded-lg font-medium hover:bg-red-500 hover:text-white transition duration-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 glass-effect bg-opacity-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                <button
                  onClick={handleCloseModal}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
                  disabled={saving}
                >
                  &times;
                </button>
                <h2 className="text-2xl font-bold text-primary">
                  {editingSource ? 'Edit Source' : 'Add New Source'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {formError && (
                  <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {formError}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Source Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., 1940 US Census, Aunt Susan's Oral History"
                  />
                </div>

                {/* Repository */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Repository
                  </label>
                  <input
                    type="text"
                    value={formData.repository}
                    onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., National Archives, FamilySearch, Personal Collection"
                  />
                </div>

                {/* Citation Details */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Citation Details
                  </label>
                  <textarea
                    value={formData.citationDetails}
                    onChange={(e) => setFormData({ ...formData, citationDetails: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Vol 4, Page 20, Enumeration District 123"
                  />
                </div>

                {/* URL */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="https://..."
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={saving}
                    className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : (editingSource ? 'Update Source' : 'Add Source')}
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

export default SourceManager;
