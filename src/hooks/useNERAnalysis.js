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
 * Returns detailed match objects with confidence scores
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
    if (!normalizedSuggested) continue;

    // Find all potential matches
    const potentialMatches = [];

    for (const person of existingPeople) {
      const normalizedExisting = (person.name || '').toLowerCase().trim();
      let matchType = null;
      let confidence = 0;

      // 1. Exact Match
      if (normalizedExisting === normalizedSuggested) {
        matchType = 'exact';
        confidence = 1.0;
      }
      // 2. Transposed Match (First Last <-> Last First)
      else if (
        normalizedExisting.split(' ').reverse().join(' ') === normalizedSuggested ||
        normalizedSuggested.split(' ').reverse().join(' ') === normalizedExisting
      ) {
        matchType = 'exact'; // Treat as exact for scoring
        confidence = 0.95;
      }
      // 3. Partial Match (Name contained within another)
      else if (
        normalizedExisting.includes(normalizedSuggested) ||
        normalizedSuggested.includes(normalizedExisting)
      ) {
        matchType = 'partial';
        // innovative scoring: longer matches are more confident
        // e.g. "John Smith" matching "John Smith Jr" is better than "John" matching "John Smith"
        const lengthRatio = Math.min(normalizedExisting.length, normalizedSuggested.length) / 
                            Math.max(normalizedExisting.length, normalizedSuggested.length);
        confidence = 0.6 + (lengthRatio * 0.3); // Range 0.6 - 0.9
      }
      // 4. Word Match (At least 2 significant parts match, or prefix match)
      else {
        const suggestedWords = normalizedSuggested.split(/\s+/).filter(w => w.length > 2);
        const existingWords = normalizedExisting.split(/\s+/).filter(w => w.length > 2);
        
        let matchCount = 0;
        suggestedWords.forEach(sw => {
          // Check exact word match
          if (existingWords.includes(sw)) {
            matchCount++;
          }
          // Check if sw is a prefix of an existing word (e.g. Phil -> Philip) 
          // or vice versa (though less common for nicknames, e.g. Philip -> Phil is rare in text)
          // We limit this to cases where the shorter word is at least 3 chars
          else if (existingWords.some(ew => ew.startsWith(sw) || sw.startsWith(ew))) {
             matchCount += 0.8; // Partial word match counts slightly less
          }
        });

        // Threshold: 
        // 2 exact words = 2.0
        // 1 exact + 1 prefix (Phil Laurien) = 1.8
        // 1 exact (Laurien) = 1.0 -> No Match
        if (matchCount >= 1.5) { 
          matchType = 'fuzzy';
          confidence = 0.5 + (matchCount * 0.1); // Base 0.65+
          if (confidence > 0.85) confidence = 0.85; // Cap fuzzy matches
        }
      }

      if (matchType) {
        potentialMatches.push({
          person: {
            id: person.id,
            name: person.name || '',
            birthDate: person.birthDate || null,
            photoURL: person.photoURL || null
          },
          matchType,
          confidence
        });
      }
    }

    // Sort matches by confidence
    potentialMatches.sort((a, b) => b.confidence - a.confidence);

    // Determine result for this name
    if (potentialMatches.length === 0) {
      newPeople.push(suggestedName);
    } else {
      // Logic for ambiguity
      const bestMatch = potentialMatches[0];
      
      // If we have multiple high-confidence matches (conflict)
      // e.g. "John Smith" matches "John Smith Sr" and "John Smith Jr" similarly
      const similarMatches = potentialMatches.filter(m => 
        m.confidence >= (bestMatch.confidence - 0.1) && m.person.id !== bestMatch.person.id
      );

      if (similarMatches.length > 0) {
        matchedPeople.push({
          suggestedName,
          status: 'ambiguous',
          candidates: [bestMatch, ...similarMatches]
        });
      } else {
        matchedPeople.push({
          suggestedName,
          status: bestMatch.confidence > 0.85 ? 'linked' : 'suggested',
          matchedPerson: bestMatch.person,
          confidence: bestMatch.confidence,
          matchType: bestMatch.matchType
        });
      }
    }
  }

  return { matchedPeople, newPeople };
}

/**
 * Analyze transcription text to find auto-link candidates
 * Enhanced "Phase 2" logic: Heavily relies on scanning text for known people.
 */
export function analyzeTranscription(text, peopleList) {
  if (!text || !peopleList) return { autoLinks: [], suggestions: [] };

  const normalizedText = text.toLowerCase();
  
  // Track findings
  // Map<PersonID, { person, confidence, matchType, matchedText }>
  const matchesMap = new Map();

  // 1. Scan for ALL existing people in the text (Case-Insensitive)
  peopleList.forEach(person => {
    if (!person.name) return;
    const pName = person.name.toLowerCase().trim();
    const parts = pName.split(/\s+/);
    
    // Strategy A: Exact Full Name Match
    if (normalizedText.includes(pName)) {
      updateMatch(matchesMap, person, 1.0, 'exact', person.name);
      return; // Skip other strategies for this person if exact match found
    }

    // Strategy B: "First Last" Match (for "First Middle Last" names)
    if (parts.length > 2) {
      const firstLast = `${parts[0]} ${parts[parts.length - 1]}`;
      if (normalizedText.includes(firstLast)) {
        updateMatch(matchesMap, person, 0.9, 'partial_name', firstLast);
        return; 
      }
    }

    // Strategy C: "Last, First" Match (Transposed)
    if (parts.length >= 2) {
      const reversed = `${parts[parts.length - 1]}, ${parts[0]}`;
      const reversedNoComma = `${parts[parts.length - 1]} ${parts[0]}`;
      if (normalizedText.includes(reversed) || normalizedText.includes(reversedNoComma)) {
        updateMatch(matchesMap, person, 0.95, 'transposed', reversed);
        return;
      }
    }

    // Strategy D: Unique First Name Match
    // (We collect these, but only auto-link if unique across ALL people)
    // Only check if First Name is significant (> 2 chars)
    if (parts[0].length > 2) {
      // Use regex to ensure we match whole word "John" not "Johnson"
      // Escape regex special chars in name
      const escapedFirst = parts[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordRegex = new RegExp(`\\b${escapedFirst}\\b`, 'i');
      if (wordRegex.test(normalizedText)) {
         updateMatch(matchesMap, person, 0.6, 'first_name', parts[0]);
      }
    }
  });

  // 2. Resolve Ambiguities
  // If we have multiple matches for the SAME extracted text (e.g. "John" matches "John Smith" and "John Doe"),
  // we must flag them as ambiguous.
  
  // Group matches by the text they matched on? 
  // Actually, "First Name" strategy matches on "John". 
  // If multiple people matched on "John" (Strategy D), we must group them.
  
  const finalMatches = []; // List of result objects
  
  // Sort by confidence
  const allCandidates = Array.from(matchesMap.values()).sort((a, b) => b.confidence - a.confidence);

  // Group by "matchType: first_name" with same 'matchedText'
  const firstNameGroups = {};
  allCandidates.forEach(c => {
    if (c.matchType === 'first_name') {
      const key = c.matchedText;
      if (!firstNameGroups[key]) firstNameGroups[key] = [];
      firstNameGroups[key].push(c);
    } else {
      // High confidence matches (Exact, First Last) are usually auto-links
      // But wait! If "John Match" (Exact) exists, and "John" (First Name) exists...
      // The Exact match should supersede the First Name match for that person.
      finalMatches.push({
        status: 'linked',
        personId: c.person.id,
        personName: c.person.name,
        confidence: c.confidence,
        matchType: c.matchType,
        originalText: c.matchedText
      });
    }
  });

  // Process First Name Groups
  Object.keys(firstNameGroups).forEach(nameKey => {
    const candidates = firstNameGroups[nameKey];
    
    // Filter out candidates that are ALREADY matched by effective full name match
    // e.g. "John" found. "John Smith" was linked by Strategy A. 
    // "John Smith" is in candidates for "John". We don't need to suggest him again for "John".
    const validCandidates = candidates.filter(c => 
      !finalMatches.some(m => m.personId === c.person.id)
    );

    if (validCandidates.length === 1) {
      // Unique First Name! Auto-link (maybe with slightly lower confidence, but effective)
      // Upgrade confidence slightly if unique?
      finalMatches.push({
        status: 'linked', // Auto-link if unique? User said "Heavy reliance". Yes.
        personId: validCandidates[0].person.id,
        personName: validCandidates[0].person.name,
        confidence: 0.8, // Bumped from 0.6
        matchType: 'unique_first_name',
        originalText: nameKey
      });
    } else if (validCandidates.length > 1) {
      // Ambiguous "John"
      finalMatches.push({
        status: 'ambiguous',
        originalText: nameKey,
        candidates: validCandidates.map(vc => ({
          person: vc.person,
          confidence: vc.confidence,
          matchType: vc.matchType
        }))
      });
    }
  });

  // Split into AutoLinks and Suggestions
  const autoLinks = finalMatches
    .filter(m => m.status === 'linked')
    .map(m => ({
      personId: m.personId,
      personName: m.personName,
      confidence: m.confidence
    }));

  const suggestions = finalMatches
    .filter(m => m.status === 'ambiguous' || m.status === 'suggested')
    .map(m => ({
      originalText: m.originalText,
      status: m.status,
      candidates: m.candidates || []
    }));

  return { autoLinks, suggestions };
}

function updateMatch(map, person, confidence, matchType, matchedText) {
  // If person already matches, keep highest confidence
  if (map.has(person.id)) {
    const existing = map.get(person.id);
    if (confidence > existing.confidence) {
      map.set(person.id, { person, confidence, matchType, matchedText });
    }
  } else {
    map.set(person.id, { person, confidence, matchType, matchedText });
  }
}

export default useNERAnalysis;
