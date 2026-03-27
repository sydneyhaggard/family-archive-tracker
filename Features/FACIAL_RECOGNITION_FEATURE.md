# Facial Recognition Feature

**Date:** February 15, 2026  
**Status:** 📝 Spec  
**Type:** New Feature — AI / Computer Vision

## Overview

Add facial recognition to the Family Archive Tracker so users can automatically detect, identify, and tag people in their photos. Detected faces are matched against known `relatedPeople` records, enabling users to quickly tag who appears in each photo. Over time, the system learns each person's face from multiple angles, improving match accuracy.

### Key Capabilities

- **Face Detection** — Locate all faces in a photo with bounding boxes
- **Face Encoding** — Generate 128-dimensional descriptor vectors for each face
- **Face Matching** — Compare descriptors against known faces using Euclidean distance
- **Face Tagging** — Link detected faces to `relatedPeople` records
- **Auto-Suggestion** — Suggest person matches ranked by confidence
- **Batch Scanning** — Scan all photos in the archive for faces

## Technology Choice

### face-api.js (Client-Side) ⭐

| Criteria | Details |
|----------|---------|
| **Library** | [face-api.js](https://github.com/justadudewhohacks/face-api.js) — TensorFlow.js wrapper |
| **Runs** | Entirely client-side (browser) |
| **Models** | SSD MobileNet v1 (detection) + FaceLandmark68Net + FaceRecognitionNet |
| **Model Size** | ~6MB total, loaded once and cached by browser |
| **Embeddings** | 128-dimensional float vectors per face |
| **Matching** | Euclidean distance threshold (< 0.6 = match) |
| **Cost** | Free — no API calls |
| **Privacy** | All processing stays on user's device |

#### Why Not Gemini / Cloud Vision?

- Gemini can detect faces but **cannot generate comparable embeddings** for cross-photo matching
- Google Cloud Vision removed face recognition due to ethical policy
- AWS Rekognition / Azure Face work but add cost and cloud dependency
- face-api.js is free, private, and sufficient for family-scale datasets

## Architecture

### System Flow

```
┌───────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Photo Upload │────▶│ Face Detection│────▶│ Face Descriptors│
│  or Edit View │     │ (face-api.js) │     │  (128-d vectors) │
└───────────────┘     └──────────────┘     └────────┬────────┘
                                                     │
                                           ┌─────────▼─────────┐
                                           │  Match Against     │
                                           │  Known Faces       │
                                           │  (Euclidean dist)  │
                                           └─────────┬─────────┘
                                                     │
                                    ┌────────────────┬┴─────────────────┐
                                    ▼                ▼                  ▼
                            ┌──────────┐    ┌──────────────┐   ┌────────────┐
                            │  Match   │    │  Suggestion  │   │  Unknown   │
                            │  Found   │    │  (< 0.6 but  │   │  Face      │
                            │  (< 0.5) │    │    close)    │   │  (> 0.6)   │
                            └──────────┘    └──────────────┘   └────────────┘
```

### Firestore Data Model

#### New Collection: `faceProfiles`

One document per known person. Stores multiple descriptors for better matching.

```javascript
{
  personId: string,           // Reference to relatedPeople document
  personName: string,         // Denormalized name for quick display
  ownerId: string,            // User who owns this profile
  descriptors: [              // Array of face descriptor vectors
    {
      vector: number[128],    // 128-d embedding from face-api.js
      sourceItemId: string,   // Which archive item this came from
      addedAt: timestamp      // When this descriptor was added
    }
  ],
  thumbnailURL: string,       // Cropped face thumbnail (Firebase Storage)
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Design Rationale:**
- Multiple descriptors per person improves accuracy (different angles, lighting, ages)
- Denormalized `personName` avoids extra reads during matching
- `thumbnailURL` enables a visual face gallery without loading full photos

#### New Collection: `faceDetections`

One document per detected face in a photo.

```javascript
{
  itemId: string,             // Reference to archiveItems document
  ownerId: string,            // User who owns this detection
  boundingBox: {              // Face location (relative coords 0-1)
    x: number,
    y: number,
    width: number,
    height: number
  },
  descriptor: number[128],    // Face embedding vector
  personId: string | null,    // Linked person (null = unidentified)
  personName: string | null,  // Denormalized name
  confidence: number,         // Match confidence (0-1, lower = better match)
  status: string,             // 'confirmed' | 'suggested' | 'unidentified'
  thumbnailURL: string,       // Cropped face thumbnail
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### Updated Collection: `archiveItems`

Add optional fields to existing documents:

```javascript
{
  // ... existing fields ...
  facesDetected: number,        // Count of detected faces (for badges/filtering)
  facesIdentified: number,      // Count of identified faces
  facesScanDate: timestamp      // When faces were last scanned
}
```

#### Updated Collection: `relatedPeople`

Add optional field:

```javascript
{
  // ... existing fields ...
  faceProfileId: string | null  // Reference to faceProfiles document
}
```

### Security Rules

```javascript
// Face Profiles — owner-only access
match /faceProfiles/{profileId} {
  allow read: if request.auth != null &&
    resource.data.ownerId == request.auth.uid;
  allow create: if request.auth != null &&
    request.resource.data.ownerId == request.auth.uid;
  allow update, delete: if request.auth != null &&
    resource.data.ownerId == request.auth.uid;
}

// Face Detections — owner-only access
match /faceDetections/{detectionId} {
  allow read: if request.auth != null &&
    resource.data.ownerId == request.auth.uid;
  allow create: if request.auth != null &&
    request.resource.data.ownerId == request.auth.uid;
  allow update, delete: if request.auth != null &&
    resource.data.ownerId == request.auth.uid;
}
```

## Custom Hook: `useFaceRecognition`

Location: `src/hooks/useFaceRecognition.js`

### Exported Functions

**Initialization:**
- `modelsLoaded` — Boolean, true when face-api.js models are ready
- `loadingModels` — Boolean, true while models are loading
- `loadModels()` — Trigger model loading (called once on mount)

**Detection:**
- `detectFaces(imageElement)` — Detect all faces in an image, returns array of `{boundingBox, descriptor}`
- `scanItem(itemId, imageURL)` — Full pipeline: detect → match → store results

**Matching:**
- `matchFace(descriptor)` — Compare a descriptor against all known `faceProfiles`, returns best match + confidence
- `getUnidentifiedFaces(itemId)` — Get faces in a photo that haven't been matched

**Profile Management:**
- `createFaceProfile(personId, descriptor, sourceItemId)` — Create a new face profile from a confirmed match
- `addDescriptorToProfile(profileId, descriptor, sourceItemId)` — Add another photo of a known person
- `deleteFaceProfile(profileId)` — Remove a face profile

**Tagging:**
- `confirmMatch(detectionId, personId)` — User confirms a suggested match
- `rejectMatch(detectionId)` — User rejects a suggestion, marks as unidentified
- `manualTag(detectionId, personId)` — User manually selects a person for a face

**Bulk Operations:**
- `scanAllItems(items, onProgress)` — Scan multiple items with progress callback
- `getDetectionStats()` — Returns { totalFaces, identified, unidentified, profileCount }

### Usage Example

```javascript
import { useFaceRecognition } from '../hooks/useFaceRecognition';

function PhotoViewer({ item }) {
  const { 
    modelsLoaded, 
    detectFaces, 
    matchFace, 
    confirmMatch 
  } = useFaceRecognition();

  const handleScanFaces = async () => {
    if (!modelsLoaded) return;
    
    const img = document.getElementById('photo');
    const faces = await detectFaces(img);
    
    for (const face of faces) {
      const match = await matchFace(face.descriptor);
      if (match && match.confidence < 0.5) {
        // High-confidence match — auto-suggest
        console.log(`Looks like ${match.personName}`);
      }
    }
  };
}
```

## UI Components

### 1. Face Detection Overlay

Location: Integrated into `ItemDetailModal.jsx`

**Features:**
- Canvas overlay on photo showing detected face bounding boxes
- Color-coded boxes:
  - 🟢 Green — confirmed identification
  - 🟡 Yellow — suggested match (needs confirmation)
  - 🔴 Red — unidentified face
- Name labels beneath each box
- Click a face to open tagging UI

### 2. Face Tagging Panel

Location: New component `FaceTaggingPanel.jsx`

**Features:**
- Appears when clicking a detected face
- Shows cropped face thumbnail
- If match found: shows suggested person with confidence %
  - "Confirm" / "Reject" buttons
- If no match: dropdown to manually select from `relatedPeople`
  - "Create New Person" option
- "Skip" to leave unidentified

### 3. Scan Faces Button

Location: Added to `ItemDetailModal.jsx` toolbar

**Features:**
- "🔍 Scan Faces" button on photo items
- Shows loading spinner during detection + matching
- Badge showing face count after scan: "👤 3 faces detected"
- Disabled while scanning or if no photo

### 4. Face Gallery (Person Profile)

Location: New section in `PersonDetailModal.jsx`

**Features:**
- Grid of all photos where this person was identified
- Thumbnail of their face crop from each photo
- Link to open the full photo
- Count badge: "Appears in 12 photos"

### 5. Batch Scan Page

Location: New component `FaceScanDashboard.jsx` or tab in `AdminDashboard.jsx`

**Features:**
- "Scan All Photos" button with progress bar
- Statistics dashboard:
  - Total photos scanned / unscanned
  - Total faces detected
  - Identified vs. unidentified
- List of unidentified faces for review
- Filter: show only items with unidentified faces

## Staged Implementation Plan

### Stage 1: Face Detection Foundation

**Goal:** Load face-api.js models and detect faces in photos.

**Files:**
- `[NEW] src/hooks/useFaceRecognition.js` — Hook with model loading + `detectFaces()`
- `[NEW] public/models/` — face-api.js model weight files
- `[MODIFY] package.json` — Add `face-api.js` dependency

**Acceptance:**
- Models load successfully in browser
- `detectFaces()` returns bounding boxes for faces in sample photos
- No UI yet — console-only verification

---

### Stage 2: Detection Storage & Overlay UI

**Goal:** Store detections in Firestore and show bounding boxes on photos.

**Files:**
- `[MODIFY] src/hooks/useFaceRecognition.js` — Add Firestore CRUD for `faceDetections`
- `[MODIFY] src/components/ItemDetailModal.jsx` — Add "Scan Faces" button + canvas overlay
- `[MODIFY] firestore.rules` — Add `faceDetections` rules

**Acceptance:**
- Clicking "Scan Faces" detects faces and stores results
- Bounding boxes appear on the photo
- Detection results persist across page reloads

---

### Stage 3: Face Matching & Profiles

**Goal:** Generate face profiles, match new faces against known ones, suggest identities.

**Files:**
- `[MODIFY] src/hooks/useFaceRecognition.js` — Add `matchFace()`, `createFaceProfile()`, `confirmMatch()`
- `[NEW] src/components/FaceTaggingPanel.jsx` — Tagging UI for confirming/rejecting matches
- `[MODIFY] firestore.rules` — Add `faceProfiles` rules

**Acceptance:**
- User can confirm a face → creates a face profile
- Subsequent scans of other photos match against known profiles
- Suggested matches show with confidence scores

---

### Stage 4: Integration & Polish

**Goal:** Connect to Related People, add batch scanning, and polish the UX.

**Files:**
- `[MODIFY] src/components/PersonDetailModal.jsx` — Add face gallery section
- `[NEW] src/components/FaceScanDashboard.jsx` — Batch scan UI (or admin tab)
- `[MODIFY] src/hooks/useRelatedPeople.js` — Add `faceProfileId` support
- `[MODIFY] src/components/AllItemsPage.jsx` — Add "faces detected" filter/badge

**Acceptance:**
- Person profile shows all photos they appear in
- Batch scan processes multiple photos with progress
- Archive items show face count badges

## Technical Details

### Model Loading Strategy

```javascript
// Load models from /public/models/ (served as static assets)
await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
```

- Models are loaded **once** on first use, then cached by the browser
- Total download: ~6MB (first load only)
- Loading time: 2-4 seconds on modern hardware

### Matching Algorithm

```javascript
function findBestMatch(descriptor, knownProfiles) {
  let bestMatch = null;
  let bestDistance = Infinity;
  
  for (const profile of knownProfiles) {
    for (const known of profile.descriptors) {
      const distance = faceapi.euclideanDistance(descriptor, known.vector);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = profile;
      }
    }
  }
  
  return {
    profile: bestMatch,
    distance: bestDistance,        // Lower = more similar
    confidence: 1 - bestDistance,  // Higher = more confident
    status: bestDistance < 0.5 ? 'confident' 
          : bestDistance < 0.6 ? 'suggested' 
          : 'unidentified'
  };
}
```

**Distance Thresholds:**
| Distance | Status | Action |
|----------|--------|--------|
| < 0.5 | High confidence | Auto-suggest with "Confirm" button |
| 0.5 – 0.6 | Possible match | Show as suggestion with lower confidence |
| > 0.6 | No match | Mark as unidentified |

### Face Thumbnail Generation

```javascript
// Extract face region and save as thumbnail
function extractFaceThumbnail(imageElement, boundingBox) {
  const canvas = document.createElement('canvas');
  const padding = 0.2; // 20% padding around face
  
  const x = Math.max(0, boundingBox.x - padding) * imageElement.width;
  const y = Math.max(0, boundingBox.y - padding) * imageElement.height;
  const w = Math.min(1, boundingBox.width + padding * 2) * imageElement.width;
  const h = Math.min(1, boundingBox.height + padding * 2) * imageElement.height;
  
  canvas.width = 150;  // Standardized thumbnail size
  canvas.height = 150;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElement, x, y, w, h, 0, 0, 150, 150);
  
  return canvas.toDataURL('image/jpeg', 0.8);
}
```

### Firestore Descriptor Storage

128-dimensional float vectors stored as arrays. Firestore document size limit is 1MB, which supports ~700 descriptors per document (well above what's needed — most people would have 5-20 reference photos).

### Performance Considerations

| Metric | Estimate |
|--------|----------|
| Detection per photo | 200-500ms |
| Descriptor generation | 100-200ms per face |
| Matching (100 known profiles, 10 descriptors each) | < 5ms |
| Total scan per photo | ~1 second |
| Model first-load | 2-4 seconds |
| Model cached-load | < 500ms |

For a family archive of ~1000 photos with ~200 known people, full batch scan would take approximately 15-20 minutes. Progress UI is essential.

## Privacy & Ethics

### Design Principles

1. **Local Processing** — All face detection and matching runs in the browser. No face data is sent to external APIs.
2. **User-Owned Data** — Face profiles and detections are stored in the user's Firestore and are owner-only access.
3. **Opt-In** — Face scanning must be explicitly triggered by the user (no automatic scanning on upload).
4. **Deletable** — Users can delete face profiles and all associated detections at any time.
5. **Transparent** — Clear UI indicators showing what's detected and matched.

### Data Retention

- Face descriptors are numerical vectors — they cannot be reverse-engineered into a photo
- Thumbnails are low-resolution crops for identification purposes only
- Deleting a face profile removes all associated descriptors and thumbnails

## Integration Points

### Existing Components Modified

| Component | Change |
|-----------|--------|
| `ItemDetailModal.jsx` | Add "Scan Faces" button, face overlay, face count badge |
| `PersonDetailModal.jsx` | Add face gallery section showing all photos of this person |
| `AllItemsPage.jsx` | Add face count filter/badge on item cards |
| `ItemFormModal.jsx` | Show tagged faces in metadata section |
| `useRelatedPeople.js` | Add `faceProfileId` to person data |
| `firestore.rules` | Add rules for `faceProfiles` and `faceDetections` |
| `BatchUploadModal.jsx` | Optional: "Scan faces after upload" toggle |

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useFaceRecognition.js` | Core hook for all face recognition logic |
| `src/components/FaceTaggingPanel.jsx` | UI for confirming/rejecting face matches |
| `src/components/FaceScanDashboard.jsx` | Batch scanning + statistics dashboard |
| `public/models/*` | face-api.js model weight files (~6MB) |

## Dependencies

### New Package

```bash
npm install face-api.js
```

### Model Files

Download from [face-api.js models](https://github.com/justadudewhohacks/face-api.js/tree/master/weights) and place in `public/models/`:

```
public/models/
├── ssd_mobilenetv1_model-weights_manifest.json
├── ssd_mobilenetv1_model-shard1
├── ssd_mobilenetv1_model-shard2
├── face_landmark_68_model-weights_manifest.json
├── face_landmark_68_model-shard1
├── face_recognition_model-weights_manifest.json
└── face_recognition_model-shard1
```

## Testing Recommendations

### Manual Testing Scenarios

1. **Face Detection:**
   - Scan photo with 1 face — verify bounding box
   - Scan photo with multiple faces — verify all detected
   - Scan photo with no faces — verify graceful handling
   - Scan non-photo item — verify appropriate message

2. **Face Matching:**
   - Tag a face in Photo A as "John"
   - Scan Photo B (which also has John) — verify auto-suggestion
   - Confirm match — verify profile is updated with new descriptor

3. **Edge Cases:**
   - Very small faces (group photos) — may not detect below ~40px
   - Side profiles — lower confidence expected
   - Historical/old photos — may have reduced accuracy
   - Black-and-white photos — should still work (face-api.js handles grayscale)

4. **Performance:**
   - Scan 10+ photos sequentially — verify progress works
   - Test on mobile device — verify acceptable performance
   - Test model loading on slow connection — verify loading indicator

5. **Data Integrity:**
   - Delete a person — verify their face profile is cleaned up
   - Delete a photo — verify face detections are removed
   - Multiple users — verify face data is isolated per owner

## Future Enhancements

### Priority 1 (High Value)
- [ ] **Auto-Scan on Upload** — Optional toggle to scan faces during batch upload
- [ ] **Age-Aware Matching** — Account for aging in historical photos
- [ ] **GEDCOM Integration** — Auto-create face profiles from imported family trees

### Priority 2 (Nice to Have)
- [ ] **Face Clustering** — Group similar unidentified faces together
- [ ] **Family Resemblance** — "Looks like their parent" scoring
- [ ] **Export Tagged Photos** — Export photos with face tags to PDF/ZIP
- [ ] **Timeline View** — Show all photos of a person chronologically

### Priority 3 (Future)
- [ ] **Video Frame Extraction** — Detect faces in video thumbnails
- [ ] **Offline Support** — Cache models and profiles for offline scanning
- [ ] **Cloud Function Batch** — Server-side scanning for large archives
- [ ] **Face Search** — Upload a photo and find all matches in the archive

## Deployment Checklist

- [ ] Install `face-api.js` dependency
- [ ] Download and add model files to `public/models/`
- [ ] Deploy updated Firestore security rules
- [ ] Test face detection on various photo types
- [ ] Test matching accuracy with 5+ known people
- [ ] Verify mobile performance is acceptable
- [ ] Test model caching behavior
- [ ] Monitor Firestore usage (storage for descriptors + thumbnails)
- [ ] Add user documentation / help text

---

**Spec Date:** February 15, 2026  
**Version:** 1.0.0  
**Status:** Awaiting implementation
