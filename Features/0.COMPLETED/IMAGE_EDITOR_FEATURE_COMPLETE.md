# Image Editor Feature

## Overview
Add a full-featured image editor that lets users non-destructively edit photos and scans attached to archive items. The editor opens from the item detail / media gallery views and saves an edited copy back to Firebase Storage while preserving the original file and its EXIF metadata.

---

## Capabilities
| Tool | Description |
|---|---|
| **Manual Crop** | Freeform rectangle + preset aspect ratios (4:3, 16:9, 1:1, original) |
| **Smart Crop** | AI-assisted background removal — isolates the artifact / photo from a tabletop or background surface |
| **Rotate** | 90° CW / CCW buttons + free-angle slider (0–360°) |
| **Perspective Correction (Skew)** | 4-corner drag to fix keystoning on documents photographed at an angle |
| **Brightness** | Slider (–100 to +100) |
| **Contrast** | Slider (–100 to +100) |
| **Greyscale Balance** | Convert to greyscale with adjustable channel weighting (R/G/B sliders) for fine-tuned B&W output |
| **EXIF Preservation** | All edits are applied to pixel data only; the original EXIF block (including Date Taken, camera info) is carried forward into the saved file |

---

## Staged Implementation Plan

### Stage 1 — Foundation & Basic Editing
> *Goal: Get a working editor modal with canvas rendering, rotation, and manual crop.*

| # | Task | Details |
|---|---|---|
| 1.1 | **Install dependencies** | `piexifjs` (EXIF read/write), no heavy image-editing library — we'll use the native Canvas API for maximum control and bundle-size efficiency. |
| 1.2 | **Create `ImageEditorModal.jsx`** | Full-screen modal (matches `MediaGallery` z-index pattern). Loads an image from its Firebase URL onto an off-screen `<canvas>`. Displays a preview `<canvas>` with the current edits applied in real time. |
| 1.3 | **Implement Rotate** | 90° CW / CCW buttons that rotate the canvas. Free-angle slider for fine rotation. |
| 1.4 | **Implement Manual Crop** | Draggable crop rectangle overlay on the preview canvas. Aspect-ratio lock presets. "Apply Crop" button commits the crop. |
| 1.5 | **EXIF read/write utility** | `src/utils/exifUtils.js` — helper functions using `piexifjs` to extract EXIF from the original JPEG, and re-inject it into the exported JPEG blob. |
| 1.6 | **Save flow** | "Save as Copy" button: exports the canvas to a JPEG blob → injects original EXIF → uploads to Firebase Storage under the same item path with an `_edited_` suffix → appends the new file entry to the item's `files[]` array in Firestore. The original file is never modified. |
| 1.7 | **Wire into UI** | Add an "✏️ Edit" button on image thumbnails in `ItemDetailModal` and on the toolbar in `MediaGallery`. Only shown for image file types. |

**Files touched:**
- `[NEW] src/components/ImageEditorModal.jsx`
- `[NEW] src/utils/exifUtils.js`
- `[MODIFY] src/components/ItemDetailModal.jsx` — add Edit button
- `[MODIFY] src/components/MediaGallery.jsx` — add Edit button
- `[MODIFY] package.json` — add `piexifjs`

---

### Stage 2 — Brightness, Contrast & Greyscale
> *Goal: Add adjustment sliders using Canvas pixel manipulation.*

| # | Task | Details |
|---|---|---|
| 2.1 | **Brightness slider** | Applies a brightness offset to each pixel via `ImageData` manipulation. Real-time preview on the display canvas. |
| 2.2 | **Contrast slider** | Standard contrast curve applied per-pixel. |
| 2.3 | **Greyscale balance** | Toggle greyscale mode + three channel-weight sliders (Red, Green, Blue). Defaults to standard luminosity weights (0.299 R, 0.587 G, 0.114 B). Lets user emphasize or de-emphasize channels for archival photo tuning. |
| 2.4 | **Non-destructive pipeline** | All adjustments are stored as parameters and re-applied from the original image data on each render, so sliders can be freely adjusted without quality loss. |

**Files touched:**
- `[MODIFY] src/components/ImageEditorModal.jsx` — add adjustment panel
- `[NEW] src/utils/imageFilters.js` — pure functions for pixel-level brightness, contrast, greyscale

---

### Stage 3 — Perspective Correction (Skew)
> *Goal: Let users fix photos taken at an angle.*

| # | Task | Details |
|---|---|---|
| 3.1 | **4-corner perspective UI** | Overlay four draggable corner handles on the image. User drags corners to define the quadrilateral of the document/photo within the image. |
| 3.2 | **Perspective transform** | Use a projective (homography) transform to map the selected quadrilateral to a rectangle. Implementation via Canvas + manual matrix math (no external dependency). |
| 3.3 | **Auto-detect edges (optional)** | Attempt to auto-detect the document rectangle using simple edge-detection heuristics (contrast-based) to pre-position the four corners. Falls back to manual placement. |

**Files touched:**
- `[MODIFY] src/components/ImageEditorModal.jsx` — add perspective mode
- `[NEW] src/utils/perspectiveTransform.js` — homography math

---

### Stage 4 — Smart Crop (AI Background Removal)
> *Goal: Automatically isolate the artifact from its background (e.g., a tabletop).*

| # | Task | Details |
|---|---|---|
| 4.1 | **Evaluate approach** | Two options: (a) Use the existing Gemini API integration to ask the model for bounding-box coordinates of the main subject, or (b) use a lightweight client-side segmentation model (e.g., `@mediapipe/selfie_segmentation` or a custom TF Lite model). Recommend starting with **(a)** since Gemini is already integrated and can handle diverse object types (books, trinkets, documents). |
| 4.2 | **Gemini-based smart crop** | Send a low-res version of the image to Gemini with a prompt asking it to return the bounding box `[x, y, width, height]` of the main artifact. Parse the response and auto-set the crop rectangle. |
| 4.3 | **Background removal mode** | Optional: instead of just cropping, use Gemini to generate a segmentation mask and set the background to transparent/white. Useful for creating clean catalog images. |
| 4.4 | **UI integration** | "✨ Smart Crop" button in the crop tool panel. Shows a loading spinner while the API processes, then snaps the crop rectangle to the detected subject. User can adjust before applying. |

**Files touched:**
- `[MODIFY] src/components/ImageEditorModal.jsx` — add Smart Crop button
- `[NEW] src/utils/smartCrop.js` — Gemini API call for subject detection

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              ImageEditorModal               │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │         Preview Canvas               │   │
│  │  (crop handles / perspective grid)   │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌────────────┐   │
│  │  Crop   │ │ Rotate  │ │ Perspective│   │
│  │  Panel  │ │ Panel   │ │   Panel    │   │
│  └─────────┘ └─────────┘ └────────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌────────────┐   │
│  │ Bright  │ │Contrast │ │ Greyscale  │   │
│  │ Slider  │ │ Slider  │ │  Balance   │   │
│  └─────────┘ └─────────┘ └────────────┘   │
│                                             │
│  [ Reset ] [ Undo ]   [ Save as Copy ]     │
└─────────────────────────────────────────────┘
```

### Data Flow (Save)
1. User clicks **Save as Copy**
2. Final canvas → export as JPEG blob
3. Extract EXIF from original image using `piexifjs`
4. Inject EXIF into new JPEG blob
5. Upload blob to Firebase Storage: `users/{uid}/items/{timestamp}_edited_{originalName}`
6. Get download URL
7. Append new file object to item's `files[]` array in Firestore
8. Show success toast, close editor

---

## EXIF Preservation Strategy

Standard `<canvas>.toBlob()` strips all EXIF data. Our approach:
1. **On load**: read EXIF bytes from original JPEG using `piexifjs.load()`
2. **On save**: export canvas to a base64 data URL → use `piexifjs.insert()` to write the original EXIF block back into the new JPEG data
3. **Convert** the resulting data URL to a `Blob` for upload
4. **Non-JPEG files** (PNG, WebP): EXIF preservation is best-effort; PNGs rarely carry EXIF but we'll attempt to copy any XMP data

---

## UI / UX Design Notes
- **Full-screen modal** with a dark background (consistent with `MediaGallery`)
- **Toolbar** across the top or left side with icon buttons for each tool
- **Active tool** highlighted with accent color
- **Sliders** styled to match the app's existing Tailwind design system
- **Undo** button reverts the last operation
- **Reset** button restores the original, unedited image
- **Responsive**: works on tablet-sized screens and up (image editing on mobile is impractical)
- **Keyboard shortcuts**: `Ctrl+Z` undo, `Escape` close, `R` rotate 90° CW

---

## Dependencies
| Package | Purpose | Size |
|---|---|---|
| `piexifjs` | Read/write JPEG EXIF data | ~15 KB |

All image processing (crop, rotate, brightness, contrast, greyscale, perspective) is done via native **Canvas 2D API** — no heavy image-processing library needed.

Smart Crop uses the **existing Gemini API** integration already in the project (via `VITE_GEMINI_API_KEY`).

---

## Verification Plan

### Per-Stage Testing
- **Stage 1**: Upload an image → open editor → rotate → crop → save → verify new file appears in item, original untouched, EXIF preserved
- **Stage 2**: Adjust brightness/contrast/greyscale → save → verify visual output matches preview, EXIF preserved
- **Stage 3**: Open a skewed document photo → drag corners → apply perspective → verify straightened output
- **Stage 4**: Open photo of artifact on table → click Smart Crop → verify crop rectangle targets the artifact

### EXIF Validation
- Use browser EXIF viewer extension or `exiftool` CLI to compare Date Taken between original and edited files

---

*Last Updated: February 14, 2026*
*Version: 1.0.0*
