/**
 * perspectiveTransform.js
 * Homography-based perspective correction using Canvas + manual matrix math.
 * No external dependencies.
 */

/**
 * Solve an N×N linear system Ax = b using Gaussian elimination with partial pivoting.
 * @param {number[][]} A  — N×N matrix (will be mutated)
 * @param {number[]} b    — N-length vector (will be mutated)
 * @returns {number[]}    — solution vector x
 */
function solveLinearSystem(A, b) {
    const n = A.length;

    // Forward elimination with partial pivoting
    for (let col = 0; col < n; col++) {
        // Find pivot
        let maxVal = Math.abs(A[col][col]);
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(A[row][col]) > maxVal) {
                maxVal = Math.abs(A[row][col]);
                maxRow = row;
            }
        }

        // Swap rows
        if (maxRow !== col) {
            [A[col], A[maxRow]] = [A[maxRow], A[col]];
            [b[col], b[maxRow]] = [b[maxRow], b[col]];
        }

        // Eliminate below
        for (let row = col + 1; row < n; row++) {
            const factor = A[row][col] / A[col][col];
            for (let j = col; j < n; j++) {
                A[row][j] -= factor * A[col][j];
            }
            b[row] -= factor * b[col];
        }
    }

    // Back substitution
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
        let sum = b[i];
        for (let j = i + 1; j < n; j++) {
            sum -= A[i][j] * x[j];
        }
        x[i] = sum / A[i][i];
    }

    return x;
}

/**
 * Compute the 3×3 homography matrix that maps 4 source points to 4 destination points.
 *
 * The homography H satisfies:
 *   [x']   [h0 h1 h2] [x]
 *   [y'] = [h3 h4 h5] [y]
 *   [w']   [h6 h7  1] [1]
 *
 *   dst_x = x'/w',  dst_y = y'/w'
 *
 * @param {Array<{x: number, y: number}>} src — 4 source points (the quadrilateral on the image)
 * @param {Array<{x: number, y: number}>} dst — 4 destination points (the target rectangle)
 * @returns {number[]} — 9-element array [h0..h7, 1] representing the 3×3 matrix in row-major order
 */
export function computeHomography(src, dst) {
    // Set up the 8×8 linear system
    const A = [];
    const b = [];

    for (let i = 0; i < 4; i++) {
        const sx = src[i].x, sy = src[i].y;
        const dx = dst[i].x, dy = dst[i].y;

        A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
        b.push(dx);

        A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
        b.push(dy);
    }

    const h = solveLinearSystem(A, b);

    // Return as 3×3 matrix in row-major order: [h0, h1, h2, h3, h4, h5, h6, h7, 1]
    return [...h, 1];
}

/**
 * Invert a 3×3 matrix.
 * @param {number[]} m — 9-element row-major matrix
 * @returns {number[]} — inverted 9-element row-major matrix
 */
function invertMatrix3x3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;

    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

    if (Math.abs(det) < 1e-10) {
        // Near-singular, return identity
        return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }

    const invDet = 1 / det;

    return [
        (e * i - f * h) * invDet,
        (c * h - b * i) * invDet,
        (b * f - c * e) * invDet,
        (f * g - d * i) * invDet,
        (a * i - c * g) * invDet,
        (c * d - a * f) * invDet,
        (d * h - e * g) * invDet,
        (b * g - a * h) * invDet,
        (a * e - b * d) * invDet,
    ];
}

/**
 * Apply a perspective transform to get a corrected rectangular output.
 *
 * Uses inverse mapping: for each output pixel, find the corresponding source pixel
 * via the inverse homography, with bilinear interpolation for smooth results.
 *
 * @param {HTMLCanvasElement|HTMLImageElement} srcElement — the source image/canvas
 * @param {Array<{x: number, y: number}>} corners — 4 source corners in image-space [TL, TR, BR, BL]
 * @param {number} [outputW] — output width (auto-calculated if omitted)
 * @param {number} [outputH] — output height (auto-calculated if omitted)
 * @returns {HTMLCanvasElement} — the transformed output canvas
 */
export function applyPerspectiveTransform(srcElement, corners, outputW, outputH) {
    // Get source image data
    const srcCanvas = document.createElement('canvas');
    const sw = srcElement.width || srcElement.naturalWidth;
    const sh = srcElement.height || srcElement.naturalHeight;
    srcCanvas.width = sw;
    srcCanvas.height = sh;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(srcElement, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, sw, sh);
    const srcPixels = srcData.data;

    // Calculate output dimensions from corners if not provided
    if (!outputW || !outputH) {
        const topW = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
        const botW = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
        const leftH = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
        const rightH = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
        outputW = Math.round(Math.max(topW, botW));
        outputH = Math.round(Math.max(leftH, rightH));
    }

    // Destination corners (rectangle)
    const dst = [
        { x: 0, y: 0 },                    // TL
        { x: outputW - 1, y: 0 },           // TR
        { x: outputW - 1, y: outputH - 1 }, // BR
        { x: 0, y: outputH - 1 },           // BL
    ];

    // Compute homography: dst → src (inverse mapping)
    // We want: for each (x,y) in output, find the source (u,v)
    // So we compute H that maps dst→src
    const H = computeHomography(dst, corners);

    // Create output canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outputW;
    outCanvas.height = outputH;
    const outCtx = outCanvas.getContext('2d');
    const outData = outCtx.createImageData(outputW, outputH);
    const outPixels = outData.data;

    // For each output pixel, find source pixel via homography
    for (let y = 0; y < outputH; y++) {
        for (let x = 0; x < outputW; x++) {
            // Apply homography: [u', v', w'] = H * [x, y, 1]
            const w = H[6] * x + H[7] * y + H[8];
            const srcX = (H[0] * x + H[1] * y + H[2]) / w;
            const srcY = (H[3] * x + H[4] * y + H[5]) / w;

            // Bilinear interpolation
            const x0 = Math.floor(srcX);
            const y0 = Math.floor(srcY);
            const x1 = x0 + 1;
            const y1 = y0 + 1;

            if (x0 < 0 || y0 < 0 || x1 >= sw || y1 >= sh) {
                // Out of bounds — transparent
                const idx = (y * outputW + x) * 4;
                outPixels[idx] = 0;
                outPixels[idx + 1] = 0;
                outPixels[idx + 2] = 0;
                outPixels[idx + 3] = 0;
                continue;
            }

            const fx = srcX - x0;
            const fy = srcY - y0;
            const fx1 = 1 - fx;
            const fy1 = 1 - fy;

            const w00 = fx1 * fy1;
            const w10 = fx * fy1;
            const w01 = fx1 * fy;
            const w11 = fx * fy;

            const i00 = (y0 * sw + x0) * 4;
            const i10 = (y0 * sw + x1) * 4;
            const i01 = (y1 * sw + x0) * 4;
            const i11 = (y1 * sw + x1) * 4;

            const outIdx = (y * outputW + x) * 4;
            outPixels[outIdx]     = srcPixels[i00] * w00 + srcPixels[i10] * w10 + srcPixels[i01] * w01 + srcPixels[i11] * w11;
            outPixels[outIdx + 1] = srcPixels[i00 + 1] * w00 + srcPixels[i10 + 1] * w10 + srcPixels[i01 + 1] * w01 + srcPixels[i11 + 1] * w11;
            outPixels[outIdx + 2] = srcPixels[i00 + 2] * w00 + srcPixels[i10 + 2] * w10 + srcPixels[i01 + 2] * w01 + srcPixels[i11 + 2] * w11;
            outPixels[outIdx + 3] = srcPixels[i00 + 3] * w00 + srcPixels[i10 + 3] * w10 + srcPixels[i01 + 3] * w01 + srcPixels[i11 + 3] * w11;
        }
    }

    outCtx.putImageData(outData, 0, 0);
    return outCanvas;
}
