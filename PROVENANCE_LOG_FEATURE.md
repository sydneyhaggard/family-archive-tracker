# Provenance Log Feature Documentation

## Overview
The Provenance Log feature tracks the transfer history and chain of custody for archive items. Each archive item can have multiple provenance log entries documenting how the item was acquired, from whom, and under what circumstances. This creates an auditable trail of ownership and custody changes.

## Architecture

### Firestore Data Model

#### Sub-Collection: `provenanceLog`
Located under each `archiveItems/{itemId}/provenanceLog/{logId}` document.

Each document in this sub-collection represents one transfer/acquisition and contains:

```javascript
{
  transferDate: timestamp,       // Required - Date of transfer/acquisition
  transferorName: string,         // Required - Name of person/entity who gave the item
  method: string,                 // Required - Method of acquisition
  notes: string,                  // Optional - Additional details/conditions
  addedBy: string,                // Required - UID of user who added this entry
  createdAt: timestamp            // Auto-generated creation timestamp
}
```

**Valid Methods:**
- Gift
- Inheritance
- Purchase
- Found
- Donation
- Other

**Security Rules:**
- **Read**: Only the owner of the parent archiveItem
- **Create**: Only the owner of the parent archiveItem
- **Delete**: Only the owner of the parent archiveItem
- **Update**: Not allowed (entries are immutable once created)

### Custom Hook: `useProvenanceLog`

Location: `src/hooks/useProvenanceLog.js`

#### Parameters
- `itemId` (string) - The ID of the archive item

#### Exported Values

**Data:**
- `logEntries` - Real-time array of provenance log entries, ordered by transferDate (ascending, oldest first)
- `loading` - Boolean indicating loading state
- `error` - Error message if any operation fails

**Functions:**

1. **addLogEntry(data)**
   - Adds a new provenance log entry
   - Parameters: `{ transferDate, transferorName, method, notes }`
   - Automatically sets `addedBy` to current user's UID
   - Validation: transferDate, transferorName, and method are required
   - Returns: Promise<string> - Document ID of created entry

2. **deleteLogEntry(logId)**
   - Deletes a specific provenance log entry
   - Parameters: logId (string)
   - Returns: Promise<void>

#### Usage Example

```javascript
import { useProvenanceLog } from '../hooks/useProvenanceLog';

function MyComponent({ itemId }) {
  const { 
    logEntries, 
    loading, 
    error, 
    addLogEntry, 
    deleteLogEntry 
  } = useProvenanceLog(itemId);

  const handleAdd = async () => {
    try {
      await addLogEntry({
        transferDate: new Date('2020-06-15'),
        transferorName: 'John Smith',
        method: 'Gift',
        notes: 'Given as a birthday present with original packaging'
      });
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleDelete = async (logId) => {
    await deleteLogEntry(logId);
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {logEntries.map(entry => (
        <div key={entry.id}>
          {entry.transferorName} - {entry.method}
        </div>
      ))}
    </div>
  );
}
```

### UI Component: `ProvenanceTracker`

Location: `src/components/ProvenanceTracker.jsx`

#### Features

**Layout:**
- Clean, responsive design using Tailwind CSS v4
- Integrated into ItemDetailModal (owner-only section)
- Two-part interface: Add form + Transfer log table

**Add Entry Form:**
- Located above the table
- White background with border for distinction
- Compact grid layout (2 columns on desktop, 1 on mobile)
- Fields:
  - **Transfer Date** (required) - HTML date picker
  - **Transferor Name** (required) - Text input with placeholder
  - **Method** (required) - Dropdown with predefined options
  - **Notes** (optional) - Text input for additional details
- "Add Transfer Log Entry" button
- Form validation with error messages
- Disabled state during save operation
- Auto-resets after successful submission

**Transfer Log Table:**
- Responsive table with horizontal scroll on small screens
- Columns:
  - **Date** - Formatted date (e.g., "June 15, 2020")
  - **Transferor Name** - Full name
  - **Method** - Badge with color-coded method type
  - **Notes** - Gray italic text if empty
  - **Actions** - Delete button
- Hover effect on rows
- Empty state message if no entries exist
- Entry count display below table

**Delete Functionality:**
- Red "Delete" button for each entry
- Confirmation dialog before deletion
- Prevents accidental deletions

**Error Handling:**
- Form validation errors displayed above form
- API errors displayed in alert dialogs
- Loading state for provenance log

#### UI Flow

1. **Initial Load:**
   - Component displays with add form and table
   - If no entries exist, shows empty state message
   - If entries exist, displays in chronological order (oldest first)

2. **Adding an Entry:**
   - User fills in required fields (date, name, method)
   - Optionally adds notes
   - Clicks "Add Transfer Log Entry"
   - Validation checks for required fields
   - On success: Form resets, new entry appears at bottom of table
   - On error: Error message displayed above form

3. **Viewing Entries:**
   - Entries displayed in table sorted by date (oldest → newest)
   - Each row shows complete transfer information
   - Method displayed as colored badge
   - Notes shown or "No notes" placeholder

4. **Deleting an Entry:**
   - User clicks "Delete" button
   - Confirmation dialog appears
   - On confirm: Entry removed from table
   - On cancel: No action taken

### Integration with ItemDetailModal

**Location:** Positioned after Event Association section, before Action Buttons

**Visibility:** Only shown to item owners (not visible to users with shared access)

**Styling:** Consistent with other sections in the modal (gray background, rounded corners)

## Firestore Security Rules

Location: `firestore.rules`

### Provenance Log Sub-Collection Rules

```javascript
// Provenance Log sub-collection
match /provenanceLog/{logId} {
  // Only the owner of the parent archiveItem can create, read, or delete provenance log entries
  allow read, create, delete: if request.auth != null && 
    get(/databases/$(database)/documents/archiveItems/$(itemId)).data.ownerId == request.auth.uid;
}
```

**Key Points:**
- Rules are nested inside the `archiveItems/{itemId}` match block
- Access control is based on parent item's `ownerId`
- No update permission (entries are immutable once created)
- Requires authentication
- Uses Firestore `get()` to check parent document ownership

## Use Cases

### Example 1: Inherited Family Heirloom
```
Archive Item: "Grandmother's Wedding Ring"

Provenance Log:
1. Date: 1945-06-12
   Transferor: Robert Johnson (Jeweler)
   Method: Purchase
   Notes: Original purchase receipt included

2. Date: 1945-06-15
   Transferor: Robert Johnson Sr.
   Method: Gift
   Notes: Given as wedding gift to daughter Mary

3. Date: 1980-03-10
   Transferor: Mary Johnson Smith
   Method: Inheritance
   Notes: Inherited after grandmother's passing

4. Date: 2023-12-25
   Transferor: Mary Johnson Smith
   Method: Gift
   Notes: Given as Christmas gift, passed down through generations
```

### Example 2: Military Artifact
```
Archive Item: "WWII Service Medal"

Provenance Log:
1. Date: 1945-08-15
   Transferor: United States Army
   Method: Other
   Notes: Awarded for service in Pacific Theater

2. Date: 1990-05-20
   Transferor: John Davis (Veteran)
   Method: Inheritance
   Notes: Inherited after father's death, came with service papers
```

### Example 3: Purchased Antique
```
Archive Item: "Victorian Era Photograph Album"

Provenance Log:
1. Date: 2019-07-04
   Transferor: Heritage Antiques Store
   Method: Purchase
   Notes: Purchased at estate sale, original price $150

2. Date: 2020-01-15
   Transferor: Self
   Method: Found
   Notes: Found additional loose photos that matched album style, inserted them
```

## Technical Implementation Details

### Real-time Updates
- Uses Firestore `onSnapshot` for live data synchronization
- Automatically updates when entries are added/deleted
- No manual refresh needed
- Changes visible immediately across all open tabs/windows

### Data Ordering
- Entries ordered by `transferDate` in ascending order (oldest first)
- Creates chronological chain of custody
- Helps visualize item's history over time

### Error Handling
- All CRUD operations wrapped in try-catch blocks
- Ownership verification at database level (security rules)
- User-friendly error messages
- Console logging for debugging
- Form validation before submission

### Performance Considerations
- Sub-collection structure keeps queries scoped to single item
- Efficient real-time listeners (only for current item)
- Minimal re-renders using React hooks
- Indexed by transferDate for fast sorting

### Data Validation
- Required field validation (transferDate, transferorName, method)
- Ownership verification via security rules
- Date format handling (converts to Firestore timestamp)
- Trimming of string inputs

### Date Handling
- HTML5 date input for user-friendly selection
- Stores as Firestore timestamp
- Displays formatted with locale support
- Handles both Firestore timestamps and Date objects

## Future Enhancements

Potential improvements for future versions:

1. **Edit Entries:** Allow editing existing entries (would require security rule update)
2. **Export to PDF:** Generate provenance report as PDF document
3. **Attach Documents:** Link supporting documents (receipts, certificates) to entries
4. **Verification Status:** Mark entries as verified/unverified
5. **Chain of Custody Report:** Auto-generate complete chain of custody document
6. **Provenance Photos:** Attach photos of item at different stages
7. **Import from CSV:** Bulk import provenance data
8. **Relationship Linking:** Link transferor names to Related People records
9. **Location Tracking:** Add acquisition location to entries
10. **Value Tracking:** Record purchase prices or appraised values over time

## Testing Recommendations

### Manual Testing Scenarios

1. **Add Entry:**
   - Add with all fields filled
   - Add with only required fields
   - Try adding without date (should show error)
   - Try adding without name (should show error)
   - Try adding without method (should show error)

2. **Delete Entry:**
   - Delete single entry
   - Delete multiple entries
   - Cancel deletion
   - Verify deletion in Firestore console

3. **View Entries:**
   - View empty state
   - View single entry
   - View multiple entries
   - Verify chronological ordering

4. **Date Handling:**
   - Enter various date formats
   - Enter dates in different years
   - Verify correct display format

5. **Real-time Updates:**
   - Open item in two browser tabs
   - Add entry in one tab
   - Verify it appears in both tabs
   - Delete in one tab
   - Verify removal in both tabs

6. **Form Validation:**
   - Submit empty form (should show error)
   - Submit with missing required fields
   - Enter very long notes (should handle gracefully)
   - Test all method options

7. **Security:**
   - Verify non-owners cannot see provenance log
   - Try accessing another user's item provenance (should fail)

## Deployment Checklist

- [ ] Review and deploy updated Firestore security rules
- [ ] Test CRUD operations in staging environment
- [ ] Verify security rules block unauthorized access
- [ ] Test UI on mobile devices
- [ ] Verify integration in ItemDetailModal
- [ ] Monitor Firestore usage after deployment
- [ ] Document feature for end users
- [ ] Create tutorial/help documentation

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `firestore.rules` | Modified | Added provenanceLog sub-collection security rules |
| `src/hooks/useProvenanceLog.js` | New | Custom hook for provenance CRUD operations |
| `src/components/ProvenanceTracker.jsx` | New | Table UI with add/delete functionality |
| `src/components/ItemDetailModal.jsx` | Modified | Integrated ProvenanceTracker component |

**Total:** 4 files changed (2 new, 2 modified), 406 lines of code
