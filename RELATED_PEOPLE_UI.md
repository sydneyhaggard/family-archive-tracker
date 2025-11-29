# Related People Feature - UI Documentation

## Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                  Family Archive Tracker                         │
│                                                                 │
│  user@email.com              Storage: X.XX MB / 50 GB  Sign Out│
├─────────────────────────────────────────────────────────────────┤
│ Home │ View All │ Database │ Related People (Active)           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Related People                               + Add Person      │
│  Manage people related to your archive items                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🔍 Search by name or description...                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │     JD     │  │     MS     │  │     ED     │              │
│  │            │  │            │  │            │              │
│  │ John Doe   │  │ Mary Smith │  │ Ed Davis   │              │
│  │ Born: 1920 │  │ Born: 1935 │  │ Born: 1942 │              │
│  │            │  │            │  │            │              │
│  │ Great      │  │ Grandmother│  │ Uncle who  │              │
│  │ grandfather│  │ on mother's│  │ served in  │              │
│  │ from Iowa  │  │ side...    │  │ WWII...    │              │
│  │            │  │            │  │            │              │
│  │ ┌────┐     │  │ ┌────┐     │  │ ┌────┐     │              │
│  │ │Edit│     │  │ │Edit│     │  │ │Edit│     │              │
│  │ └────┘     │  │ └────┘     │  │ └────┘     │              │
│  │ ┌────┐     │  │ ┌────┐     │  │ ┌────┐     │              │
│  │ │Del │     │  │ │Del │     │  │ │Del │     │              │
│  │ └────┘     │  │ └────┘     │  │ └────┘     │              │
│  └────────────┘  └────────────┘  └────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Add/Edit Person Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Add New Person                                           ✕     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Name *                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Enter person's name                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Birth Date                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ [📅 Date Picker]                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Description                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │ Enter additional information about this person...        │  │
│  │                                                          │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│                                      ┌────────┐ ┌────────────┐ │
│                                      │ Cancel │ │ Add Person │ │
│                                      └────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Empty State

```
┌─────────────────────────────────────────────────────────────────┐
│  Related People                               + Add Person      │
│  Manage people related to your archive items                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🔍 Search by name or description...                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│                                                                 │
│                    No people added yet.                         │
│              Click "Add Person" to get started!                 │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Search Results

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🔍 john                                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────┐                                                │
│  │     JD     │                                                │
│  │            │  Only showing results matching "john"          │
│  │ John Doe   │                                                │
│  │ Born: 1920 │                                                │
│  │            │                                                │
│  │ Great      │                                                │
│  │ grandfather│                                                │
│  │ from Iowa  │                                                │
│  │            │                                                │
│  │ ┌────┐     │                                                │
│  │ │Edit│     │                                                │
│  │ └────┘     │                                                │
│  │ ┌────┐     │                                                │
│  │ │Del │     │                                                │
│  │ └────┘     │                                                │
│  └────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Delete Confirmation

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  Confirm Deletion                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Are you sure you want to delete this person?                   │
│  This action cannot be undone.                                  │
│                                                                 │
│                                      ┌────────┐ ┌────────┐     │
│                                      │ Cancel │ │   OK   │     │
│                                      └────────┘ └────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Responsive Behavior

### Desktop (1200px+)
- 3 columns of person cards
- Full navigation visible
- Side-by-side buttons in header

### Tablet (768px - 1199px)
- 2 columns of person cards
- Scrollable navigation tabs
- Stacked buttons in header

### Mobile (< 768px)
- 1 column of person cards
- Scrollable navigation tabs
- Full-width buttons
- Larger touch targets

## Color Scheme (Tailwind CSS v4)

- **Primary:** Blue (#primary from theme)
- **Secondary:** Purple (#secondary from theme)
- **Background:** Gray-50
- **Cards:** White with shadow
- **Text:** Gray-800 (headings), Gray-600 (body)
- **Borders:** Gray-200/300
- **Hover:** Slight elevation + color change

## Interactive Elements

### Person Card
- **Hover:** Shadow increases, slight elevation
- **Avatar:** Circle with first letter, primary background
- **Edit Button:** Secondary color, hover to primary
- **Delete Button:** Red border, hover fills red

### Search Bar
- **Focus:** Blue ring (primary color)
- **Real-time:** Filters as you type
- **Clear:** Auto-clears on empty results

### Modal
- **Backdrop:** Semi-transparent black overlay
- **Animation:** Fade in/out
- **Close:** X button or ESC key
- **Form:** Live validation

### Navigation Tab
- **Active:** Primary background, white text
- **Inactive:** Gray text, hover light gray
- **Responsive:** Horizontal scroll on mobile

## Accessibility

- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Focus indicators
- Screen reader friendly
- High contrast text
- Touch-friendly targets (mobile)

## User Flows

### Adding a Person
1. User clicks "+ Add Person" button
2. Modal opens with empty form
3. User enters name (required) and optional fields
4. User clicks "Add Person"
5. Modal closes, new card appears in grid
6. Success: Real-time update, no page refresh

### Editing a Person
1. User clicks "Edit" on person card
2. Modal opens with pre-filled data
3. User modifies fields
4. User clicks "Update Person"
5. Modal closes, card updates instantly
6. Success: Changes reflected immediately

### Deleting a Person
1. User clicks "Delete" on person card
2. Browser confirmation appears
3. User confirms deletion
4. Card disappears from grid
5. Success: Person removed from database

### Searching
1. User types in search box
2. Grid filters in real-time
3. Shows matching results only
4. Clear search shows all people
5. Empty results: "No people found..." message

## Integration with Archive Items

While the UI page focuses on managing people, the hook provides functions to link people to archive items:

```javascript
// In ItemFormModal or ItemDetailModal
import { useRelatedPeople } from '../hooks/useRelatedPeople';

const { peopleList, linkPeopleToItem } = useRelatedPeople();

// Show people selector
<select multiple>
  {peopleList.map(person => (
    <option key={person.id} value={person.id}>
      {person.name}
    </option>
  ))}
</select>

// Save links
await linkPeopleToItem(currentItem.id, selectedPeopleIds);
```

This allows archive items to reference people, creating relationships between items and family members.
