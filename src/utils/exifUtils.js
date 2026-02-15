/**
 * EXIF Utilities
 * Read EXIF data from original JPEG images and re-inject into edited versions.
 * Uses piexifjs for EXIF manipulation.
 */
import piexif from 'piexifjs';

/**
 * Read EXIF data from a File or Blob (JPEG only).
 * Returns the raw EXIF binary string, or null if not available.
 */
export async function readExifFromFile(file) {
  return new Promise((resolve) => {
    if (!file || !file.type?.startsWith('image/jpeg')) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataUrl = e.target.result;
        const exifObj = piexif.load(dataUrl);
        resolve(exifObj);
      } catch (err) {
        console.warn('Could not read EXIF data:', err);
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Read EXIF data from a data URL string.
 */
export function readExifFromDataUrl(dataUrl) {
  try {
    if (!dataUrl || !dataUrl.startsWith('data:image/jpeg')) {
      return null;
    }
    return piexif.load(dataUrl);
  } catch (err) {
    console.warn('Could not read EXIF from data URL:', err);
    return null;
  }
}

/**
 * Read EXIF data from an image URL (fetches the image first).
 */
export async function readExifFromUrl(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Only process JPEGs
    if (!blob.type?.startsWith('image/jpeg')) {
      return null;
    }
    
    return readExifFromFile(blob);
  } catch (err) {
    console.warn('Could not fetch image for EXIF reading:', err);
    return null;
  }
}

/**
 * Inject EXIF data into a JPEG data URL.
 * Returns a new data URL with the EXIF data embedded.
 */
export function injectExif(jpegDataUrl, exifObj) {
  if (!exifObj || !jpegDataUrl) {
    return jpegDataUrl;
  }

  try {
    const exifBytes = piexif.dump(exifObj);
    return piexif.insert(exifBytes, jpegDataUrl);
  } catch (err) {
    console.warn('Could not inject EXIF data:', err);
    return jpegDataUrl;
  }
}

/**
 * Convert a data URL to a Blob.
 */
export function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const binaryStr = atob(parts[1]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Export a canvas as a JPEG data URL with EXIF data preserved.
 * @param {HTMLCanvasElement} canvas 
 * @param {object|null} exifObj - EXIF object from piexifjs
 * @param {number} quality - JPEG quality 0-1
 * @returns {Blob} JPEG blob with EXIF data
 */
export function canvasToJpegBlobWithExif(canvas, exifObj, quality = 0.92) {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  
  if (exifObj) {
    const withExif = injectExif(dataUrl, exifObj);
    return dataUrlToBlob(withExif);
  }
  
  return dataUrlToBlob(dataUrl);
}
