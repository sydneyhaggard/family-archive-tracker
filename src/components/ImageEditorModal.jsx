import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, storage } from '../config/firebase';
import { canvasToJpegBlobWithExif } from '../utils/exifUtils';
import { applyAllFilters } from '../utils/imageFilters';
import { applyPerspectiveTransform } from '../utils/perspectiveTransform';
import { detectSubject } from '../utils/smartCrop';
import piexif from 'piexifjs';

// ─── Constants ──────────────────────────────────────────────
const ASPECT_RATIOS = [
    { label: 'Free', value: null },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '16:9', value: 16 / 9 },
    { label: 'Original', value: 'original' },
];

const TOOLS = {
    ROTATE: 'rotate',
    CROP: 'crop',
    ADJUST: 'adjust',
    GREYSCALE: 'greyscale',
    PERSPECTIVE: 'perspective',
};

// ─── Component ──────────────────────────────────────────────
function ImageEditorModal({ isOpen, onClose, file, item, user, onSave }) {
    // ── State ──
    const [activeTool, setActiveTool] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState('');
    const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
    const [error, setError] = useState('');

    // Image data
    const [originalImage, setOriginalImage] = useState(null); // HTMLImageElement
    const [exifData, setExifData] = useState(null);

    // Rotation
    const [rotation, setRotation] = useState(0); // degrees

    // Crop
    const [cropRect, setCropRect] = useState(null); // { x, y, w, h } in image-space coords
    const [cropAspectRatio, setCropAspectRatio] = useState(null);
    const [isCropping, setIsCropping] = useState(false);
    const [cropStart, setCropStart] = useState(null);
    const [cropHandle, setCropHandle] = useState(null); // 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
    const [hoverHandle, setHoverHandle] = useState(null);

    // Adjustments (non-destructive)
    const [brightness, setBrightness] = useState(0);
    const [contrast, setContrast] = useState(0);
    const [greyscale, setGreyscale] = useState(false);
    const [greyscaleWeights, setGreyscaleWeights] = useState({ r: 0.299, g: 0.587, b: 0.114 });

    // Perspective correction
    const [perspectiveCorners, setPerspectiveCorners] = useState(null); // [{x,y}, ...] in image-space, TL TR BR BL
    const [draggingCorner, setDraggingCorner] = useState(null); // 0-3 index
    const [isAnalyzing, setIsAnalyzing] = useState(false); // Smart crop loading state

    // History for undo
    const [history, setHistory] = useState([]); // array of { rotation, cropApplied: {x,y,w,h} | null }
    const [croppedImageData, setCroppedImageData] = useState(null); // ImageData after crop applied

    // Refs
    const canvasRef = useRef(null);
    const previewCanvasRef = useRef(null);
    const containerRef = useRef(null);

    // ── Load image when modal opens ──
    useEffect(() => {
        if (!isOpen || !file?.url) return;

        setIsLoading(true);
        setError('');
        setRotation(0);
        setCropRect(null);
        setCroppedImageData(null);
        setHistory([]);
        setActiveTool(null);
        setBrightness(0);
        setContrast(0);
        setGreyscale(false);
        setGreyscaleWeights({ r: 0.299, g: 0.587, b: 0.114 });
        setPerspectiveCorners(null);
        setDraggingCorner(null);

        let objectUrl = null;

        // Use Firebase Storage SDK to download blob (bypasses CORS entirely)
        const loadImage = async () => {
            try {
                let blob;
                if (file.path) {
                    const fileRef = ref(storage, file.path);
                    blob = await getBlob(fileRef);
                } else {
                    const res = await fetch(file.url);
                    blob = await res.blob();
                }

                objectUrl = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    setOriginalImage(img);
                    setIsLoading(false);
                };
                img.onerror = () => {
                    setError('Failed to decode image data.');
                    setIsLoading(false);
                };
                img.src = objectUrl;

                // Read EXIF from the blob we already have
                if (blob.type?.startsWith('image/jpeg')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const exifObj = piexif.load(e.target.result);
                            setExifData(exifObj);
                        } catch { setExifData(null); }
                    };
                    reader.readAsDataURL(blob);
                }
            } catch (err) {
                console.error('Image load error:', err);
                setError('Failed to load image from storage.');
                setIsLoading(false);
            }
        };

        loadImage();

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [isOpen, file?.url]);


    // ── Get the current source image (original or cropped) ──
    const getSourceImage = useCallback(() => {
        if (croppedImageData) {
            // Create a canvas from cropped data
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = croppedImageData.width;
            tempCanvas.height = croppedImageData.height;
            const ctx = tempCanvas.getContext('2d');
            ctx.putImageData(croppedImageData, 0, 0);
            return tempCanvas;
        }
        return originalImage;
    }, [croppedImageData, originalImage]);

    // Initialize perspective corners when tool active
    useEffect(() => {
        if (activeTool === TOOLS.PERSPECTIVE && !perspectiveCorners && originalImage) {
            const src = getSourceImage(); // This might return null if not ready
            if (!src) return;

            const w = src.width || src.naturalWidth;
            const h = src.height || src.naturalHeight;
            // Default: 10% inset from edges
            const padX = w * 0.1;
            const padY = h * 0.1;

            setPerspectiveCorners([
                { x: padX, y: padY },             // TL
                { x: w - padX, y: padY },         // TR
                { x: w - padX, y: h - padY },     // BR
                { x: padX, y: h - padY },         // BL
            ]);
        }
    }, [activeTool, perspectiveCorners, originalImage, getSourceImage]);

    // ── Compute the rotated dimensions ──
    const getRotatedDimensions = useCallback((srcWidth, srcHeight, angleDeg) => {
        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        return {
            width: Math.ceil(srcWidth * cos + srcHeight * sin),
            height: Math.ceil(srcWidth * sin + srcHeight * cos),
        };
    }, []);

    // ── Render preview ──
    useEffect(() => {
        const canvas = previewCanvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !originalImage) return;

        const src = getSourceImage();
        if (!src) return;

        const srcW = src.width || src.naturalWidth;
        const srcH = src.height || src.naturalHeight;
        const { width: rotW, height: rotH } = getRotatedDimensions(srcW, srcH, rotation);

        // Fit to container
        const maxW = container.clientWidth - 48;
        const maxH = container.clientHeight - 48;
        const scale = Math.min(maxW / rotW, maxH / rotH, 1);

        canvas.width = rotW * scale;
        canvas.height = rotH * scale;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.drawImage(src, -srcW / 2, -srcH / 2, srcW, srcH);
        ctx.restore();

        // Apply filters non-destructively (re-computed from original each render)
        const hasFilters = brightness !== 0 || contrast !== 0 || greyscale;
        if (hasFilters) {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            applyAllFilters(imgData, { brightness, contrast, greyscale, greyscaleWeights });
            ctx.putImageData(imgData, 0, 0);
        }

        // Draw crop overlay
        if (cropRect && activeTool === TOOLS.CROP) {
            drawCropOverlay(ctx, canvas, cropRect, scale, rotation, srcW, srcH);
        }

        // Draw perspective overlay
        if (perspectiveCorners && activeTool === TOOLS.PERSPECTIVE) {
            drawPerspectiveOverlay(ctx, canvas, perspectiveCorners, scale, rotation, srcW, srcH);
        }
    }, [originalImage, rotation, cropRect, activeTool, croppedImageData, brightness, contrast, greyscale, greyscaleWeights, perspectiveCorners, getSourceImage, getRotatedDimensions]);

    // ── Draw crop overlay on the preview canvas ──
    function drawCropOverlay(ctx, canvas, rect, scale, rot, srcW, srcH) {
        // Convert image-space crop rect to canvas-space
        const canvasRect = imageToCanvasRect(rect, canvas, scale, rot, srcW, srcH);

        // Darken outside crop area
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.clearRect(canvasRect.x, canvasRect.y, canvasRect.w, canvasRect.h);
        // Redraw image in the crop area
        ctx.restore();

        // Redraw everything including the image
        const src = getSourceImage();
        if (!src) return;
        const sW = src.width || src.naturalWidth;
        const sH = src.height || src.naturalHeight;

        ctx.save();
        ctx.beginPath();
        ctx.rect(canvasRect.x, canvasRect.y, canvasRect.w, canvasRect.h);
        ctx.clip();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.drawImage(src, -sW / 2, -sH / 2, sW, sH);
        ctx.restore();

        // Draw crop border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvasRect.x, canvasRect.y, canvasRect.w, canvasRect.h);

        // Draw rule-of-thirds grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(canvasRect.x + (canvasRect.w * i) / 3, canvasRect.y);
            ctx.lineTo(canvasRect.x + (canvasRect.w * i) / 3, canvasRect.y + canvasRect.h);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(canvasRect.x, canvasRect.y + (canvasRect.h * i) / 3);
            ctx.lineTo(canvasRect.x + canvasRect.w, canvasRect.y + (canvasRect.h * i) / 3);
            ctx.stroke();
        }

        // Draw corner handles
        const handleSize = 12;
        ctx.fillStyle = '#ffffff';
        const corners = [
            { x: canvasRect.x, y: canvasRect.y },
            { x: canvasRect.x + canvasRect.w, y: canvasRect.y },
            { x: canvasRect.x, y: canvasRect.y + canvasRect.h },
            { x: canvasRect.x + canvasRect.w, y: canvasRect.y + canvasRect.h },
        ];
        corners.forEach(({ x, y }) => {
            ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        });

        // Draw edge midpoint handles
        const edgeSize = 8;
        const midpoints = [
            { x: canvasRect.x + canvasRect.w / 2, y: canvasRect.y },               // top
            { x: canvasRect.x + canvasRect.w / 2, y: canvasRect.y + canvasRect.h }, // bottom
            { x: canvasRect.x, y: canvasRect.y + canvasRect.h / 2 },               // left
            { x: canvasRect.x + canvasRect.w, y: canvasRect.y + canvasRect.h / 2 }, // right
        ];
        midpoints.forEach(({ x, y }) => {
            ctx.fillRect(x - edgeSize / 2, y - edgeSize / 2, edgeSize, edgeSize);
        });
    }

    // ── Coordinate conversion helpers ──
    function imageToCanvasRect(imgRect, canvas, scale, rot, srcW, srcH) {
        // For 0° rotation, simple scale. For other angles, we do a simplified mapping.
        // Since crop is applied to the unrotated image, we map through the rotation.
        const rad = (rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Center of image in image-space
        const cx = srcW / 2;
        const cy = srcH / 2;

        // Crop rect corners in image-space (relative to center)
        const x1 = imgRect.x - cx;
        const y1 = imgRect.y - cy;
        const x2 = imgRect.x + imgRect.w - cx;
        const y2 = imgRect.y + imgRect.h - cy;

        // Rotate all four corners
        const pts = [
            { x: x1 * cos - y1 * sin, y: x1 * sin + y1 * cos },
            { x: x2 * cos - y1 * sin, y: x2 * sin + y1 * cos },
            { x: x1 * cos - y2 * sin, y: x1 * sin + y2 * cos },
            { x: x2 * cos - y2 * sin, y: x2 * sin + y2 * cos },
        ];

        const minX = Math.min(...pts.map(p => p.x));
        const maxX = Math.max(...pts.map(p => p.x));
        const minY = Math.min(...pts.map(p => p.y));
        const maxY = Math.max(...pts.map(p => p.y));

        return {
            x: (minX * scale) + canvas.width / 2,
            y: (minY * scale) + canvas.height / 2,
            w: (maxX - minX) * scale,
            h: (maxY - minY) * scale,
        };
    }

    function canvasToImageCoords(canvasX, canvasY, canvas, scale, rot, srcW, srcH) {
        // Reverse: canvas → image space
        const relX = (canvasX - canvas.width / 2) / scale;
        const relY = (canvasY - canvas.height / 2) / scale;

        const rad = (-rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const imgX = relX * cos - relY * sin + srcW / 2;
        const imgY = relX * sin + relY * cos + srcH / 2;

        return { x: imgX, y: imgY };
    }

    // ── Image-space point to canvas-space point ──
    function imageToCanvasPoint(imgX, imgY, canvas, scale, rot, srcW, srcH) {
        const relX = imgX - srcW / 2;
        const relY = imgY - srcH / 2;
        const rad = (rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return {
            x: (relX * cos - relY * sin) * scale + canvas.width / 2,
            y: (relX * sin + relY * cos) * scale + canvas.height / 2,
        };
    }

    // ── Draw perspective overlay ──
    function drawPerspectiveOverlay(ctx, canvas, corners, scale, rot, srcW, srcH) {
        const canvasPts = corners.map(c => imageToCanvasPoint(c.x, c.y, canvas, scale, rot, srcW, srcH));

        // Semi-transparent overlay
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Cut out the quadrilateral (clear it)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(canvasPts[0].x, canvasPts[0].y);
        for (let i = 1; i < 4; i++) {
            ctx.lineTo(canvasPts[i].x, canvasPts[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // Draw quadrilateral outline
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(canvasPts[0].x, canvasPts[0].y);
        for (let i = 1; i < 4; i++) {
            ctx.lineTo(canvasPts[i].x, canvasPts[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw corner handles
        const labels = ['TL', 'TR', 'BR', 'BL'];
        canvasPts.forEach((pt, i) => {
            // Outer circle
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = draggingCorner === i ? '#818cf8' : 'rgba(129, 140, 248, 0.8)';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            ctx.fillStyle = 'white';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labels[i], pt.x, pt.y);
        });

        ctx.restore();
    }

    // ── Perspective mouse handlers ──
    function handlePerspectiveMouseDown(e) {
        if (activeTool !== TOOLS.PERSPECTIVE || !perspectiveCorners) return;
        const pos = getCanvasMousePos(e);
        const canvas = previewCanvasRef.current;
        const src = getSourceImage();
        if (!canvas || !src) return;

        const srcW = src.width || src.naturalWidth;
        const srcH = src.height || src.naturalHeight;
        const scale = getScale();

        // Find closest corner within threshold
        const threshold = 20;
        for (let i = 0; i < 4; i++) {
            const cpt = imageToCanvasPoint(perspectiveCorners[i].x, perspectiveCorners[i].y, canvas, scale, rotation, srcW, srcH);
            const dist = Math.hypot(pos.x - cpt.x, pos.y - cpt.y);
            if (dist < threshold) {
                setDraggingCorner(i);
                e.preventDefault();
                return;
            }
        }
    }

    function handlePerspectiveMouseMove(e) {
        if (draggingCorner === null || activeTool !== TOOLS.PERSPECTIVE) return;
        const pos = getCanvasMousePos(e);
        const canvas = previewCanvasRef.current;
        const src = getSourceImage();
        if (!canvas || !src) return;

        const srcW = src.width || src.naturalWidth;
        const srcH = src.height || src.naturalHeight;
        const scale = getScale();

        const imgCoords = canvasToImageCoords(pos.x, pos.y, canvas, scale, rotation, srcW, srcH);

        // Clamp to image bounds
        imgCoords.x = Math.max(0, Math.min(srcW, imgCoords.x));
        imgCoords.y = Math.max(0, Math.min(srcH, imgCoords.y));

        setPerspectiveCorners(prev => {
            const updated = [...prev];
            updated[draggingCorner] = { x: imgCoords.x, y: imgCoords.y };
            return updated;
        });
    }

    function handlePerspectiveMouseUp() {
        setDraggingCorner(null);
    }

    // ── Apply perspective correction ──
    function applyPerspective() {
        if (!perspectiveCorners || !originalImage) return;
        const src = getSourceImage();
        if (!src) return;

        pushHistory();

        const result = applyPerspectiveTransform(src, perspectiveCorners);
        const ctx = result.getContext('2d');
        const imgData = ctx.getImageData(0, 0, result.width, result.height);

        setCroppedImageData(imgData);
        setPerspectiveCorners(null);
        setDraggingCorner(null);
        setRotation(0);
    }

    async function handleSmartCrop() {
        setIsAnalyzing(true);
        try {
            const src = getSourceImage();
            if (!src) return;

            // Create temporary canvas to get data URL and resize
            const canvas = document.createElement('canvas');
            const maxSize = 1024; // Limit size for API speed
            let w = src.width;
            let h = src.height;

            // Handle HTMLImageElement vs HTMLCanvasElement
            if (src instanceof HTMLImageElement) {
                w = src.naturalWidth;
                h = src.naturalHeight;
            }

            let scale = 1;
            if (w > maxSize || h > maxSize) {
                scale = Math.min(maxSize / w, maxSize / h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }

            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(src, 0, 0, w, h);

            // Get base64 string
            const base64 = canvas.toDataURL('image/jpeg', 0.8);

            const bbox = await detectSubject(base64);
            if (bbox) {
                // Convert 0-1 relative coords to pixels (source image)
                const srcW = src.width || src.naturalWidth;
                const srcH = src.height || src.naturalHeight;

                setCropRect({
                    x: Math.round(bbox.x * srcW),
                    y: Math.round(bbox.y * srcH),
                    width: Math.round(bbox.width * srcW),
                    height: Math.round(bbox.height * srcH),
                });
            } else {
                alert('No subject detected. Try manual cropping.');
            }
        } catch (error) {
            console.error('Smart Crop failed:', error);
            alert('Smart Crop failed: ' + error.message);
        } finally {
            setIsAnalyzing(false);
        }
    }

    // ── Crop mouse handlers ──
    function getCanvasMousePos(e) {
        const canvas = previewCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }

    function getScale() {
        const canvas = previewCanvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !originalImage) return 1;
        const src = getSourceImage();
        if (!src) return 1;
        const srcW = src.width || src.naturalWidth;
        const srcH = src.height || src.naturalHeight;
        const { width: rotW, height: rotH } = getRotatedDimensions(srcW, srcH, rotation);
        const maxW = container.clientWidth - 48;
        const maxH = container.clientHeight - 48;
        return Math.min(maxW / rotW, maxH / rotH, 1);
    }

    function getSrcDims() {
        const src = getSourceImage();
        if (!src) return { w: 0, h: 0 };
        return { w: src.width || src.naturalWidth, h: src.height || src.naturalHeight };
    }

    const handleCropMouseDown = (e) => {
        if (activeTool !== TOOLS.CROP) return;
        e.preventDefault();
        const pos = getCanvasMousePos(e);
        const canvas = previewCanvasRef.current;
        const scale = getScale();
        const { w: srcW, h: srcH } = getSrcDims();

        if (cropRect && cropRect.w > 5 && cropRect.h > 5) {
            const canvasRect = imageToCanvasRect(cropRect, canvas, scale, rotation, srcW, srcH);
            const handle = getHandleAtPoint(pos, canvasRect);
            if (handle) {
                setCropHandle(handle);
                setCropStart(pos);
                setIsCropping(true);
                return;
            }
        }

        // Start new crop
        const imgPos = canvasToImageCoords(pos.x, pos.y, canvas, scale, rotation, srcW, srcH);
        setCropRect({ x: imgPos.x, y: imgPos.y, w: 0, h: 0 });
        setCropStart(pos);
        setCropHandle(null);
        setIsCropping(true);
    };

    const handleCropMouseMove = useCallback((e) => {
        if (!isCropping || activeTool !== TOOLS.CROP) return;
        const pos = getCanvasMousePos(e);
        const canvas = previewCanvasRef.current;
        const scale = getScale();
        const { w: srcW, h: srcH } = getSrcDims();

        if (cropHandle === 'move' && cropRect) {
            const dx = (pos.x - cropStart.x) / scale;
            const dy = (pos.y - cropStart.y) / scale;
            setCropRect(prev => ({
                ...prev,
                x: Math.max(0, Math.min(srcW - prev.w, prev.x + dx)),
                y: Math.max(0, Math.min(srcH - prev.h, prev.y + dy)),
            }));
            setCropStart(pos);
            return;
        }

        // Edge/corner handle resizing
        if (cropHandle && cropHandle !== 'move' && cropRect) {
            const dx = (pos.x - cropStart.x) / scale;
            const dy = (pos.y - cropStart.y) / scale;

            setCropRect(prev => {
                let { x, y, w, h } = prev;

                // Horizontal adjustments
                if (cropHandle.includes('w') || cropHandle === 'w') {
                    const newX = Math.max(0, x + dx);
                    w = w - (newX - x);
                    x = newX;
                }
                if (cropHandle.includes('e') || cropHandle === 'e') {
                    w = Math.min(w + dx, srcW - x);
                }

                // Vertical adjustments  
                if (cropHandle.includes('n') || cropHandle === 'n') {
                    const newY = Math.max(0, y + dy);
                    h = h - (newY - y);
                    y = newY;
                }
                if (cropHandle.includes('s') || cropHandle === 's') {
                    h = Math.min(h + dy, srcH - y);
                }

                // Enforce minimum size
                if (w < 5) w = 5;
                if (h < 5) h = 5;

                return { x, y, w, h };
            });
            setCropStart(pos);
            return;
        }

        // Drawing new crop
        if (!cropHandle) {
            const imgPos = canvasToImageCoords(pos.x, pos.y, canvas, scale, rotation, srcW, srcH);
            const startImgPos = canvasToImageCoords(cropStart.x, cropStart.y, canvas, scale, rotation, srcW, srcH);

            let w = imgPos.x - startImgPos.x;
            let h = imgPos.y - startImgPos.y;

            if (cropAspectRatio && cropAspectRatio !== 'original') {
                const ratio = typeof cropAspectRatio === 'number' ? cropAspectRatio : srcW / srcH;
                h = Math.abs(w) / ratio * Math.sign(h || 1);
            }

            const x = w >= 0 ? startImgPos.x : startImgPos.x + w;
            const y = h >= 0 ? startImgPos.y : startImgPos.y + h;

            setCropRect({
                x: Math.max(0, x),
                y: Math.max(0, y),
                w: Math.min(Math.abs(w), srcW - Math.max(0, x)),
                h: Math.min(Math.abs(h), srcH - Math.max(0, y)),
            });
        }
    }, [isCropping, activeTool, cropHandle, cropRect, cropStart, cropAspectRatio, rotation]);

    const handleCropMouseUp = useCallback(() => {
        if (!isCropping) return;
        setIsCropping(false);
        setCropStart(null);
        setCropHandle(null);

        // Remove tiny crops (accidental clicks)
        setCropRect(prev => {
            if (prev && (prev.w < 5 || prev.h < 5)) return null;
            return prev;
        });
    }, [isCropping]);

    // Global mouse listeners so crop drag works even when mouse leaves canvas
    useEffect(() => {
        if (!isCropping) return;
        window.addEventListener('mousemove', handleCropMouseMove);
        window.addEventListener('mouseup', handleCropMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleCropMouseMove);
            window.removeEventListener('mouseup', handleCropMouseUp);
        };
    }, [isCropping, handleCropMouseMove, handleCropMouseUp]);

    function getHandleAtPoint(pos, rect) {
        const threshold = 20;

        // Corner handles (check first — higher priority)
        const corners = [
            { key: 'nw', x: rect.x, y: rect.y },
            { key: 'ne', x: rect.x + rect.w, y: rect.y },
            { key: 'sw', x: rect.x, y: rect.y + rect.h },
            { key: 'se', x: rect.x + rect.w, y: rect.y + rect.h },
        ];
        for (const c of corners) {
            if (Math.abs(pos.x - c.x) < threshold && Math.abs(pos.y - c.y) < threshold) {
                return c.key;
            }
        }

        // Edge handles (check if near an edge but inside the rect bounds on the other axis)
        const inX = pos.x >= rect.x - threshold && pos.x <= rect.x + rect.w + threshold;
        const inY = pos.y >= rect.y - threshold && pos.y <= rect.y + rect.h + threshold;

        if (inX && Math.abs(pos.y - rect.y) < threshold) return 'n';
        if (inX && Math.abs(pos.y - (rect.y + rect.h)) < threshold) return 's';
        if (inY && Math.abs(pos.x - rect.x) < threshold) return 'w';
        if (inY && Math.abs(pos.x - (rect.x + rect.w)) < threshold) return 'e';

        // Inside rect → move
        if (pos.x >= rect.x && pos.x <= rect.x + rect.w &&
            pos.y >= rect.y && pos.y <= rect.y + rect.h) {
            return 'move';
        }

        return null;
    }

    // ── Actions ──
    const rotateBy = (degrees) => {
        pushHistory();
        setRotation(prev => (prev + degrees) % 360);
    };

    const applyCrop = () => {
        if (!cropRect || cropRect.w < 5 || cropRect.h < 5) return;

        pushHistory();

        const src = getSourceImage();
        if (!src) return;
        const srcW = src.width || src.naturalWidth;
        const srcH = src.height || src.naturalHeight;

        // First render the rotated image to a temp canvas
        const { width: rotW, height: rotH } = getRotatedDimensions(srcW, srcH, rotation);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = rotW;
        tempCanvas.height = rotH;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.translate(rotW / 2, rotH / 2);
        tempCtx.rotate((rotation * Math.PI) / 180);
        tempCtx.drawImage(src, -srcW / 2, -srcH / 2, srcW, srcH);

        // Now extract the crop region from the rotated image
        // Map crop rect from image-space to rotated-space
        const canvasRect = imageToCanvasRect(cropRect, { width: rotW, height: rotH }, 1, rotation, srcW, srcH);

        const cx = Math.max(0, Math.round(canvasRect.x));
        const cy = Math.max(0, Math.round(canvasRect.y));
        const cw = Math.min(Math.round(canvasRect.w), rotW - cx);
        const ch = Math.min(Math.round(canvasRect.h), rotH - cy);

        if (cw <= 0 || ch <= 0) return;

        const cropData = tempCtx.getImageData(cx, cy, cw, ch);
        setCroppedImageData(cropData);
        setRotation(0);
        setCropRect(null);
        setActiveTool(null);
    };

    const handleReset = () => {
        setRotation(0);
        setCropRect(null);
        setCroppedImageData(null);
        setHistory([]);
        setActiveTool(null);
        setBrightness(0);
        setContrast(0);
        setGreyscale(false);
        setGreyscaleWeights({ r: 0.299, g: 0.587, b: 0.114 });
        setPerspectiveCorners(null);
        setDraggingCorner(null);
    };

    const pushHistory = () => {
        setHistory(prev => [...prev, { rotation, croppedImageData, brightness, contrast, greyscale, greyscaleWeights }]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setRotation(prev.rotation);
        setCroppedImageData(prev.croppedImageData);
        setCropRect(null);
        setBrightness(prev.brightness ?? 0);
        setContrast(prev.contrast ?? 0);
        setGreyscale(prev.greyscale ?? false);
        setGreyscaleWeights(prev.greyscaleWeights ?? { r: 0.299, g: 0.587, b: 0.114 });
        setPerspectiveCorners(null);
        setDraggingCorner(null);
        setHistory(h => h.slice(0, -1));
    };

    // ── Save ──
    const renderFinalCanvas = () => {
        const src = getSourceImage();
        const srcW = src.width || src.naturalWidth;
        const srcH = src.height || src.naturalHeight;
        const { width: rotW, height: rotH } = getRotatedDimensions(srcW, srcH, rotation);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = rotW;
        finalCanvas.height = rotH;
        const ctx = finalCanvas.getContext('2d');
        ctx.translate(rotW / 2, rotH / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(src, -srcW / 2, -srcH / 2, srcW, srcH);

        // Apply filters to final output
        const hasFilters = brightness !== 0 || contrast !== 0 || greyscale;
        if (hasFilters) {
            const imgData = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
            applyAllFilters(imgData, { brightness, contrast, greyscale, greyscaleWeights });
            ctx.putImageData(imgData, 0, 0);
        }

        return finalCanvas;
    };

    const handleSave = async () => {
        if (!originalImage || !file || !item || !user) return;

        try {
            setIsSaving(true);
            setSaveProgress('Rendering final image...');
            const finalCanvas = renderFinalCanvas();

            setSaveProgress('Preserving EXIF metadata...');
            const blob = canvasToJpegBlobWithExif(finalCanvas, exifData, 0.92);

            setSaveProgress('Uploading to storage...');
            const timestamp = Date.now();
            const editedName = `edited_${timestamp}_${file.name}`;
            const fileRef = ref(storage, `users/${user.uid}/items/${editedName}`);
            const uploadResult = await uploadBytes(fileRef, blob);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            setSaveProgress('Updating archive item...');
            const newFile = {
                name: editedName,
                url: downloadURL,
                type: 'image/jpeg',
                size: blob.size,
                path: fileRef.fullPath,
                uploadedAt: new Date().toISOString(),
                editedFrom: file.name,
            };

            const itemRef = doc(db, 'archiveItems', item.id);
            const updatedFiles = [...(item.files || []), newFile];
            await updateDoc(itemRef, { files: updatedFiles });

            setSaveProgress('Done!');
            setTimeout(() => {
                setIsSaving(false);
                setSaveProgress('');
                if (onSave) onSave();
                onClose();
            }, 500);
        } catch (err) {
            console.error('Error saving edited image:', err);
            setError(`Failed to save: ${err.message}`);
            setIsSaving(false);
            setSaveProgress('');
        }
    };

    const handleReplaceClick = () => {
        if (!originalImage || !file || !item || !user) return;
        setShowReplaceConfirm(true);
    };

    const handleReplaceConfirmed = async () => {
        setShowReplaceConfirm(false);

        try {
            setIsSaving(true);
            setSaveProgress('Rendering final image...');
            const finalCanvas = renderFinalCanvas();

            setSaveProgress('Preserving EXIF metadata...');
            const blob = canvasToJpegBlobWithExif(finalCanvas, exifData, 0.92);

            setSaveProgress('Uploading replacement...');
            const timestamp = Date.now();
            const editedName = `replaced_${timestamp}_${file.name}`;
            const fileRef = ref(storage, `users/${user.uid}/items/${editedName}`);
            const uploadResult = await uploadBytes(fileRef, blob);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            setSaveProgress('Updating archive item...');
            const replacedFile = {
                name: file.name,
                url: downloadURL,
                type: 'image/jpeg',
                size: blob.size,
                path: fileRef.fullPath,
                uploadedAt: new Date().toISOString(),
                replacedOriginalPath: file.path,
            };

            // Fetch latest item data from Firestore to avoid stale files array
            const itemRef = doc(db, 'archiveItems', item.id);
            const latestSnap = await getDoc(itemRef);
            const latestFiles = latestSnap.exists() ? (latestSnap.data().files || []) : (item.files || []);

            // Match by path (stable) instead of URL (contains changing tokens)
            const filePath = file.path;
            console.log('[ImageEditor] Replacing file with path:', filePath);
            console.log('[ImageEditor] Current files paths:', latestFiles.map(f => f.path));

            const updatedFiles = latestFiles.map(f => {
                if (f.path === filePath) {
                    console.log('[ImageEditor] Matched file, replacing:', f.path);
                    return replacedFile;
                }
                return f;
            });

            // Check if we actually found and replaced the file
            const didReplace = updatedFiles.some(f => f.path === replacedFile.path);
            if (!didReplace) {
                console.warn('[ImageEditor] Could not match file by path, falling back to URL match');
                // Fallback: try matching by URL prefix (before query params)
                const fileUrlBase = file.url?.split('?')[0];
                const fallbackFiles = latestFiles.map(f => {
                    const fUrlBase = f.url?.split('?')[0];
                    if (fUrlBase === fileUrlBase) {
                        console.log('[ImageEditor] Matched by URL base:', fUrlBase);
                        return replacedFile;
                    }
                    return f;
                });
                await updateDoc(itemRef, { files: fallbackFiles });
            } else {
                await updateDoc(itemRef, { files: updatedFiles });
            }

            setSaveProgress('Done!');
            setTimeout(() => {
                setIsSaving(false);
                setSaveProgress('');
                if (onSave) onSave();
                onClose();
            }, 500);
        } catch (err) {
            console.error('Error replacing image:', err);
            setError(`Failed to replace: ${err.message}`);
            setIsSaving(false);
            setSaveProgress('');
        }
    };

    // ── Keyboard shortcuts ──
    useEffect(() => {
        if (!isOpen) return;

        const handleKey = (e) => {
            if (e.key === 'Escape') {
                if (isSaving) return; // Don't close while saving
                if (showReplaceConfirm) {
                    setShowReplaceConfirm(false);
                    return;
                }
                if (activeTool) {
                    setActiveTool(null);
                    setCropRect(null);
                } else {
                    onClose();
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            }
            if (e.key === 'r' && !e.metaKey && !e.ctrlKey && activeTool !== TOOLS.CROP) {
                rotateBy(90);
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, activeTool, history.length]);

    // ── Prevent body scroll ──
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    // ── Cursor helpers ──
    const CURSOR_MAP = {
        nw: 'nwse-resize', se: 'nwse-resize',
        ne: 'nesw-resize', sw: 'nesw-resize',
        n: 'ns-resize', s: 'ns-resize',
        e: 'ew-resize', w: 'ew-resize',
        move: 'grab',
    };

    function getCropCursor() {
        if (isCropping && cropHandle) return CURSOR_MAP[cropHandle] || 'crosshair';
        if (hoverHandle) return CURSOR_MAP[hoverHandle] || 'crosshair';
        return 'crosshair';
    }

    function updateHoverCursor(e) {
        if (!cropRect || cropRect.w < 5 || cropRect.h < 5) {
            setHoverHandle(null);
            return;
        }
        const pos = getCanvasMousePos(e);
        const canvas = previewCanvasRef.current;
        const scale = getScale();
        const { w: srcW, h: srcH } = getSrcDims();
        const canvasRect = imageToCanvasRect(cropRect, canvas, scale, rotation, srcW, srcH);
        const handle = getHandleAtPoint(pos, canvasRect);
        setHoverHandle(handle);
    }

    // ── Render ──
    return (
        <div className="fixed inset-0 z-[110] bg-gray-950 flex flex-col">
            {/* ── Top Bar ── */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => { if (!isSaving) onClose(); }}
                        className="text-gray-400 hover:text-white transition p-1"
                        title="Close (Esc)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <h2 className="text-white font-semibold text-lg truncate max-w-xs">
                        ✏️ Edit: {file?.name}
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleUndo}
                        disabled={history.length === 0}
                        className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Undo (⌘Z)"
                    >
                        ↩ Undo
                    </button>
                    <button
                        onClick={handleReset}
                        className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition"
                    >
                        ⟳ Reset
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-1.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50"
                    >
                        {isSaving ? saveProgress : '💾 Save as Copy'}
                    </button>
                    <button
                        onClick={handleReplaceClick}
                        disabled={isSaving}
                        className="px-4 py-1.5 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition disabled:opacity-50"
                        title="Replace the original file with the edited version"
                    >
                        {isSaving ? '...' : '🔄 Replace Original'}
                    </button>
                </div>
            </div>

            {/* ── Main content ── */}
            <div className="flex flex-1 min-h-0">
                {/* ── Tool sidebar ── */}
                <div className="w-56 bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto shrink-0">
                    {/* Rotate Section */}
                    <div className="mb-6">
                        <button
                            onClick={() => setActiveTool(activeTool === TOOLS.ROTATE ? null : TOOLS.ROTATE)}
                            className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm transition ${activeTool === TOOLS.ROTATE
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            🔄 Rotate
                        </button>

                        {activeTool === TOOLS.ROTATE && (
                            <div className="mt-3 space-y-3 px-1">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => rotateBy(-90)}
                                        className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition"
                                    >
                                        ↺ 90° L
                                    </button>
                                    <button
                                        onClick={() => rotateBy(90)}
                                        className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition"
                                    >
                                        ↻ 90° R
                                    </button>
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs block mb-1">
                                        Fine rotation: {rotation}°
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="359"
                                        value={((rotation % 360) + 360) % 360}
                                        onChange={(e) => {
                                            pushHistory();
                                            setRotation(parseInt(e.target.value));
                                        }}
                                        className="w-full accent-indigo-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Crop Section */}
                    <div className="mb-6">
                        <button
                            onClick={() => {
                                if (activeTool === TOOLS.CROP) {
                                    setActiveTool(null);
                                    setCropRect(null);
                                } else {
                                    setActiveTool(TOOLS.CROP);
                                }
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm transition ${activeTool === TOOLS.CROP
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            ✂️ Crop
                        </button>

                        {activeTool === TOOLS.CROP && (
                            <div className="mt-3 space-y-3 px-1">
                                {/* Aspect ratio buttons */}
                                <div>
                                    <label className="text-gray-400 text-xs block mb-2">Aspect Ratio</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {ASPECT_RATIOS.map(({ label, value }) => (
                                            <button
                                                key={label}
                                                onClick={() => setCropAspectRatio(value)}
                                                className={`px-2 py-1.5 text-xs rounded-md transition ${cropAspectRatio === value
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Smart Crop Button */}
                                <button
                                    onClick={handleSmartCrop}
                                    disabled={isAnalyzing}
                                    className="w-full mt-2 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 rounded-lg transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>✨ Smart Crop</>
                                    )}
                                </button>


                                <p className="text-gray-500 text-xs">
                                    Drag on the image to draw a crop area. Then drag edges, corners, or the inside to adjust.
                                </p>

                                {cropRect && cropRect.w > 5 && cropRect.h > 5 && (
                                    <button
                                        onClick={applyCrop}
                                        className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg font-medium transition"
                                    >
                                        ✅ Apply Crop
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Adjust Section */}
                    <div className="mb-6">
                        <button
                            onClick={() => setActiveTool(activeTool === TOOLS.ADJUST ? null : TOOLS.ADJUST)}
                            className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm transition ${activeTool === TOOLS.ADJUST
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            ☀️ Adjust
                            {(brightness !== 0 || contrast !== 0) && (
                                <span className="ml-2 text-xs opacity-60">●</span>
                            )}
                        </button>

                        {activeTool === TOOLS.ADJUST && (
                            <div className="mt-3 space-y-4 px-1">
                                <div>
                                    <label className="text-gray-400 text-xs flex justify-between mb-1">
                                        <span>Brightness</span>
                                        <span className="text-gray-500">{brightness}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="-100"
                                        max="100"
                                        value={brightness}
                                        onChange={(e) => {
                                            pushHistory();
                                            setBrightness(parseInt(e.target.value));
                                        }}
                                        className="w-full accent-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs flex justify-between mb-1">
                                        <span>Contrast</span>
                                        <span className="text-gray-500">{contrast}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="-100"
                                        max="100"
                                        value={contrast}
                                        onChange={(e) => {
                                            pushHistory();
                                            setContrast(parseInt(e.target.value));
                                        }}
                                        className="w-full accent-amber-500"
                                    />
                                </div>
                                {(brightness !== 0 || contrast !== 0) && (
                                    <button
                                        onClick={() => {
                                            pushHistory();
                                            setBrightness(0);
                                            setContrast(0);
                                        }}
                                        className="w-full px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                                    >
                                        Reset Adjustments
                                    </button>
                                )}
                            </div>
                        )}
                    </div>


                    {/* Perspective Section */}
                    <div className="mb-6">
                        <button
                            onClick={() => setActiveTool(activeTool === TOOLS.PERSPECTIVE ? null : TOOLS.PERSPECTIVE)}
                            className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm transition flex items-center justify-between ${activeTool === TOOLS.PERSPECTIVE
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            <span>📐 Perspective</span>
                        </button>

                        {activeTool === TOOLS.PERSPECTIVE && (
                            <div className="mt-3 px-1 space-y-4">
                                <p className="text-xs text-gray-400">
                                    Drag the 4 corners to match the document edges.
                                </p>

                                <button
                                    onClick={applyPerspective}
                                    className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-400 rounded-lg transition shadow-sm"
                                >
                                    Apply Perspective
                                </button>

                                <button
                                    onClick={() => setPerspectiveCorners(null)}
                                    className="w-full px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                                >
                                    Reset Corners
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Greyscale Section */}
                    <div className="mb-6">
                        <button
                            onClick={() => setActiveTool(activeTool === TOOLS.GREYSCALE ? null : TOOLS.GREYSCALE)}
                            className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm transition ${activeTool === TOOLS.GREYSCALE
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            🔲 Greyscale
                            {greyscale && (
                                <span className="ml-2 text-xs opacity-60">●</span>
                            )}
                        </button>

                        {activeTool === TOOLS.GREYSCALE && (
                            <div className="mt-3 space-y-4 px-1">
                                {/* Toggle */}
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div
                                        onClick={() => {
                                            pushHistory();
                                            setGreyscale(!greyscale);
                                        }}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${greyscale ? 'bg-indigo-600' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${greyscale ? 'translate-x-5' : ''}`} />
                                    </div>
                                    <span className="text-gray-300 text-sm">{greyscale ? 'On' : 'Off'}</span>
                                </label>

                                {greyscale && (
                                    <>
                                        {/* Channel weight sliders */}
                                        <div>
                                            <label className="text-gray-400 text-xs flex justify-between mb-1">
                                                <span className="text-red-400">Red</span>
                                                <span className="text-gray-500">{greyscaleWeights.r.toFixed(2)}</span>
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.01"
                                                value={greyscaleWeights.r}
                                                onChange={(e) => {
                                                    pushHistory();
                                                    setGreyscaleWeights(w => ({ ...w, r: parseFloat(e.target.value) }));
                                                }}
                                                className="w-full accent-red-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs flex justify-between mb-1">
                                                <span className="text-green-400">Green</span>
                                                <span className="text-gray-500">{greyscaleWeights.g.toFixed(2)}</span>
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.01"
                                                value={greyscaleWeights.g}
                                                onChange={(e) => {
                                                    pushHistory();
                                                    setGreyscaleWeights(w => ({ ...w, g: parseFloat(e.target.value) }));
                                                }}
                                                className="w-full accent-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs flex justify-between mb-1">
                                                <span className="text-blue-400">Blue</span>
                                                <span className="text-gray-500">{greyscaleWeights.b.toFixed(2)}</span>
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.01"
                                                value={greyscaleWeights.b}
                                                onChange={(e) => {
                                                    pushHistory();
                                                    setGreyscaleWeights(w => ({ ...w, b: parseFloat(e.target.value) }));
                                                }}
                                                className="w-full accent-blue-500"
                                            />
                                        </div>

                                        {/* Presets */}
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-2">Presets</label>
                                            <div className="grid grid-cols-2 gap-1">
                                                {[
                                                    { label: 'Standard', r: 0.299, g: 0.587, b: 0.114 },
                                                    { label: 'Equal', r: 0.333, g: 0.334, b: 0.333 },
                                                    { label: 'Red-heavy', r: 0.6, g: 0.3, b: 0.1 },
                                                    { label: 'Green-heavy', r: 0.2, g: 0.7, b: 0.1 },
                                                ].map(preset => (
                                                    <button
                                                        key={preset.label}
                                                        onClick={() => {
                                                            pushHistory();
                                                            setGreyscaleWeights({ r: preset.r, g: preset.g, b: preset.b });
                                                        }}
                                                        className="px-2 py-1.5 text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-md transition"
                                                    >
                                                        {preset.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="mt-8 pt-4 border-t border-gray-800">
                        <p className="text-gray-500 text-xs">
                            <strong className="text-gray-400">Shortcuts:</strong><br />
                            R — Rotate 90° CW<br />
                            ⌘Z — Undo<br />
                            Esc — Close tool / editor
                        </p>
                        {exifData && (
                            <p className="text-emerald-400 text-xs mt-3">
                                ✓ EXIF data detected — will be preserved on save.
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Canvas area ── */}
                <div
                    ref={containerRef}
                    className="flex-1 flex items-center justify-center bg-gray-950 overflow-hidden relative"
                >
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-indigo-500" />
                            <p>Loading image...</p>
                        </div>
                    ) : error ? (
                        <div className="text-red-400 text-center">
                            <p className="text-lg mb-2">⚠️ {error}</p>
                            <button onClick={onClose} className="text-gray-400 hover:text-white underline">
                                Close
                            </button>
                        </div>
                    ) : (
                        <canvas
                            ref={previewCanvasRef}
                            style={{ cursor: activeTool === TOOLS.PERSPECTIVE ? (draggingCorner !== null ? 'grabbing' : 'grab') : activeTool === TOOLS.CROP ? getCropCursor() : 'default' }}
                            onMouseDown={(e) => {
                                handleCropMouseDown(e);
                                handlePerspectiveMouseDown(e);
                            }}
                            onMouseMove={(e) => {
                                if (!isCropping) updateHoverCursor(e);
                                handleCropMouseMove(e);
                                handlePerspectiveMouseMove(e);
                            }}
                            onMouseUp={(e) => {
                                handleCropMouseUp(e);
                                handlePerspectiveMouseUp();
                            }}
                            onMouseLeave={(e) => {
                                handleCropMouseUp(e);
                                handlePerspectiveMouseUp();
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Hidden off-screen canvas for final rendering */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Replace confirmation dialog */}
            {showReplaceConfirm && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
                        <h3 className="text-white text-lg font-semibold mb-3">🔄 Replace Original?</h3>
                        <p className="text-gray-300 text-sm mb-5">
                            This will replace the original image with your edited version.
                            The original will no longer be accessible.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowReplaceConfirm(false)}
                                className="px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReplaceConfirmed}
                                className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition"
                            >
                                Replace
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Save progress overlay */}
            {isSaving && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
                    <div className="flex flex-col items-center gap-4 text-white">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-emerald-500" />
                        <p className="text-lg font-medium">{saveProgress}</p>
                        <p className="text-gray-400 text-sm">Please wait...</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ImageEditorModal;
