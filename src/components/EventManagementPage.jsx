import React, { useState, useEffect } from 'react';
import { useArchiveEvents } from '../hooks/useArchiveEvents';

function EventManagementPage({ user }) {
  const { 
    userEvents, 
    loading, 
    error, 
    createEvent, 
    updateEvent, 
    deleteEvent,
    getEventItemsCount,
    linkMultipleItemsToEvent,
    getAllUserItems
  } = useArchiveEvents();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dateStart: '',
    dateEnd: '',
    location: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [itemCounts, setItemCounts] = useState({});
  
  // Item selection modal state
  const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
  const [selectedEventForItems, setSelectedEventForItems] = useState(null);
  const [allUserItems, setAllUserItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [originalItemIds, setOriginalItemIds] = useState(new Set());
  const [loadingItems, setLoadingItems] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [lastClickedIndex, setLastClickedIndex] = useState(null);

  // Filter events based on search term
  const filteredEvents = userEvents.filter(event => 
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (event.location && event.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Load item counts for all events
  useEffect(() => {
    const loadCounts = async () => {
      const counts = {};
      for (const event of userEvents) {
        counts[event.id] = await getEventItemsCount(event.id);
      }
      setItemCounts(counts);
    };
    
    if (userEvents.length > 0) {
      loadCounts();
    }
  }, [userEvents, getEventItemsCount]);

  const handleOpenModal = (event = null) => {
    if (event) {
      setEditingEvent(event);
      // Convert Firestore timestamps to date strings for input fields
      const dateStart = event.dateStart?.toDate ? 
        event.dateStart.toDate().toISOString().split('T')[0] : 
        event.dateStart || '';
      const dateEnd = event.dateEnd?.toDate ? 
        event.dateEnd.toDate().toISOString().split('T')[0] : 
        event.dateEnd || '';
      
      setFormData({
        title: event.title || '',
        description: event.description || '',
        dateStart: dateStart,
        dateEnd: dateEnd,
        location: event.location || ''
      });
    } else {
      setEditingEvent(null);
      setFormData({
        title: '',
        description: '',
        dateStart: '',
        dateEnd: '',
        location: ''
      });
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      dateStart: '',
      dateEnd: '',
      location: ''
    });
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Event title is required');
      return;
    }

    if (!formData.dateStart) {
      setFormError('Start date is required');
      return;
    }

    try {
      setSaving(true);
      
      const eventData = {
        title: formData.title,
        description: formData.description,
        dateStart: new Date(formData.dateStart),
        dateEnd: formData.dateEnd ? new Date(formData.dateEnd) : new Date(formData.dateStart),
        location: formData.location
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, eventData);
      } else {
        await createEvent(eventData);
      }
      
      handleCloseModal();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    const itemCount = itemCounts[eventId] || 0;
    const message = itemCount > 0 
      ? `Are you sure you want to delete this collection? This will unlink ${itemCount} archive item(s). This action cannot be undone.`
      : 'Are you sure you want to delete this collection? This action cannot be undone.';
    
    if (!window.confirm(message)) {
      return;
    }

    try {
      await deleteEvent(eventId);
    } catch (err) {
      alert(`Error deleting collection: ${err.message}`);
    }
  };

  // Open item selector modal for an event
  const handleOpenItemSelector = async (event) => {
    setSelectedEventForItems(event);
    setLoadingItems(true);
    setItemSearchTerm('');
    
    try {
      // Load all user's archive items
      const items = await getAllUserItems();
      setAllUserItems(items);
      
      // Pre-select items already linked to this event
      const linkedIds = new Set(
        items.filter(item => item.eventId === event.id).map(item => item.id)
      );
      setSelectedItemIds(linkedIds);
      setOriginalItemIds(new Set(linkedIds));
    } catch (err) {
      console.error('Error loading items:', err);
      alert('Error loading archive items');
    } finally {
      setLoadingItems(false);
    }
    
    setIsItemSelectorOpen(true);
  };

  const handleCloseItemSelector = () => {
    setIsItemSelectorOpen(false);
    setSelectedEventForItems(null);
    setAllUserItems([]);
    setSelectedItemIds(new Set());
    setOriginalItemIds(new Set());
    setItemSearchTerm('');
    setLastClickedIndex(null);
  };

  const handleToggleItem = (itemId, index, event) => {
    const filteredItems = getFilteredItems();
    
    // Handle shift+click for range selection
    if (event?.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      
      // Determine if we're selecting or deselecting based on the target item
      const shouldSelect = !selectedItemIds.has(itemId);
      
      setSelectedItemIds(prev => {
        const newSet = new Set(prev);
        for (let i = start; i <= end; i++) {
          const item = filteredItems[i];
          if (item) {
            if (shouldSelect) {
              newSet.add(item.id);
            } else {
              newSet.delete(item.id);
            }
          }
        }
        return newSet;
      });
    } else {
      // Regular click - toggle single item
      setSelectedItemIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    }
    
    // Always update last clicked index
    setLastClickedIndex(index);
  };

  const handleSelectAll = () => {
    const filteredItems = getFilteredItems();
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      filteredItems.forEach(item => newSet.add(item.id));
      return newSet;
    });
  };

  const handleDeselectAll = () => {
    const filteredItems = getFilteredItems();
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      filteredItems.forEach(item => newSet.delete(item.id));
      return newSet;
    });
  };

  const getFilteredItems = () => {
    if (!itemSearchTerm.trim()) {
      return allUserItems;
    }
    const search = itemSearchTerm.toLowerCase();
    return allUserItems.filter(item => 
      item.title?.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search) ||
      item.itemType?.toLowerCase().includes(search) ||
      item.tags?.some(tag => tag.toLowerCase().includes(search))
    );
  };

  const handleSaveItemSelections = async () => {
    if (!selectedEventForItems) return;
    
    try {
      setSavingItems(true);
      
      // Find items to link (in selected but not in original)
      const itemsToLink = [...selectedItemIds].filter(id => !originalItemIds.has(id));
      
      // Find items to unlink (in original but not in selected)
      const itemsToUnlink = [...originalItemIds].filter(id => !selectedItemIds.has(id));
      
      if (itemsToLink.length > 0 || itemsToUnlink.length > 0) {
        await linkMultipleItemsToEvent(selectedEventForItems.id, itemsToLink, itemsToUnlink);
        
        // Refresh item counts
        const counts = { ...itemCounts };
        counts[selectedEventForItems.id] = selectedItemIds.size;
        setItemCounts(counts);
      }
      
      handleCloseItemSelector();
    } catch (err) {
      alert(`Error saving item selections: ${err.message}`);
    } finally {
      setSavingItems(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-primary">Archive Collections</h1>
              <p className="text-gray-600 mt-1">Manage collections and link them to your archive items</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              + Create Collection
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
            placeholder="Search collections by title, description, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            Error loading collections: {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">Loading collections...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No collections found matching your search.' : 'No collections created yet. Click "Create Collection" to get started!'}
            </p>
          </div>
        ) : (
          /* Events Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map(event => (
              <div
                key={event.id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        {event.title}
                      </h3>
                      <div className="flex items-center text-sm text-gray-500 mb-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDateRange(event.dateStart, event.dateEnd)}
                      </div>
                      {event.location && (
                        <div className="flex items-center text-sm text-gray-500 mb-2">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {event.location}
                        </div>
                      )}
                    </div>
                  </div>

                  {event.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {event.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mb-4 pt-3 border-t border-gray-200">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      📁 {itemCounts[event.id] || 0} linked item{(itemCounts[event.id] || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleOpenItemSelector(event)}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition duration-300"
                    >
                      Manage Items
                    </button>
                    <button
                      onClick={() => handleOpenModal(event)}
                      className="flex-1 px-4 py-2 bg-secondary text-white rounded-lg font-medium hover:bg-primary transition duration-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
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
                  {editingEvent ? 'Edit Collection' : 'Create New Collection'}
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
                    Collection Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter collection title"
                  />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.dateStart}
                      onChange={(e) => setFormData({ ...formData, dateStart: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.dateEnd}
                      onChange={(e) => setFormData({ ...formData, dateEnd: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter event location"
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
                    placeholder="Enter event description..."
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
                    {saving ? 'Saving...' : (editingEvent ? 'Update Collection' : 'Create Collection')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Item Selector Modal */}
      {isItemSelectorOpen && selectedEventForItems && (
        <div className="fixed inset-0 glass-effect bg-opacity-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                <button
                  onClick={handleCloseItemSelector}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
                  disabled={savingItems}
                >
                  &times;
                </button>
                <h2 className="text-2xl font-bold text-primary">
                  Manage Items: {selectedEventForItems.title}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Select archive items to link to this collection
                </p>
              </div>

              {/* Search and Actions Bar */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search items by title, description, type, or tags..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-4">
                    <span>{selectedItemIds.size} item(s) selected</span>
                    <span>•</span>
                    <span>{getFilteredItems().length} item(s) shown</span>
                  </div>
                  <span className="text-xs text-gray-400 italic">
                    💡 Tip: Hold Shift and click to select a range
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingItems ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading archive items...</p>
                  </div>
                ) : getFilteredItems().length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      {itemSearchTerm ? 'No items match your search.' : 'No archive items found. Create some items first!'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getFilteredItems().map((item, index) => {
                      const isSelected = selectedItemIds.has(item.id);
                      const isLinkedToOther = item.eventId && item.eventId !== selectedEventForItems.id;
                      const linkedEvent = isLinkedToOther ? userEvents.find(e => e.id === item.eventId) : null;
                      
                      return (
                        <div
                          key={item.id}
                          onClick={(e) => handleToggleItem(item.id, index, e)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'border-primary bg-primary bg-opacity-5'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-primary border-primary text-white'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            
                            {/* Thumbnail */}
                            <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                              {item.files && item.files.length > 0 && item.files[0].type?.startsWith('image') ? (
                                <img
                                  src={item.files[0].url}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">
                                  📦
                                </div>
                              )}
                            </div>
                            
                            {/* Item Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-800 truncate">{item.title}</h4>
                              <p className="text-sm text-gray-500 truncate">
                                {item.itemType || 'No type'}
                              </p>
                              {isLinkedToOther && (
                                <p className="text-xs text-orange-600 mt-1">
                                  Currently in: {linkedEvent?.title || 'Another collection'}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    {selectedItemIds.size !== originalItemIds.size || 
                     [...selectedItemIds].some(id => !originalItemIds.has(id)) ||
                     [...originalItemIds].some(id => !selectedItemIds.has(id))
                      ? 'You have unsaved changes'
                      : 'No changes made'}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseItemSelector}
                      disabled={savingItems}
                      className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveItemSelections}
                      disabled={savingItems}
                      className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50"
                    >
                      {savingItems ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventManagementPage;
