# Archive Events Feature Documentation

## Overview
The Archive Events feature allows users to create and manage events, then link their archive items to these events. This creates a relational hierarchy where multiple archive items can be associated with a single event (e.g., all photos from a wedding, documents from a military deployment, etc.).

## Architecture

### Firestore Data Model

#### New Collection: `archiveEvents`
Each document in this collection represents an event and contains:

```javascript
{
  title: string,              // Required - Event title
  description: string,        // Optional - Event description
  dateStart: timestamp,       // Required - Event start date
  dateEnd: timestamp,         // Required - Event end date (defaults to start date)
  location: string,           // Optional - Event location
  ownerId: string,            // Required - UID of the user who created this event
  createdAt: timestamp,       // Auto-generated creation timestamp
  updatedAt: timestamp        // Auto-updated modification timestamp
}
```

**Security Rules:**
- **Read**: Owner can read their own events; authenticated users can read if they have access to items linking to the event
- **Create**: Users can only create events where `ownerId` matches their UID
- **Update/Delete**: Only the owner (matching `ownerId`) can modify or delete

#### Updated Collection: `archiveItems`
Added new optional field to existing documents:

```javascript
{
  // ... existing fields ...
  eventId: string  // Optional - Document ID from archiveEvents collection
}
```

**Security Rules:**
- Validates that `eventId` is either null or a valid string
- Maintains existing ownership rules for read/write operations

### Custom Hook: `useArchiveEvents`

Location: `src/hooks/useArchiveEvents.js`

#### Exported Functions

**Data Retrieval:**
- `userEvents` - Real-time array of events owned by current user
- `loading` - Boolean indicating loading state
- `error` - Error message if any operation fails

**Event CRUD Operations:**

1. **createEvent(data)**
   - Creates a new event in Firestore
   - Automatically sets `ownerId` to current user's UID
   - Parameters: `{ title, description, dateStart, dateEnd, location }`
   - Returns: Promise<string> - Document ID of created event
   - Validation: Title and dateStart are required

2. **updateEvent(eventId, newData)**
   - Updates an existing event's details
   - Verifies ownership before updating
   - Automatically updates `updatedAt` timestamp
   - Returns: Promise<void>

3. **deleteEvent(eventId)**
   - Deletes an event AND unlinks all associated archive items
   - Uses batch operation for atomicity
   - Verifies ownership before deletion
   - Sets `eventId` to null on all linked items
   - Returns: Promise<void>

**Item Linking Operations:**

4. **getEventItems(eventId, callback)**
   - Gets real-time list of items linked to a specific event
   - Parameters: eventId (string), callback (function)
   - Returns: Unsubscribe function
   - Callback receives array of items with real-time updates

5. **linkItemToEvent(itemId, eventId)**
   - Links an archive item to an event (or unlinks by passing null)
   - Verifies ownership of both item and event
   - Parameters: itemId (string), eventId (string | null)
   - Returns: Promise<void>

6. **getEventItemsCount(eventId)**
   - Returns count of items linked to an event
   - Parameters: eventId (string)
   - Returns: Promise<number>

#### Usage Example

```javascript
import { useArchiveEvents } from '../hooks/useArchiveEvents';

function MyComponent() {
  const { 
    userEvents, 
    loading, 
    error, 
    createEvent, 
    updateEvent, 
    deleteEvent,
    linkItemToEvent,
    getEventItems 
  } = useArchiveEvents();

  const handleCreateEvent = async () => {
    try {
      const eventId = await createEvent({
        title: 'Smith Family Reunion 2024',
        description: 'Annual family gathering in Maine',
        dateStart: new Date('2024-07-15'),
        dateEnd: new Date('2024-07-17'),
        location: 'Portland, Maine'
      });
      console.log('Created event:', eventId);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleLinkItem = async (itemId, eventId) => {
    await linkItemToEvent(itemId, eventId);
  };

  // Get items for an event with real-time updates
  useEffect(() => {
    const unsubscribe = getEventItems('eventId123', (items) => {
      console.log('Linked items:', items);
    });
    return unsubscribe;
  }, []);

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {userEvents.map(event => (
        <div key={event.id}>{event.title}</div>
      ))}
    </div>
  );
}
```

### UI Component 1: `EventManagementPage`

Location: `src/components/EventManagementPage.jsx`

#### Features

**Layout:**
- Clean, responsive design using Tailwind CSS v4
- Header with page title and "Create Event" button
- Search bar for filtering events
- Grid layout of event cards (responsive: 1/2/3 columns)

**Event Cards:**
- Event title
- Date range display (formatted)
- Location icon and text
- Description preview
- Linked items count badge
- Edit and Delete buttons

**Search/Filter:**
- Real-time search by title, description, or location
- Case-insensitive matching
- Updates grid automatically

**Create/Edit Modal:**
- Form fields: Title (required), Start Date (required), End Date (optional), Location (optional), Description (optional)
- Date inputs with native date picker
- Validation with error messages
- Save/Cancel buttons
- Disabled state during save operation
- ESC key to close

**Delete Confirmation:**
- Browser confirmation dialog
- Shows warning if items are linked (e.g., "This will unlink 5 archive items")
- Prevents accidental deletions

**Item Count Display:**
- Badge showing number of linked items (e.g., "📁 5 linked items")
- Automatically updated
- Loaded asynchronously for all events

#### UI Flow

1. **Initial Load:**
   - Page displays with header and search bar
   - If no events exist, shows empty state message
   - If events exist, displays in grid layout with item counts

2. **Creating an Event:**
   - Click "+ Create Event" button
   - Modal opens with empty form
   - Fill in title and start date (required) and optional fields
   - Click "Create Event" to save
   - Modal closes and new event appears in grid

3. **Editing an Event:**
   - Click "Edit" button on event card
   - Modal opens with pre-filled form
   - Modify fields as needed
   - Click "Update Event" to save
   - Modal closes and card updates

4. **Deleting an Event:**
   - Click "Delete" button on event card
   - Confirmation dialog appears with item count warning
   - Confirm to delete
   - Event deleted and all linked items are automatically unlinked
   - Card disappears from grid

5. **Searching:**
   - Type in search bar
   - Grid filters in real-time
   - Clear search to show all

### UI Component 2: `ItemEventLinker`

Location: `src/components/ItemEventLinker.jsx`

#### Features

**Layout:**
- Compact component designed to fit in ItemDetailModal
- Gray background section with rounded corners
- Clear visual hierarchy

**Linked Event Display:**
- Blue highlighted box showing currently linked event
- Event title (bold)
- Date range with calendar icon
- Location with location icon
- Description
- Unlink button (red)

**Event Selection:**
- Dropdown showing all user's events
- Formatted display: "Title (Date Range)"
- "-- Select an event --" placeholder
- Empty state message if no events exist

**Link/Unlink Actions:**
- Link button appears when event is selected
- Unlink button appears when event is linked
- Change event button when selecting different event
- Disabled state during operations
- Loading indicators

**Integration:**
- Used inside ItemDetailModal
- Only shown for item owners
- Positioned before Action Buttons section
- Calls `onUpdate` callback after link/unlink

#### UI Flow

1. **No Event Linked:**
   - Dropdown shows "-- Select an event --"
   - User selects event from dropdown
   - "Link to Event" button appears
   - Click to link
   - Blue highlight box appears with event details

2. **Event Already Linked:**
   - Blue box shows linked event details
   - Unlink button in box
   - Dropdown shows current event selected
   - User can select different event to change link
   - Or click unlink to remove association

3. **Changing Event:**
   - Select different event from dropdown
   - "Change Event Link" button appears
   - Click to change association
   - Blue box updates with new event details

4. **Unlinking Event:**
   - Click "Unlink" button
   - Confirmation dialog appears
   - Confirm to unlink
   - Blue box disappears
   - Dropdown resets to placeholder

### Navigation Integration

**Route:** `/events`

**Navigation Tab:** "Events" button added to main navigation bar

**Access:** Available on all main pages (Home, View All, Database View, People, Events)

**Integration Points:**
- `src/components/MainApp.jsx` - Added route handling
- Navigation component updated with new tab
- Consistent header across all pages

## Firestore Security Rules

Location: `firestore.rules`

### Archive Events Collection Rules

```javascript
// Helper function to check if eventId is valid
function isEventIdValid(eventId) {
  return eventId == null || eventId is string;
}

// Helper function to check if user can read an event
function canReadEvent(eventId) {
  return eventId == null || 
    get(/databases/$(database)/documents/archiveEvents/$(eventId)).data.ownerId == request.auth.uid;
}

match /archiveEvents/{eventId} {
  // Owner can read their own events
  // Any authenticated user can read if they have access to an item linking to this event
  allow read: if request.auth != null && (
    resource.data.ownerId == request.auth.uid ||
    exists(/databases/$(database)/documents/archiveItems)
  );
  
  // Users can only create events if ownerId matches their UID
  allow create: if request.auth != null && 
    request.resource.data.ownerId == request.auth.uid;
  
  // Only the owner can update or delete their event records
  allow update, delete: if request.auth != null && 
    resource.data.ownerId == request.auth.uid;
}
```

### Archive Items Collection Rules (Updated)

```javascript
match /archiveItems/{itemId} {
  // Allow create if authenticated, relatedPeopleIds are valid, and eventId is valid
  allow create: if request.auth != null && 
    request.resource.data.ownerId == request.auth.uid &&
    areRelatedPeopleValid(request.resource.data.relatedPeopleIds) &&
    isEventIdValid(request.resource.data.eventId);
  
  // Allow update/delete only if user is the owner, relatedPeopleIds are valid, and eventId is valid
  allow update, delete: if request.auth != null && 
    resource.data.ownerId == request.auth.uid &&
    areRelatedPeopleValid(request.resource.data.relatedPeopleIds) &&
    isEventIdValid(request.resource.data.eventId);
}
```

## Technical Implementation Details

### Real-time Updates
- Uses Firestore `onSnapshot` for live data synchronization
- EventManagementPage: Automatically updates when events change
- ItemEventLinker: Automatically detects when item's event changes
- getEventItems: Provides real-time callback for item lists

### Batch Operations
- Delete event uses `writeBatch` for atomic operations
- Ensures all items are unlinked before event is deleted
- Prevents orphaned references

### Error Handling
- All CRUD operations wrapped in try-catch blocks
- Ownership verification before modifications
- User-friendly error messages
- Console logging for debugging

### Performance Considerations
- Query scoped to current user's events only
- Efficient Firestore queries with `where` clause
- Item counts loaded asynchronously
- Minimal re-renders using React hooks

### Data Validation
- Required field validation (title, dateStart)
- Ownership verification on all mutations
- Event ID validation in security rules
- Type checking in hook functions

### Date Handling
- Stores dates as Firestore timestamps
- Converts to Date objects for display
- Native date inputs in forms
- Formatted display with locale support

## Use Cases

### Example 1: Wedding Photos
```
Event: "Smith-Johnson Wedding"
  Date: June 15, 2019
  Location: Portland, Maine
  Linked Items:
    - 50 wedding photos
    - Wedding invitation
    - Guest book pages
    - Video recording
```

### Example 2: Military Service
```
Event: "Vietnam War Deployment"
  Date: March 1968 - October 1969
  Location: Vietnam
  Linked Items:
    - Service medals
    - Letters home
    - Military photos
    - Dog tags
    - Discharge papers
```

### Example 3: Family Reunion
```
Event: "Annual Family Reunion 2023"
  Date: July 4-7, 2023
  Location: Lake Tahoe, CA
  Linked Items:
    - Group photos
    - Reunion program
    - Recipe cards shared
    - Family tree updates
```

## Future Enhancements

Potential improvements for future versions:

1. **Event Timeline View:** Visual timeline showing all events chronologically
2. **Event Categories:** Add categories (Wedding, Funeral, Reunion, Military, etc.)
3. **Multi-user Events:** Allow multiple users to contribute to shared events
4. **Event Import/Export:** Import events from calendar apps, export to PDF
5. **Photo Gallery View:** Special view for events with many photos
6. **Event Statistics:** Show metrics (total items, total file size, etc.)
7. **Recurring Events:** Support for annual events
8. **Event Templates:** Pre-configured templates for common event types

## Testing Recommendations

### Manual Testing Scenarios

1. **Create Event:**
   - Create with all fields
   - Create with only required fields
   - Try creating without title (should show error)
   - Try creating without start date (should show error)

2. **Update Event:**
   - Edit all fields
   - Update only some fields
   - Cancel edit (should not save)

3. **Delete Event:**
   - Delete event with no linked items
   - Delete event with linked items (check warning)
   - Cancel deletion
   - Verify items are unlinked after deletion

4. **Link Item to Event:**
   - Link item to event
   - Change item to different event
   - Unlink item from event
   - Verify real-time updates

5. **Search Events:**
   - Search by title
   - Search by location
   - Search by description
   - Clear search

6. **Real-time Updates:**
   - Open page in two browser tabs
   - Create event in one tab
   - Verify it appears in both tabs
   - Delete in one, verify removal in both

7. **Batch Unlinking:**
   - Create event
   - Link multiple items to event
   - Delete event
   - Verify all items are unlinked

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
| `firestore.rules` | Modified | Added archiveEvents collection rules and eventId validation |
| `src/hooks/useArchiveEvents.js` | New | Custom hook for event CRUD and item linking |
| `src/components/EventManagementPage.jsx` | New | Event management UI page |
| `src/components/ItemEventLinker.jsx` | New | Component for linking items to events |
| `src/components/ItemDetailModal.jsx` | Modified | Integrated ItemEventLinker component |
| `src/components/MainApp.jsx` | Modified | Added /events route and navigation |

**Total:** 6 files changed (3 new, 3 modified), 996 lines of code
