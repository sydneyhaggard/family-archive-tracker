# Batch Upload Feature - User Interface Flow

## UI Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Family Archive Tracker                      │
│                                                                 │
│  Home  │  View All (Cards)  │  View Every Archive Item        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Latest Archive Items                                           │
│  Showing the 10 most recent items                               │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ + Add Archive Item  │  │  📤 Batch Upload    │  View All   │
│  └─────────────────────┘  └─────────────────────┘             │
│                                 ▲                               │
│                                 │                               │
│                      Clicking opens modal                       │
│                                 │                               │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Batch Upload Files                         │
│ Upload multiple files at once. Each file will be saved as its  │
│ own archive item.                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Default Settings for All Items                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Default Category *          Default Item Type *       │    │
│  │  ┌──────────────────┐        ┌──────────────────┐     │    │
│  │  │ Family History ▼ │        │ Auto-detect ▼    │     │    │
│  │  └──────────────────┘        └──────────────────┘     │    │
│  │                                                        │    │
│  │  ☑ Enable AI transcription for documents and images   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Select Files to Upload                                         │
│  Maximum file size: 10 MB per file                              │
│  Each file will become a separate archive item with its         │
│  filename as the title                                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Choose Files...                     No files chosen   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Selected Files (3):                                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  🖼️  family_photo_1950.jpg           2.3 MB  [Photo]   │    │
│  │  🖼️  grandpa_portrait.jpg            1.8 MB  [Photo]   │    │
│  │  📄  birth_certificate.pdf           0.5 MB  [Document]│    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│                                                                 │
│                              ┌────────┐  ┌──────────────────┐  │
│                              │ Cancel │  │  Upload 3 Files  │  │
│                              └────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

When Upload is clicked:
┌─────────────────────────────────────────────────────────────────┐
│  Uploading file 2 of 3... (67%)                                 │
│  ████████████████████░░░░░░░░░░                                 │
└─────────────────────────────────────────────────────────────────┘

After successful upload:
┌─────────────────────────────────────────────────────────────────┐
│ 3 new archive items created:                                    │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ family_    │  │ grandpa_   │  │ birth_     │                │
│  │ photo_1950 │  │ portrait   │  │ certificate│                │
│  │            │  │            │  │            │                │
│  │ Photo      │  │ Photo      │  │ Document   │                │
│  │ Family     │  │ Family     │  │ Family     │                │
│  │ History    │  │ History    │  │ History    │                │
│  │ 📁 1       │  │ 📁 1       │  │ 📁 1       │                │
│  │ batch-     │  │ batch-     │  │ batch-     │                │
│  │ upload     │  │ upload     │  │ upload     │                │
│  └────────────┘  └────────────┘  └────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

## Feature Workflow

### Step 1: Access Batch Upload
- User clicks "📤 Batch Upload" button on home page
- Modal dialog opens with batch upload interface

### Step 2: Configure Default Settings
- **Select Default Category** (required)
  - Family History, Military, Education, Religious, Professional, etc.
  - Applies to ALL uploaded files
  
- **Select Default Item Type** (optional)
  - Can leave as "Auto-detect" to automatically determine from file type
  - Or manually select: Book, Document, Photo, Video, etc.
  
- **Enable/Disable AI Transcription** (optional checkbox)
  - When enabled, documents and images are automatically transcribed
  - Uses Google Gemini AI
  - May increase upload time

### Step 3: Select Files
- Click "Choose Files..." button
- Select multiple files from file system
- Supported types: images, videos, PDFs, documents (.doc, .docx), text files
- Maximum: 10 MB per file

### Step 4: Review Selection
- Preview shows all selected files with:
  - Icon (🖼️ for images, 🎥 for videos, 📄 for documents, etc.)
  - Filename
  - File size
  - Detected/assigned item type

### Step 5: Upload
- Click "Upload X Files" button
- Progress bar shows:
  - Current file being uploaded (e.g., "Uploading file 2 of 3")
  - Overall percentage complete
- Cannot cancel during upload to maintain data integrity

### Step 6: Result
- Modal closes automatically on success
- New items appear in archive list
- Each file is now an individual archive item with:
  - Title: filename (without extension)
  - Description: "Batch uploaded file: [filename]"
  - Category: Selected default category
  - Item Type: Auto-detected or default type
  - Tags: Includes "batch-upload" tag
  - File: Single file attachment
  - Transcription: AI-generated (if enabled and applicable)
  - Owner: Current user

## Auto-Detection Examples

| File Type | MIME Type | Auto-Detected Item Type |
|-----------|-----------|------------------------|
| .jpg, .png, .gif | image/* | Photo |
| .mp4, .mov, .avi | video/* | Video |
| .mp3, .wav | audio/* | Audio Recording |
| .pdf, .doc, .docx, .txt | application/pdf, etc. | Document |
| Other | * | Other |

## Benefits

1. **Time Savings**: Upload 10 files in one operation instead of 10 separate operations
2. **Consistency**: Same category applied to related items automatically
3. **Organization**: Auto-tagging makes it easy to find batch-uploaded items
4. **Flexibility**: Each file is its own item, allowing individual editing/deletion later
5. **Intelligence**: Auto-detection and AI transcription reduce manual data entry
6. **Transparency**: Clear progress feedback during upload process
