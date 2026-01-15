# Collections (Archive Events)

## Description

The Collections feature, internally called Archive Events, allows users to organize their archive items into themed collections or events. Each collection represents a meaningful grouping such as a family reunion, wedding, military deployment, school year, or any other significant event or time period.

Collections act as virtual albums or folders that can contain multiple archive items. This makes it easy to find and view all items related to a specific event or theme. Users can link items to multiple collections, creating flexible organizational structures that reflect how memories are naturally connected.

The feature includes:
- Visual collection management with item counts
- Bulk item selection with shift-click support
- Date range tracking for time-bounded events
- Location information for place-based collections
- Bi-directional linking between items and collections

## Features

### Collection Management
- **Create Collections**: Add new collections with title, description, date range, and location
- **Edit Collection Details**: Update metadata including dates and location information
- **Delete Collections**: Remove collections while preserving linked items
- **Search Collections**: Real-time filtering by title, description, or location
- **Item Count Display**: See how many items are linked to each collection
- **Sort by Date**: Collections automatically sorted by start date

### Item Linking
- **Multi-Select Interface**: Checkbox-based selection for linking multiple items
- **Shift-Click Selection**: Select ranges of items efficiently
- **Visual Selection State**: Clear indication of selected vs already-linked items
- **Bulk Link Operations**: Add multiple items to a collection at once
- **Link Removal**: Remove items from collections individually or in bulk
- **Bidirectional Links**: Items track their collection memberships via `linkedEventIds` array

### Collection Display
- **Collection Cards**: Visual grid with title, dates, location, and item count
- **Date Formatting**: Human-readable display of date ranges (e.g., "May 15, 2020 - May 17, 2020")
- **Location Badge**: Prominent display of collection location when specified
- **Description Preview**: Truncated description with full text on hover
- **Item Count Badge**: Quick reference for collection size

### Item Selection Modal
- **Full Item List**: Display all user's archive items with thumbnails
- **Search & Filter**: Find specific items by title or description
- **Already Linked Indicator**: Visual distinction for items already in the collection
- **Thumbnail Preview**: Small image preview for each item
- **Select All/None**: Quick actions for bulk selection
- **Loading States**: Progress indicators during data fetch

### Date & Location Tracking
- **Start Date**: Required field for collection beginning
- **End Date**: Optional field for collection conclusion
- **Single Day Events**: Automatically handle same start and end date
- **Location Field**: Optional text field for place names or addresses
- **Date Validation**: Ensure end date is after start date

### Integration with Archive Items
- **Event Selector**: Multi-select dropdown in item forms
- **Quick Assignment**: Link items to collections during item creation/editing
- **Visual Tags**: Collection names displayed as badges on item cards
- **Filter by Collection**: View all items in a specific collection
- **Remove from Collection**: Unlink items from item detail view

### Data Management
- **Real-time Updates**: Live synchronization of collection and item changes
- **Batch Operations**: Efficient bulk updates using Firestore batch writes
- **Item Count Caching**: Performance optimization for collection sizes
- **Array Management**: Efficient Firestore `arrayUnion` and `arrayRemove` operations
- **Ownership Verification**: Security rules enforce user ownership

### User Interface
- **Responsive Grid**: Mobile-friendly collection card layout
- **Modal Forms**: Focused experience for creating and editing collections
- **Confirmation Dialogs**: Prevent accidental deletions
- **Empty States**: Helpful messages when no collections exist
- **Loading Indicators**: Clear feedback during async operations
- **Error Messages**: User-friendly validation and error handling
