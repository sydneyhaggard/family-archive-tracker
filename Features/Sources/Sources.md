# Sources & Citations

## Description

The Sources & Citations feature provides a comprehensive system for tracking the origins and references of archive items. Users can create detailed source records that document where items came from, who provided them, and any relevant citation information. This is particularly valuable for genealogical research, historical documentation, and maintaining the provenance of family artifacts.

Each source can include citation details, repository information, URLs, and attached files such as certificates, correspondence, or documentation. Sources can be linked to multiple archive items, creating a traceable connection between items and their origins.

The feature supports:
- Standardized citation formatting
- File attachments for source documentation
- Multiple source attribution per item
- Repository tracking for archival materials
- URL linking for online sources

## Features

### Source Management
- **Create Sources**: Add new sources with title, citation details, repository, and URL
- **Edit Source Information**: Update citation details and metadata
- **Delete Sources**: Remove sources with ownership verification
- **Search Sources**: Real-time filtering by title, citation details, or repository
- **Source Cards**: Visual grid display with citation preview and file indicators
- **Persistent Storage**: All sources stored in Firestore with timestamps

### Citation Details
- **Title Field**: Required descriptive name for the source
- **Citation Details**: Formatted citation information following standard practices
- **Repository Field**: Track physical or institutional locations
- **URL Field**: Link to online sources or digital repositories
- **Validation**: Required title with optional supplementary fields
- **Text Area Support**: Multi-line citation entry for complex references

### File Attachments
- **Upload Files**: Attach multiple files to each source
- **Supported Types**: Documents, images, PDFs, and other file formats
- **File Size Limit**: 10MB maximum per file
- **Storage Organization**: Files stored in Firebase Storage by source ID
- **File Management**: View, download, and delete attached files
- **Thumbnail Preview**: Visual indicators for image files

### File Gallery
- **Media Gallery View**: Full-screen display of attached files
- **Image Carousel**: Navigate through multiple image attachments
- **Zoom & Pan**: Detailed viewing of high-resolution images
- **File Information**: Display file names and types
- **Download Option**: Save files locally
- **Delete from Gallery**: Remove files directly from viewer

### Item Integration
- **Source Selector**: Dropdown in item forms to link sources
- **Multiple Sources**: Items can reference multiple sources
- **Source Tags**: Display source names as badges on item cards
- **Quick Attribution**: Assign sources during item creation/editing
- **Bidirectional Links**: Track which items reference each source

### File Upload Interface
- **Drag & Drop**: Easy file selection and upload
- **Multiple Files**: Upload several files at once
- **Progress Indicators**: Visual feedback during upload
- **File Preview**: Show pending uploads before submission
- **Error Handling**: Clear messages for size/type violations
- **Pending File State**: Manage files before creating new sources

### Citation Practices
- **Flexible Format**: Support various citation styles
- **Structured Input**: Separate fields for different citation elements
- **Preview Display**: See formatted citation in source list
- **Copy-Friendly**: Text can be copied for external use
- **Research Support**: Designed for genealogical standards

### Data Security
- **User Ownership**: Each source owned by creating user
- **Read Access**: All authenticated users can view sources
- **Write Permissions**: Only owners can edit or delete
- **Firestore Rules**: Server-side validation and security
- **Storage Rules**: File access controlled by authentication

### User Interface
- **Responsive Grid**: Mobile-friendly source card layout
- **Modal Forms**: Focused add/edit experience
- **File Grid Display**: Visual representation of attachments
- **Search Bar**: Quick filtering of source list
- **Empty States**: Helpful messages for new users
- **Loading States**: Feedback during async operations
- **Error Messages**: User-friendly validation feedback

### Storage Management
- **Firebase Storage**: Centralized file storage
- **Organized Folders**: Files grouped by source ID
- **Automatic Cleanup**: Delete files when source is removed
- **URL Generation**: Secure download URLs for files
- **Metadata Tracking**: File names, types, and timestamps
