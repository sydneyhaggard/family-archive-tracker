# Timeline View

## Description

Create a chronological timeline that integrates life events (births, deaths, marriages, residences, military service) with archive items, showing the story of the family across generations.

## Current State

- Archive items have dates but no unified timeline view
- Related People have birth/death dates, marriage dates, residences, military service
- Archive Events exist with date ranges
- No visual representation of chronology

## Proposed Features

### Main Timeline Display
- **Horizontal scrolling timeline** with zoom levels (decade, year, month)
- **Swim lanes**: Separate lanes for different people or categories
- **Event markers**: Icons for births (🎂), deaths (✝️), marriages (💒), military service (⚔️)
- **Archive items**: Show items on timeline at their creation/capture dates
- **Event blocks**: Display archive events as date range blocks

### Filtering & Navigation
- **Date range selector**: Jump to specific years or decades
- **Person filter**: Show timeline for one person or family branch
- **Category filter**: Show only photos, documents, or specific item types
- **Search on timeline**: Find events by keyword and highlight on timeline

### Interactive Features
- **Hover previews**: Thumbnail and basic info on hover
- **Click to open**: Click event to open detail modal
- **Add from timeline**: Right-click empty space to add new event at that date
- **Drag to reorder**: Adjust item dates directly on timeline

### Views
- **Personal timeline**: Focus on one person's life with all linked items
- **Family timeline**: Multiple people on separate swim lanes
- **Archive timeline**: All items chronologically
- **Event-centric timeline**: Show events with linked items nested

## Technical Implementation

### Libraries
- **vis-timeline**: React component for interactive timelines
- **react-chrono**: Modern timeline component with multiple layouts
- **react-vertical-timeline-component**: Clean vertical timeline
- **Custom D3.js**: Maximum flexibility for complex requirements

### Data Aggregation
```javascript
// Aggregate events from multiple sources
const timelineEvents = [
  ...people.map(p => ({
    type: 'birth',
    date: p.birthDate,
    person: p,
    label: `${p.name} born`
  })),
  ...archiveItems.map(item => ({
    type: 'item',
    date: item.date || item.createdAt,
    item: item,
    label: item.title
  })),
  ...archiveEvents.map(event => ({
    type: 'event',
    dateStart: event.dateStart,
    dateEnd: event.dateEnd,
    event: event,
    label: event.title
  }))
];
```

### Date Handling
- Support partial dates (year only, year-month)
- Handle BCE dates for ancient family histories
- Show "circa" or "before/after" for uncertain dates
- Group items by decade when exact date unknown

### Performance
- Virtualized scrolling for timelines with 1000+ events
- Lazy load event details
- Throttle zoom/pan calculations
- Index events by date for quick filtering

## User Stories

1. As a user, I want to see my grandfather's military service alongside photos from that era
2. As a genealogist, I want to identify time gaps in my archive coverage
3. As a family historian, I want to create a visual presentation of our family's journey
4. As a researcher, I want to see which relatives were alive at the same time

## Example Use Cases

### Personal Life Story
Display one person's complete life with milestones:
- Birth → School years → Marriage → Children born → Career → Death
- Intersperse with photos, letters, and documents from each period

### Family Migration Journey
Show family movement across generations:
- Original homeland → Immigration event → First residence in new country
- Include ship manifests, naturalization papers, residence records

### Multi-generational Context
View what multiple family members were doing simultaneously:
- 1944: Grandfather serving in WWII, Grandmother working in factory, Great-aunt writing letters home

## UI Mockup Ideas

### Horizontal Timeline (Recommended)
```
[1900]----[1920]----[1940]----[1960]----[1980]----[2000]----[2020]
  |         |          |         |         |         |
 🎂John   💒Marriage ⚔️Service  🎂Jane   ✝️John   📷Photo
```

### Vertical Timeline (Mobile-friendly)
```
2020 │ 📷 Family reunion photo
     │
2010 │ 📄 Grandfather's obituary
     │
2000 │ 🎂 Jane Smith born
     │
1990 │ 💒 John & Mary married
```

## Priority

**High Impact, Medium Complexity**

Provides strong narrative value and helps users understand context. Complements family tree by showing *when* things happened, not just *who*.

## Dependencies

- Archive Items (✅ implemented)
- Related People (✅ implemented)
- Archive Events (✅ implemented)
- Date fields on all entities (✅ implemented)

## Future Enhancements

- Historical context layer (major world events, cultural moments)
- Weather/season indicators for outdoor photos
- Location map view synced with timeline
- Automatic story generation from timeline data
- Export timeline as video or animated presentation
