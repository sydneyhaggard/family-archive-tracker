import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { auth, db, storage } from '../config/firebase';

/**
 * Custom hook for managing user profiles
 * Provides CRUD operations for user profile data including display name and photo
 */
export function useUserProfile() {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = auth.currentUser;

  // Listen for real-time updates to user profile
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setUserProfile({
            id: snapshot.id,
            ...snapshot.data()
          });
        } else {
          // Create default profile if doesn't exist
          setUserProfile({
            id: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching user profile:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  /**
   * Get user profile by ID
   */
  const getUserProfile = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return { id: userSnap.id, ...userSnap.data() };
      }
      return null;
    } catch (err) {
      console.error('Error getting user profile:', err);
      throw err;
    }
  };

  /**
   * Create or update user profile
   */
  const updateUserProfile = async (profileData) => {
    if (!user) throw new Error('Not authenticated');

    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const updateData = {
        ...profileData,
        updatedAt: new Date()
      };

      if (userSnap.exists()) {
        await updateDoc(userRef, updateData);
      } else {
        await setDoc(userRef, {
          ...updateData,
          email: user.email,
          createdAt: new Date()
        });
      }

      // Also update Firebase Auth profile
      if (profileData.displayName !== undefined || profileData.photoURL !== undefined) {
        const authUpdate = {};
        if (profileData.displayName !== undefined) {
          authUpdate.displayName = profileData.displayName;
        }
        if (profileData.photoURL !== undefined) {
          authUpdate.photoURL = profileData.photoURL;
        }
        await updateProfile(user, authUpdate);
      }

      return true;
    } catch (err) {
      console.error('Error updating user profile:', err);
      throw err;
    }
  };

  /**
   * Upload profile photo
   */
  const uploadProfilePhoto = async (file) => {
    if (!user) throw new Error('Not authenticated');
    if (!file) throw new Error('No file provided');

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Image must be less than 2MB');
    }

    try {
      // Determine extension from MIME type for consistency
      const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp'
      };
      const ext = mimeToExt[file.type] || 'jpg';
      
      // Create storage reference - always use consistent filename
      const photoRef = ref(storage, `users/${user.uid}/profile/photo.${ext}`);
      
      
      // Upload file
      await uploadBytes(photoRef, file);
      
      // Get download URL
      const photoURL = await getDownloadURL(photoRef);
      
      // Update profile with new photo URL
      await updateUserProfile({ photoURL });
      
      return photoURL;
    } catch (err) {
      console.error('Error uploading profile photo:', err);
      throw err;
    }
  };

  /**
   * Delete profile photo
   * Since we store the extension in the photoURL, we can parse it to find the exact file
   */
  const deleteProfilePhoto = async () => {
    if (!user) throw new Error('Not authenticated');

    try {
      // Try to get the extension from the current photoURL if available
      const currentPhotoURL = userProfile?.photoURL || '';
      let deletedSuccessfully = false;
      
      // If we have a current photo URL, try to extract the extension from it
      if (currentPhotoURL) {
        const match = currentPhotoURL.match(/photo\.(jpg|jpeg|png|gif|webp)/i);
        if (match) {
          try {
            const ext = match[1].toLowerCase();
            const photoRef = ref(storage, `users/${user.uid}/profile/photo.${ext}`);
            await deleteObject(photoRef);
            deletedSuccessfully = true;
          } catch {
            // Fall through to try all extensions
          }
        }
      }
      
      // If we couldn't delete by URL, try common extensions as fallback
      if (!deletedSuccessfully) {
        const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        for (const ext of extensions) {
          try {
            const photoRef = ref(storage, `users/${user.uid}/profile/photo.${ext}`);
            await deleteObject(photoRef);
          } catch {
            // Ignore errors for files that don't exist
          }
        }
      }
      
      // Update profile to remove photo URL
      await updateUserProfile({ photoURL: '' });
      
      // Update Firebase Auth profile
      await updateProfile(user, { photoURL: '' });
      
      return true;
    } catch (err) {
      console.error('Error deleting profile photo:', err);
      throw err;
    }
  };

  /**
   * Get display name for a user (with fallback to email)
   */
  const getDisplayName = (profile) => {
    if (!profile) return 'Unknown User';
    return profile.displayName || profile.email?.split('@')[0] || 'Unknown User';
  };

  return {
    userProfile,
    loading,
    error,
    getUserProfile,
    updateUserProfile,
    uploadProfilePhoto,
    deleteProfilePhoto,
    getDisplayName
  };
}

export default useUserProfile;
