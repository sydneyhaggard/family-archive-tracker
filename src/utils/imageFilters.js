/**
 * imageFilters.js
 * Pure pixel-manipulation functions for the image editor.
 * All functions operate on ImageData and return the modified ImageData in-place.
 */

/**
 * Apply brightness adjustment to ImageData.
 * @param {ImageData} imageData
 * @param {number} amount  -100 to +100
 */
export function applyBrightness(imageData, amount) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, Math.max(0, data[i] + amount));     // R
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + amount)); // G
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + amount)); // B
    }
    return imageData;
}

/**
 * Apply contrast adjustment to ImageData.
 * Uses the standard contrast formula:
 *   factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
 *   newValue = factor * (oldValue - 128) + 128
 * @param {ImageData} imageData
 * @param {number} amount  -100 to +100
 */
export function applyContrast(imageData, amount) {
    const factor = (259 * (amount + 255)) / (255 * (259 - amount));
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
        data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
        data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    }
    return imageData;
}

/**
 * Convert to greyscale using adjustable channel weights.
 * @param {ImageData} imageData
 * @param {{ r: number, g: number, b: number }} weights  Channel weights (should sum to ~1.0)
 */
export function applyGreyscale(imageData, weights = { r: 0.299, g: 0.587, b: 0.114 }) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const grey = Math.min(255, Math.max(0,
            data[i] * weights.r + data[i + 1] * weights.g + data[i + 2] * weights.b
        ));
        data[i] = grey;
        data[i + 1] = grey;
        data[i + 2] = grey;
    }
    return imageData;
}

/**
 * Apply all active filters in a SINGLE pass over the pixel data for performance.
 * Order: brightness → contrast → greyscale
 * @param {ImageData} imageData
 * @param {{ brightness: number, contrast: number, greyscale: boolean, greyscaleWeights: { r: number, g: number, b: number } }} params
 */
export function applyAllFilters(imageData, { brightness = 0, contrast = 0, greyscale = false, greyscaleWeights = { r: 0.299, g: 0.587, b: 0.114 } }) {
    // Skip if nothing to apply
    if (brightness === 0 && contrast === 0 && !greyscale) return imageData;

    const data = imageData.data;
    const contrastFactor = contrast !== 0
        ? (259 * (contrast + 255)) / (255 * (259 - contrast))
        : 1;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // 1. Brightness
        if (brightness !== 0) {
            r += brightness;
            g += brightness;
            b += brightness;
        }

        // 2. Contrast
        if (contrast !== 0) {
            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            b = contrastFactor * (b - 128) + 128;
        }

        // Clamp
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));

        // 3. Greyscale
        if (greyscale) {
            const grey = r * greyscaleWeights.r + g * greyscaleWeights.g + b * greyscaleWeights.b;
            r = g = b = Math.min(255, Math.max(0, grey));
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }

    return imageData;
}
