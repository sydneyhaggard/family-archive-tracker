import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { stripHtml } from '../utils/helpers';

const ITEM_TYPES = [
  'Book',
  'Document',
  'Photo',
  'Video',
  'Audio Recording',
  'Artwork',
  'Clothing',
  'Jewelry',
  'Furniture',
  'Tool',
  'Toy',
  'Letter/Correspondence',
  'Certificate',
  'Other'
];

const CATEGORIES = [
  'Family History',
  'Military',
  'Education',
  'Religious',
  'Professional',
  'Personal',
  'Medical',
  'Legal',
  'Financial',
  'Genealogy',
  'Other'
];

function AllItemsPage({ user, onViewItem, refreshTrigger }) {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    owner: 'all',
    category: 'all',
    itemType: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 20;
  const navigate = useNavigate();

  useEffect(() => {
    loadAllItems();
  }, [user, refreshTrigger]);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [items, searchTerm, filters]);

  const loadAllItems = async () => {
    try {
      setLoading(true);
      
      // Get items owned by user
      const ownedQuery = query(
        collection(db, 'archiveItems'),
        where('ownerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const ownedSnapshot = await getDocs(ownedQuery);
      
      // Get items shared with user
      const sharedQuery = query(
        collection(db, 'archiveItems'),
        where('sharedWith', 'array-contains', user.email),
        orderBy('createdAt', 'desc')
      );
      const sharedSnapshot = await getDocs(sharedQuery);
      
      // Combine and deduplicate
      const itemsMap = new Map();
      
      ownedSnapshot.forEach(doc => {
        itemsMap.set(doc.id, { id: doc.id, ...doc.data(), isOwner: true });
      });
      
      sharedSnapshot.forEach(doc => {
        if (!itemsMap.has(doc.id)) {
          itemsMap.set(doc.id, { id: doc.id, ...doc.data(), isOwner: false });
        }
      });
      
      // Sort items by creation date descending
      const allItems = Array.from(itemsMap.values()).sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });
      
      setItems(allItems);
      setFilteredItems(allItems);
      setLoading(false);
    } catch (error) {
      console.error('Error loading items:', error);
      setLoading(false);
    }
  };

  const applyFiltersAndSearch = () => {
    let filtered = [...items];

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const titleMatch = item.title?.toLowerCase().includes(searchLower);
        const descriptionMatch = stripHtml(item.description || '').toLowerCase().includes(searchLower);
        const transcriptionMatch = item.transcription?.toLowerCase().includes(searchLower);
        return titleMatch || descriptionMatch || transcriptionMatch;
      });
    }

    // Apply owner filter
    if (filters.owner === 'owned') {
      filtered = filtered.filter(item => item.isOwner);
    } else if (filters.owner === 'shared') {
      filtered = filtered.filter(item => !item.isOwner);
    }

    // Apply category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(item => item.category === filters.category);
    }

    // Apply item type filter
    if (filters.itemType !== 'all') {
      filtered = filtered.filter(item => item.itemType === filters.itemType);
    }

    // Apply date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom).getTime();
      filtered = filtered.filter(item => {
        const itemDate = item.createdAt?.toMillis() || 0;
        return itemDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo).setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const itemDate = item.createdAt?.toMillis() || 0;
        return itemDate <= toDate;
      });
    }

    setFilteredItems(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({
      owner: 'all',
      category: 'all',
      itemType: 'all',
      dateFrom: '',
      dateTo: ''
    });
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackClick = () => {
    navigate('/');
  };

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <h2 className="text-3xl font-bold text-gray-800">All Archive Items</h2>
          <button
            onClick={handleBackClick}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition duration-300 shadow-md hover:shadow-lg"
          >
            ← Back to Home
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by title, description, or transcription..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Filter Toggle and Controls */}
        <div className="mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="font-medium">Filters</span>
            {(filters.owner !== 'all' || filters.category !== 'all' || filters.itemType !== 'all' || filters.dateFrom || filters.dateTo) && (
              <span className="ml-2 px-2 py-0.5 bg-primary text-white text-xs rounded-full">Active</span>
            )}
          </button>

          {showFilters && (
            <div className="mt-4 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Owner Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
                  <select
                    value={filters.owner}
                    onChange={(e) => handleFilterChange('owner', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="all">All Items</option>
                    <option value="owned">My Items</option>
                    <option value="shared">Shared with Me</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="all">All Categories</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Item Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
                  <select
                    value={filters.itemType}
                    onChange={(e) => handleFilterChange('itemType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    {ITEM_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Clear Filters Button */}
                <div className="flex items-end">
                  <button
                    onClick={handleClearFilters}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        {(searchTerm || filters.owner !== 'all' || filters.category !== 'all' || filters.itemType !== 'all' || filters.dateFrom || filters.dateTo) && (
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredItems.length} of {items.length} items
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">Loading archive items...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">
              {items.length === 0 
                ? 'No archive items yet.' 
                : 'No items match your search or filters. Try adjusting your criteria.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => onViewItem(item)}
                  className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer transition transform hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="bg-gray-100">
                    {item.files && item.files.length > 0 && item.files[0].type?.startsWith('image') ? (
                      <img
                        src={item.files[0].url}
                        alt={item.title}
                        className="w-full h-48 object-cover"
                        style={{ objectPosition: item.imagePosition || 'center' }}
                      />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center text-6xl text-gray-400">
                        📦
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">{item.title}</h3>
                    <div className="flex gap-2 mb-2">
                      <span className="inline-block px-3 py-1 text-xs font-medium text-white bg-primary rounded-full">
                        {item.itemType || item.category}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                      {item.description ? stripHtml(item.description) : 'No description'}
                    </p>
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
                      <span>📁 {item.files?.length || 0} file{item.files?.length !== 1 ? 's' : ''}</span>
                      {!item.isOwner && (
                        <span className="text-xs font-medium text-accent bg-accent bg-opacity-10 px-2 py-1 rounded">
                          Shared
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg font-semibold transition duration-300 ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-secondary'
                  }`}
                >
                  Previous
                </button>
                
                <div className="flex gap-2">
                  {[...Array(totalPages)].map((_, index) => {
                    const page = index + 1;
                    // Show first page, last page, current page, and pages around current
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-4 py-2 rounded-lg font-semibold transition duration-300 ${
                            currentPage === page
                              ? 'bg-primary text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      page === currentPage - 2 ||
                      page === currentPage + 2
                    ) {
                      return <span key={page} className="px-2 py-2">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-lg font-semibold transition duration-300 ${
                    currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-secondary'
                  }`}
                >
                  Next
                </button>
              </div>
            )}

            <div className="text-center mt-4 text-gray-600">
              Showing {startIndex + 1} - {Math.min(endIndex, filteredItems.length)} of {filteredItems.length} items
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AllItemsPage;
