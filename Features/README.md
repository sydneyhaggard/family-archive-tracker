# Family Archive Tracker

A comprehensive web application for tracking and preserving physical family archive items including books, trinkets, documents, and photos. Built with React, Firebase, and Tailwind CSS v4, enhanced with AI-powered document transcription using Google's Gemini API.

## Features

### Core Functionality
- 📚 **Archive Item Management**: Track individual physical items in your family archive
- 📁 **Multi-file Upload**: Upload images, videos, documents, and other resources for each item
- 👥 **Sharing**: Share archival items between multiple users via email
- 🏷️ **Categories**: Organize items with user-defined categories
- 🔍 **Search & Filter**: Find items quickly by title, description, or category
- 💾 **Data Export**: Export all archive data to CSV or SQL formats

### Authentication
- 🔐 **Email/Password Authentication**: Traditional sign-up and sign-in
- 🔑 **Google Sign-In**: One-click authentication with Google OAuth
- 👤 **User Profile Management**: Automatic profile creation and management

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
- 🎨 **Modern UI**: Built with React and Tailwind CSS v4 for a clean, responsive design
- 🔐 **Secure Authentication**: Firebase Authentication with Google OAuth support
- 🌐 **Real-time Updates**: Live data synchronization across devices
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- ⚡ **Fast Build Process**: Vite for lightning-fast development and optimized production builds
- ✨ **Scroll Animations**: Smooth, performant animations triggered on scroll or page progress

### Advanced Animation System
- 🎭 **Intersection Observer API**: Performance-optimized scroll animations
- 📜 **Progress-Based Triggers**: Animate elements based on page scroll percentage
- 🎨 **Multiple Animation Types**: 15+ pre-built animation styles
- ⚙️ **Customizable**: Control timing, delays, thresholds, and repetition
- 🔄 **Dynamic Content Support**: Auto-detects and animates newly added elements

## Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS v4
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **AI**: Google Gemini API for transcription and image analysis
- **Hosting**: Firebase Hosting
- **Build Tool**: Vite with hot module replacement

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- A Firebase project ([Create one here](https://console.firebase.google.com/))
- A Google AI Studio API key for Gemini ([Get one here](https://makersuite.google.com/app/apikey))

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/sydneyhaggard/family-archive-tracker.git
   cd family-archive-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   
   Copy the example environment file and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Firebase and Gemini API credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Enable Google Sign-In in Firebase Console**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Navigate to Authentication → Sign-in method
   - Enable "Google" as a sign-in provider
   - Configure OAuth consent screen if needed

5. **Install Firebase CLI** (if not already installed)
   ```bash
   npm install -g firebase-tools
   ```

6. **Login to Firebase**
   ```bash
   firebase login
   ```

7. **Initialize Firebase in your project** (if not already done)
   ```bash
   firebase init
   ```
   - Select Firestore, Storage, and Hosting
   - Use the existing `firestore.rules` and `storage.rules` files
   - Set the public directory to `dist`

8. **Deploy Firestore and Storage rules**
   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```

9. **Run locally in development mode**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

10. **Build for production**
    ```bash
    npm run build
    ```

11. **Preview production build locally**
    ```bash
    npm run preview
    ```

12. **Deploy to Firebase Hosting**
    ```bash
    firebase deploy --only hosting
    ```

## Development

### Dev Container Setup (Recommended)

This project includes a dev container configuration for a consistent development environment.

#### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VS Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

#### Getting Started with Dev Container

1. **Open in Dev Container**
   - Open the project in VS Code
   - Press `Cmd+Shift+P` and select "Dev Containers: Reopen in Container"
   - Wait for the container to build (first time may take a few minutes)

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your Firebase and Gemini API credentials.

3. **Login to Firebase**
   
   > ⚠️ **Important**: Inside the container, use the `--no-localhost` flag for Firebase login:
   ```bash
   firebase login --no-localhost
   ```
   This opens a URL you can copy to your browser for authentication.

4. **Start Development**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

5. **Start Firebase Emulators** (optional, for local testing)
   ```bash
   npm run emulators
   ```
   Emulator UI available at `http://localhost:4000`

#### Forwarded Ports
| Port | Service |
|------|---------|
| 5173 | Vite dev server |
| 4000 | Firebase Emulator UI |
| 5001 | Cloud Functions emulator |
| 8080 | Firestore emulator |
| 9099 | Auth emulator |
| 9199 | Storage emulator |

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run emulators` - Start Firebase emulators
- `npm run emulators:export` - Export emulator data to `./emulator-data`
- `npm run emulators:import` - Start emulators with previously exported data

### Project Structure

```
family-archive-tracker/
├── src/
│   ├── components/
│   │   ├── AuthSection.jsx      # Authentication UI (email/password + Google)
│   │   └── MainApp.jsx           # Main application component
│   ├── config/
│   │   └── firebase.js           # Firebase configuration and initialization
│   ├── App.jsx                   # Root component with auth state management
│   ├── main.jsx                  # Application entry point
│   └── index.css                 # Global styles with Tailwind v4
├── index.html                    # HTML template
├── vite.config.js                # Vite configuration
├── firebase.json                 # Firebase hosting configuration
├── firestore.rules               # Firestore security rules
├── storage.rules                 # Storage security rules
├── .env.example                  # Example environment variables
├── package.json                  # Dependencies and scripts
└── README.md                     # This file
```

## Usage Guide

### Scroll Animations

The application includes a powerful scroll animation system built with the Intersection Observer API. Elements can animate in when they enter the viewport or when a specific scroll progress is reached.

#### Basic Usage

Add the `data-scroll-animation` attribute to any HTML element:

```jsx
{/* Simple fade up animation */}
<div data-scroll-animation="fade-up">
  Content here
</div>

{/* With custom timing */}
<div 
  data-scroll-animation="fade-left" 
  data-scroll-delay="200" 
  data-scroll-duration="800"
>
  Delayed animation
</div>
```

#### Available Animation Types

- **Fade Animations**: `fade`, `fade-up`, `fade-down`, `fade-left`, `fade-right`
- **Slide Animations**: `slide-up`, `slide-down`, `slide-left`, `slide-right`
- **Scale Animations**: `scale`, `zoom-in`, `zoom-out`
- **Rotate Animations**: `rotate-in`
- **Flip Animations**: `flip-x`, `flip-y`

#### Animation Attributes

All animations support these data attributes:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-scroll-animation` | string | `"fade-up"` | Animation type to use |
| `data-scroll-delay` | number | `0` | Delay before animation starts (milliseconds) |
| `data-scroll-duration` | number | `600` | Animation duration (milliseconds) |
| `data-scroll-once` | boolean | `true` | Animate only once or repeat on scroll |
| `data-scroll-threshold` | number | `0.1` | How much of element must be visible (0-1) |
| `data-scroll-progress` | number | - | Trigger at page scroll percentage (0-100) |

#### Viewport-Based Animations

Trigger animations when elements enter the viewport:

```jsx
{/* Animate when 10% of element is visible */}
<div 
  data-scroll-animation="fade-up" 
  data-scroll-threshold="0.1"
>
  Content
</div>

{/* Animate when 50% of element is visible */}
<div 
  data-scroll-animation="scale" 
  data-scroll-threshold="0.5"
>
  Half visible before animating
</div>

{/* Repeat animation when scrolling back */}
<div 
  data-scroll-animation="fade-right" 
  data-scroll-once="false"
>
  Repeats on scroll
</div>
```

#### Progress-Based Animations

Trigger animations based on how far the page has been scrolled:

```jsx
{/* Animate when page is 25% scrolled */}
<div 
  data-scroll-animation="fade-up" 
  data-scroll-progress="25"
>
  Appears at 25% scroll
</div>

{/* Animate when page is 50% scrolled */}
<div 
  data-scroll-animation="scale" 
  data-scroll-progress="50"
  data-scroll-delay="300"
>
  Appears halfway down the page
</div>

{/* Animate near page bottom */}
<div 
  data-scroll-animation="zoom-in" 
  data-scroll-progress="90"
>
  Appears near bottom
</div>
```

#### Advanced Examples

Combine multiple attributes for complex effects:

```jsx
{/* Staggered animations */}
<div data-scroll-animation="fade-up" data-scroll-delay="0">First</div>
<div data-scroll-animation="fade-up" data-scroll-delay="100">Second</div>
<div data-scroll-animation="fade-up" data-scroll-delay="200">Third</div>

{/* Slow, dramatic entrance */}
<div 
  data-scroll-animation="zoom-in" 
  data-scroll-duration="1500"
  data-scroll-threshold="0.8"
>
  Dramatic content
</div>

{/* Progress-based with repeat */}
<div 
  data-scroll-animation="fade-left" 
  data-scroll-progress="75"
  data-scroll-once="false"
>
  Toggles at 75% scroll
</div>
```

#### Performance Features

- **Intersection Observer**: Uses browser-native API for optimal performance
- **Request Animation Frame**: Smooth scroll tracking without jank
- **Dynamic Content**: Automatically observes elements added via React/AJAX
- **Lazy Initialization**: Elements only animate when needed
- **Memory Efficient**: Properly cleans up observers and listeners

#### Implementation Details

The scroll animation system is automatically initialized when the app loads. It:

1. Scans the DOM for elements with `data-scroll-animation`
2. Adds appropriate CSS classes for initial hidden state
3. Observes elements using Intersection Observer API
4. Tracks page scroll progress for progress-based animations
5. Applies animations with smooth CSS transitions
6. Auto-detects dynamically added content

No additional setup required - just add the data attributes to your components!

### Getting Started

1. **Sign Up/Sign In**
   - Use email/password to create an account
   - Or click "Sign in with Google" for one-click authentication
   
2. **Add Items**: Click "Add Archive Item" to create your first entry

3. **Upload Files**: Attach images, videos, or documents (max 10 MB per file)

4. **AI Processing**: Documents and images are automatically analyzed

5. **View Transcriptions**: Click "View Transcription" on document files

6. **Share**: Add email addresses to share items with family members

### Managing Storage
- Monitor your storage quota in the header
- System warns when approaching 80% capacity
- File size limit: 10 MB per file, 50 MB per item

### Google Sign-In
- Click "Sign in with Google" button
- Authorize the application in the Google OAuth popup
- Your account will be created automatically with your Google profile

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

### Environment Variables
- Never commit `.env` file to version control
- All sensitive credentials are loaded from environment variables
- Use `.env.example` as a template

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

### Build Issues
- Ensure Node.js version is 18 or higher
- Clear `node_modules` and run `npm install` again
- Check that all environment variables are set in `.env`

### Firebase Connection Issues
- Verify your Firebase configuration in `.env`
- Check Firebase Console for quota limits
- Ensure Firestore and Storage are enabled
- Verify that Google Sign-In is enabled in Firebase Authentication

### Google Sign-In Issues
- Ensure Google provider is enabled in Firebase Console
- Check that OAuth consent screen is configured
- Verify authorized domains in Firebase settings
- Clear browser cache and cookies

### AI Features Not Working
- Verify Gemini API key is correct in `.env`
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
- Tailwind CSS v4 for styling
- React and Vite for the modern development experience
