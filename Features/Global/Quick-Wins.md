# Quick Wins - Easy High-Impact Features

## Description

Collection of small features that can be implemented quickly but provide meaningful improvements to user experience.

## Features List

### 1. Recently Viewed Items
**Effort**: Low | **Impact**: Medium

Track user's recently viewed items and show them on the dashboard for quick access.

```javascript
// Store in localStorage
const addToRecentlyViewed = (item) => {
  const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
  const updated = [item, ...recent.filter(i => i.id !== item.id)].slice(0, 10);
  localStorage.setItem('recentlyViewed', JSON.stringify(updated));
};
```

**UI**: Grid of 5-6 recently viewed items on dashboard

---

### 2. Keyboard Shortcuts
**Effort**: Low | **Impact**: Medium

Add keyboard shortcuts for common actions:
- `Cmd/Ctrl + K`: Focus search
- `N`: New item
- `P`: New person
- `Escape`: Close modals
- `Arrow keys`: Navigate in grids
- `Enter`: Open selected item

```javascript
useEffect(() => {
  const handleKeyPress = (e) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    if (e.key === 'n' && !isModalOpen) {
      handleAddItem();
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

**UI**: Add keyboard shortcuts help modal (?) or footer hint

---

### 3. Random Item Discovery
**Effort**: Low | **Impact**: Fun!

Add a "🎲 Random Item" button that shows a random archive item. Great for rediscovering forgotten items.

```javascript
const getRandomItem = () => {
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
};
```

**UI**: Button in header or sidebar: "🎲 Surprise Me"

---

### 4. Item Count Badges
**Effort**: Low | **Impact**: Medium

Show counts in navigation:
- Archive Items (324)
- People (127)
- Events (18)
- Sources (42)

```javascript
// In Header component
<NavLink to="/all-items">
  Archive Items
  {itemsCount > 0 && (
    <span className="badge">{itemsCount}</span>
  )}
</NavLink>
```

---

### 5. Incomplete Items Filter
**Effort**: Low | **Impact**: Medium

Add filter to find items missing important information:
- No description
- No date
- No category
- No linked people
- No files

```javascript
const incompleteItems = items.filter(item => {
  return !item.description || 
         !item.date || 
         !item.category ||
         !item.relatedPeopleIds?.length;
});
```

**UI**: Add "⚠️ Incomplete Items" link in dashboard or sidebar

---

### 6. Anniversary Reminders
**Effort**: Low | **Impact**: Medium

Show on dashboard:
- Death anniversaries this week
- Marriage anniversaries this month
- Historical event anniversaries

```javascript
const getAnniversaries = (people, events) => {
  const today = new Date();
  const thisMonth = today.getMonth();
  
  return people
    .filter(p => {
      if (!p.deathDate) return false;
      const deathMonth = new Date(p.deathDate).getMonth();
      return deathMonth === thisMonth;
    })
    .map(p => ({
      type: 'death',
      person: p,
      yearsAgo: today.getFullYear() - new Date(p.deathDate).getFullYear()
    }));
};
```

**UI**: "📅 This Month in History" card on dashboard

---

### 7. Progress Indicators
**Effort**: Low | **Impact**: Medium

Show progress for common goals:
- "You've documented 45 of 100 family members"
- "12 items need descriptions"
- "Archive completeness: 78%"

```javascript
const calculateCompleteness = (items, people) => {
  const itemCompleteness = items.filter(i => 
    i.description && i.date && i.category && i.relatedPeopleIds?.length
  ).length / items.length;
  
  const peopleCompleteness = people.filter(p =>
    p.birthDate && p.deathDate && p.description
  ).length / people.length;
  
  return Math.round((itemCompleteness + peopleCompleteness) / 2 * 100);
};
```

**UI**: Progress bars on dashboard or profile page

---

### 8. Undo Delete
**Effort**: Low | **Impact**: High

Show toast notification after delete with "Undo" button (30-second window):

```javascript
const handleDelete = async (itemId) => {
  const item = items.find(i => i.id === itemId);
  await deleteItem(itemId);
  
  showToast(
    `Deleted "${item.title}"`,
    () => restoreItem(item), // Undo callback
    30000 // 30 seconds
  );
};
```

**UI**: Toast notification: "❌ Item deleted. [Undo]"

---

### 9. Smart Suggestions
**Effort**: Low | **Impact**: Medium

Suggest actions based on user behavior:
- "You haven't linked this photo to anyone. Add people?"
- "This item has no date. Estimate a date?"
- "Similar items found. Want to group them?"

```javascript
const getSuggestions = (item) => {
  const suggestions = [];
  
  if (!item.relatedPeopleIds?.length) {
    suggestions.push({
      type: 'link_people',
      message: 'Link this to someone in your family',
      action: () => openPeopleLinker(item)
    });
  }
  
  if (!item.date) {
    suggestions.push({
      type: 'add_date',
      message: 'Add a date to improve timeline accuracy',
      action: () => openDatePicker(item)
    });
  }
  
  return suggestions;
};
```

**UI**: Info box with suggestion cards in item detail view

---

### 10. Copy Item Link
**Effort**: Low | **Impact**: Medium

Generate shareable links to specific items:

```javascript
const copyItemLink = (itemId) => {
  const url = `${window.location.origin}/item/${itemId}`;
  navigator.clipboard.writeText(url);
  showToast('Link copied to clipboard!');
};
```

**UI**: "🔗 Copy Link" button in item actions

---

### 11. Bulk Actions Toolbar
**Effort**: Low | **Impact**: High

When items are selected, show floating toolbar:
- Delete selected
- Add to collection
- Link to person
- Export selected

```javascript
{selectedItems.size > 0 && (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 
                  bg-white shadow-lg rounded-lg p-4 flex gap-3">
    <span>{selectedItems.size} selected</span>
    <button onClick={handleBulkDelete}>Delete</button>
    <button onClick={handleBulkLink}>Link to Person</button>
    <button onClick={handleBulkExport}>Export</button>
  </div>
)}
```

---

### 12. Item Preview on Hover
**Effort**: Low | **Impact**: Medium

Show preview card when hovering over item thumbnails:

```javascript
const [hoveredItem, setHoveredItem] = useState(null);

<Tooltip content={<ItemPreview item={hoveredItem} />}>
  <ItemCard 
    item={item}
    onMouseEnter={() => setHoveredItem(item)}
    onMouseLeave={() => setHoveredItem(null)}
  />
</Tooltip>
```

---

### 13. Export Collection Button
**Effort**: Low | **Impact**: Medium

One-click export of current view/filter results to PDF or CSV:

```javascript
const exportToPDF = async (items) => {
  const doc = new jsPDF();
  
  items.forEach((item, index) => {
    doc.text(item.title, 10, 10 + (index * 20));
    doc.text(item.description, 10, 15 + (index * 20));
    if (index < items.length - 1) doc.addPage();
  });
  
  doc.save('archive-export.pdf');
};
```

---

### 14. Storage Usage Breakdown
**Effort**: Low | **Impact**: Low

Show which categories/types use most storage:

```javascript
const storageByCategory = items.reduce((acc, item) => {
  const category = item.category || 'Uncategorized';
  acc[category] = (acc[category] || 0) + calculateItemSize(item);
  return acc;
}, {});
```

**UI**: Pie chart on profile page showing storage breakdown

---

### 15. Autosave Draft
**Effort**: Medium | **Impact**: High

Auto-save form data while editing to prevent data loss:

```javascript
useEffect(() => {
  const timer = setTimeout(() => {
    if (formData.title || formData.description) {
      localStorage.setItem('itemDraft', JSON.stringify(formData));
    }
  }, 2000); // Save after 2 seconds of no typing
  
  return () => clearTimeout(timer);
}, [formData]);
```

**UI**: "Draft saved at 2:34 PM" indicator in form footer

---

## Implementation Priority

### Tier 1 (Implement First)
1. Keyboard Shortcuts
2. Undo Delete
3. Incomplete Items Filter
4. Item Count Badges

### Tier 2 (Quick Wins)
5. Recently Viewed
6. Copy Item Link
7. Bulk Actions Toolbar
8. Autosave Draft

### Tier 3 (Nice to Have)
9. Random Item
10. Anniversary Reminders
11. Smart Suggestions
12. Preview on Hover

## Notes

All of these features can be implemented in 1-4 hours each and require minimal dependencies. They significantly improve UX with small code changes.

Most features use existing data and don't require new database collections or complex state management.
