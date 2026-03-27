# Related People Feature Documentation

## Overview
The Related People feature allows users to manage a collection of people related to their family archive items. This feature includes a dedicated page for CRUD operations, a custom React hook for data management, and updated Firestore security rules.

## Architecture

### Firestore Data Model

#### New Collection: `relatedPeople`
Each document in this collection represents a person and contains:

```javascript
{
  name: string,              // Required - Person's name
  description: string,        // Optional - Additional information about the person
  birthDate: string,         // Optional - Birth date (ISO format or date string)
  ownerId: string,           // Required - UID of the user who created this record
  createdAt: timestamp,      // Auto-generated creation timestamp
  updatedAt: timestamp       // Auto-updated modification timestamp
}
```

**Security Rules:**
- **Read**: Any authenticated user can read any person record
- **Create**: Users can only create records where `ownerId` matches their UID
- **Update/Delete**: Only the owner (matching `ownerId`) can modify or delete

#### Updated Collection: `archiveItems`
Added new field to existing documents:

```javascript
{
  // ... existing fields ...
  relatedPeopleIds: [string]  // Optional - Array of person document IDs
}
```

**Security Rules:**
- Validates that `relatedPeopleIds` is either null or a valid array
- Enforces reasonable size limit (< 100 items)
- Maintains existing ownership rules for read/write operations

### Custom Hook: `useRelatedPeople`

Location: `src/hooks/useRelatedPeople.js`

#### Exported Functions

**Data Retrieval:**
- `peopleList` - Real-time array of people owned by current user
- `loading` - Boolean indicating loading state
- `error` - Error message if any operation fails

**CRUD Operations:**

1. **addPerson({ name, description, birthDate })**
   - Creates a new person in Firestore
   - Automatically sets `ownerId` to current user's UID
   - Returns: Promise<string> - Document ID of created person
   - Validation: Name is required

2. **updatePerson(personId, newData)**
   - Updates an existing person's details
   - Verifies ownership before updating
   - Automatically updates `updatedAt` timestamp
   - Returns: Promise<void>

3. **deletePerson(personId)**
   - Deletes a person record
   - Verifies ownership before deletion
   - Returns: Promise<void>

**Item Linking Operations:**

4. **linkPeopleToItem(itemId, peopleIds)**
   - Replaces entire `relatedPeopleIds` array on an archive item
   - Verifies item ownership
   - Parameters: itemId (string), peopleIds (string[])
   - Returns: Promise<void>

5. **addPersonToItem(itemId, personId)**
   - Adds a single person to item's `relatedPeopleIds` array
   - Uses Firestore `arrayUnion` for deduplication
   - Returns: Promise<void>

6. **removePersonFromItem(itemId, personId)**
   - Removes a person from item's `relatedPeopleIds` array
   - Uses Firestore `arrayRemove`
   - Returns: Promise<void>

#### Usage Example

```javascript
import { useRelatedPeople } from '../hooks/useRelatedPeople';

function MyComponent() {
  const { 
    peopleList, 
    loading, 
    error, 
    addPerson, 
    updatePerson, 
    deletePerson,
    linkPeopleToItem 
  } = useRelatedPeople();

  const handleAddPerson = async () => {
    try {
      const personId = await addPerson({
        name: 'John Doe',
        description: 'Great grandfather',
        birthDate: '1920-05-15'
      });
      console.log('Created person:', personId);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleLinkToItem = async (itemId, selectedPeopleIds) => {
    await linkPeopleToItem(itemId, selectedPeopleIds);
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {peopleList.map(person => (
        <div key={person.id}>{person.name}</div>
      ))}
    </div>
  );
}
```

### UI Component: `RelatedPeoplePage`

Location: `src/components/RelatedPeoplePage.jsx`

#### Features

**Layout:**
- Clean, responsive design using Tailwind CSS v4
- Header with page title and "Add Person" button
- Search bar for filtering people
- Grid layout of person cards (responsive: 1/2/3 columns)

**Person Cards:**
- Avatar circle with first letter of name
- Name and birth date display
- Description preview (line-clamped to 3 lines)
- Edit and Delete buttons

**Search/Filter:**
- Real-time search by name or description
- Case-insensitive matching
- Updates grid automatically

**Add/Edit Modal:**
- Form fields: Name (required), Birth Date (optional), Description (optional)
- Validation with error messages
- Save/Cancel buttons
- Disabled state during save operation
- ESC key to close

**Delete Confirmation:**
- Browser confirmation dialog before deletion
- Prevents accidental deletions

#### UI Flow

1. **Initial Load:**
   - Page displays with header and search bar
   - If no people exist, shows empty state message
   - If people exist, displays in grid layout

2. **Adding a Person:**
   - Click "+ Add Person" button
   - Modal opens with empty form
   - Fill in name (required) and optional fields
   - Click "Add Person" to save
   - Modal closes and new person appears in grid

3. **Editing a Person:**
   - Click "Edit" button on person card
   - Modal opens with pre-filled form
   - Modify fields as needed
   - Click "Update Person" to save
   - Modal closes and card updates

4. **Deleting a Person:**
   - Click "Delete" button on person card
   - Confirmation dialog appears
   - Confirm to delete
   - Card disappears from grid

5. **Searching:**
   - Type in search bar
   - Grid filters in real-time
   - Clear search to show all

### Navigation Integration

**Route:** `/people`

**Navigation Tab:** "Related People" button added to main navigation bar

**Access:** Available on all main pages (Home, View All, Database View, People)

**Integration Points:**
- `src/components/MainApp.jsx` - Added route handling
- Navigation component updated with new tab
- Consistent header across all pages

## Firestore Security Rules

Location: `firestore.rules`

### Related People Collection Rules

```javascript
match /relatedPeople/{personId} {
  // Any authenticated user can read any person record
  allow read: if request.auth != null;
  
  // Users can only create records if ownerId matches their UID
  allow create: if request.auth != null && 
    request.resource.data.ownerId == request.auth.uid;
  
  // Only the owner can update or delete their person records
  allow update, delete: if request.auth != null && 
    resource.data.ownerId == request.auth.uid;
}
```

### Archive Items Collection Rules (Updated)

```javascript
// Helper function to check if related people IDs are valid
function areRelatedPeopleValid(peopleIds) {
  return peopleIds == null || (
    peopleIds is list &&
    peopleIds.size() < 100 // Reasonable limit
  );
}

match /archiveItems/{itemId} {
  // Allow create if authenticated and relatedPeopleIds are valid
  allow create: if request.auth != null && 
    request.resource.data.ownerId == request.auth.uid &&
    areRelatedPeopleValid(request.resource.data.relatedPeopleIds);
  
  // Allow update/delete only if user is the owner and relatedPeopleIds are valid
  allow update, delete: if request.auth != null && 
    resource.data.ownerId == request.auth.uid &&
    areRelatedPeopleValid(request.resource.data.relatedPeopleIds);
}
```

## Technical Implementation Details

### Real-time Updates
- Uses Firestore `onSnapshot` for live data synchronization
- Automatically updates UI when people are added/edited/deleted
- No manual refresh needed

### Error Handling
- All CRUD operations wrapped in try-catch blocks
- Ownership verification before modifications
- User-friendly error messages
- Console logging for debugging

### Performance Considerations
- Query scoped to current user's people only
- Efficient Firestore queries with `where` clause
- Minimal re-renders using React hooks
- Debounced search (real-time but efficient)

### Data Validation
- Required field validation (name)
- Ownership verification on all mutations
- Array size limits in security rules
- Type checking in hook functions

## Future Enhancements

Potential improvements for future versions:

1. **Relationship Types:** Add field for relationship type (e.g., "grandfather", "aunt")
2. **Photo Upload:** Allow uploading profile photos for people
3. **Family Tree View:** Visualize relationships in tree format
4. **Batch Import:** Import multiple people from CSV
5. **Advanced Search:** Filter by birth year, relationship type, etc.
6. **Archive Item Links:** Show which items are linked to each person
7. **Sharing:** Allow sharing people records with other users
8. **Export:** Export people list to PDF or CSV

## Testing Recommendations

### Manual Testing Scenarios

1. **Create Person:**
   - Add person with all fields
   - Add person with only name
   - Try adding without name (should show error)

2. **Update Person:**
   - Edit all fields
   - Update only some fields
   - Cancel edit (should not save)

3. **Delete Person:**
   - Delete person
   - Cancel deletion
   - Verify deletion in Firestore console

4. **Search:**
   - Search by full name
   - Search by partial name
   - Search by description
   - Clear search

5. **Real-time Updates:**
   - Open page in two browser tabs
   - Add person in one tab
   - Verify it appears in both tabs

6. **Item Linking:**
   - Link people to archive item
   - Verify `relatedPeopleIds` array in Firestore
   - Test add/remove individual person

7. **Security:**
   - Verify users can only see their own people
   - Try to access another user's person (should fail)
   - Verify non-owners cannot edit/delete

## Deployment Checklist

- [ ] Review and deploy updated Firestore security rules
- [ ] Test CRUD operations in staging environment
- [ ] Verify security rules block unauthorized access
- [ ] Test UI on mobile devices
- [ ] Verify navigation integration
- [ ] Monitor Firestore usage after deployment
- [ ] Document feature for end users
- [ ] Create tutorial/help documentation

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `firestore.rules` | Modified | Added relatedPeople collection rules |
| `src/hooks/useRelatedPeople.js` | New | Custom hook for CRUD operations |
| `src/components/RelatedPeoplePage.jsx` | New | UI page for managing people |
| `src/components/MainApp.jsx` | Modified | Added /people route and navigation |

**Total:** 4 files changed (2 new, 2 modified)
**Lines added:** ~613 lines of code
