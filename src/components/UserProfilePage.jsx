import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';

function UserProfilePage({ user }) {
  const navigate = useNavigate();
  const { userProfile, loading, updateUserProfile, uploadProfilePhoto, deleteProfilePhoto } = useUserProfile();
  
  // Form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  
  // Photo state
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Form state
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load profile data when available
  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.bio || '');
      setLocation(userProfile.location || '');
      setWebsite(userProfile.website || '');
    }
  }, [userProfile]);

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be less than 2MB' });
      return;
    }

    setSelectedPhoto(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!selectedPhoto) return;

    try {
      setUploadingPhoto(true);
      setMessage({ type: '', text: '' });
      
      await uploadProfilePhoto(selectedPhoto);
      
      setSelectedPhoto(null);
      setPhotoPreview(null);
      setMessage({ type: 'success', text: 'Photo uploaded successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) {
      return;
    }

    try {
      setUploadingPhoto(true);
      setMessage({ type: '', text: '' });
      
      await deleteProfilePhoto();
      
      setMessage({ type: 'success', text: 'Photo removed successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      
      await updateUserProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim()
      });
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-primary hover:text-secondary font-medium mb-4 flex items-center gap-2"
          >
            ← Back to Home
          </button>
          <h1 className="text-3xl font-bold text-white">My Profile</h1>
          <p className="text-gray-600 mt-1">Manage your profile information and settings</p>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'error' 
              ? 'bg-red-100 text-red-700 border border-red-200' 
              : 'bg-green-100 text-green-700 border border-green-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Profile Header with Photo */}
          <div className="bg-gradient-to-r from-primary to-secondary p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Profile Photo */}
              <div className="relative">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName || 'Profile'}
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-white text-primary flex items-center justify-center text-5xl font-bold border-4 border-white shadow-lg">
                    {(displayName || user?.email || '?')[0].toUpperCase()}
                  </div>
                )}
                
                {/* Photo upload button */}
                <label className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer hover:bg-gray-100 transition">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <span className="text-xl">📷</span>
                </label>
              </div>

              {/* User Info */}
              <div className="text-center md:text-left text-white">
                <h2 className="text-2xl font-bold">
                  {displayName || user?.email?.split('@')[0] || 'User'}
                </h2>
                <p className="text-white/80">{user?.email}</p>
                {userProfile?.location && (
                  <p className="text-white/70 mt-1">📍 {userProfile.location}</p>
                )}
              </div>
            </div>

            {/* Photo actions */}
            {(selectedPhoto || userProfile?.photoURL) && (
              <div className="flex gap-3 mt-4 justify-center md:justify-start md:ml-38">
                {selectedPhoto && (
                  <>
                    <button
                      onClick={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="px-4 py-2 bg-white text-primary rounded-lg font-medium hover:bg-gray-100 transition disabled:opacity-50"
                    >
                      {uploadingPhoto ? 'Uploading...' : 'Save Photo'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPhoto(null);
                        setPhotoPreview(null);
                      }}
                      className="px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {!selectedPhoto && userProfile?.photoURL && (
                  <button
                    onClick={handlePhotoDelete}
                    disabled={uploadingPhoto}
                    className="px-4 py-2 bg-red-500/20 text-white rounded-lg font-medium hover:bg-red-500/30 transition disabled:opacity-50"
                  >
                    {uploadingPhoto ? 'Removing...' : 'Remove Photo'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                This name will be shown across the app when referencing you
              </p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us a little about yourself..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition resize-none"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State, Country"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-sm text-gray-500 mt-1">
                Email cannot be changed
              </p>
            </div>

            {/* Account Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">User ID:</span>
                  <span className="ml-2 font-mono text-gray-700">{user?.uid?.slice(0, 12)}...</span>
                </div>
                <div>
                  <span className="text-gray-500">Member since:</span>
                  <span className="ml-2 text-gray-700">
                    {userProfile?.createdAt 
                      ? new Date(
                          userProfile.createdAt.seconds 
                            ? userProfile.createdAt.seconds * 1000 
                            : userProfile.createdAt instanceof Date 
                              ? userProfile.createdAt.getTime()
                              : userProfile.createdAt
                        ).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* GEDCOM Import Card */}
        <div className="mt-6 bg-white rounded-xl shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Import Family Tree</h3>
              <p className="text-gray-600 text-sm">
                Upload a GEDCOM file to import your family tree data and related people into the archive.
              </p>
            </div>
            <button
              onClick={() => navigate('/gedcom-import')}
              className="px-6 py-3 bg-secondary text-white rounded-lg font-semibold hover:bg-primary transition duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 whitespace-nowrap"
            >
              📁 GEDCOM Import
            </button>
          </div>
        </div>

        {/* Storage Usage Card */}
        {userProfile?.storageUsed !== undefined && (
          <div className="mt-6 bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Storage Usage</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min((userProfile.storageUsed / (500 * 1024 * 1024)) * 100, 100)}%` 
                    }}
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600 whitespace-nowrap">
                {((userProfile.storageUsed || 0) / (1024 * 1024)).toFixed(2)} MB / 500 MB
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserProfilePage;
