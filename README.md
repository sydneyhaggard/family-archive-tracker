# Family Archive Tracker

A comprehensive web application for tracking and preserving physical family archive items including books, trinkets, documents, and photos. Built with Firebase and enhanced with AI-powered document transcription using Google's Gemini API.

## Features

### Core Functionality
- 📚 **Archive Item Management**: Track individual physical items in your family archive
- 📁 **Multi-file Upload**: Upload images, videos, documents, and other resources for each item
- 👥 **Sharing**: Share archival items between multiple users via email
- 🏷️ **Categories**: Organize items with user-defined categories
- 🔍 **Search & Filter**: Find items quickly by title, description, or category
- 💾 **Data Export**: Export all archive data to CSV or SQL formats

### AI-Powered Features
- 🤖 **Automatic Transcription**: Documents are automatically transcribed using Gemini AI
- 🖼️ **Image Analysis**: AI-generated descriptions for uploaded images
- 📝 **Text Extraction**: Extract text from PDFs, Word documents, and other file types
- 💬 **Smart Descriptions**: Detailed AI analysis of photos including time period, people, and objects

### Storage Management
- 📊 **Storage Quota Tracking**: Monitor your storage usage in real-time
- ⚠️ **File Size Limits**: 10 MB maximum per file, with quota warnings
- 📈 **Usage Analytics**: Track storage consumption across all items

### User Experience
- 🎨 **Modern UI**: Built with Tailwind CSS for a clean, responsive design
- 🔐 **Secure Authentication**: Firebase Authentication for user management
- 🌐 **Real-time Updates**: Live data synchronization across devices
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

## Technology Stack

- **Frontend**: HTML5, Tailwind CSS, JavaScript (Vanilla)
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **AI**: Google Gemini API for transcription and image analysis
- **Hosting**: Firebase Hosting

## Setup Instructions

### Prerequisites
- A Firebase project ([Create one here](https://console.firebase.google.com/))
- A Google AI Studio API key for Gemini ([Get one here](https://makersuite.google.com/app/apikey))
- Node.js and npm (for Firebase CLI)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/sydneyhaggard/family-archive-tracker.git
   cd family-archive-tracker
   ```

2. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

3. **Configure Firebase**
   - Edit `firebase-config.js` and replace the placeholder values with your Firebase project configuration:
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_PROJECT_ID.appspot.com",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       appId: "YOUR_APP_ID"
   };
   ```

4. **Configure Gemini API**
   - In `firebase-config.js`, add your Gemini API key:
   ```javascript
   const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
   ```

5. **Initialize Firebase in your project**
   ```bash
   firebase login
   firebase init
   ```
   - Select Firestore, Storage, and Hosting
   - Use the existing `firestore.rules` and `storage.rules` files
   - Set the public directory to `.` (current directory)

6. **Deploy Firestore and Storage rules**
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only storage:rules
   ```

7. **Run locally** (optional)
   ```bash
   firebase serve
   ```
   Visit `http://localhost:5000` to test the application

8. **Deploy to Firebase Hosting**
   ```bash
   firebase deploy --only hosting
   ```

## File Structure

```
family-archive-tracker/
├── index.html              # Main HTML file
├── app.js                  # Application logic
├── firebase-config.js      # Firebase and Gemini configuration
├── firebase.json           # Firebase hosting configuration
├── firestore.rules         # Firestore security rules
├── storage.rules           # Storage security rules
└── README.md              # This file
```

## Usage Guide

### Getting Started
1. **Sign Up**: Create an account with your email and password
2. **Add Items**: Click "Add Archive Item" to create your first entry
3. **Upload Files**: Attach images, videos, or documents (max 10 MB per file)
4. **AI Processing**: Documents and images are automatically analyzed
5. **View Transcriptions**: Click "View Transcription" on document files
6. **Share**: Add email addresses to share items with family members

### Managing Storage
- Monitor your storage quota in the header
- System warns when approaching 80% capacity
- File size limit: 10 MB per file, 50 MB per item

### Exporting Data
1. Click the "Export Data" button
2. Choose CSV or SQL format
3. File downloads automatically with all item details and transcriptions

## Security

### Firestore Rules
- Users can only read/write their own user documents
- Items can be read if user is owner or in shared list
- Only owners can update or delete items

### Storage Rules
- Users can only access their own uploaded files
- Maximum file size enforced at 10 MB
- All uploads require authentication

## AI Features in Detail

### Document Transcription
When you upload a document (PDF, Word, TXT, etc.):
1. File is uploaded to Firebase Storage
2. Gemini AI extracts all text content
3. Transcription is stored with the file metadata
4. View transcription anytime with "View Transcription" button
5. Copy or download transcription as TXT file

### Image Analysis
When you upload an image:
1. Image is uploaded to Firebase Storage
2. Gemini Vision AI analyzes the content
3. Description includes: visible elements, text, time period, people/places
4. Analysis is stored with the image metadata
5. View analysis with "View AI Analysis" button

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Firebase Connection Issues
- Verify your Firebase configuration is correct
- Check Firebase Console for quota limits
- Ensure Firestore and Storage are enabled

### AI Features Not Working
- Verify Gemini API key is correct
- Check API quota in Google AI Studio
- Ensure files are under size limits
- Check browser console for detailed errors

### Upload Failures
- Verify file size is under 10 MB
- Check internet connection
- Ensure storage quota not exceeded
- Verify Storage Rules are deployed

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on GitHub.

## Acknowledgments

- Firebase for backend infrastructure
- Google Gemini for AI capabilities
- Tailwind CSS for styling
