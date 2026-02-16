# Auto-Link People from Transcriptions Feature

**Date:** February 15, 2026  
**Status:** 📝 Spec  
**Type:** New Feature — Automation / Text Analysis

## Overview

Automatically scans the `transcription` text of archive items to identify names that match existing records in the **Related People** database. When matches are found, the system either automatically links the person to the item or flags potential matches for user review, significantly reducing manual tagging effort.

### Key Capabilities

- **Text Scanning** — Analyzes transcription text for potential names
- **Auto-Linking** — automatically adds `relatedPeopleIds` for high-confidence, unique matches
- **Ambiguity Detection** — Flags items where a name could match multiple people (e.g., "John Smith")
- **Review UI** — "Yellow Flag" indicator for items needing user attention
- **Batch Processing** — Scan existing items with transcriptions

## Architecture

### System Flow

```
┌────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Transcription │────▶│ NER / Name       │────▶│ Compare with        │
│  Updated       │     │ Extraction       │     │ Related People DB   │
└────────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                           │
                                          ┌────────────────▼────────────────┐
                                          ▼                                 ▼
                                  ┌──────────────┐                  ┌──────────────┐
                                  │ Unique Match │                  │ Ambiguous    │
                                  │ (Confidence) │                  │ or Multiple  │
                                  └───────┬──────┘                  └──────┬───────┘
                                          ▼                                ▼
                                  ┌──────────────┐                  ┌──────────────┐
                                  │ Auto-Link to │                  │ Set Warning  │
                                  │ Item         │                  │ Flag (⚠️)    │
                                  └──────────────┘                  └──────────────┘
```

### Data Model Changes

#### Updated Collection: `archiveItems`

Add fields to track auto-linking status and suggestions:

```javascript
{
  // ... existing fields ...
  
  // Status of auto-linking
  autoLinkStatus: 'pending' | 'completed' | 'review_required' | 'none',
  
  // Explains why review is required (e.g., "Ambiguous match for 'John'")
  autoLinkReason: string | null,
  
  // Potential matches that need user confirmation
  suggestedPeople: [
    {
      nameInText: string,      // "Uncle Bob"
      possibleMatches: [
        { personId: string, name: string, score: number }
      ]
    }
  ]
}
```

### Logic & Heuristics

#### Matching Algorithm
Leverage the existing `performLocalResolution` logic in `useNERAnalysis.js`, enhanced with:

1.  **Exact Match**: "Robert J. Smith" matches "Robert J. Smith" (High Confidence)
2.  **Nickname/Alias Match**: "Bob Smith" matches "Robert Smith" (Medium Confidence - requires alias DB or heuristic)
3.  **Context Match**: "Grandpa" matches person with tag "Grandfather" (Low Confidence, needs confirmation)

#### Auto-Link Rules
- **Link Immediately IF**:
    - Exact name match found.
    - AND only 1 candidate in Related People.
    - AND candidate is not already linked.
- **Flag for Review IF**:
    - Multiple candidates match the name (e.g., two "James Haggard"s).
    - Match is partial/fuzzy and confidence is below threshold.
    - Name appears in text but no match found (optional: "New Person" suggestion).

## UI Components

### 1. Item Card Indicator
- **Yellow Flag (⚠️)** icon on Archive Item cards in the grid view if `autoLinkStatus === 'review_required'`.
- Tooltip: "Transcription mentions people that need confirmation."

### 2. Item Detail Review Panel
- New section in `ItemDetailModal`: **"Suggested Links"**
- Lists found names and their potential matches.
- **Actions**:
    - "Confirm" (links the person)
    - "Select Correct Person" (if multiple options)
    - "Ignore" (dismisses suggestion)
    - "Create New Person"

### 3. Batch Action
- Admin/Dashboard button: **"Scan All Transcriptions"**
- Runs the analysis on all items with transcriptions that haven't been scanned recently.

#### Usage Example

**Scenario**: User uploads a letter.
**Transcription**: "...we visited Aunt Mary and cousin Philip Laurien in Chicago..."
**Related People DB**:
- "Mary Smith"
- "Mary Jones"
- "Philip Laurien"

**Outcome**:
- **Philip Laurien**: Exact unique match → **Auto-Linked**.
- **Aunt Mary**: Matches "Mary Smith" and "Mary Jones" → **Yellow Flag**.
    - User opens item, sees flag.
    - Clicks review.
    - System asks: "Who is 'Aunt Mary'?"
    - User selects "Mary Smith".

## Implementation Plan

### Stage 1: Logic & Hook Updates
- Update `useNERAnalysis.js` to return detailed match confidence objects.
- Create `analyzeTranscription(text, peopleList)` utility.

### Stage 2: Background Processing / Trigger
- Implement a listener or function that runs when `transcription` field changes.
- (Or client-side effect in `ItemFormModal` upon save).

### Stage 3: UI Integration
- Add Yellow Flag to `MediaGallery` / `AllItemsPage`.
- Build `SuggestedLinksPanel` component.
- Integrate into `ItemDetailModal`.

### Stage 4: Batch Scan
- Create "Scan All" functionality for existing items.

## Future Enhancements
- **Relationships**: Use "My Uncle" to filter candidates based on tree structure.
- **Alias Support**: Add `aliases` field to `relatedPeople` (e.g., "Bob", "Red").
- **Ignore List**: "Ignore 'George' in this item".

## Phase 2: Enhanced Transcription Matching & Reliability
**Goal**: Iterate on the matching algorithm to aggressively find and tag people mentioned in transcriptions, supporting multiple tags per item.

### Requirements
1.  **Heavy Reliance on Transcription**: Trust the text. If a name appears in the Related People list, and identifying text is in the transcription, match it.
2.  **Multi-Person Tagging**: Explicitly ensure `relatedPeopleIds` accumulates multiple distinct people found in the same text draft.
3.  **Improved Normalization**: Handle case-sensitivity, punctuation, and middle names more robustly to avoid missed matches.

---
**Spec Date:** February 15, 2026
**Version:** 1.0.0
