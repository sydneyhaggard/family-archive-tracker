# Photo & Media Enhancements

## Description

Advanced features for working with photos and media files, including face tagging, image comparison, galleries, and improved viewing experiences.

## Current State

- Images upload and display in item detail modal
- MediaGallery component exists for viewing files
- No face detection or tagging
- No image comparison features
- Basic thumbnail display in grids

## Proposed Features

### Face Tagging
- **Automatic face detection**: Use ML to detect faces in photos
- **Manual face boxes**: Click and drag to create face boxes
- **Tag people**: Link detected faces to Related People entries
- **Search by face**: Find all photos of a specific person
- **Untagged faces**: View photos with untagged faces needing identification
- **Face recognition suggestions**: AI suggests identities based on previous tags

### Image Comparison
- **Side-by-side view**: Compare two photos simultaneously
- **Slider overlay**: Drag slider to reveal differences
- **Synchronized zoom**: Zoom into the same spot on both images
- **Annotation tools**: Draw circles, arrows to highlight features
- **Use cases**:
  - Compare old photo with restoration
  - Identify same location at different times
  - Find subtle differences in similar photos

### Enhanced Gallery
- **Lightbox mode**: Full-screen viewing with keyboard navigation
- **Slideshow**: Auto-advance through photos
- **Thumbnails strip**: Quick navigation to specific images
- **Zoom and pan**: Pinch to zoom, drag to pan on mobile
- **Image rotation**: Fix incorrectly oriented photos
- **Download original**: One-click download of full resolution

### Photo Organization
- **Albums/Collections**: Group related photos
- **Favorites**: Star important photos
- **Photo map**: Show photos on a map by location
- **Color search**: Find photos by dominant color
- **Date clustering**: Auto-group by date ranges
- **Duplicate detection**: Find similar/identical photos

### Image Metadata
- **EXIF data display**: Camera model, settings, GPS coordinates
- **Edit metadata**: Add/edit camera info, location, date taken
- **Metadata search**: Find photos by camera, lens, ISO, etc.
- **GPS coordinates**: Show on map where photo was taken
- **Auto-date correction**: Use EXIF dates instead of upload dates

### Advanced Features
- **Thumbnail generation**: Auto-generate optimized thumbnails
- **Image filters**: Apply filters (sepia, B&W, brightness, contrast)
- **Cropping tool**: Crop images without reuploading
- **Color restoration**: AI-powered colorization of B&W photos
- **Upscaling**: Enhance low-resolution photos with AI

## Technical Implementation

### Face Detection
**Option 1: Google Cloud Vision API**
```javascript
// Detect faces in uploaded images
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();

const [result] = await client.faceDetection(imageUrl);
const faces = result.faceAnnotations;

faces.forEach(face => {
  // Store face bounding box coordinates
  const bounds = face.boundingPoly.vertices;
  saveFaceAnnotation(itemId, bounds);
});
```

**Option 2: TensorFlow.js (Client-side)**
```javascript
// Face detection in browser
import * as blazeface from '@tensorflow-models/blazeface';

const model = await blazeface.load();
const predictions = await model.estimateFaces(image);

predictions.forEach(prediction => {
  // Draw box and allow tagging
  const [x, y, width, height] = prediction.topLeft;
});
```

### Face Tagging Data Model
```javascript
// faceAnnotations subcollection under archiveItems
{
  itemId: 'archive_item_id',
  annotations: [
    {
      id: 'annotation_id',
      boundingBox: {
        x: 100,
        y: 150,
        width: 80,
        height: 100
      },
      personId: 'related_person_id', // null if untagged
      personName: 'Mary Smith',
      confidence: 0.95, // AI confidence score
      taggedBy: 'user_uid',
      taggedAt: timestamp
    }
  ]
}
```

### Image Optimization
**Firebase Storage Extension: Resize Images**
```json
{
  "name": "storage-resize-images",
  "params": {
    "IMG_SIZES": "200x200,400x400,800x800,1600x1600",
    "IMG_BUCKET": "project-id.appspot.com",
    "CACHE_CONTROL_HEADER": "max-age=86400"
  }
}
```

### Image Comparison Component
```javascript
function ImageCompare({ image1, image2 }) {
  const [sliderPosition, setSliderPosition] = useState(50);
  
  return (
    <div className="relative">
      <img src={image1} alt="Before" />
      <div 
        className="absolute top-0 left-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <img src={image2} alt="After" />
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPosition}
        onChange={e => setSliderPosition(e.target.value)}
      />
    </div>
  );
}
```

### Thumbnail Generation
```javascript
// Cloud Function to auto-generate thumbnails
exports.generateThumbnail = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    if (!filePath.match(/\.(jpg|jpeg|png|gif)$/i)) return;
    
    const sizes = [200, 400, 800];
    
    for (const size of sizes) {
      await sharp(filePath)
        .resize(size, size, { fit: 'inside' })
        .toFile(`thumbnails/${size}_${filename}`);
    }
  });
```

## User Stories

1. As a user, I want to tag my grandmother's face in photos so I can find all her pictures
2. As a researcher, I want to compare an old photo with a modern one of the same location
3. As an organizer, I want to view all photos in a slideshow at a family reunion
4. As a user, I want to see where photos were taken on a map
5. As a contributor, I want AI to suggest who's in a photo based on previous tags

## UI Mockups

### Face Tagging Mode
```
┌─────────────────────────────────────────────┐
│ [Photo with face boxes overlay]             │
│                                              │
│   ┌─────────┐                                │
│   │ Mary S. │ ← Click to tag                │
│   └─────────┘                                │
│        ┌──────────┐                          │
│        │ Untagged │ ← Click to identify      │
│        └──────────┘                          │
│                                              │
│ [Done] [Add Face Box] [Cancel]              │
└─────────────────────────────────────────────┘
```

### Image Comparison
```
┌──────────────────┬──────────────────┐
│  Before (1955)   │   After (2020)   │
├──────────────────┼──────────────────┤
│                  │                  │
│  [Old photo]     │  [New photo]     │
│                  │                  │
├──────────────────┴──────────────────┤
│ Zoom: [─────●─────]  [↻ Rotate]    │
└──────────────────────────────────────┘
```

### Enhanced Gallery
```
┌─────────────────────────────────────────────┐
│                                   [✕] Close │
│                                              │
│          [◄]   [Large Image]   [►]          │
│                                              │
│                                              │
├─────────────────────────────────────────────┤
│ [▶︎] Slideshow  [↓] Download  [⋯] More     │
│                                              │
│ Thumbnails: [▣][▣][▣][▣][▣][▣][▣]           │
└─────────────────────────────────────────────┘
```

### Photo Map
```
┌─────────────────────────────────────────────┐
│              [Interactive Map]               │
│                                              │
│        ● Chicago (12 photos)                │
│                                              │
│    ● New York (8 photos)                    │
│                                              │
│               ● Paris (3 photos)            │
│                                              │
└─────────────────────────────────────────────┘
Click marker to view photos from that location
```

## Priority

**Medium-High Impact, Medium-High Complexity**

Photo enhancements provide significant value for visual content-heavy archives. Face tagging and improved galleries are most requested features.

## Implementation Phases

### Phase 1: Enhanced Gallery (Quick Win)
- Lightbox/full-screen viewer
- Slideshow mode
- Keyboard navigation
- Image rotation

### Phase 2: Thumbnail Optimization
- Firebase Storage Extension for auto-resize
- Update UI to use thumbnails
- Lazy loading improvements

### Phase 3: Image Comparison
- Side-by-side component
- Slider overlay mode
- Synchronized zoom

### Phase 4: Face Detection & Tagging
- Integrate Google Cloud Vision or TensorFlow.js
- Face box drawing UI
- Person linking
- Search by face

### Phase 5: Advanced Features
- EXIF metadata display
- Photo map with GPS
- Color restoration with AI
- Duplicate detection

## Dependencies

- Archive Items with files (✅ implemented)
- MediaGallery component (✅ implemented)
- Related People (✅ implemented)
- Firebase Storage (✅ implemented)

## Future Enhancements

- AI automatic photo tagging (objects, scenes, activities)
- Photo story generator (create narratives from photo sets)
- Facial aging visualization (show how people changed over time)
- 3D photo scanning for objects
- Augmented reality viewing of historical photos at locations
- Collaborative photo identification games
