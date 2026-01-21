# Search Improvements

## Description

Enhance the current search functionality with global search across all entities, advanced filtering, and full-text search capabilities for better content discovery.

## Current State

- Basic search exists on specific pages (All Items, Related People)
- Search is client-side only (filters loaded data)
- Limited to exact/substring matching
- No cross-entity search
- No search history or suggestions

## Proposed Features

### Global Search
- **Unified search bar** in header that searches across:
  - Archive items (title, description, transcription)
  - Related people (name, description)
  - Archive events (title, description)
  - Sources (title, citation details)
  - Cookbooks & recipes
- **Results grouped by type** with counts for each category
- **Keyboard shortcut** (Cmd/Ctrl + K) to focus search
- **Recent searches** dropdown when clicking search box

### Advanced Search
- **Field-specific search**:
  - Search only titles, only descriptions, or only transcriptions
  - Search by date range
  - Search by category/type
  - Search by person linked
  - Search by tags
- **Boolean operators**: AND, OR, NOT
- **Phrase search**: Exact matches with quotes "family reunion"
- **Wildcard search**: Use * for partial matches (e.g., "Smit*" finds Smith, Smithson)
- **Saved searches**: Save complex queries for reuse

### Search Results Page
- **Relevance sorting**: Most relevant results first
- **Faceted filtering**: Refine by category, date, person, tags
- **Preview snippets**: Show matched text with highlighting
- **Quick actions**: Edit, delete, share from results
- **Results count**: "Found 24 items, 7 people, 3 events"
- **Pagination**: Handle large result sets

### Smart Features
- **Fuzzy matching**: Find "Haggard" when user types "Hagard"
- **Synonym expansion**: Search "photo" finds "picture", "image"
- **Auto-complete**: Suggest queries as user types
- **Did you mean?**: Suggest corrections for typos
- **Related suggestions**: "People who searched this also looked at..."

### Search Filters
- **Date range picker**: Find items from specific time periods
- **Person selector**: Filter by linked people
- **Location filter**: Search by birth/death/residence locations
- **Has attachments**: Filter for items with files
- **Incomplete items**: Find items missing description, dates, etc.

## Technical Implementation

### Option 1: Client-Side (Current)
**Pros**: Simple, no additional costs, works offline
**Cons**: Slow with large datasets, limited features, loads all data

```javascript
// Enhanced client-side search with Fuse.js
import Fuse from 'fuse.js';

const fuse = new Fuse(items, {
  keys: ['title', 'description', 'transcription'],
  threshold: 0.3, // Fuzzy matching
  includeScore: true
});

const results = fuse.search(query);
```

### Option 2: Algolia (Recommended)
**Pros**: Fast, powerful, typo-tolerance, faceting, analytics
**Cons**: $1/month for 10k records, requires indexing

```javascript
// Algolia setup
import algoliasearch from 'algoliasearch';

const client = algoliasearch('APP_ID', 'API_KEY');
const index = client.initIndex('archiveItems');

// Search with filters
const { hits } = await index.search(query, {
  filters: 'category:Photos AND date > 1990',
  facets: ['category', 'tags']
});
```

### Option 3: Typesense (Self-hosted)
**Pros**: Open source, fast, no per-record pricing, privacy
**Cons**: Requires hosting, setup complexity

```javascript
// Typesense search
const searchResults = await client
  .collections('archiveItems')
  .documents()
  .search({
    q: query,
    query_by: 'title,description,transcription',
    filter_by: 'category:=[Photos,Documents]',
    sort_by: 'date:desc'
  });
```

### Option 4: Firestore Composite Indexes
**Pros**: No extra service, uses existing data
**Cons**: Limited full-text search, complex queries expensive

Keep for now, but consider upgrading when collection grows beyond 500-1000 items.

### Indexing Strategy
- **Sync on write**: Update search index when items created/updated
- **Cloud Function triggers**: Auto-index on Firestore changes
- **Batch reindex**: Manual command to rebuild entire index
- **Incremental updates**: Only sync changed records

## User Stories

1. As a user, I want to find all photos of "Grandma Mary" across items and people
2. As a researcher, I want to search "military service 1944" and find relevant documents
3. As an organizer, I want to find all items missing descriptions to complete them
4. As a user, I want to save "incomplete items" search and check it weekly

## UI Examples

### Global Search Bar
```
┌──────────────────────────────────────────────┐
│ 🔍  Search everywhere... (Cmd+K)            │
└──────────────────────────────────────────────┘

Recent searches:
• Grandma Mary photos
• Military records 1944
• Items without descriptions
```

### Search Results Page
```
Found 31 results for "wedding"

Archive Items (12)
[Photo] John & Mary's Wedding - June 15, 1955
  ... beautiful **wedding** ceremony at St. Mary's Church...
[Document] Wedding Invitation
  ... cordially invited to the **wedding** of John Smith...

People (3)
Mary Smith (née Johnson)
  Marriage date: June 15, 1955 | Spouse: John Smith

Events (2)
Smith-Johnson Wedding
  June 15, 1955 | St. Mary's Church, Chicago
```

### Advanced Search Form
```
╔═══════════════════════════════════════════╗
║ Advanced Search                           ║
╟───────────────────────────────────────────╢
║ Keywords: [________________]              ║
║ In: [✓] Title [✓] Description [ ] Tags   ║
║                                           ║
║ Date Range: [1950] to [1960]             ║
║                                           ║
║ Category: [All ▼]                         ║
║ Linked People: [Select... ▼]             ║
║                                           ║
║ [Search] [Reset] [Save Search]           ║
╚═══════════════════════════════════════════╝
```

## Priority

**High Impact, Medium-High Complexity**

Search is fundamental to usability. As the archive grows, finding specific items becomes critical. Consider starting with improved client-side search (Fuse.js), then migrate to Algolia/Typesense when needed.

## Implementation Phases

### Phase 1: Enhanced Client-Side (Quick Win)
- Add Fuse.js for fuzzy matching
- Global search across all loaded entities
- Keyboard shortcut (Cmd+K)
- Search history in localStorage

### Phase 2: Search Results Page
- Dedicated results page with all entities
- Grouped results by type
- Preview snippets with highlighting
- Advanced filters sidebar

### Phase 3: External Search Service
- Evaluate Algolia vs Typesense based on collection size
- Set up indexing pipeline
- Migrate to external search
- Add analytics dashboard

## Dependencies

- All entity collections (✅ implemented)
- Header component (✅ implemented)

## Future Enhancements

- Visual search (upload image to find similar)
- Voice search (speak queries)
- Search within files (OCR/transcription search)
- Natural language queries ("photos from the 1960s with Grandma")
- ML-powered relevance tuning
- Search result clustering
