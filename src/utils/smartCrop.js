import { GEMINI_API_KEY, GEMINI_API_URL } from '../config/firebase';

/**
 * Detects the main subject in an image using Gemini 1.5 Flash
 * allowing for "Smart Crop" functionality in the Image Editor.
 * 
 * @param {string} imageBase64 - Base64 encoded image data (e.g. from canvas.toDataURL)
 * @returns {Promise<{x: number, y: number, width: number, height: number} | null>} - Relative bounding box (0-1) or null if failed/no subject
 */
export async function detectSubject(imageBase64) {
    if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not configured');
        return null;
    }

    try {
        // Strip data:image/jpeg;base64, prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        const systemPrompt = `Analyze this image and identify the bounding box of the main subject (a document, photo, or artifact).
Return the bounding box as a JSON object with keys: ymin, xmin, ymax, xmax.
Coordinates should be relative to the image dimensions (0.0 to 1.0).
If multiple items are present, choose the single most prominent central item.
Return ONLY valid JSON, no markdown.`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: systemPrompt },
                    {
                        inline_data: {
                            mime_type: 'image/jpeg',
                            data: base64Data
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                topK: 1,
                topP: 1,
                maxOutputTokens: 256,
                responseMimeType: "application/json"
            }
        };

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Gemini API error:', response.status, errorData);
            throw new Error(`AI analysis failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            console.warn('No analysis results returned from AI');
            return null;
        }

        const content = data.candidates[0].content.parts[0].text;
        const bbox = JSON.parse(content);

        // Normalize checks
        if (typeof bbox.ymin !== 'number' || typeof bbox.xmin !== 'number') {
            console.error('Invalid bbox format:', bbox);
            return null;
        }

        // Convert [ymin, xmin, ymax, xmax] to {x, y, width, height}
        return {
            x: bbox.xmin,
            y: bbox.ymin,
            width: bbox.xmax - bbox.xmin,
            height: bbox.ymax - bbox.ymin
        };

    } catch (err) {
        console.error('Smart Crop error:', err);
        return null;
    }
}
