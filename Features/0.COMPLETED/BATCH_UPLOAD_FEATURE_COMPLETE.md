# Batch Upload Feature

## Overview
The batch upload feature allows users to upload multiple files at once, with each file automatically saved as its own individual archive item. This streamlines the process of adding multiple items to the family archive.

## How It Works

### User Interface
- A new "📤 Batch Upload" button has been added to the home page, next to the "Add Archive Item" button
- The button opens a modal dialog for batch file selection and configuration

### Batch Upload Modal Features

#### 1. Default Settings
Users can configure default settings that apply to all uploaded files:
- **Default Category**: Required - applies to all items (Family History, Military, Education, etc.)
- **Default Item Type**: Optional - can be set to auto-detect based on file type, or manually specified
- **AI Transcription**: Optional toggle to enable/disable automatic transcription for documents and images

#### 2. File Selection
- Support for multiple file selection at once
- File types supported: images, videos, PDFs, documents (.doc, .docx), and text files
- Maximum file size: 10 MB per file (configurable via MAX_FILE_SIZE constant)
- File validation with clear error messages for oversized files

#### 3. File Preview
- Visual preview of selected files with icons
- Display of file name, size, and detected/assigned item type
- Shows count of selected files

#### 4. Upload Process
- Real-time progress indicator showing:
  - Current file being uploaded (e.g., "Uploading file 3 of 10")
  - Overall progress percentage
- Each file is processed sequentially:
  1. Upload to Firebase Storage
  2. Optional AI transcription (if enabled and file is document/image)
  3. Create archive item in Firestore
  4. Update user storage quota

#### 5. Item Creation
For each uploaded file, a new archive item is created with:
- **Title**: Filename without extension
- **Description**: "Batch uploaded file: [filename]"
- **Item Type**: Auto-detected from file type or user-specified default
  - Images → Photo
  - Videos → Video
  - Audio → Audio Recording
  - PDFs/Documents → Document
  - Other → Other
- **Category**: User-specified default category
- **Tags**: Automatically tagged with "batch-upload" for easy filtering
- **Files**: Single file attached to each item
- **Transcription**: Auto-generated via Gemini AI (if enabled and applicable)
- **Owner Info**: User's ID, email, name, and photo
- **Timestamps**: Created and updated timestamps

### Auto-Detection Logic
The batch upload feature includes intelligent file type detection:
- Image files (image/*) → Photo
- Video files (video/*) → Video
- Audio files (audio/*) → Audio Recording
- Document files (PDF, .doc, .docx, .txt) → Document
- All others → Other

### AI Transcription
When enabled, the batch upload feature:
- Uses Google Gemini AI to extract text from documents and images
- For images: Extracts visible text and provides image description if no text found
- For documents: Extracts and transcribes all text content
- For text files: Reads content directly without API call
- Stores transcription with each individual file's archive item

### Storage Management
- Each file's size is tracked and added to user's storage quota
- Storage updates happen in real-time during upload
- User can monitor storage usage in the header

## Technical Implementation

### Components
- **BatchUploadModal.jsx**: New component handling the batch upload UI and logic
- **MainApp.jsx**: Updated to include batch upload button and modal integration

### Key Functions
- `handleFileSelect()`: Validates and processes selected files
- `getItemTypeFromFile()`: Auto-detects item type from file MIME type
- `transcribeDocument()`: Handles AI transcription via Gemini API
- `handleBatchUpload()`: Main upload orchestration function

### Data Flow
1. User selects files and configures settings
2. Files are validated for size constraints
3. On submit, each file is processed sequentially:
   - Upload to Firebase Storage
   - Generate download URL
   - (Optional) Generate AI transcription
   - Create Firestore document with item data
   - Update user storage quota
4. On completion, refresh items list and close modal

## Usage Example

### Scenario: Uploading Family Photos
1. User clicks "📤 Batch Upload" button
2. Selects "Family History" as default category
3. Leaves item type as "Auto-detect" (will detect as Photo)
4. Enables AI transcription to extract text from photos
5. Selects 10 family photos from computer
6. Reviews preview showing all 10 files
7. Clicks "Upload 10 Files" button
8. System uploads each photo and creates 10 separate archive items
9. Each item is titled with the photo filename
10. AI transcriptions are generated for any photos with visible text
11. All items are tagged with "batch-upload"
12. Items appear in the main archive list

## Benefits
- **Time Saving**: Upload many files at once instead of one-by-one
- **Consistency**: Apply same category to related items
- **Organization**: Auto-tagging helps filter batch-uploaded items
- **Flexibility**: Each file becomes its own item, allowing individual editing later
- **Intelligence**: Auto-detection and AI transcription reduce manual work

## Future Enhancements
Potential improvements for future versions:
- Ability to customize title/description per file before upload
- Bulk editing of uploaded items
- Support for drag-and-drop file selection
- Folder upload support
- Customizable tags for batch uploads
- Progress recovery for interrupted uploads
