import React, { useState, useEffect } from 'react';
import { useCitations } from '../hooks/useCitations';

/**
 * Component for selecting and attaching citation sources to items or people
 * Can be used inside Archive Item or Related Person forms
 */
function SourceSelector({ selectedSourceIds = [], onChange }) {
  const { sources, loading, addSource } = useCitations();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSourceData, setNewSourceData] = useState({
    title: '',
    citationDetails: '',
    url: '',
    repository: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filter sources based on search term
  const filteredSources = sources.filter(source => 
    source.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (source.repository && source.repository.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get selected sources details
  const selectedSources = sources.filter(source => selectedSourceIds.includes(source.id));

  const handleToggleSource = (sourceId) => {
    const newSelection = selectedSourceIds.includes(sourceId)
      ? selectedSourceIds.filter(id => id !== sourceId)
      : [...selectedSourceIds, sourceId];
    onChange(newSelection);
  };

  const handleRemoveSource = (sourceId) => {
    const newSelection = selectedSourceIds.filter(id => id !== sourceId);
    onChange(newSelection);
  };

  const handleAddNewSource = async (e) => {
    e.preventDefault();
    setError('');

    if (!newSourceData.title.trim()) {
      setError('Source title is required');
      return;
    }

    try {
      setSaving(true);
      const newSourceId = await addSource(newSourceData);
      
      // Add the new source to selection
      onChange([...selectedSourceIds, newSourceId]);
      
      // Reset form
      setNewSourceData({
        title: '',
        citationDetails: '',
        url: '',
        repository: ''
      });
      setIsAddingNew(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-500 text-sm">Loading sources...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">Citation Sources</h3>
        <button
          type="button"
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="text-sm text-primary hover:text-secondary font-medium"
        >
          {isAddingNew ? 'Cancel' : '+ Add New'}
        </button>
      </div>

      {/* Add New Source Form */}
      {isAddingNew && (
        <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-700 mb-3">Add New Source</h4>
          
          {error && (
            <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newSourceData.title}
                onChange={(e) => setNewSourceData({ ...newSourceData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="e.g., 1940 US Census"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repository
                </label>
                <input
                  type="text"
                  value={newSourceData.repository}
                  onChange={(e) => setNewSourceData({ ...newSourceData, repository: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="e.g., National Archives"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={newSourceData.url}
                  onChange={(e) => setNewSourceData({ ...newSourceData, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Citation Details
              </label>
              <input
                type="text"
                value={newSourceData.citationDetails}
                onChange={(e) => setNewSourceData({ ...newSourceData, citationDetails: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="e.g., Vol 4, Page 20"
              />
            </div>
            
            <button
              type="button"
              onClick={handleAddNewSource}
              disabled={saving}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-secondary transition duration-300 disabled:opacity-50 text-sm"
            >
              {saving ? 'Adding...' : 'Add Source & Select'}
            </button>
          </div>
        </div>
      )}

      {/* Selected Sources */}
      {selectedSources.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Selected Sources ({selectedSources.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedSources.map(source => (
              <div
                key={source.id}
                className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                <span className="truncate max-w-[200px]">{source.title}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSource(source.id)}
                  className="ml-2 text-blue-600 hover:text-blue-900 font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Select */}
      <div>
        <input
          type="text"
          placeholder="Search existing sources..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm mb-3"
        />
        
        {sources.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No sources available. Create one using the "Add New" button above.
          </p>
        ) : filteredSources.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No sources found matching "{searchTerm}"
          </p>
        ) : (
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
            {filteredSources.map(source => (
              <div
                key={source.id}
                onClick={() => handleToggleSource(source.id)}
                className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 flex items-center justify-between ${
                  selectedSourceIds.includes(source.id) ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {source.title}
                  </p>
                  {source.repository && (
                    <p className="text-xs text-gray-500 truncate">
                      {source.repository}
                    </p>
                  )}
                </div>
                {selectedSourceIds.includes(source.id) && (
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SourceSelector;
