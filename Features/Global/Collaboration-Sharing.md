# Collaboration & Sharing Features

## Description

Enhance multi-user collaboration with activity feeds, comments, granular permissions, and notifications to make the archive a shared family project.

## Current State

- Basic sharing via `sharedWith` array (email-based)
- Shared items visible to all shared users
- No differentiation between read/edit permissions
- No activity tracking or notifications
- No commenting system

## Proposed Features

### Activity Feed
- **Recent activity dashboard**: Show what's been added/changed
- **User attribution**: See who added/edited each item
- **Timestamp tracking**: When changes occurred
- **Filter by user**: View one person's contributions
- **Filter by entity**: Show only people updates, only item updates, etc.
- **Activity types**:
  - 🆕 Item added
  - ✏️ Item edited
  - 🔗 Item linked to person/event
  - 👤 Person added
  - 📝 Comment added
  - 📤 Item shared

### Comments System
- **Item comments**: Discussion threads on archive items
- **Person comments**: Notes on people profiles
- **Event comments**: Collaboration on event details
- **Rich text**: Support basic formatting, links
- **@mentions**: Notify specific users
- **Edit/delete own comments**: Within time window
- **Comment notifications**: Email or in-app alerts

### Enhanced Sharing
- **Permission levels**:
  - **View only**: Can see but not edit
  - **Comment**: Can view and comment
  - **Edit**: Can modify items
  - **Admin**: Can delete and manage sharing
- **Share by folder/collection**: Share sets of items at once
- **Share links**: Generate shareable links (optional password)
- **Expiring shares**: Temporary access with expiration dates
- **Share invitations**: Email invites with accept/decline

### Notifications
- **In-app notification center**: Bell icon with unread count
- **Email notifications**: Optional daily/weekly digest
- **Notification preferences**: Per-event type settings
- **Notification types**:
  - Someone shared an item with you
  - Someone commented on your item
  - Someone mentioned you in a comment
  - New items added by family members
  - Weekly activity summary

### Collaboration Dashboard
- **Contributors list**: See all people with access
- **Contribution stats**: Items added, edits made, comments posted
- **Recent contributors**: Active users this week/month
- **Collaboration goals**: Track collective progress

## Technical Implementation

### Activity Feed Data Model
```javascript
// activityLog collection
{
  id: 'uuid',
  userId: 'user_uid',
  userName: 'John Smith',
  userPhoto: 'url',
  action: 'item_added', // item_added, item_edited, comment_added, etc.
  entityType: 'archiveItem', // archiveItem, relatedPerson, event
  entityId: 'item_uuid',
  entityTitle: 'Wedding Photo',
  timestamp: serverTimestamp(),
  details: {
    // Action-specific data
  }
}
```

### Comments Data Model
```javascript
// comments subcollection under each entity
{
  id: 'uuid',
  userId: 'user_uid',
  userName: 'Jane Doe',
  userPhoto: 'url',
  text: 'This looks like Uncle Bob!',
  mentions: ['user_uid_2'], // For @mentions
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  edited: false,
  replies: [] // Optional: nested replies
}
```

### Permissions Data Model
```javascript
// Update archiveItems
{
  ownerId: 'creator_uid',
  sharedWith: [
    {
      email: 'user@example.com',
      userId: 'uid', // Set when user accepts
      permission: 'edit', // 'view', 'comment', 'edit', 'admin'
      sharedAt: timestamp,
      acceptedAt: timestamp
    }
  ]
}
```

### Firestore Security Rules
```javascript
// Granular permissions
match /archiveItems/{itemId} {
  // Owner has full access
  allow read, write: if request.auth.uid == resource.data.ownerId;
  
  // Shared users based on permission level
  allow read: if request.auth.token.email in getSharedEmails(resource.data.sharedWith);
  allow update: if hasPermission(resource.data.sharedWith, request.auth.token.email, ['edit', 'admin']);
  allow delete: if hasPermission(resource.data.sharedWith, request.auth.token.email, ['admin']);
}

function hasPermission(sharedWith, email, allowedPermissions) {
  return sharedWith.hasAny([email]) 
    && sharedWith.where('email', '==', email)[0].permission in allowedPermissions;
}
```

### Cloud Functions
```javascript
// Trigger on new activity
exports.onActivityCreated = functions.firestore
  .document('activityLog/{activityId}')
  .onCreate(async (snap, context) => {
    const activity = snap.data();
    
    // Send notifications to relevant users
    await sendNotifications(activity);
    
    // Update user activity stats
    await incrementUserStats(activity.userId);
  });

// Send email notifications
exports.sendActivityDigest = functions.pubsub
  .schedule('every day 08:00')
  .onRun(async (context) => {
    // Send daily digest emails to opted-in users
  });
```

## User Stories

1. As a user, I want to see what family members added recently so I stay up to date
2. As a contributor, I want to ask questions about an item by commenting
3. As an owner, I want to give my sister view-only access but my brother can edit
4. As a user, I want to receive notifications when someone shares items with me
5. As a collaborator, I want to @mention my cousin to get their input on a photo

## UI Mockups

### Activity Feed
```
┌─────────────────────────────────────────────┐
│ Recent Activity                    [Filter] │
├─────────────────────────────────────────────┤
│ 👤 Jane Doe                        2h ago   │
│ Added person: Robert Smith                  │
│                                              │
│ 📷 John Smith                      5h ago   │
│ Added item: Family Reunion Photo            │
│ 💬 3 comments                               │
│                                              │
│ ✏️ Jane Doe                        1d ago   │
│ Edited event: Wedding 1955                  │
│                                              │
│ 🔗 John Smith                      2d ago   │
│ Linked Mary Johnson to 5 items              │
└─────────────────────────────────────────────┘
```

### Comments Section
```
┌─────────────────────────────────────────────┐
│ Comments (3)                                 │
├─────────────────────────────────────────────┤
│ 👤 Jane Doe · 2 hours ago                   │
│ Is this Grandma Mary on the left?           │
│ [Reply] [Edit] [Delete]                     │
│                                              │
│   👤 John Smith · 1 hour ago                │
│   Yes! That's her at age 25.                │
│   [Reply]                                    │
│                                              │
│ 👤 Bob Johnson · 1 day ago                  │
│ @JohnSmith Do you know the location?        │
│ [Reply]                                      │
├─────────────────────────────────────────────┤
│ [Write a comment...]         [Post Comment] │
└─────────────────────────────────────────────┘
```

### Sharing Modal
```
╔═══════════════════════════════════════════╗
║ Share "Wedding Photo 1955"                ║
╟───────────────────────────────────────────╢
║ Share with:                               ║
║ [email@example.com                      ] ║
║                                           ║
║ Permission: [Edit ▼] View, Comment, Edit ║
║                                           ║
║ Message (optional):                       ║
║ [Take a look at this photo...]           ║
║                                           ║
║ [Send Invitation]                         ║
╟───────────────────────────────────────────╢
║ Currently shared with:                    ║
║ • jane@example.com (Edit) [Change] [×]   ║
║ • bob@example.com (View) [Change] [×]    ║
╚═══════════════════════════════════════════╝
```

## Priority

**High Impact, Medium-High Complexity**

Collaboration features transform a personal archive into a shared family project, increasing engagement and contributions from multiple family members.

## Implementation Phases

### Phase 1: Activity Feed
- Create activityLog collection
- Add activity tracking to create/update operations
- Build activity feed component
- Basic filtering

### Phase 2: Comments
- Add comments subcollections
- Build comment thread component
- Real-time comment updates
- Edit/delete own comments

### Phase 3: Enhanced Permissions
- Refactor sharedWith to include permission levels
- Update Firestore security rules
- Build permission selector UI
- Implement read-only mode

### Phase 4: Notifications
- Build notification center component
- Email notification system via Cloud Functions
- User notification preferences
- @mention parsing and notifications

## Dependencies

- User authentication (✅ implemented)
- Basic sharing (✅ implemented via sharedWith)
- Cloud Functions (✅ available)

## Future Enhancements

- Real-time collaborative editing (like Google Docs)
- Video/audio comments
- Reaction emojis on items
- Collaborative tagging games ("tag family members in photos")
- Contribution leaderboards
- Family newsletter generator from activity
