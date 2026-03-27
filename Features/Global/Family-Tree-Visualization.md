# Family Tree Visualization

## Description

Create an interactive, visual family tree that displays the relationships between people in the Related People collection. Users can navigate through generations, click on individuals to view their profiles, and see the entire family structure at a glance.

## Current State

- GEDCOM import functionality exists and parses family relationships
- Relationship data (parents, siblings, spouses, children) is stored in the `relatedPeople` collection
- Person detail modal shows relationships as text lists with links

## Proposed Features

### Interactive Tree Display
- **Visual tree layout**: Hierarchical display showing multiple generations
- **Click to navigate**: Click on any person node to view their detail modal
- **Expand/collapse branches**: Hide/show specific family branches for clarity
- **Pan and zoom**: Navigate large family trees smoothly
- **Highlight paths**: Show the connection between two selected people

### Layout Options
- **Ancestor tree**: Traditional upward tree showing ancestors
- **Descendant tree**: Downward tree showing descendants
- **Hourglass view**: Combined ancestor and descendant view centered on one person
- **Horizontal/vertical orientation**: User preference

### Node Information
- **Photo thumbnails**: Show profile photos on tree nodes (or initials)
- **Birth/death years**: Display dates under names
- **Relationship labels**: Show how people are related (spouse, child, etc.)
- **Visual indicators**: Icons for living vs. deceased, incomplete data

### Additional Features
- **Search within tree**: Find a person and center the view on them
- **Print tree view**: Generate printable family tree charts
- **Export as image**: Save tree as PNG/PDF
- **Link to archive items**: Show count of linked items on each node

## Technical Implementation

### Recommended Libraries
- **d3.js**: Most flexible, can create custom layouts
- **react-family-tree**: React-specific, easier to integrate
- **gojs**: Commercial option with pre-built templates
- **vis.js**: Good for network/hierarchy visualizations

### Data Structure Requirements
- Convert existing relationship arrays to graph data structure
- Calculate tree depth and breadth for initial zoom level
- Handle circular relationships (remarriages, adoptions)
- Support multiple disconnected family trees

### Performance Considerations
- Virtualize rendering for trees with 100+ people
- Lazy load person details on node click
- Cache tree layout calculations
- Implement progressive rendering for deep trees

## User Stories

1. As a user, I want to see my entire family tree so I can understand how everyone is related
2. As a genealogist, I want to identify gaps in my research by seeing which people have incomplete information
3. As a family member, I want to find how I'm related to a distant relative by viewing the connection path
4. As an organizer, I want to print a family tree poster for a family reunion

## Priority

**High Impact, Medium Complexity**

This feature leverages existing relationship data and provides significant value for understanding family connections. Most users expect a visual tree in family archive applications.

## Dependencies

- Related People collection (✅ implemented)
- Person Detail Modal (✅ implemented)
- Relationship data (✅ implemented)

## Future Enhancements

- DNA ethnicity visualization overlay
- Migration paths on a map
- Animated timeline showing family growth over centuries
- Collaborative tree editing with change tracking
