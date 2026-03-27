# Duplicate Name Cleanup - Deployment Guide

## Overview
This guide walks you through deploying and using the duplicate last name cleanup feature for your Family Archive Tracker.

## What's Been Added

### 1. **Utility Functions** ([src/utils/helpers.js](src/utils/helpers.js))
- `detectDuplicateLastName()` - Detects duplicate last names and flags suspicious cases
- `cleanDuplicateName()` - Cleans duplicate names from a string
- `cleanRelationshipNames()` - Cleans names in relationship arrays
- Includes a list of known compound surnames (add more as needed)

### 2. **Cloud Functions** ([functions/index.js](functions/index.js))
- `analyzeNamesForDuplicates` - Scans database and returns analysis without making changes
- `cleanDuplicateLastNames` - Performs the actual cleanup with batch processing
- Both functions require admin privileges
- Processes 450 records per batch (stays under 500 Firestore limit)

### 3. **Admin UI** ([src/components/AdminDashboard.jsx](src/components/AdminDashboard.jsx))
- New "Name Cleanup" tab in Admin Dashboard
- Analysis interface showing:
  - Total people in database
  - Clean names count
  - Auto-fixable duplicates
  - Suspicious cases needing review
- Manual review interface for compound surnames
- Real-time cleanup results display

## How It Works

### Detection Logic
The system identifies duplicate last names by checking if the last two words in a name are identical:
- **"Haggard Haggard"** → Duplicate found ✅
- **"Mary Smith Smith"** → Duplicate found ✅
- **"John Williams"** → Clean ✅

### Suspicious Case Detection
These cases are flagged for manual review:
- Names containing hyphens (e.g., "Smith-Jones Smith-Jones")
- Known compound surnames from the whitelist
- Any pattern that might be intentional

### What Gets Cleaned
When you run the cleanup:
1. **Main `name` field** - Primary person name
2. **`parents` array** - Names of all parents in relationships
3. **`siblings` array** - Names of all siblings
4. **`spouses` array** - Names of all spouses
5. **`children` array** - Names of all children

## Deployment Steps

### Prerequisites
- Node.js 20 or higher installed
- Firebase CLI installed: `npm install -g firebase-tools`
- Logged into Firebase: `firebase login`
- Admin role in your app

### Step 1: Deploy Cloud Functions

```bash
# Navigate to project root
cd /Users/sydneyhaggard/Documents/00_Builds/family-archive-tracker

# Install dependencies (if not already done)
cd functions
npm install
cd ..

# Deploy the new functions
firebase deploy --only functions:cleanDuplicateLastNames,functions:analyzeNamesForDuplicates
```

### Step 2: Update Frontend (Already Complete)
The React components have been updated. Just rebuild and redeploy:

```bash
# Build the app
npm run build

# Deploy hosting
firebase deploy --only hosting
```

### Step 3: Configure Compound Surnames
Edit the `KNOWN_COMPOUND_SURNAMES` array in both files if you have specific compound surnames in your family:

**Frontend:** [src/utils/helpers.js](src/utils/helpers.js) (lines 18-25)
**Backend:** [functions/index.js](functions/index.js) (lines 459-466)

```javascript
const KNOWN_COMPOUND_SURNAMES = [
  'Smith-Jones',
  'Lloyd-Jones',
  'Lloyd-George',
  // Add your family's compound surnames here
  'Your-Compound-Name'
];
```

## Using the Feature

### 1. Access Admin Dashboard
- Navigate to `/admin` in your app
- Click on "🏷️ Name Cleanup" tab

### 2. Analyze Your Names
- Click "🔍 Analyze My Names"
- Review the statistics:
  - **Total People** - All records in your database
  - **Clean Names** - Names without duplicates
  - **Auto-Fixable** - Safe to clean automatically
  - **Needs Review** - Suspicious cases requiring manual review

### 3. Automatic Cleanup
For non-suspicious duplicates:
- Click "✨ Auto-Fix X Names"
- Confirm the action
- Wait for processing (Cloud Function handles batches)
- Review results

### 4. Manual Review
For suspicious cases:
1. Click "⚠️ Show Suspicious Only" to focus on review cases
2. Check each name carefully
3. Select the ones you want to clean (checkbox on right)
4. Use "Select All Suspicious" if you want to clean all
5. Click "✨ Clean Selected"
6. Review results

### 5. Verify Changes
After cleanup:
- Go to Related People page
- Search for names that were cleaned
- Verify they appear correctly
- Check relationship data (parents, siblings, etc.)

## Safety Features

### 1. **Admin-Only**
Only users with admin role can run cleanup functions.

### 2. **Ownership Verification**
Functions only process records owned by the authenticated user (or specified owner ID).

### 3. **Batch Processing**
Processes 450 records per batch to stay under Firestore limits and prevent timeouts.

### 4. **Suspicious Case Flagging**
Compound surnames and hyphenated names are flagged for manual review.

### 5. **No Data Loss**
Original data is replaced, but you can see before/after in results. Consider backing up your database first.

### 6. **Real-Time Results**
See exactly what was changed with before/after comparison.

## Backup Before Running

### Option 1: Export Firestore Data
```bash
# Export your entire database
gcloud firestore export gs://[YOUR_BUCKET_NAME]/backup-$(date +%Y%m%d)
```

### Option 2: Manual Backup Query
Run this in Firestore console to export Related People:
```javascript
// Firestore Console
const snapshot = await db.collection('relatedPeople').get();
const backup = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
console.log(JSON.stringify(backup));
// Copy output and save to file
```

## Troubleshooting

### Issue: "Permission denied" error
**Solution:** Ensure you're logged in as an admin user.

### Issue: No duplicates found but you see them
**Solution:** Check that names are stored exactly as "Word Word" (case-insensitive match required).

### Issue: Too many suspicious cases
**Solution:** Add your family's legitimate compound surnames to the whitelist.

### Issue: Function timeout
**Solution:** The function uses batching. If you have thousands of people, it may take time. Check logs:
```bash
firebase functions:log --only cleanDuplicateLastNames
```

### Issue: Changes not appearing
**Solution:** The UI uses real-time listeners. Refresh the page or wait a few seconds for updates.

## Testing Strategy

### Phase 1: Test with Small Sample
1. Create a test account
2. Add 5-10 test people with duplicate names
3. Run analysis
4. Run cleanup
5. Verify results

### Phase 2: Review-Only Run
1. Run analysis on your actual data
2. Review all suspicious cases
3. Don't clean anything yet
4. Update the compound surname whitelist if needed

### Phase 3: Incremental Cleanup
1. Clean just a few suspicious cases manually
2. Verify they look correct in the UI
3. Then run auto-fix for non-suspicious cases
4. Review final results

## Monitoring

### Check Function Logs
```bash
# Real-time logs
firebase functions:log --only cleanDuplicateLastNames

# Specific time period
firebase functions:log --only cleanDuplicateLastNames --since 2h
```

### Verify in Firestore Console
- Go to Firebase Console
- Navigate to Firestore Database
- Filter `relatedPeople` collection
- Manually inspect cleaned records

## Rollback Plan

If you need to revert changes:

### Option 1: Restore from Backup
```bash
# Import from backup
gcloud firestore import gs://[YOUR_BUCKET_NAME]/backup-[DATE]
```

### Option 2: Manual Fix
If you have the cleanup results JSON:
1. Copy the `cleanedCases` array
2. For each entry, update the Firestore document back to `originalName`
3. Use a script or manual edits

## Performance Notes

- **Small databases (<100 people):** Near-instant
- **Medium databases (100-1000 people):** 1-5 seconds
- **Large databases (>1000 people):** 5-30 seconds with batching
- Cloud Functions have 60-second default timeout (can be increased if needed)

## Future Enhancements

Consider adding:
1. **Undo button** - Store original values temporarily
2. **Scheduled cleanup** - Run automatically on GEDCOM import
3. **Email reports** - Send summary of changes to admin
4. **Whitelist management** - UI to add compound surnames without code changes
5. **Preview mode** - Show what would change without committing

## Support

If you encounter issues:
1. Check the browser console for errors
2. Review Firebase Functions logs
3. Check Firestore security rules
4. Verify admin role is correctly set

## Files Modified

- ✅ [src/utils/helpers.js](src/utils/helpers.js) - Detection utilities
- ✅ [functions/index.js](functions/index.js) - Cloud Functions
- ✅ [src/components/AdminDashboard.jsx](src/components/AdminDashboard.jsx) - Admin UI

---

**Last Updated:** January 21, 2026
**Version:** 1.0.0
