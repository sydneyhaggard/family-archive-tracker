# Related People Filtering Feature

**Date:** January 21, 2026  
**Status:** 🚧 In Progress  
**Type:** New Feature

## Overview

Add a collapsible sidebar with multi-criteria filtering to the Related People page, enabling users to filter by birth/death year ranges, relationship types, last names, linked items count, date added, and custom tags. Includes URL persistence for shareable filter links.

## Requirements

Based on [New-Features_jan-18-2026.md](Related%20People/New-Features_jan-18-2026.md):

### Filtering Criteria
1. **Birth Year Range** - Filter by birth year range (e.g., 1900-1950)
2. **Death Year Range** - Filter by death year range
3. **Relationship Type** - Filter by has parents/siblings/spouses/children
4. **Linked Archive Items** - Filter by minimum linked items count
5. **Date Added** - Filter by when added to database
6. **Last Name** - Filter by last name with auto-populated options
7. **Custom Tags** - Filter by user-defined tags (NEW field)

### UI Requirements
- Collapsible sidebar on left side
- Appropriate input controls for each filter type
- "Clear All Filters" button
- Active filter count badge
- Real-time filtering as filters change
- Responsive: slide-out drawer on mobile
- Accessibility compliant

### URL Persistence
- Filter state persists in URL searchParams
- Enables shareable links with pre-applied filters
- Browser back button support

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tags field | Add new `tags: string[]` field | Enables user-defined categorization |
| Filtering approach | Client-side | All data already loaded via real-time listener |
| URL persistence | Use `useSearchParams` | Shareable links, browser history support |
| Mobile pattern | Slide-out drawer | Consistent with mobile UX patterns |

## Implementation

### Files Created

#### 1. `src/components/FilterSidebar.jsx` (NEW)
Complete sidebar component with:
- 7 collapsible filter sections
- Derived filter options (last names, year ranges, tags)
- Active filter count
- Clear all functionality
- Mobile drawer with backdrop
- Responsive sticky positioning

### Files Modified

#### 2. `src/components/RelatedPeoplePage.jsx`
Changes:
- Import `useSearchParams` from react-router-dom
- Import `FilterSidebar` component
- Add filter state with URL sync
- Add `handleFiltersChange` for URL persistence
- Update `filteredPeople` useMemo with all filter logic
- Update layout to flex with sidebar
- Add mobile filter toggle button

#### 3. `src/hooks/useRelatedPeople.js`
Changes:
- Add `tags: []` to `addPerson` function
- Ensure `tags` preserved in `updatePerson`

#### 4. `src/components/PersonDetailModal.jsx`
Changes:
- Add tags input field with Enter-to-add
- Display existing tags as removable chips
- Include tags in edit data state

## Data Model Changes

### New Field: `tags`

Added to `relatedPeople` collection:

```javascript
{
  // ... existing fields ...
  tags: string[],  // NEW - Array of user-defined tags
}
```

## Filter Logic

### Client-Side Filtering Chain

```javascript
filteredPeople = sortedPeople.filter(person => {
  // 1. Text search (existing)
  // 2. Birth year range
  // 3. Death year range  
  // 4. Relationship type (has non-empty array)
  // 5. Last name match
  // 6. Linked items count >= minimum
  // 7. Date added range
  // 8. Tags intersection
  return true; // if passes all filters
});
```

### URL Parameter Schema

| Parameter | Type | Example |
|-----------|------|---------|
| `birthYearMin` | string | `1900` |
| `birthYearMax` | string | `1950` |
| `deathYearMin` | string | `1950` |
| `deathYearMax` | string | `2000` |
| `relationships` | CSV | `parents,children` |
| `lastNames` | CSV | `Haggard,Laurien` |
| `minLinkedItems` | number | `5` |
| `dateAddedFrom` | date | `2025-12-01` |
| `dateAddedTo` | date | `2026-01-21` |
| `tags` | CSV | `veteran,immigrant` |

Example URL:
```
/people?lastNames=Haggard,Laurien&birthYearMin=1900&birthYearMax=1950
```

## Component Architecture

```
RelatedPeoplePage
├── FilterSidebar (NEW)
│   ├── SectionHeader (collapsible)
│   ├── Birth Year Range Inputs
│   ├── Death Year Range Inputs
│   ├── Relationship Checkboxes
│   ├── Last Name Checkboxes (scrollable)
│   ├── Linked Items Dropdown
│   ├── Date Added Pickers + Quick Buttons
│   └── Tags Chips
├── Header with Filter Toggle (mobile)
├── Search Input (existing)
├── People Grid (existing, now filtered)
└── Pagination (existing)
```

## Testing Checklist

- [ ] All 7 filter types work independently
- [ ] Multiple filters combine correctly (AND logic)
- [ ] URL updates when filters change
- [ ] Page load with URL params applies filters
- [ ] Browser back/forward works
- [ ] Clear all resets URL and filters
- [ ] Mobile drawer opens/closes correctly
- [ ] Backdrop closes drawer on click
- [ ] Tags can be added/removed in PersonDetailModal
- [ ] New tags appear in filter options
- [ ] Performance acceptable with 500+ people
- [ ] Accessibility: keyboard navigation works

## Future Enhancements

1. **Save Filter Presets** - Save named filter combinations
2. **Export Filtered Results** - CSV/PDF export of filtered list
3. **Dashboard Widget** - Quick filter links on home page

---

**Implementation Started:** January 21, 2026
