import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

function AdminDashboard() {
  const { user, isAdmin, refreshToken } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  
  // User Management State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userActionLoading, setUserActionLoading] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    displayName: '',
    storageLimit: 500
  });
  const [editFormError, setEditFormError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  
  // System Settings State
  const [config, setConfig] = useState({
    allowRegistration: true,
    enableGeminiAI: true,
    defaultStorageLimitMB: 500
  });
  const [configLoading, setConfigLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState('');

  // Name Cleanup State
  const [nameAnalysis, setNameAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResults, setCleanupResults] = useState(null);
  const [selectedForReview, setSelectedForReview] = useState({});
  const [showSuspiciousOnly, setShowSuspiciousOnly] = useState(false);

  // Firebase Functions
  const functions = getFunctions();

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  // Load users
  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadConfig();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const usersQuery = query(collection(db, 'users'), orderBy('email'));
      const snapshot = await getDocs(usersQuery);
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      const configRef = doc(db, 'system', 'config');
      const configSnap = await getDoc(configRef);
      
      if (configSnap.exists()) {
        setConfig(configSnap.data());
      } else {
        // Create default config if it doesn't exist
        const defaultConfig = {
          allowRegistration: true,
          enableGeminiAI: true,
          defaultStorageLimitMB: 500
        };
        await setDoc(configRef, defaultConfig);
        setConfig(defaultConfig);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleMakeAdmin = async (userEmail) => {
    if (!window.confirm(`Are you sure you want to make ${userEmail} an admin?`)) {
      return;
    }

    try {
      setUserActionLoading(userEmail);
      
      // Call Cloud Function to add admin role
      const addAdminRole = httpsCallable(functions, 'addAdminRole');
      const result = await addAdminRole({ email: userEmail });
      
      // Update local user data
      setUsers(prev => prev.map(u => 
        u.email === userEmail ? { ...u, isAdmin: true } : u
      ));
      
      alert(`${userEmail} is now an admin. They will need to sign out and back in for the change to take effect.`);
    } catch (error) {
      console.error('Error making user admin:', error);
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.code === 'functions/unavailable') {
        errorMessage = 'Cloud Functions are not available. Please ensure Firebase Functions are deployed.';
      } else if (error.code === 'functions/unauthenticated') {
        errorMessage = 'Authentication required. Please sign in again.';
      } else if (error.code === 'functions/permission-denied') {
        errorMessage = 'You do not have permission to perform this action.';
      }
      
      alert(`Error: ${errorMessage}`);
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleBanUser = async (userId, email, currentBanStatus) => {
    const action = currentBanStatus ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${action} ${email}?`)) {
      return;
    }

    try {
      setUserActionLoading(email);
      
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isBanned: !currentBanStatus,
        bannedAt: currentBanStatus ? null : new Date(),
        bannedBy: currentBanStatus ? null : user.uid
      });
      
      // Update local user data
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, isBanned: !currentBanStatus } : u
      ));
      
      alert(`${email} has been ${action}ned.`);
    } catch (error) {
      console.error(`Error ${action}ning user:`, error);
      alert(`Error: ${error.message}`);
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleOpenEditModal = (u) => {
    setEditingUser(u);
    setEditFormData({
      displayName: u.displayName || '',
      storageLimit: u.storageLimit || config.defaultStorageLimitMB || 500
    });
    setEditFormError('');
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingUser(null);
    setEditFormData({
      displayName: '',
      storageLimit: 500
    });
    setEditFormError('');
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    setEditFormError('');

    if (!editFormData.displayName.trim()) {
      setEditFormError('Display name cannot be empty');
      return;
    }

    if (editFormData.storageLimit < 0 || editFormData.storageLimit > 50000) {
      setEditFormError('Storage limit must be between 0 and 50000 MB');
      return;
    }

    try {
      setSavingEdit(true);
      
      const userRef = doc(db, 'users', editingUser.id);
      await updateDoc(userRef, {
        displayName: editFormData.displayName,
        storageLimit: editFormData.storageLimit,
        updatedAt: new Date(),
        updatedBy: user.uid
      });
      
      // Update local user data
      setUsers(prev => prev.map(u => 
        u.id === editingUser.id 
          ? { 
              ...u, 
              displayName: editFormData.displayName,
              storageLimit: editFormData.storageLimit
            } 
          : u
      ));
      
      handleCloseEditModal();
      alert('User updated successfully!');
    } catch (error) {
      console.error('Error updating user:', error);
      setEditFormError(`Error: ${error.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    
    try {
      setSavingConfig(true);
      setConfigMessage('');
      
      const configRef = doc(db, 'system', 'config');
      await setDoc(configRef, {
        ...config,
        updatedAt: new Date(),
        updatedBy: user.uid
      });
      
      setConfigMessage('Settings saved successfully!');
      setTimeout(() => setConfigMessage(''), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      setConfigMessage(`Error: ${error.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  // Name Cleanup Functions
  const handleAnalyzeNames = async () => {
    try {
      setAnalyzing(true);
      setNameAnalysis(null);
      setCleanupResults(null);
      
      const analyzeFunction = httpsCallable(functions, 'analyzeNamesForDuplicates');
      const result = await analyzeFunction({ ownerId: user.uid });
      
      setNameAnalysis(result.data);
      setSelectedForReview({});
    } catch (error) {
      console.error('Error analyzing names:', error);
      alert(`Error analyzing names: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCleanNames = async (autoApprove = true) => {
    const confirmMsg = autoApprove 
      ? `This will automatically clean ${nameAnalysis.duplicates.length - nameAnalysis.suspicious.length} non-suspicious duplicate names. Continue?`
      : `This will clean ${Object.keys(selectedForReview).filter(k => selectedForReview[k]).length} selected names. Continue?`;
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setCleaning(true);
      setCleanupResults(null);
      
      const cleanFunction = httpsCallable(functions, 'cleanDuplicateLastNames');
      const personIds = autoApprove ? undefined : Object.keys(selectedForReview).filter(k => selectedForReview[k]);
      
      const result = await cleanFunction({
        ownerId: user.uid,
        autoApprove,
        personIds
      });
      
      setCleanupResults(result.data);
      
      // Refresh analysis after cleanup
      setTimeout(() => {
        handleAnalyzeNames();
      }, 1000);
      
    } catch (error) {
      console.error('Error cleaning names:', error);
      alert(`Error cleaning names: ${error.message}`);
    } finally {
      setCleaning(false);
    }
  };

  const toggleReviewSelection = (personId) => {
    setSelectedForReview(prev => ({
      ...prev,
      [personId]: !prev[personId]
    }));
  };

  const selectAllSuspicious = () => {
    const newSelection = {};
    nameAnalysis.suspicious.forEach(item => {
      newSelection[item.personId] = true;
    });
    setSelectedForReview(newSelection);
  };

  const clearSelection = () => {
    setSelectedForReview({});
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">You do not have permission to access this page.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Manage users and system settings</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300"
            >
              ← Back to App
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            👥 User Management
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚙️ System Settings
          </button>
          <button
            onClick={() => setActiveTab('names')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'names'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🏷️ Name Cleanup
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'users' ? (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">User Management</h2>
                  <p className="text-gray-600 text-sm mt-1">
                    View all registered users and manage their roles
                  </p>
                </div>
                <button
                  onClick={() => navigate('/database-view')}
                  className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 whitespace-nowrap"
                >
                  📊 Database View
                </button>
              </div>
            </div>
            
            {usersLoading ? (
              <div className="p-8 text-center text-gray-500">
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No users found in the database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Storage Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id} className={u.isBanned ? 'bg-red-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt={u.displayName || u.email}
                                className="w-10 h-10 rounded-full"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold">
                                {(u.displayName || u.email || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {u.displayName || 'No Name'}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {u.id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{u.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {u.isAdmin && (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                Admin
                              </span>
                            )}
                            {u.isBanned ? (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                Banned
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                Active
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {u.storageUsed ? `${(u.storageUsed / (1024 * 1024)).toFixed(2)} MB` : '0 MB'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition"
                            >
                              Edit
                            </button>
                            {!u.isAdmin && u.id !== user.uid && (
                              <button
                                onClick={() => handleMakeAdmin(u.email)}
                                disabled={userActionLoading === u.email}
                                className="px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition disabled:opacity-50"
                              >
                                {userActionLoading === u.email ? '...' : 'Make Admin'}
                              </button>
                            )}
                            {u.id !== user.uid && (
                              <button
                                onClick={() => handleBanUser(u.id, u.email, u.isBanned)}
                                disabled={userActionLoading === u.email}
                                className={`px-3 py-1 text-xs rounded-lg transition disabled:opacity-50 ${
                                  u.isBanned
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                                }`}
                              >
                                {userActionLoading === u.email ? '...' : (u.isBanned ? 'Unban' : 'Ban')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'settings' ? (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">System Settings</h2>
              <p className="text-gray-600 text-sm mt-1">
                Configure global application settings
              </p>
            </div>
            
            {configLoading ? (
              <div className="p-8 text-center text-gray-500">
                Loading settings...
              </div>
            ) : (
              <form onSubmit={handleSaveConfig} className="p-6 space-y-6">
                {configMessage && (
                  <div className={`p-4 rounded-lg ${
                    configMessage.includes('Error')
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {configMessage}
                  </div>
                )}

                {/* Allow Registration */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Allow Registration</h3>
                    <p className="text-sm text-gray-500">
                      When disabled, only existing users can sign in (Invite Only mode)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.allowRegistration}
                      onChange={(e) => setConfig({ ...config, allowRegistration: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Enable Gemini AI */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Enable Gemini AI</h3>
                    <p className="text-sm text-gray-500">
                      Master switch for AI features (transcription, analysis). Disable to control API costs.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enableGeminiAI}
                      onChange={(e) => setConfig({ ...config, enableGeminiAI: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Default Storage Limit */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">Default Storage Limit</h3>
                    <span className="text-sm text-gray-500">{config.defaultStorageLimitMB} MB</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    Maximum storage per user in megabytes
                  </p>
                  <input
                    type="range"
                    min="100"
                    max="5000"
                    step="100"
                    value={config.defaultStorageLimitMB}
                    onChange={(e) => setConfig({ ...config, defaultStorageLimitMB: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>100 MB</span>
                    <span>2.5 GB</span>
                    <span>5 GB</span>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50"
                  >
                    {savingConfig ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : activeTab === 'names' ? (
          <div className="space-y-6">
            {/* Name Cleanup Header */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Duplicate Name Cleanup</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Find and fix duplicate last names in your Related People database
                </p>
              </div>

              <div className="p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-blue-900 mb-2">ℹ️ How it works:</h3>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Scans all Related People records for duplicate last names (e.g., "Haggard Haggard")</li>
                    <li>Cleans both the main name field AND relationship arrays (parents, siblings, spouses, children)</li>
                    <li>Flags suspicious cases like compound surnames for manual review</li>
                    <li>Uses Cloud Functions for safe, server-side processing</li>
                  </ul>
                </div>

                <button
                  onClick={handleAnalyzeNames}
                  disabled={analyzing}
                  className="w-full px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50 shadow-md hover:shadow-lg"
                >
                  {analyzing ? '🔍 Analyzing...' : '🔍 Analyze My Names'}
                </button>
              </div>
            </div>

            {/* Analysis Results */}
            {nameAnalysis && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">Analysis Results</h3>
                </div>

                <div className="p-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-gray-900">{nameAnalysis.total}</div>
                      <div className="text-sm text-gray-600 mt-1">Total People</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-green-700">{nameAnalysis.clean}</div>
                      <div className="text-sm text-gray-600 mt-1">Clean Names</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-yellow-700">{nameAnalysis.duplicates.length - nameAnalysis.suspicious.length}</div>
                      <div className="text-sm text-gray-600 mt-1">Auto-Fixable</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-red-700">{nameAnalysis.suspicious.length}</div>
                      <div className="text-sm text-gray-600 mt-1">Needs Review</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {nameAnalysis.duplicates.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-6">
                      <button
                        onClick={() => handleCleanNames(true)}
                        disabled={cleaning || nameAnalysis.duplicates.length === nameAnalysis.suspicious.length}
                        className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cleaning ? '🔄 Cleaning...' : `✨ Auto-Fix ${nameAnalysis.duplicates.length - nameAnalysis.suspicious.length} Names`}
                      </button>
                      <button
                        onClick={() => setShowSuspiciousOnly(!showSuspiciousOnly)}
                        className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition duration-300"
                      >
                        {showSuspiciousOnly ? '📋 Show All' : '⚠️ Show Suspicious Only'}
                      </button>
                    </div>
                  )}

                  {nameAnalysis.duplicates.length === 0 && (
                    <div className="text-center py-8 text-green-600">
                      <div className="text-4xl mb-2">✅</div>
                      <div className="text-lg font-semibold">All names are clean!</div>
                      <div className="text-sm text-gray-600 mt-1">No duplicate last names found.</div>
                    </div>
                  )}

                  {/* Duplicates List */}
                  {nameAnalysis.duplicates.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-800">
                          {showSuspiciousOnly ? 'Suspicious Cases (Manual Review)' : 'All Duplicates Found'}
                        </h4>
                        {nameAnalysis.suspicious.length > 0 && !showSuspiciousOnly && (
                          <div className="flex gap-2">
                            <button
                              onClick={selectAllSuspicious}
                              className="text-sm px-3 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                            >
                              Select All Suspicious
                            </button>
                            <button
                              onClick={clearSelection}
                              className="text-sm px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                            >
                              Clear Selection
                            </button>
                          </div>
                        )}
                      </div>

                      {Object.keys(selectedForReview).filter(k => selectedForReview[k]).length > 0 && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                          <span className="text-sm text-blue-800">
                            {Object.keys(selectedForReview).filter(k => selectedForReview[k]).length} names selected for manual cleanup
                          </span>
                          <button
                            onClick={() => handleCleanNames(false)}
                            disabled={cleaning}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition duration-300 disabled:opacity-50"
                          >
                            {cleaning ? '🔄 Processing...' : '✨ Clean Selected'}
                          </button>
                        </div>
                      )}

                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(showSuspiciousOnly ? nameAnalysis.suspicious : nameAnalysis.duplicates).map((item) => (
                          <div
                            key={item.personId}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              item.isSuspicious 
                                ? 'bg-yellow-50 border-yellow-300' 
                                : 'bg-gray-50 border-gray-200'
                            } ${selectedForReview[item.personId] ? 'ring-2 ring-blue-500' : ''}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {item.isSuspicious && (
                                    <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-semibold rounded">
                                      ⚠️ REVIEW
                                    </span>
                                  )}
                                  <span className="text-gray-600 text-xs">
                                    ID: {item.personId.substring(0, 8)}...
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-red-600 font-medium line-through">
                                    {item.originalName}
                                  </span>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-green-600 font-medium">
                                    {item.cleanedName}
                                  </span>
                                </div>
                                {item.isSuspicious && (
                                  <p className="text-xs text-yellow-700 mt-1">
                                    May be a compound surname. Review before cleaning.
                                  </p>
                                )}
                              </div>
                              {item.isSuspicious && (
                                <label className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedForReview[item.personId] || false}
                                    onChange={() => toggleReviewSelection(item.personId)}
                                    className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">Clean this</span>
                                </label>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cleanup Results */}
            {cleanupResults && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">Cleanup Results</h3>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-blue-700">{cleanupResults.totalProcessed}</div>
                      <div className="text-sm text-gray-600 mt-1">Processed</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-green-700">{cleanupResults.totalCleaned}</div>
                      <div className="text-sm text-gray-600 mt-1">Cleaned</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-red-700">{cleanupResults.errors.length}</div>
                      <div className="text-sm text-gray-600 mt-1">Errors</div>
                    </div>
                  </div>

                  {cleanupResults.cleanedCases.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-3">✅ Successfully Cleaned:</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {cleanupResults.cleanedCases.map((item, idx) => (
                          <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm">
                            <span className="text-red-600 line-through">{item.originalName}</span>
                            <span className="text-gray-400 mx-2">→</span>
                            <span className="text-green-600 font-medium">{item.cleanedName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cleanupResults.suspiciousCases.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-3">⚠️ Skipped (Suspicious):</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {cleanupResults.suspiciousCases.map((item, idx) => (
                          <div key={idx} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm">
                            {item.originalName}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cleanupResults.errors.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">❌ Errors:</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {cleanupResults.errors.map((error, idx) => (
                          <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm">
                            <div className="font-medium text-red-800">{error.name}</div>
                            <div className="text-red-600 text-xs mt-1">{error.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Edit User Modal */}
      {editModalOpen && editingUser && (
        <div className="fixed inset-0 glass-effect bg-opacity-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                <button
                  onClick={handleCloseEditModal}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
                  disabled={savingEdit}
                >
                  &times;
                </button>
                <h2 className="text-2xl font-bold text-primary">
                  Edit User: {editingUser.email}
                </h2>
              </div>

              <form onSubmit={handleSaveUserEdit} className="p-6 space-y-6">
                {editFormError && (
                  <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {editFormError}
                  </div>
                )}

                {/* User Info (Read-only) */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">User Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{editingUser.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">User ID</p>
                      <p className="font-medium text-gray-900 truncate">{editingUser.id}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Storage Used</p>
                      <p className="font-medium text-gray-900">
                        {editingUser.storageUsed ? `${(editingUser.storageUsed / (1024 * 1024)).toFixed(2)} MB` : '0 MB'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Status</p>
                      <p className="font-medium text-gray-900">
                        {editingUser.isAdmin ? '👑 Admin' : ''} 
                        {editingUser.isBanned ? '🚫 Banned' : '✅ Active'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.displayName}
                    onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter display name"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This name will be displayed throughout the app
                  </p>
                </div>

                {/* Storage Limit */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Storage Limit (MB)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      value={editFormData.storageLimit}
                      onChange={(e) => setEditFormData({ ...editFormData, storageLimit: parseInt(e.target.value) || 0 })}
                      min="0"
                      max="50000"
                      step="100"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                      ({(editFormData.storageLimit / 1024).toFixed(2)} GB)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10000"
                    step="100"
                    value={Math.min(editFormData.storageLimit, 10000)}
                    onChange={(e) => setEditFormData({ ...editFormData, storageLimit: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary mt-2"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0 MB</span>
                    <span>5 GB</span>
                    <span>10 GB</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Current usage: {editingUser.storageUsed ? `${(editingUser.storageUsed / (1024 * 1024)).toFixed(2)} MB` : '0 MB'}
                    {editingUser.storageUsed && editFormData.storageLimit > 0 && (
                      <span className="ml-2">
                        ({((editingUser.storageUsed / (1024 * 1024)) / editFormData.storageLimit * 100).toFixed(1)}% used)
                      </span>
                    )}
                  </p>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    disabled={savingEdit}
                    className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50"
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
