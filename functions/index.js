/**
 * Firebase Cloud Functions for Family Archive Tracker
 * 
 * These functions handle admin operations that require elevated privileges,
 * such as setting custom claims for user roles and AI content analysis.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

// Super admin email (first admin for bootstrapping)
// In production, set this via Firebase Functions config:
// firebase functions:config:set admin.email="your-email@example.com"
const SUPER_ADMIN_EMAIL = functions.config().admin?.email || null;

/**
 * Validates that the super admin email is configured
 * @throws {Error} if super admin email is not configured
 */
function validateSuperAdminConfig() {
  if (!SUPER_ADMIN_EMAIL) {
    console.warn('Super admin email not configured. Set it via: firebase functions:config:set admin.email="your-email@example.com"');
  }
}

// Validate config on cold start
validateSuperAdminConfig();

/**
 * addAdminRole - Callable function to grant admin privileges to a user
 * 
 * Requirements:
 * - Caller must be authenticated
 * - Caller must be either a super admin (by email) or already have admin claim
 * 
 * @param {Object} data - { email: string } - Email of user to make admin
 * @returns {Object} - { success: boolean, message: string }
 */
exports.addAdminRole = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to call this function.'
    );
  }

  const callerEmail = context.auth.token.email;
  const callerIsAdmin = context.auth.token.admin === true;
  const callerIsSuperAdmin = callerEmail === SUPER_ADMIN_EMAIL;

  // Verify caller has permission (must be admin or super admin)
  if (!callerIsAdmin && !callerIsSuperAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can grant admin privileges.'
    );
  }

  // Validate input
  const { email } = data;
  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email address is required.'
    );
  }

  try {
    // Get the user by email
    const user = await admin.auth().getUserByEmail(email);

    // Set custom claim
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    // Optionally update Firestore user document
    await admin.firestore().collection('users').doc(user.uid).set(
      { isAdmin: true, adminGrantedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    return {
      success: true,
      message: `Successfully granted admin privileges to ${email}`
    };
  } catch (error) {
    console.error('Error adding admin role:', error);

    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError(
        'not-found',
        `No user found with email: ${email}`
      );
    }

    throw new functions.https.HttpsError(
      'internal',
      `Failed to grant admin privileges: ${error.message}`
    );
  }
});

/**
 * removeAdminRole - Callable function to revoke admin privileges from a user
 * 
 * @param {Object} data - { email: string } - Email of user to remove admin from
 * @returns {Object} - { success: boolean, message: string }
 */
exports.removeAdminRole = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to call this function.'
    );
  }

  const callerEmail = context.auth.token.email;
  const callerIsAdmin = context.auth.token.admin === true;
  const callerIsSuperAdmin = callerEmail === SUPER_ADMIN_EMAIL;

  // Only super admin can remove admin rights
  if (!callerIsSuperAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only the super administrator can revoke admin privileges.'
    );
  }

  const { email } = data;
  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email address is required.'
    );
  }

  // Prevent removing super admin
  if (email === SUPER_ADMIN_EMAIL) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Cannot remove admin privileges from the super administrator.'
    );
  }

  try {
    const user = await admin.auth().getUserByEmail(email);

    // Remove custom claim
    await admin.auth().setCustomUserClaims(user.uid, { admin: false });

    // Update Firestore
    await admin.firestore().collection('users').doc(user.uid).set(
      { isAdmin: false, adminRevokedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    return {
      success: true,
      message: `Successfully revoked admin privileges from ${email}`
    };
  } catch (error) {
    console.error('Error removing admin role:', error);

    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError(
        'not-found',
        `No user found with email: ${email}`
      );
    }

    throw new functions.https.HttpsError(
      'internal',
      `Failed to revoke admin privileges: ${error.message}`
    );
  }
});

/**
 * onUserCreate - Trigger when a new user is created
 * Automatically grants admin to the first user (super admin) if configured
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  // If this is the super admin email, grant admin privileges
  if (user.email === SUPER_ADMIN_EMAIL) {
    try {
      await admin.auth().setCustomUserClaims(user.uid, { admin: true });
      await admin.firestore().collection('users').doc(user.uid).set(
        { 
          isAdmin: true, 
          isSuperAdmin: true,
          adminGrantedAt: admin.firestore.FieldValue.serverTimestamp() 
        },
        { merge: true }
      );
      console.log(`Super admin privileges granted to ${user.email}`);
    } catch (error) {
      console.error('Error granting super admin privileges:', error);
    }
  }
});

/**
 * analyzeContentNER - Callable function for Named Entity Recognition analysis
 * 
 * Uses Gemini API to analyze text/document content and extract entities:
 * - People names
 * - Dates
 * - Locations
 * - Summary
 * 
 * Also performs entity resolution against existing relatedPeople collection.
 * 
 * @param {Object} data - { content: string, imageUrl?: string, userId: string }
 * @returns {Object} - { suggestedPeople, suggestedDates, suggestedLocations, summary, matchedPeople, newPeople }
 */
exports.analyzeContentNER = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to use content analysis.'
    );
  }

  const { content, imageUrl, userId } = data;
  const callerUid = context.auth.uid;

  // Validate input
  if (!content && !imageUrl) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Either text content or image URL is required for analysis.'
    );
  }

  // Get Gemini API key from Functions config
  const GEMINI_API_KEY = functions.config().gemini?.apikey;
  
  if (!GEMINI_API_KEY) {
    console.error('Gemini API key not configured');
    throw new functions.https.HttpsError(
      'failed-precondition',
      'AI analysis is not configured. Please contact administrator.'
    );
  }

  try {
    // Build the Gemini API request with structured output
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    
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

    const requestBody = {
      contents: [{
        parts: [
          { text: systemPrompt },
          { text: userContent }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    };

    // If there's an image URL, we could add vision capability here
    // For now, we'll focus on text analysis

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

    // Parse the JSON response from Gemini
    let nerResults;
    try {
      const responseText = geminiResponse.candidates[0].content.parts[0].text;
      // Clean up any potential markdown formatting
      const cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      nerResults = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      console.error('Raw response:', geminiResponse.candidates[0].content.parts[0].text);
      // Return empty results instead of failing
      nerResults = {
        suggestedPeople: [],
        suggestedDates: [],
        suggestedLocations: [],
        summary: ''
      };
    }

    // Ensure all expected fields exist
    nerResults = {
      suggestedPeople: nerResults.suggestedPeople || [],
      suggestedDates: nerResults.suggestedDates || [],
      suggestedLocations: nerResults.suggestedLocations || [],
      summary: nerResults.summary || ''
    };

    // Entity Resolution: Match extracted names against existing relatedPeople
    const matchedPeople = [];
    const newPeople = [];

    if (nerResults.suggestedPeople.length > 0) {
      // Query the user's relatedPeople collection
      const relatedPeopleRef = admin.firestore()
        .collection('relatedPeople')
        .where('ownerId', '==', userId || callerUid);
      
      const snapshot = await relatedPeopleRef.get();
      const existingPeople = [];
      
      snapshot.forEach(doc => {
        existingPeople.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Match each suggested name against existing people
      for (const suggestedName of nerResults.suggestedPeople) {
        const normalizedSuggested = suggestedName.toLowerCase().trim();
        
        let matched = false;
        for (const person of existingPeople) {
          const normalizedExisting = (person.name || '').toLowerCase().trim();
          
          // Check for exact match or partial match
          if (normalizedExisting === normalizedSuggested) {
            // Exact match
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
          } else if (
            normalizedExisting.includes(normalizedSuggested) ||
            normalizedSuggested.includes(normalizedExisting)
          ) {
            // Partial match (e.g., "Aunt Susan" matches "Susan Smith")
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
          } else {
            // Check if any word in the name matches
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
        }
        
        if (!matched) {
          newPeople.push(suggestedName);
        }
      }
    }

    return {
      ...nerResults,
      matchedPeople,
      newPeople
    };

  } catch (error) {
    console.error('Error in analyzeContentNER:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Content analysis failed: ${error.message}`
    );
  }
});

/**
 * Helper function to detect duplicate last names
 * @param {string} name - The full name to check
 * @returns {object} - { isDuplicate: boolean, isSuspicious: boolean, cleanedName: string, originalName: string }
 */
function detectDuplicateLastName(name) {
  const KNOWN_COMPOUND_SURNAMES = [
    'Smith-Jones',
    'Lloyd-Jones',
    'Lloyd-George',
    'Norris-Jones',
    'Davies-Evans',
    'Williams-Thomas'
  ];

  if (!name || typeof name !== 'string') {
    return { isDuplicate: false, isSuspicious: false, cleanedName: name, originalName: name };
  }

  const trimmedName = name.trim();
  const parts = trimmedName.split(/\s+/);
  
  if (parts.length < 2) {
    return { isDuplicate: false, isSuspicious: false, cleanedName: trimmedName, originalName: trimmedName };
  }

  const lastWord = parts[parts.length - 1];
  const secondLastWord = parts[parts.length - 2];

  const isDuplicate = lastWord.toLowerCase() === secondLastWord.toLowerCase();

  if (!isDuplicate) {
    return { isDuplicate: false, isSuspicious: false, cleanedName: trimmedName, originalName: trimmedName };
  }

  let isSuspicious = false;

  if (secondLastWord.includes('-') || lastWord.includes('-')) {
    isSuspicious = true;
  }

  const potentialCompound = `${secondLastWord}-${lastWord}`;
  if (KNOWN_COMPOUND_SURNAMES.some(known => known.toLowerCase() === potentialCompound.toLowerCase())) {
    isSuspicious = true;
  }

  if (parts.length === 2) {
    isSuspicious = false;
  }

  const cleanedName = parts.slice(0, -1).join(' ');

  return {
    isDuplicate: true,
    isSuspicious,
    cleanedName,
    originalName: trimmedName
  };
}

/**
 * Helper function to clean duplicate names in relationship arrays
 * @param {object} relationships - Object containing parents, siblings, spouses, children arrays
 * @returns {object} - Updated relationships object
 */
function cleanRelationshipNames(relationships) {
  const cleanArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(rel => {
      const detection = detectDuplicateLastName(rel.name);
      return {
        ...rel,
        name: detection.isDuplicate ? detection.cleanedName : rel.name
      };
    });
  };

  return {
    parents: cleanArray(relationships.parents || []),
    siblings: cleanArray(relationships.siblings || []),
    spouses: cleanArray(relationships.spouses || []),
    children: cleanArray(relationships.children || [])
  };
}

/**
 * cleanDuplicateLastNames - Callable function to clean duplicate last names
 * 
 * Requirements:
 * - Caller must be authenticated
 * - Caller must be admin
 * - Optionally provide specific personIds to clean, or clean all for the user
 * 
 * @param {Object} data - { 
 *   personIds: string[] (optional) - Specific person IDs to clean
 *   ownerId: string (optional) - Owner ID to clean (defaults to caller)
 *   autoApprove: boolean (optional) - Auto-approve non-suspicious changes
 * }
 * @returns {Object} - { 
 *   totalProcessed: number, 
 *   totalCleaned: number,
 *   suspiciousCases: array,
 *   cleanedCases: array,
 *   errors: array
 * }
 */
exports.cleanDuplicateLastNames = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to call this function.'
    );
  }

  // Verify admin status
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can clean duplicate names.'
    );
  }

  const { personIds, ownerId, autoApprove = true } = data;
  const targetOwnerId = ownerId || context.auth.uid;
  
  console.log(`Starting duplicate name cleanup for owner: ${targetOwnerId}`);
  
  try {
    const db = admin.firestore();
    const relatedPeopleRef = db.collection('relatedPeople');
    
    // Build query
    let query = relatedPeopleRef.where('ownerId', '==', targetOwnerId);
    
    // If specific person IDs provided, we'll filter after fetch
    const snapshot = await query.get();
    
    console.log(`Found ${snapshot.size} total people for owner`);
    
    const results = {
      totalProcessed: 0,
      totalCleaned: 0,
      suspiciousCases: [],
      cleanedCases: [],
      errors: []
    };
    
    const updates = [];
    
    // Process each person
    for (const doc of snapshot.docs) {
      const personData = doc.data();
      const personId = doc.id;
      
      // If specific IDs provided, filter
      if (personIds && Array.isArray(personIds) && !personIds.includes(personId)) {
        continue;
      }
      
      results.totalProcessed++;
      
      try {
        const nameDetection = detectDuplicateLastName(personData.name);
        
        if (!nameDetection.isDuplicate) {
          continue; // No duplicate found
        }
        
        const caseInfo = {
          personId,
          originalName: nameDetection.originalName,
          cleanedName: nameDetection.cleanedName,
          isSuspicious: nameDetection.isSuspicious
        };
        
        // If suspicious and not auto-approving, add to review list
        if (nameDetection.isSuspicious && !autoApprove) {
          results.suspiciousCases.push(caseInfo);
          console.log(`Suspicious case flagged: ${nameDetection.originalName}`);
          continue;
        }
        
        // Clean the main name and relationship arrays
        const cleanedRelationships = cleanRelationshipNames({
          parents: personData.parents || [],
          siblings: personData.siblings || [],
          spouses: personData.spouses || [],
          children: personData.children || []
        });
        
        // Prepare update
        const updateData = {
          name: nameDetection.cleanedName,
          parents: cleanedRelationships.parents,
          siblings: cleanedRelationships.siblings,
          spouses: cleanedRelationships.spouses,
          children: cleanedRelationships.children,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        updates.push({
          ref: doc.ref,
          data: updateData,
          caseInfo
        });
        
      } catch (error) {
        console.error(`Error processing person ${personId}:`, error);
        results.errors.push({
          personId,
          name: personData.name,
          error: error.message
        });
      }
    }
    
    // Execute batch updates (max 450 per batch to stay under 500 limit)
    const batchSize = 450;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = db.batch();
      const batchUpdates = updates.slice(i, i + batchSize);
      
      for (const update of batchUpdates) {
        batch.update(update.ref, update.data);
        results.cleanedCases.push(update.caseInfo);
      }
      
      await batch.commit();
      console.log(`Committed batch ${Math.floor(i / batchSize) + 1}, ${batchUpdates.length} updates`);
    }
    
    results.totalCleaned = updates.length;
    
    console.log(`Cleanup complete. Processed: ${results.totalProcessed}, Cleaned: ${results.totalCleaned}, Suspicious: ${results.suspiciousCases.length}, Errors: ${results.errors.length}`);
    
    return results;
    
  } catch (error) {
    console.error('Error in cleanDuplicateLastNames:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Name cleanup failed: ${error.message}`
    );
  }
});

/**
 * analyzeNamesForDuplicates - Callable function to analyze names without making changes
 * 
 * Returns a report of all duplicate names found, categorized by suspicious/non-suspicious
 * 
 * @param {Object} data - { ownerId: string (optional) }
 * @returns {Object} - { duplicates: array, suspicious: array, clean: number }
 */
exports.analyzeNamesForDuplicates = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to call this function.'
    );
  }

  const { ownerId } = data;
  const targetOwnerId = ownerId || context.auth.uid;
  
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('relatedPeople')
      .where('ownerId', '==', targetOwnerId)
      .get();
    
    const duplicates = [];
    const suspicious = [];
    let cleanCount = 0;
    
    snapshot.forEach(doc => {
      const personData = doc.data();
      const detection = detectDuplicateLastName(personData.name);
      
      if (detection.isDuplicate) {
        const info = {
          personId: doc.id,
          originalName: detection.originalName,
          cleanedName: detection.cleanedName,
          isSuspicious: detection.isSuspicious
        };
        
        duplicates.push(info);
        if (detection.isSuspicious) {
          suspicious.push(info);
        }
      } else {
        cleanCount++;
      }
    });
    
    return {
      total: snapshot.size,
      duplicates,
      suspicious,
      clean: cleanCount
    };
    
  } catch (error) {
    console.error('Error in analyzeNamesForDuplicates:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Name analysis failed: ${error.message}`
    );
  }
});
