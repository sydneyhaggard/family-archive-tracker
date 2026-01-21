/**
 * Safely strip HTML tags from a string using DOM APIs
 * @param {string} html - The HTML string to strip
 * @returns {string} - Plain text without HTML tags
 */
export const stripHtml = (html) => {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
};

/**
 * Common compound surnames that should not be treated as duplicates
 * Add more as needed for your family database
 */
const KNOWN_COMPOUND_SURNAMES = [
  'Smith-Jones',
  'Lloyd-Jones',
  'Lloyd-George',
  'Norris-Jones',
  'Davies-Evans',
  'Williams-Thomas'
];

/**
 * Detect if a name has a duplicate last name pattern
 * @param {string} name - The full name to check
 * @returns {object} - { isDuplicate: boolean, isSuspicious: boolean, cleanedName: string, originalName: string }
 */
export const detectDuplicateLastName = (name) => {
  if (!name || typeof name !== 'string') {
    return { isDuplicate: false, isSuspicious: false, cleanedName: name, originalName: name };
  }

  const trimmedName = name.trim();
  const parts = trimmedName.split(/\s+/);
  
  // Need at least 2 parts to have a duplicate (e.g., "Smith Smith")
  if (parts.length < 2) {
    return { isDuplicate: false, isSuspicious: false, cleanedName: trimmedName, originalName: trimmedName };
  }

  const lastWord = parts[parts.length - 1];
  const secondLastWord = parts[parts.length - 2];

  // Check if last two words are identical (case-insensitive)
  const isDuplicate = lastWord.toLowerCase() === secondLastWord.toLowerCase();

  if (!isDuplicate) {
    return { isDuplicate: false, isSuspicious: false, cleanedName: trimmedName, originalName: trimmedName };
  }

  // Found a duplicate - now determine if it's suspicious (might be compound surname)
  let isSuspicious = false;

  // Check if it contains a hyphen (compound surname indicator)
  if (secondLastWord.includes('-') || lastWord.includes('-')) {
    isSuspicious = true;
  }

  // Check against known compound surnames
  const potentialCompound = `${secondLastWord}-${lastWord}`;
  if (KNOWN_COMPOUND_SURNAMES.some(known => known.toLowerCase() === potentialCompound.toLowerCase())) {
    isSuspicious = true;
  }

  // If only 2 words total (e.g., "Smith Smith"), less suspicious
  if (parts.length === 2) {
    isSuspicious = false;
  }

  // Create cleaned name by removing the last word
  const cleanedName = parts.slice(0, -1).join(' ');

  return {
    isDuplicate: true,
    isSuspicious,
    cleanedName,
    originalName: trimmedName
  };
};

/**
 * Clean a name by removing duplicate last name if present
 * @param {string} name - The full name to clean
 * @returns {string} - The cleaned name
 */
export const cleanDuplicateName = (name) => {
  const result = detectDuplicateLastName(name);
  return result.isDuplicate ? result.cleanedName : result.originalName;
};

/**
 * Update relationship arrays to clean duplicate names
 * @param {object} relationships - Object containing parents, siblings, spouses, children arrays
 * @returns {object} - Updated relationships object
 */
export const cleanRelationshipNames = (relationships) => {
  const cleanArray = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr.map(rel => ({
      ...rel,
      name: rel.name ? cleanDuplicateName(rel.name) : rel.name
    }));
  };

  return {
    parents: cleanArray(relationships.parents),
    siblings: cleanArray(relationships.siblings),
    spouses: cleanArray(relationships.spouses),
    children: cleanArray(relationships.children)
  };
};
