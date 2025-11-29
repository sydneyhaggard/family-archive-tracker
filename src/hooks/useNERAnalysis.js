import { useState, useCallback } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { GEMINI_API_KEY, GEMINI_API_URL, auth } from '../config/firebase';

/**
 * Custom hook for Named Entity Recognition (NER) analysis
 * 
 * Provides both client-side and Cloud Function-based NER analysis
 * with entity resolution against existing relatedPeople collection
 */
export function useNERAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  /**
   * Client-side NER analysis using Gemini API directly
   * Useful for quicker response when Cloud Functions aren't deployed
   * 
   * @param {string} content - Text content to analyze
   * @param {string} imageBase64 - Optional base64 image data
   * @returns {Object} - NER results
   */
  const analyzeContentLocal = useCallback(async (content, imageBase64 = null) => {
    if (!content && !imageBase64) {
      throw new Error('Either text content or image is required for analysis');
    }

    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const systemPrompt = `You are an expert genealogist and archivist. Analyze the provided content and extract key entities that would be useful for cataloging family archive items.

Your task is to identify and extract:
1. **People**: Names of any people mentioned (full names when possible)
2. **Dates**: Any dates mentioned (normalize to YYYY-MM-DD format when possible, or describe if approximate like "circa 1920")
3. **Locations**: Places, addresses, cities, states, countries mentioned
4. **Summary**: A one-sentence summary describing what this item is about

Return ONLY valid JSON matching this exact structure:
{
  "suggestedPeople": ["Name 1", "Name 2"],
  "suggestedDates": ["YYYY-MM-DD", "circa 1920"],
  "suggestedLocations": ["City, State", "Country"],
  "summary": "One sentence summary of the content."
}

If no entities are found for a category, return an empty array [].
Do NOT include any markdown formatting or code blocks. Return ONLY the raw JSON object.`;

    const userContent = content 
      ? `Analyze this text content:\n\n${content}`
      : 'Analyze the content of this image for any text, names, dates, locations, or context.';

    const parts = [
      { text: systemPrompt },
      { text: userContent }
    ];

    // Add image if provided
    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageBase64
        }
      });
    }

    const requestBody = {
      contents: [{
        parts
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048
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

    const geminiResponse = await response.json();
    
    if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
      throw new Error('No analysis results returned from AI');
    }

    // Parse the JSON response
    const responseText = geminiResponse.candidates[0].content.parts[0].text;
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const nerResults = JSON.parse(cleanedText);

    return {
      suggestedPeople: nerResults.suggestedPeople || [],
      suggestedDates: nerResults.suggestedDates || [],
      suggestedLocations: nerResults.suggestedLocations || [],
      summary: nerResults.summary || ''
    };
  }, []);

  /**
   * Cloud Function-based NER analysis with entity resolution
   * 
   * @param {string} content - Text content to analyze
   * @param {string} imageUrl - Optional image URL
   * @returns {Object} - NER results with matched/new people
   */
  const analyzeContentWithResolution = useCallback(async (content, imageUrl = null) => {
    if (!auth.currentUser) {
      throw new Error('User must be authenticated');
    }

    try {
      const functions = getFunctions();
      const analyzeNER = httpsCallable(functions, 'analyzeContentNER');
      
      const result = await analyzeNER({
        content,
        imageUrl,
        userId: auth.currentUser.uid
      });

      return result.data;
    } catch (error) {
      // If Cloud Function fails, fall back to local analysis
      console.warn('Cloud Function failed, falling back to local analysis:', error);
      return analyzeContentLocal(content);
    }
  }, [analyzeContentLocal]);

  /**
   * Main analysis function that handles the full flow
   * 
   * @param {Object} options - Analysis options
   * @param {string} options.content - Text content to analyze
   * @param {string} options.imageBase64 - Optional base64 image data
   * @param {boolean} options.useCloudFunction - Whether to use Cloud Function (default: true)
   * @param {Array} options.existingPeople - Optional list of existing people for local resolution
   */
  const analyze = useCallback(async ({ 
    content, 
    imageBase64 = null, 
    useCloudFunction = true,
    existingPeople = []
  }) => {
    setAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      let nerResults;

      if (useCloudFunction) {
        try {
          nerResults = await analyzeContentWithResolution(content);
        } catch (cfError) {
          console.warn('Cloud Function failed:', cfError);
          nerResults = await analyzeContentLocal(content, imageBase64);
          
          // Perform local entity resolution
          if (existingPeople.length > 0 && nerResults.suggestedPeople.length > 0) {
            const { matchedPeople, newPeople } = performLocalResolution(
              nerResults.suggestedPeople,
              existingPeople
            );
            nerResults = { ...nerResults, matchedPeople, newPeople };
          } else {
            nerResults = { 
              ...nerResults, 
              matchedPeople: [],
              newPeople: nerResults.suggestedPeople 
            };
          }
        }
      } else {
        nerResults = await analyzeContentLocal(content, imageBase64);
        
        // Perform local entity resolution
        if (existingPeople.length > 0 && nerResults.suggestedPeople.length > 0) {
          const { matchedPeople, newPeople } = performLocalResolution(
            nerResults.suggestedPeople,
            existingPeople
          );
          nerResults = { ...nerResults, matchedPeople, newPeople };
        } else {
          nerResults = { 
            ...nerResults, 
            matchedPeople: [],
            newPeople: nerResults.suggestedPeople 
          };
        }
      }

      setResults(nerResults);
      return nerResults;
    } catch (err) {
      console.error('NER analysis error:', err);
      setError(err.message);
      throw err;
    } finally {
      setAnalyzing(false);
    }
  }, [analyzeContentLocal, analyzeContentWithResolution]);

  /**
   * Reset the analysis state
   */
  const reset = useCallback(() => {
    setResults(null);
    setError(null);
    setAnalyzing(false);
  }, []);

  return {
    analyze,
    analyzeContentLocal,
    analyzeContentWithResolution,
    analyzing,
    results,
    error,
    reset
  };
}

/**
 * Perform local entity resolution matching suggested names against existing people
 * 
 * @param {string[]} suggestedNames - Names extracted from content
 * @param {Object[]} existingPeople - List of existing people from Firestore
 * @returns {Object} - { matchedPeople, newPeople }
 */
function performLocalResolution(suggestedNames, existingPeople) {
  const matchedPeople = [];
  const newPeople = [];

  for (const suggestedName of suggestedNames) {
    const normalizedSuggested = suggestedName.toLowerCase().trim();
    
    let matched = false;
    for (const person of existingPeople) {
      const normalizedExisting = (person.name || '').toLowerCase().trim();
      
      // Check for exact match
      if (normalizedExisting === normalizedSuggested) {
        matchedPeople.push({
          suggestedName,
          matchedPerson: {
            id: person.id,
            name: person.name,
            birthDate: person.birthDate,
            photoURL: person.photoURL
          },
          matchType: 'exact'
        });
        matched = true;
        break;
      }
      
      // Check for partial match
      if (
        normalizedExisting.includes(normalizedSuggested) ||
        normalizedSuggested.includes(normalizedExisting)
      ) {
        matchedPeople.push({
          suggestedName,
          matchedPerson: {
            id: person.id,
            name: person.name,
            birthDate: person.birthDate,
            photoURL: person.photoURL
          },
          matchType: 'partial'
        });
        matched = true;
        break;
      }
      
      // Check for word match
      const suggestedWords = normalizedSuggested.split(/\s+/);
      const existingWords = normalizedExisting.split(/\s+/);
      const hasWordMatch = suggestedWords.some(sw => 
        existingWords.some(ew => ew === sw && sw.length > 2)
      );
      
      if (hasWordMatch) {
        matchedPeople.push({
          suggestedName,
          matchedPerson: {
            id: person.id,
            name: person.name,
            birthDate: person.birthDate,
            photoURL: person.photoURL
          },
          matchType: 'word'
        });
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      newPeople.push(suggestedName);
    }
  }

  return { matchedPeople, newPeople };
}

export default useNERAnalysis;
