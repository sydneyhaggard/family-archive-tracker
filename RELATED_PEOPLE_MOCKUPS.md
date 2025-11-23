# Related People Feature - Visual Mockups

## Navigation Bar (Updated)

The navigation bar now includes a "Related People" tab:

```
┌─────────────────────────────────────────────────────────────┐
│ [Home] [View All (Cards)] [Database View] [Related People] │
└─────────────────────────────────────────────────────────────┘
         ↑ Existing tabs                   ↑ NEW TAB
```

When clicked, navigates to `/people` route.

## Main Page Layout

### Full Page View

```
╔═══════════════════════════════════════════════════════════════╗
║            🏠 Family Archive Tracker                          ║
║   user@example.com    Storage: 25.4 MB / 50 GB   [Sign Out]  ║
╠═══════════════════════════════════════════════════════════════╣
║ Home │ View All │ Database │ 🔵 Related People 🔵            ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  👥 Related People                      [+ Add Person]        ║
║  Manage people related to your archive items                  ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ 🔍 Search by name or description...                     │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      ║
║  │   ┌────┐     │  │   ┌────┐     │  │   ┌────┐     │      ║
║  │   │ JD │     │  │   │ MS │     │  │   │ RH │     │      ║
║  │   └────┘     │  │   └────┘     │  │   └────┘     │      ║
║  │              │  │              │  │              │      ║
║  │  John Doe    │  │  Mary Smith  │  │  Robert Hill │      ║
║  │  📅 1920-05-15│  │  📅 1935-08-22│  │  📅 1942-11-03│      ║
║  │              │  │              │  │              │      ║
║  │  Great       │  │  Grandmother │  │  Uncle who   │      ║
║  │  grandfather │  │  on mother's │  │  served in   │      ║
║  │  from Iowa   │  │  side        │  │  WWII        │      ║
║  │              │  │              │  │              │      ║
║  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │      ║
║  │  │  Edit  │  │  │  │  Edit  │  │  │  │  Edit  │  │      ║
║  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │      ║
║  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │      ║
║  │  │ Delete │  │  │  │ Delete │  │  │  │ Delete │  │      ║
║  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │      ║
║  └──────────────┘  └──────────────┘  └──────────────┘      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Person Card (Detail)

```
┌──────────────────────────────────┐
│        ┌────────────┐             │
│        │            │  Avatar     │
│        │     JD     │  (Circle)   │
│        │            │             │
│        └────────────┘             │
│                                   │
│  John Doe                         │  ← Name (Bold)
│  📅 Born: May 15, 1920            │  ← Birth Date
│                                   │
│  Great grandfather from Iowa.     │  ← Description
│  Moved to California in 1940.     │    (3 line max)
│  Worked as a carpenter...         │
│                                   │
│  ┌─────────────────────────────┐ │
│  │          Edit               │ │  ← Edit Button
│  └─────────────────────────────┘ │    (Secondary color)
│  ┌─────────────────────────────┐ │
│  │         Delete              │ │  ← Delete Button
│  └─────────────────────────────┘ │    (Red outline)
└──────────────────────────────────┘
```

## Add Person Modal

```
┌───────────────────────────────────────────────────────────┐
│  Add New Person                                      ✕    │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Name *                                                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Enter person's name                                 │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  Birth Date                                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ [MM/DD/YYYY]                           📅           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  Description                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                                                     │ │
│  │ Enter additional information about this person...   │ │
│  │                                                     │ │
│  │                                                     │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│                              ┌────────┐  ┌─────────────┐ │
│                              │ Cancel │  │  Add Person │ │
│                              └────────┘  └─────────────┘ │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

## Edit Person Modal (Pre-filled)

```
┌───────────────────────────────────────────────────────────┐
│  Edit Person                                         ✕    │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Name *                                                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ John Doe                                            │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  Birth Date                                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 1920-05-15                             📅           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  Description                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Great grandfather from Iowa. Moved to California    │ │
│  │ in 1940. Worked as a carpenter and built many      │ │
│  │ homes in the San Francisco Bay Area. Known for     │ │
│  │ his kindness and strong work ethic.                │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│                              ┌────────┐  ┌─────────────┐ │
│                              │ Cancel │  │Update Person│ │
│                              └────────┘  └─────────────┘ │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

## Empty State

```
╔═══════════════════════════════════════════════════════════╗
║  👥 Related People                      [+ Add Person]    ║
║  Manage people related to your archive items              ║
║                                                           ║
║  ┌───────────────────────────────────────────────────┐   ║
║  │ 🔍 Search by name or description...               │   ║
║  └───────────────────────────────────────────────────┘   ║
║                                                           ║
║                                                           ║
║                        👤                                 ║
║                                                           ║
║              No people added yet.                         ║
║        Click "Add Person" to get started!                 ║
║                                                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

## Search Results

```
╔═══════════════════════════════════════════════════════════╗
║  ┌───────────────────────────────────────────────────┐   ║
║  │ 🔍 john                                           │   ║
║  └───────────────────────────────────────────────────┘   ║
║                                                           ║
║  ┌──────────────┐                                        ║
║  │   ┌────┐     │    Only 1 result found                ║
║  │   │ JD │     │                                        ║
║  │   └────┘     │                                        ║
║  │              │                                        ║
║  │  John Doe    │                                        ║
║  │  📅 1920-05-15│                                        ║
║  │              │                                        ║
║  │  Great       │                                        ║
║  │  grandfather │                                        ║
║  │  from Iowa   │                                        ║
║  │              │                                        ║
║  │  ┌────────┐  │                                        ║
║  │  │  Edit  │  │                                        ║
║  │  └────────┘  │                                        ║
║  │  ┌────────┐  │                                        ║
║  │  │ Delete │  │                                        ║
║  │  └────────┘  │                                        ║
║  └──────────────┘                                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

## Mobile View (Stacked Layout)

```
┌─────────────────────────────┐
│  Family Archive Tracker     │
│  user@email.com  [Sign Out] │
├─────────────────────────────┤
│< Home│All│DB│👥People >    │  ← Scrollable tabs
├─────────────────────────────┤
│                             │
│  Related People             │
│  [+ Add Person]             │  ← Full width
│                             │
│  ┌─────────────────────────┐│
│  │ 🔍 Search...            ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │      ┌────┐             ││
│  │      │ JD │             ││
│  │      └────┘             ││
│  │  John Doe               ││
│  │  📅 1920-05-15          ││
│  │  Great grandfather...   ││
│  │  ┌────────┐             ││
│  │  │  Edit  │             ││
│  │  └────────┘             ││
│  │  ┌────────┐             ││
│  │  │ Delete │             ││
│  │  └────────┘             ││
│  └─────────────────────────┘│
│                             │  ← Single column
│  ┌─────────────────────────┐│
│  │      ┌────┐             ││
│  │      │ MS │             ││
│  │      └────┘             ││
│  │  Mary Smith             ││
│  │  📅 1935-08-22          ││
│  │  Grandmother...         ││
│  │  ┌────────┐             ││
│  │  │  Edit  │             ││
│  │  └────────┘             ││
│  │  ┌────────┐             ││
│  │  │ Delete │             ││
│  │  └────────┘             ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

## Color Reference

- **Primary Blue:** Navigation active state, buttons, avatars
- **Secondary Purple:** Edit button hover state
- **White:** Card backgrounds
- **Gray-50:** Page background
- **Gray-200:** Borders
- **Gray-600:** Body text
- **Gray-800:** Headings
- **Red-500:** Delete button border/hover
- **Green-500:** Success states (not shown)

## Interaction States

### Buttons
- **Normal:** Solid color, white text
- **Hover:** Slight color change, elevation increase
- **Active:** Pressed effect
- **Disabled:** Opacity 50%, cursor not-allowed

### Cards
- **Normal:** White background, subtle shadow
- **Hover:** Shadow increases, slight lift effect
- **Selected:** (Future) Blue border

### Inputs
- **Normal:** Gray border
- **Focus:** Blue ring (primary color)
- **Error:** Red border, red text below
- **Success:** Green border

## Real-time Behavior

All changes are reflected immediately across all open tabs/windows:

1. **Add Person:** New card appears instantly in all views
2. **Edit Person:** Card updates in real-time
3. **Delete Person:** Card disappears immediately
4. **Search:** Filters apply as you type

This is powered by Firestore's `onSnapshot` real-time listener in the custom hook.
