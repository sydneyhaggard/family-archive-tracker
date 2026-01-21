import React, { useState, useMemo } from 'react';

/**
 * FilterSidebar - Collapsible sidebar for filtering Related People
 * 
 * Props:
 * - people: Array of all people (for deriving filter options)
 * - filters: Current filter state object
 * - onFiltersChange: Callback when filters change
 * - isOpen: Boolean for mobile visibility
 * - onClose: Callback to close on mobile
 */
function FilterSidebar({ people, filters, onFiltersChange, isOpen, onClose }) {
  const [expandedSections, setExpandedSections] = useState({
    birthYear: true,
    deathYear: false,
    relationship: true,
    lastName: true,
    linkedItems: false,
    dateAdded: false,
    tags: true
  });

  // Derive unique last names from people
  const lastNameOptions = useMemo(() => {
    const names = new Set();
    people.forEach(person => {
      if (person.name) {
        const parts = person.name.trim().split(/\s+/);
        if (parts.length > 0) {
          const lastName = parts[parts.length - 1];
          if (lastName && lastName.length > 1) {
            names.add(lastName);
          }
        }
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [people]);

  // Derive year ranges from birth/death dates
  const yearRanges = useMemo(() => {
    let minBirth = 9999, maxBirth = 0;
    let minDeath = 9999, maxDeath = 0;
    
    people.forEach(person => {
      if (person.birthDate) {
        const year = parseInt(person.birthDate.substring(0, 4));
        if (!isNaN(year) && year > 1000 && year < 2100) {
          minBirth = Math.min(minBirth, year);
          maxBirth = Math.max(maxBirth, year);
        }
      }
      if (person.deathDate) {
        const year = parseInt(person.deathDate.substring(0, 4));
        if (!isNaN(year) && year > 1000 && year < 2100) {
          minDeath = Math.min(minDeath, year);
          maxDeath = Math.max(maxDeath, year);
        }
      }
    });

    return {
      birth: { min: minBirth === 9999 ? 1800 : minBirth, max: maxBirth === 0 ? 2025 : maxBirth },
      death: { min: minDeath === 9999 ? 1800 : minDeath, max: maxDeath === 0 ? 2025 : maxDeath }
    };
  }, [people]);

  // Derive unique tags from people
  const tagOptions = useMemo(() => {
    const tags = new Set();
    people.forEach(person => {
      if (Array.isArray(person.tags)) {
        person.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [people]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.birthYearMin || filters.birthYearMax) count++;
    if (filters.deathYearMin || filters.deathYearMax) count++;
    if (filters.relationships?.length > 0) count++;
    if (filters.lastNames?.length > 0) count++;
    if (filters.minLinkedItems > 0) count++;
    if (filters.dateAddedFrom || filters.dateAddedTo) count++;
    if (filters.tags?.length > 0) count++;
    return count;
  }, [filters]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFilter = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key, value) => {
    const current = filters[key] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      birthYearMin: '',
      birthYearMax: '',
      deathYearMin: '',
      deathYearMax: '',
      relationships: [],
      lastNames: [],
      minLinkedItems: 0,
      dateAddedFrom: '',
      dateAddedTo: '',
      tags: []
    });
  };

  const SectionHeader = ({ title, section, count }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between py-2 px-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      aria-expanded={expandedSections[section]}
      aria-controls={`filter-section-${section}`}
    >
      <span className="flex items-center gap-2">
        {title}
        {count > 0 && (
          <span className="px-1.5 py-0.5 text-xs bg-primary text-white rounded-full">
            {count}
          </span>
        )}
      </span>
      <svg
        className={`w-4 h-4 transition-transform ${expandedSections[section] ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-auto
          w-72 md:w-64 lg:w-72 shrink-0
          bg-white md:bg-white/80 md:backdrop-blur-sm
          border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          overflow-y-auto
          md:rounded-xl md:shadow-md md:border
          md:max-h-[calc(100vh-200px)] md:sticky md:top-24
        `}
        role="complementary"
        aria-label="Filter sidebar"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 text-xs bg-primary text-white rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </h3>
            <button
              onClick={onClose}
              className="md:hidden p-1 hover:bg-gray-100 rounded"
              aria-label="Close filters"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="w-full py-2 px-3 text-sm text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* Filter Sections */}
        <div className="p-4 space-y-1">
          {/* Birth Year Range */}
          <div className="border-b border-gray-100 pb-2">
            <SectionHeader 
              title="Birth Year" 
              section="birthYear" 
              count={filters.birthYearMin || filters.birthYearMax ? 1 : 0}
            />
            {expandedSections.birthYear && (
              <div id="filter-section-birthYear" className="px-3 py-2 space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder={yearRanges.birth.min.toString()}
                    value={filters.birthYearMin || ''}
                    onChange={(e) => updateFilter('birthYearMin', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Minimum birth year"
                  />
                  <span className="text-gray-400">—</span>
                  <input
                    type="number"
                    placeholder={yearRanges.birth.max.toString()}
                    value={filters.birthYearMax || ''}
                    onChange={(e) => updateFilter('birthYearMax', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Maximum birth year"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Death Year Range */}
          <div className="border-b border-gray-100 pb-2">
            <SectionHeader 
              title="Death Year" 
              section="deathYear"
              count={filters.deathYearMin || filters.deathYearMax ? 1 : 0}
            />
            {expandedSections.deathYear && (
              <div id="filter-section-deathYear" className="px-3 py-2 space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder={yearRanges.death.min.toString()}
                    value={filters.deathYearMin || ''}
                    onChange={(e) => updateFilter('deathYearMin', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Minimum death year"
                  />
                  <span className="text-gray-400">—</span>
                  <input
                    type="number"
                    placeholder={yearRanges.death.max.toString()}
                    value={filters.deathYearMax || ''}
                    onChange={(e) => updateFilter('deathYearMax', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Maximum death year"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Relationship Type */}
          <div className="border-b border-gray-100 pb-2">
            <SectionHeader 
              title="Has Relationship" 
              section="relationship"
              count={filters.relationships?.length || 0}
            />
            {expandedSections.relationship && (
              <div id="filter-section-relationship" className="px-3 py-2 space-y-1">
                {['parents', 'siblings', 'spouses', 'children'].map(rel => (
                  <label key={rel} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2">
                    <input
                      type="checkbox"
                      checked={filters.relationships?.includes(rel) || false}
                      onChange={() => toggleArrayFilter('relationships', rel)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700 capitalize">{rel}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Last Name */}
          <div className="border-b border-gray-100 pb-2">
            <SectionHeader 
              title="Last Name" 
              section="lastName"
              count={filters.lastNames?.length || 0}
            />
            {expandedSections.lastName && (
              <div id="filter-section-lastName" className="px-3 py-2">
                <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
                  {lastNameOptions.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No last names found</p>
                  ) : (
                    lastNameOptions.map(name => (
                      <label key={name} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2">
                        <input
                          type="checkbox"
                          checked={filters.lastNames?.includes(name) || false}
                          onChange={() => toggleArrayFilter('lastNames', name)}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">{name}</span>
                      </label>
                    ))
                  )}
                </div>
                {filters.lastNames?.length > 0 && (
                  <button
                    onClick={() => updateFilter('lastNames', [])}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Clear selection ({filters.lastNames.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Linked Archive Items */}
          <div className="border-b border-gray-100 pb-2">
            <SectionHeader 
              title="Linked Items" 
              section="linkedItems"
              count={filters.minLinkedItems > 0 ? 1 : 0}
            />
            {expandedSections.linkedItems && (
              <div id="filter-section-linkedItems" className="px-3 py-2">
                <label className="block text-sm text-gray-600 mb-1">
                  Minimum linked items:
                </label>
                <select
                  value={filters.minLinkedItems || 0}
                  onChange={(e) => updateFilter('minLinkedItems', parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={0}>Any</option>
                  <option value={1}>At least 1</option>
                  <option value={3}>At least 3</option>
                  <option value={5}>At least 5</option>
                  <option value={10}>At least 10</option>
                </select>
              </div>
            )}
          </div>

          {/* Date Added */}
          <div className="border-b border-gray-100 pb-2">
            <SectionHeader 
              title="Date Added" 
              section="dateAdded"
              count={filters.dateAddedFrom || filters.dateAddedTo ? 1 : 0}
            />
            {expandedSections.dateAdded && (
              <div id="filter-section-dateAdded" className="px-3 py-2 space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From:</label>
                  <input
                    type="date"
                    value={filters.dateAddedFrom || ''}
                    onChange={(e) => updateFilter('dateAddedFrom', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To:</label>
                  <input
                    type="date"
                    value={filters.dateAddedTo || ''}
                    onChange={(e) => updateFilter('dateAddedTo', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  <button
                    onClick={() => {
                      const date = new Date();
                      date.setDate(date.getDate() - 7);
                      onFiltersChange({
                        ...filters,
                        dateAddedFrom: date.toISOString().split('T')[0],
                        dateAddedTo: ''
                      });
                    }}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() => {
                      const date = new Date();
                      date.setDate(date.getDate() - 30);
                      onFiltersChange({
                        ...filters,
                        dateAddedFrom: date.toISOString().split('T')[0],
                        dateAddedTo: ''
                      });
                    }}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    Last 30 days
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="pb-2">
            <SectionHeader 
              title="Tags" 
              section="tags"
              count={filters.tags?.length || 0}
            />
            {expandedSections.tags && (
              <div id="filter-section-tags" className="px-3 py-2">
                {tagOptions.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No tags found. Add tags to people to filter by them.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tagOptions.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleArrayFilter('tags', tag)}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          filters.tags?.includes(tag)
                            ? 'bg-primary text-white border-primary'
                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-primary'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default FilterSidebar;
