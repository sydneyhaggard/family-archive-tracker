import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import ItemFormModal from './ItemFormModal';
import ItemDetailModal from './ItemDetailModal';
import BatchUploadModal from './BatchUploadModal';
import AllItemsPage from './AllItemsPage';
import AllItemsListView from './AllItemsListView';
import RelatedPeoplePage from './RelatedPeoplePage';
import EventManagementPage from './EventManagementPage';
import SourceManager from './SourceManager';
import GedcomUpload from './GedcomUpload';
import AdminDashboard from './AdminDashboard';
import UserProfilePage from './UserProfilePage';
import Header from './Header';
import UserProfileHeader from './UserProfileHeader';
import { stripHtml } from '../utils/helpers';

function MainApp({ user }) {
  const { isAdmin, userProfile, getDisplayName } = useAuth();
  const [items, setItems] = useState([]);
  const [storageUsage, setStorageUsage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isBatchUploadModalOpen, setIsBatchUploadModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadItems();
    updateStorageQuota();
  }, [user]);

  const loadItems = async () => {
    try {
      setLoading(true);
      
      // Get items owned by user
      const ownedQuery = query(
        collection(db, 'archiveItems'),
        where('ownerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const ownedSnapshot = await getDocs(ownedQuery);
      
      // Get items shared with user
      const sharedQuery = query(
        collection(db, 'archiveItems'),
        where('sharedWith', 'array-contains', user.email),
        orderBy('createdAt', 'desc')
      );
      const sharedSnapshot = await getDocs(sharedQuery);
      
      // Combine and deduplicate
      const itemsMap = new Map();
      
      ownedSnapshot.forEach(doc => {
        itemsMap.set(doc.id, { id: doc.id, ...doc.data(), isOwner: true });
      });
      
      sharedSnapshot.forEach(doc => {
        if (!itemsMap.has(doc.id)) {
          itemsMap.set(doc.id, { id: doc.id, ...doc.data(), isOwner: false });
        }
      });
      
      // Get all items sorted by creation date and limit to 10
      const allItems = Array.from(itemsMap.values())
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        })
        .slice(0, 6);
      
      setItems(allItems);
      setLoading(false);
    } catch (error) {
      console.error('Error loading items:', error);
      setLoading(false);
    }
  };

  const updateStorageQuota = async () => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setStorageUsage(userData?.storageUsed || 0);
      }
    } catch (error) {
      console.error('Error updating storage quota:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Error signing out');
    }
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setIsFormModalOpen(true);
  };

  const handleBatchUpload = () => {
    setIsBatchUploadModalOpen(true);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setIsFormModalOpen(true);
  };

  const handleViewItem = (item) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleSaveItem = async () => {
    await loadItems();
    await updateStorageQuota();
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDeleteItem = async () => {
    await loadItems();
    await updateStorageQuota();
    setRefreshTrigger(prev => prev + 1);
  };

  const storageMB = (storageUsage / (1024 * 1024)).toFixed(2);
  const maxStorageGB = 50;

  // If we're on the profile page, render that
  if (location.pathname === '/profile') {
    return (
      <div>
        <Header user={user} storageUsage={storageUsage} maxStorageGB={maxStorageGB} />

        <UserProfilePage user={user} />
      </div>
    );
  }

  // If we're on the admin page, render that instead
  if (location.pathname === '/admin') {
    return <AdminDashboard />;
  }

  // If we're on the sources page, render that instead
  if (location.pathname === '/sources') {
    return (
      <div>
        <Header user={user} storageUsage={storageUsage} maxStorageGB={maxStorageGB} />

        <SourceManager user={user} />
      </div>
    );
  }

  // If we're on the GEDCOM import page, render that instead
  if (location.pathname === '/gedcom-import') {
    return (
      <div>
        <Header user={user} storageUsage={storageUsage} maxStorageGB={maxStorageGB} />

        <GedcomUpload user={user} />
      </div>
    );
  }

  // If we're on the events page, render that instead
  if (location.pathname === '/events') {
    return (
      <div>
        <Header user={user} storageUsage={storageUsage} maxStorageGB={maxStorageGB} />

        <EventManagementPage user={user} />
      </div>
    );
  }

  // If we're on the people page, render that instead
  if (location.pathname === '/people') {
    return (
      <div>
        <Header user={user} storageUsage={storageUsage} maxStorageGB={maxStorageGB} />

        <RelatedPeoplePage user={user} />
      </div>
    );
  }

  // If we're on the database-view page, render that instead
  if (location.pathname === '/database-view') {
    return (
      <div>
        <Header user={user} storageUsage={storageUsage} maxStorageGB={maxStorageGB} />

        <AllItemsListView user={user} refreshTrigger={refreshTrigger} />

        {/* Modals */}
        <ItemFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          item={editingItem}
          user={user}
          onSave={handleSaveItem}
        />

        <BatchUploadModal
          isOpen={isBatchUploadModalOpen}
          onClose={() => setIsBatchUploadModalOpen(false)}
          user={user}
          onSave={handleSaveItem}
        />

        <ItemDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          item={selectedItem}
          user={user}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
        />
      </div>
    );
  }

  // If we're on the all-items page, render that instead
  if (location.pathname === '/all-items') {
    return (
      <div>
        <Header user={user} storageUsage={storageUsage} maxStorageGB={maxStorageGB} />

        <AllItemsPage user={user} onViewItem={handleViewItem} refreshTrigger={refreshTrigger} />

        {/* Modals */}
        <ItemFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          item={editingItem}
          user={user}
          onSave={handleSaveItem}
        />

        <BatchUploadModal
          isOpen={isBatchUploadModalOpen}
          onClose={() => setIsBatchUploadModalOpen(false)}
          user={user}
          onSave={handleSaveItem}
        />

        <ItemDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          item={selectedItem}
          user={user}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
        />
      </div>
    );
  }

  // Otherwise render the home page
  return (
    <div>
      <Header user={user} storageUsage={storageUsage} maxStorageGB={maxStorageGB} />

      {/* Main Content */}
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-6">
            <h2 className="text-4xl font-bold text-white uppercase font-yrt-school mb-2">Dashboard</h2>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
            <div className="flex gap-4">
              <button
                onClick={handleAddItem}
                className="button"
              >
                <img className="max-w-[20px] h-[20px] -mt-1" 
                  src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAABOUlEQVR4nO2YQUrDQBSG30IhpcUTKLjyCoq68G49R3Vf9BK61SN4hFYq2NJNPxl5Yoyd0Famztj/g0CS9zL/fEySxZgJ8T8BjoBb4BWYAHfAiRUoMeInI+DwNwMfANfAC2k59bywEjGG3nPWuB/mNghzbRO5YTt0PS+8TjEm3tOL1AdtIp8rcW6JAfY8awGMG8fCa/tLnrv02rht8A9SS3hWx+OmS2pTr3U2mqdEchVJzGxdEb6uv7E7IrYF9I2YRNIgEZNIGiRiEkmDREwiaZCISSQNQOVx83DeEJx7rcpexPMeifO08Tz/QOSitvXT5KoYEc8cxnYZSxMJ+79vNYkZcFyciOf2ayL9FfqzFekCz370ihWp/Y6rFXvzFVkHJJIZSCQzkEipIqVgLSIPlMN9ogUXQljGvAOaP4HQOnwgTgAAAABJRU5ErkJggg==" alt="create"
                  /> 
                  New Item
              </button>
              <button
                onClick={handleBatchUpload}
                className="button secondary"
              >
                <img className="max-w-[20px] h-[20px] -mt-1.5"
                  src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA80lEQVR4nO3WUWrCQBhF4bsKle5/Jc2LfapC0bqaU2ynNEoyBjpt79R7YDAYSP7PxBDphwNW56WeAzbAoayNegxYAy98dQIe1DmiPwwft9OxDP75Od4+2t9mXF6J1/OvP4KsRvt8rwwTiPL9e2XbG8MM4hpijaGCmILYYoB97U88BZl4KOz01wFPwPPck2gOMsLsgK3cowLpKgIxK5CWsbzh1jEq+4elJ9EvQB67gOgbWRwDhyEUiNkQCsRsCAViNoQCMRtCgZgNoUDMhpAPZKi95ncDaRGBlAJpHIGUAmkcgZQCaRyBlAJpHIH8V4hLugfIG93zuFkCNO7UAAAAAElFTkSuQmCC" alt="upload--v1"
                />
                Upload
              </button>
            </div>
            <button
              onClick={() => navigate('/all-items')}
              className="button outlined"
            >
              View All
            </button>
          </div>

          {/* Items Grid */}
          {loading ? (
            <div className="text-center py-16">
              <p className="text-white text-lg">Loading archive items...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-white text-lg">No archive items yet. Click "Add Archive Item" to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {items.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleViewItem(item)}
                  className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer transition transform hover:shadow-xl hover:-translate-y-1 glass-effect"
                >
                  <div className="bg-gray-100">
                    {item.files && item.files.length > 0 && item.files[0].type?.startsWith('image') ? (
                      <img
                        src={item.files[0].url}
                        alt={item.title}
                        className="w-full h-48 object-cover"
                        style={{ objectPosition: item.imagePosition || 'center' }}
                      />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center text-6xl text-gray-400">
                        📦
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-xs font-semibold text-white mb-1">{item.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <ItemFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        item={editingItem}
        user={user}
        onSave={handleSaveItem}
      />

      <BatchUploadModal
        isOpen={isBatchUploadModalOpen}
        onClose={() => setIsBatchUploadModalOpen(false)}
        user={user}
        onSave={handleSaveItem}
      />

      <ItemDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        item={selectedItem}
        user={user}
        onEdit={handleEditItem}
        onDelete={handleDeleteItem}
      />
    </div>
  );
}

export default MainApp;
