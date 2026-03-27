# Related People

## Description

The Related People feature enables users to create and manage a database of people connected to their family archive. This feature provides a centralized location to store information about family members, ancestors, and other individuals who appear in or are associated with archive items.

Users can create person entries with biographical information including name, birth date, death date, marriage date, and descriptive notes. Each person in the database can then be linked to one or more archive items, making it easy to track which items are associated with specific individuals.

The feature integrates seamlessly with the archive item management system, allowing users to:
- View which items are associated with a person
- Link items to people when creating or editing archive entries
- Navigate between person profiles and related archive items
- Import people from GEDCOM family tree files

## Features

### Person Management
- **Create Person Entries**: Add new people with name, birth date, death date, marriage date, and description
- **Edit Person Information**: Update biographical details for existing person records
- **Delete Person Entries**: Remove people from the database with ownership verification
- **Search & Filter**: Real-time search by name or description to find people quickly
- **Person Cards**: Visual grid display with avatar, key dates, and description preview

### GEDCOM Import
- **Import from GEDCOM Files**: Upload family tree files in standard GEDCOM format
- **Automatic Person Extraction**: Parse GEDCOM data to create person entries automatically
- **Batch Import**: Create multiple person records in a single operation
- **Date Parsing**: Extract and format birth, death, and marriage dates from GEDCOM
- **Validation**: Preview imported data before adding to database

### Archive Item Integration
- **Link People to Items**: Associate multiple people with any archive item
- **Related People Selector**: Multi-select dropdown in item forms to choose associated people
- **Clickable Person Links**: Navigate from item detail view to person profile
- **Linked Items Display**: View all archive items associated with a person

### Person Detail Modal
- **View Person Profile**: Display complete biographical information
- **Show Linked Items**: Grid of all archive items associated with the person
- **Click-through Navigation**: Open archive item details from person profile
- **Edit from Profile**: Quick access to edit person information

### Security & Permissions
- **User Ownership**: Each person record is owned by the creating user
- **Read Access**: All authenticated users can view person records
- **Write Permissions**: Only owners can edit or delete their person records
- **Firestore Rules**: Server-side validation of ownership and data structure

### Data Management
- **Real-time Updates**: Automatic UI refresh when person data changes
- **Persistent Storage**: All data stored in Firestore with timestamps
- **Relationship Tracking**: Maintain bidirectional links between people and items
- **Array Management**: Efficient handling of related people IDs on archive items

### User Interface
- **Responsive Design**: Mobile-friendly layout that adapts to screen size
- **Modal Forms**: Clean, focused add/edit experience
- **Date Formatting**: Human-readable display of birth, death, and marriage dates
- **Empty States**: Helpful messages when no people exist
- **Error Handling**: User-friendly error messages for validation and operations
