/**
 * Firebase Cloud Functions for Family Archive Tracker
 * 
 * These functions handle admin operations that require elevated privileges,
 * such as setting custom claims for user roles.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Super admin email (first admin for bootstrapping)
// In production, set this via Firebase Functions config:
// firebase functions:config:set admin.email="your-email@example.com"
const SUPER_ADMIN_EMAIL = functions.config().admin?.email || null;

/**
 * Validates that the super admin email is configured
 * @throws {Error} if super admin email is not configured
 */
function validateSuperAdminConfig() {
  if (!SUPER_ADMIN_EMAIL) {
    console.warn('Super admin email not configured. Set it via: firebase functions:config:set admin.email="your-email@example.com"');
  }
}

// Validate config on cold start
validateSuperAdminConfig();

/**
 * addAdminRole - Callable function to grant admin privileges to a user
 * 
 * Requirements:
 * - Caller must be authenticated
 * - Caller must be either a super admin (by email) or already have admin claim
 * 
 * @param {Object} data - { email: string } - Email of user to make admin
 * @returns {Object} - { success: boolean, message: string }
 */
exports.addAdminRole = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to call this function.'
    );
  }

  const callerEmail = context.auth.token.email;
  const callerIsAdmin = context.auth.token.admin === true;
  const callerIsSuperAdmin = callerEmail === SUPER_ADMIN_EMAIL;

  // Verify caller has permission (must be admin or super admin)
  if (!callerIsAdmin && !callerIsSuperAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can grant admin privileges.'
    );
  }

  // Validate input
  const { email } = data;
  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email address is required.'
    );
  }

  try {
    // Get the user by email
    const user = await admin.auth().getUserByEmail(email);

    // Set custom claim
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    // Optionally update Firestore user document
    await admin.firestore().collection('users').doc(user.uid).set(
      { isAdmin: true, adminGrantedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    return {
      success: true,
      message: `Successfully granted admin privileges to ${email}`
    };
  } catch (error) {
    console.error('Error adding admin role:', error);

    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError(
        'not-found',
        `No user found with email: ${email}`
      );
    }

    throw new functions.https.HttpsError(
      'internal',
      `Failed to grant admin privileges: ${error.message}`
    );
  }
});

/**
 * removeAdminRole - Callable function to revoke admin privileges from a user
 * 
 * @param {Object} data - { email: string } - Email of user to remove admin from
 * @returns {Object} - { success: boolean, message: string }
 */
exports.removeAdminRole = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to call this function.'
    );
  }

  const callerEmail = context.auth.token.email;
  const callerIsAdmin = context.auth.token.admin === true;
  const callerIsSuperAdmin = callerEmail === SUPER_ADMIN_EMAIL;

  // Only super admin can remove admin rights
  if (!callerIsSuperAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only the super administrator can revoke admin privileges.'
    );
  }

  const { email } = data;
  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email address is required.'
    );
  }

  // Prevent removing super admin
  if (email === SUPER_ADMIN_EMAIL) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Cannot remove admin privileges from the super administrator.'
    );
  }

  try {
    const user = await admin.auth().getUserByEmail(email);

    // Remove custom claim
    await admin.auth().setCustomUserClaims(user.uid, { admin: false });

    // Update Firestore
    await admin.firestore().collection('users').doc(user.uid).set(
      { isAdmin: false, adminRevokedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    return {
      success: true,
      message: `Successfully revoked admin privileges from ${email}`
    };
  } catch (error) {
    console.error('Error removing admin role:', error);

    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError(
        'not-found',
        `No user found with email: ${email}`
      );
    }

    throw new functions.https.HttpsError(
      'internal',
      `Failed to revoke admin privileges: ${error.message}`
    );
  }
});

/**
 * onUserCreate - Trigger when a new user is created
 * Automatically grants admin to the first user (super admin) if configured
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  // If this is the super admin email, grant admin privileges
  if (user.email === SUPER_ADMIN_EMAIL) {
    try {
      await admin.auth().setCustomUserClaims(user.uid, { admin: true });
      await admin.firestore().collection('users').doc(user.uid).set(
        { 
          isAdmin: true, 
          isSuperAdmin: true,
          adminGrantedAt: admin.firestore.FieldValue.serverTimestamp() 
        },
        { merge: true }
      );
      console.log(`Super admin privileges granted to ${user.email}`);
    } catch (error) {
      console.error('Error granting super admin privileges:', error);
    }
  }
});
