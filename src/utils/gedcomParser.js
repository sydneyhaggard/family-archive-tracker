/**
 * GEDCOM Parser Utility
 * Parses .ged files and extracts individual records for import into relatedPeople collection
 */

/**
 * Parse a GEDCOM file content and extract individual records
 * @param {string} fileContent - The raw content of the GEDCOM file
 * @returns {Object[]} - Array of parsed person objects
 */
export function parseGedcom(fileContent) {
  const lines = fileContent.split(/\r?\n/);
  const individuals = [];
  const families = [];
  let currentIndividual = null;
  let currentFamily = null;
  let currentSection = null;
  let currentLevel = 0;
  let recordType = null; // 'INDI' or 'FAM'
  let currentResidence = null;
  let currentMilitary = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse GEDCOM line format: LEVEL TAG [VALUE] or LEVEL @ID@ TAG
    const match = line.match(/^(\d+)\s+(@\S+@|\S+)\s*(.*)?$/);
    if (!match) continue;

    const level = parseInt(match[1], 10);
    const tag = match[2];
    const value = match[3] || '';

    // Handle record starts at level 0
    if (level === 0) {
      // Save previous records
      if (currentIndividual && currentIndividual.id) {
        // Save any pending residence or military records
        if (currentResidence && currentResidence.location) {
          currentIndividual.residences.push(currentResidence);
        }
        if (currentMilitary && (currentMilitary.rank || currentMilitary.company)) {
          currentIndividual.militaryService.push(currentMilitary);
        }
        individuals.push(currentIndividual);
      }
      if (currentFamily && currentFamily.id) {
        families.push(currentFamily);
      }

      currentIndividual = null;
      currentFamily = null;
      currentSection = null;
      recordType = null;
      currentResidence = null;
      currentMilitary = null;

      // Check if this is a new individual record
      if (value.toUpperCase() === 'INDI') {
        recordType = 'INDI';
        currentIndividual = {
          id: tag.replace(/@/g, ''),
          name: '',
          birthDate: '',
          birthYear: null,
          birthLocation: '',
          deathDate: '',
          deathLocation: '',
          burialDate: '',
          burialLocation: '',
          marriageDate: '',
          marriageLocation: '',
          sex: '',
          description: '',
          notes: [],
          familySpouseIds: [],  // FAM records where this person is a spouse
          familyChildId: null,   // FAM record where this person is a child
          residences: [],        // Array of residence records
          militaryService: [],   // Array of military service records
          sources: []            // Array of source citations
        };
      } 
      // Check if this is a family record
      else if (value.toUpperCase() === 'FAM') {
        recordType = 'FAM';
        currentFamily = {
          id: tag.replace(/@/g, ''),
          husbandId: null,
          wifeId: null,
          childIds: [],          // Children in this family
          marriageDate: '',
          marriageLocation: ''
        };
      }
    } 
    // Handle INDI record fields
    else if (recordType === 'INDI' && currentIndividual) {
      currentLevel = level;

      switch (tag.toUpperCase()) {
        case 'NAME':
          // Parse name - remove slashes around surname
          currentIndividual.name = value.replace(/\//g, '').trim();
          currentSection = 'NAME';
          break;

        case 'GIVN':
          // Given name (first name)
          if (currentSection === 'NAME' && value) {
            // Only use if we don't have a name yet
            if (!currentIndividual.name) {
              currentIndividual.name = value;
            }
          }
          break;

        case 'SURN':
          // Surname
          if (currentSection === 'NAME' && value) {
            currentIndividual.name = currentIndividual.name 
              ? `${currentIndividual.name} ${value}`
              : value;
          }
          break;

        case 'BIRT':
          currentSection = 'BIRT';
          break;

        case 'DEAT':
          currentSection = 'DEAT';
          break;

        case 'BURI':
          currentSection = 'BURI';
          break;

        case 'RESI':
          // Save previous residence if exists
          if (currentResidence && currentResidence.location) {
            currentIndividual.residences.push(currentResidence);
          }
          currentResidence = { location: '', startDate: '', endDate: '' };
          currentSection = 'RESI';
          break;

        case '_MILI':
        case 'MILI':
          // Save previous military record if exists
          if (currentMilitary && (currentMilitary.rank || currentMilitary.company)) {
            currentIndividual.militaryService.push(currentMilitary);
          }
          currentMilitary = { enlistmentDate: '', dischargeDate: '', rank: '', company: '', branch: '', notes: '' };
          currentSection = 'MILI';
          break;

        case 'DATE':
          if (currentSection === 'BIRT' && value) {
            currentIndividual.birthDate = normalizeDate(value);
            currentIndividual.birthYear = extractYear(value);
          } else if (currentSection === 'DEAT' && value) {
            currentIndividual.deathDate = normalizeDate(value);
          } else if (currentSection === 'BURI' && value) {
            currentIndividual.burialDate = normalizeDate(value);
          } else if (currentSection === 'MARR' && value) {
            currentIndividual.marriageDate = normalizeDate(value);
          } else if (currentSection === 'RESI' && currentResidence && value) {
            currentResidence.startDate = normalizeDate(value);
          } else if (currentSection === 'MILI' && currentMilitary && value) {
            currentMilitary.enlistmentDate = normalizeDate(value);
          }
          break;

        case 'PLAC':
          // Place for birth, death, burial, marriage, or residence
          if (currentSection === 'BIRT' && value) {
            currentIndividual.birthLocation = value;
          } else if (currentSection === 'DEAT' && value) {
            currentIndividual.deathLocation = value;
          } else if (currentSection === 'BURI' && value) {
            currentIndividual.burialLocation = value;
          } else if (currentSection === 'MARR' && value) {
            currentIndividual.marriageLocation = value;
          } else if (currentSection === 'RESI' && currentResidence && value) {
            currentResidence.location = value;
          }
          break;

        case 'MARR':
          currentSection = 'MARR';
          break;

        case 'NOTE':
          if (value) {
            currentIndividual.notes.push(value);
          }
          currentSection = 'NOTE';
          break;

        case 'CONT':
        case 'CONC':
          // Continuation of previous text
          if (currentSection === 'NOTE' && value) {
            const lastNoteIndex = currentIndividual.notes.length - 1;
            if (lastNoteIndex >= 0) {
              currentIndividual.notes[lastNoteIndex] += (tag === 'CONT' ? '\n' : '') + value;
            }
          }
          break;

        case 'OCCU':
          // Occupation - add to notes
          if (value) {
            currentIndividual.notes.push(`Occupation: ${value}`);
          }
          break;

        case 'SEX':
          // Gender
          if (value) {
            currentIndividual.sex = value.toUpperCase();
          }
          break;

        case 'FAMS':
          // Link to family where this person is a spouse
          if (value) {
            const famId = value.replace(/@/g, '');
            currentIndividual.familySpouseIds.push(famId);
          }
          break;

        case 'FAMC':
          // Family where this person is a child (for parent relationships)
          if (value) {
            currentIndividual.familyChildId = value.replace(/@/g, '');
          }
          break;

        case 'CORP':
        case '_CORP':
          // Military company/unit
          if (currentSection === 'MILI' && currentMilitary && value) {
            currentMilitary.company = value;
          }
          break;

        case 'RANK':
        case '_RANK':
          // Military rank
          if (currentSection === 'MILI' && currentMilitary && value) {
            currentMilitary.rank = value;
          }
          break;

        case 'SOUR':
          // Source citation
          if (value) {
            currentIndividual.sources.push(value.replace(/@/g, ''));
          }
          break;

        default:
          // Reset section if we're at a new level 1 tag
          if (level === 1 && !['CONT', 'CONC'].includes(tag.toUpperCase())) {
            currentSection = null;
          }
          break;
      }
    }
    // Handle FAM record fields
    else if (recordType === 'FAM' && currentFamily) {
      switch (tag.toUpperCase()) {
        case 'HUSB':
          if (value) {
            currentFamily.husbandId = value.replace(/@/g, '');
          }
          break;

        case 'WIFE':
          if (value) {
            currentFamily.wifeId = value.replace(/@/g, '');
          }
          break;

        case 'CHIL':
          // Child in this family
          if (value) {
            currentFamily.childIds.push(value.replace(/@/g, ''));
          }
          break;

        case 'MARR':
          currentSection = 'MARR';
          break;

        case 'DATE':
          if (currentSection === 'MARR' && value) {
            currentFamily.marriageDate = normalizeDate(value);
          }
          break;

        case 'PLAC':
          if (currentSection === 'MARR' && value) {
            currentFamily.marriageLocation = value;
          }
          break;

        default:
          if (level === 1) {
            currentSection = null;
          }
          break;
      }
    }
  }

  // Don't forget the last records
  if (currentIndividual && currentIndividual.id) {
    // Save any pending residence or military records
    if (currentResidence && currentResidence.location) {
      currentIndividual.residences.push(currentResidence);
    }
    if (currentMilitary && (currentMilitary.rank || currentMilitary.company)) {
      currentIndividual.militaryService.push(currentMilitary);
    }
    individuals.push(currentIndividual);
  }
  if (currentFamily && currentFamily.id) {
    families.push(currentFamily);
  }

  // Create a map for quick family lookup
  const familyMap = new Map();
  families.forEach(fam => {
    familyMap.set(fam.id, fam);
  });

  // Create a map for quick individual lookup by GEDCOM ID
  const individualMap = new Map();
  individuals.forEach(ind => {
    individualMap.set(ind.id, ind);
  });

  // Post-process individuals - build relationships and link marriage data
  return individuals.map(person => {
    // Combine notes into description
    let description = '';
    
    if (person.sex) {
      description += `Gender: ${person.sex === 'M' ? 'Male' : person.sex === 'F' ? 'Female' : person.sex}. `;
    }
    
    if (person.notes.length > 0) {
      description += person.notes.join(' ');
    }

    // Get marriage info from linked FAM records
    let marriageDate = person.marriageDate || '';
    let marriageLocation = person.marriageLocation || '';
    
    // Build spouses array from FAM records
    const spouses = [];
    for (const famId of person.familySpouseIds || []) {
      const family = familyMap.get(famId);
      if (family) {
        // Use the first marriage info we find
        if (!marriageDate && family.marriageDate) {
          marriageDate = family.marriageDate;
        }
        if (!marriageLocation && family.marriageLocation) {
          marriageLocation = family.marriageLocation;
        }
        
        // Find the spouse
        const spouseGedcomId = family.husbandId === person.id ? family.wifeId : family.husbandId;
        if (spouseGedcomId) {
          const spouseRecord = individualMap.get(spouseGedcomId);
          spouses.push({
            gedcomId: spouseGedcomId,
            name: spouseRecord ? spouseRecord.name : 'Unknown',
            birthDate: spouseRecord?.birthDate || '',
            deathDate: spouseRecord?.deathDate || '',
            marriageDate: family.marriageDate || '',
            marriageLocation: family.marriageLocation || ''
          });
        }
      }
    }

    // Build parents and siblings arrays from FAMC (family as child)
    const parents = [];
    const siblings = [];
    if (person.familyChildId) {
      const family = familyMap.get(person.familyChildId);
      if (family) {
        // Add father
        if (family.husbandId) {
          const fatherRecord = individualMap.get(family.husbandId);
          parents.push({
            gedcomId: family.husbandId,
            name: fatherRecord ? fatherRecord.name : 'Unknown Father',
            birthDate: fatherRecord?.birthDate || '',
            birthLocation: fatherRecord?.birthLocation || '',
            deathDate: fatherRecord?.deathDate || '',
            deathLocation: fatherRecord?.deathLocation || '',
            burialDate: fatherRecord?.burialDate || '',
            burialLocation: fatherRecord?.burialLocation || '',
            parentalStatus: 'biological'
          });
        }
        // Add mother
        if (family.wifeId) {
          const motherRecord = individualMap.get(family.wifeId);
          parents.push({
            gedcomId: family.wifeId,
            name: motherRecord ? motherRecord.name : 'Unknown Mother',
            birthDate: motherRecord?.birthDate || '',
            birthLocation: motherRecord?.birthLocation || '',
            deathDate: motherRecord?.deathDate || '',
            deathLocation: motherRecord?.deathLocation || '',
            burialDate: motherRecord?.burialDate || '',
            burialLocation: motherRecord?.burialLocation || '',
            parentalStatus: 'biological'
          });
        }
        // Add siblings (other children in the same family)
        for (const childId of family.childIds || []) {
          if (childId !== person.id) {
            const siblingRecord = individualMap.get(childId);
            siblings.push({
              gedcomId: childId,
              name: siblingRecord ? siblingRecord.name : 'Unknown Sibling',
              birthDate: siblingRecord?.birthDate || '',
              birthLocation: siblingRecord?.birthLocation || '',
              deathDate: siblingRecord?.deathDate || '',
              deathLocation: siblingRecord?.deathLocation || ''
            });
          }
        }
      }
    }

    return {
      gedcomId: person.id,
      name: person.name || 'Unknown',
      birthDate: person.birthDate || '',
      birthYear: person.birthYear,
      birthLocation: person.birthLocation || '',
      deathDate: person.deathDate || '',
      deathLocation: person.deathLocation || '',
      burialDate: person.burialDate || '',
      burialLocation: person.burialLocation || '',
      marriageDate: marriageDate,
      marriageLocation: marriageLocation,
      description: description.trim(),
      parents: parents,
      siblings: siblings,
      spouses: spouses,
      residences: person.residences || [],
      militaryService: person.militaryService || [],
      sources: person.sources || []
    };
  }).filter(person => person.name && person.name !== 'Unknown');
}

/**
 * Normalize a GEDCOM date string to ISO format when possible
 * @param {string} dateStr - GEDCOM date string (e.g., "15 JAN 1920", "ABT 1920", "BET 1920 AND 1925")
 * @returns {string} - Normalized date string
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  
  const monthMap = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
    'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
    'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };

  // Remove modifiers like ABT, BEF, AFT, etc.
  let cleaned = dateStr.toUpperCase()
    .replace(/^(ABT|ABOUT|CIRCA|CA|C\.?|BEF|BEFORE|AFT|AFTER|EST|ESTIMATED)\s*/gi, '')
    .replace(/^(BET|BETWEEN)\s+.*\s+(AND)\s+/gi, '')
    .trim();

  // Try to parse "DD MMM YYYY" format
  const fullMatch = cleaned.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
  if (fullMatch) {
    const day = fullMatch[1].padStart(2, '0');
    const month = monthMap[fullMatch[2]] || '01';
    const year = fullMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try to parse "MMM YYYY" format
  const monthYearMatch = cleaned.match(/^([A-Z]{3})\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = monthMap[monthYearMatch[1]] || '01';
    const year = monthYearMatch[2];
    return `${year}-${month}`;
  }

  // Try to parse just year
  const yearMatch = cleaned.match(/^(\d{4})$/);
  if (yearMatch) {
    return yearMatch[1];
  }

  // Return original if can't parse
  return dateStr;
}

/**
 * Extract year from a GEDCOM date string
 * @param {string} dateStr - GEDCOM date string
 * @returns {number|null} - Year as number or null
 */
function extractYear(dateStr) {
  if (!dateStr) return null;
  
  const yearMatch = dateStr.match(/(\d{4})/);
  return yearMatch ? parseInt(yearMatch[1], 10) : null;
}

/**
 * Read a GEDCOM file and parse its contents
 * @param {File} file - File object from input
 * @returns {Promise<Object[]>} - Array of parsed person objects
 */
export async function parseGedcomFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const people = parseGedcom(content);
        resolve(people);
      } catch (error) {
        reject(new Error(`Failed to parse GEDCOM file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    // GEDCOM files can be in various encodings, try UTF-8 first
    reader.readAsText(file, 'UTF-8');
  });
}
