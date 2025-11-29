import React, { useState } from 'react';
import { useCitations } from '../hooks/useCitations';
import { MAX_FILE_SIZE } from '../config/firebase';
import MediaGallery from './MediaGallery';

/**
 * Component for managing citation sources
 * Displays a list of sources with add/edit/delete functionality and file uploads
 */
function SourceManager({ user }) {
  const { sources, loading, error, addSource, updateSource, deleteSource, uploadSourceFile, deleteSourceFile, FILE_ACCEPT_STRING } = useCitations();
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
  const [uploadingFile, setUploadingFile] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

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
    if (!window.confirm('Are you sure you want to delete this source? This will also delete all attached files. This action cannot be undone.')) {
      return;
    }

    try {
      await deleteSource(sourceId);
    } catch (err) {
      alert(`Error deleting source: ${err.message}`);
    }
  };

  const handleFileUpload = async (e, sourceId) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingFile(true);
    setFormError('');

    try {
      for (const file of files) {
        await uploadSourceFile(sourceId, file);
      }
    } catch (err) {
      setFormError(err.message);
      alert(`Error uploading file: ${err.message}`);
    } finally {
      setUploadingFile(false);
      // Clear the file input
      e.target.value = '';
    }
  };

  const handleFileDelete = async (sourceId, filePath, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      await deleteSourceFile(sourceId, filePath);
    } catch (err) {
      alert(`Error deleting file: ${err.message}`);
    }
  };

  const openGallery = (files, index) => {
    setGalleryFiles(files);
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📕';
    return '📄';
  };

  const getFileTypeLabel = (type) => {
    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Video';
    if (type.startsWith('audio/')) return 'Audio';
    if (type.includes('pdf')) return 'PDF';
    if (type.startsWith('text/')) return 'Text';
    return 'File';
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
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-3"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Source
                    </a>
                  )}

                  {/* Attached Files Section */}
                  {source.files && source.files.length > 0 && (
                    <div className="mb-3 border-t border-gray-100 pt-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        Attached Files ({source.files.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {source.files.slice(0, 4).map((file, index) => (
                          <button
                            key={file.path}
                            onClick={() => openGallery(source.files, index)}
                            className="relative group"
                            title={file.name}
                          >
                            {file.type.startsWith('image/') ? (
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-12 h-12 object-cover rounded-lg border border-gray-200 hover:border-primary transition-colors"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-xl hover:border-primary transition-colors">
                                {getFileIcon(file.type)}
                              </div>
                            )}
                          </button>
                        ))}
                        {source.files.length > 4 && (
                          <button
                            onClick={() => openGallery(source.files, 4)}
                            className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 hover:border-primary transition-colors"
                          >
                            +{source.files.length - 4}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Upload Button */}
                  <div className="mb-3">
                    <label className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Attach File
                      <input
                        type="file"
                        multiple
                        accept={FILE_ACCEPT_STRING}
                        onChange={(e) => handleFileUpload(e, source.id)}
                        className="hidden"
                        disabled={uploadingFile}
                      />
                    </label>
                    {uploadingFile && (
                      <span className="ml-2 text-sm text-gray-500">Uploading...</span>
                    )}
                  </div>

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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
                <button
                  onClick={handleCloseModal}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
                  disabled={saving || uploadingFile}
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

                {/* File Upload Section (only when editing) */}
                {editingSource && (
                  <div className="border-t border-gray-200 pt-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Attached Files
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                      Upload text files, images, videos, or audio files. Max size: {(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB per file.
                    </p>
                    
                    {/* File Upload Input */}
                    <div className="mb-4">
                      <label className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-secondary transition-colors">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        {uploadingFile ? 'Uploading...' : 'Upload Files'}
                        <input
                          type="file"
                          multiple
                          accept={FILE_ACCEPT_STRING}
                          onChange={(e) => handleFileUpload(e, editingSource.id)}
                          className="hidden"
                          disabled={uploadingFile}
                        />
                      </label>
                    </div>

                    {/* Current Files List */}
                    {editingSource.files && editingSource.files.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="max-h-60 overflow-y-auto">
                          {editingSource.files.map((file, index) => (
                            <div
                              key={file.path}
                              className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-2xl flex-shrink-0">{getFileIcon(file.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {getFileTypeLabel(file.type)} • {(file.size / (1024 * 1024)).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openGallery(editingSource.files, index)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View file"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFileDelete(editingSource.id, file.path, file.name)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete file"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="mt-2 text-sm text-gray-500">No files attached yet</p>
                        <p className="text-xs text-gray-400 mt-1">Upload text, images, videos, or audio files</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={saving || uploadingFile}
                    className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || uploadingFile}
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

      {/* Media Gallery */}
      <MediaGallery
        files={galleryFiles}
        initialIndex={galleryIndex}
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  );
}

export default SourceManager;
