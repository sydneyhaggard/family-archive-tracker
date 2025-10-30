import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage, MAX_FILE_SIZE } from '../config/firebase';

function MainApp({ user }) {
  const [items, setItems] = useState([]);
  const [storageUsage, setStorageUsage] = useState(0);
  const [loading, setLoading] = useState(true);

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
      
      setItems(Array.from(itemsMap.values()));
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

  const storageMB = (storageUsage / (1024 * 1024)).toFixed(2);
  const maxStorageGB = 5;

  return (
    <div>
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-2xl font-bold text-primary">Family Archive Tracker</h1>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <span className="text-gray-700 font-medium">{user.email}</span>
              <span className="text-sm text-gray-600 px-3 py-1.5 bg-gray-100 rounded-lg">
                Storage: {storageMB} MB / {maxStorageGB} GB
              </span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
            <button
              className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              + Add Archive Item
            </button>
          </div>

          {/* Items Grid */}
          {loading ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">Loading archive items...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">No archive items yet. Click "Add Archive Item" to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer transition transform hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="bg-gray-100">
                    {item.files && item.files.length > 0 && item.files[0].type?.startsWith('image') ? (
                      <img
                        src={item.files[0].url}
                        alt={item.title}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center text-6xl text-gray-400">
                        📦
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">{item.title}</h3>
                    <span className="inline-block px-3 py-1 text-xs font-medium text-white bg-primary rounded-full">
                      {item.category}
                    </span>
                    <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                      {item.description || 'No description'}
                    </p>
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
                      <span>📁 {item.files?.length || 0} file{item.files?.length !== 1 ? 's' : ''}</span>
                      {!item.isOwner && (
                        <span className="text-xs font-medium text-accent bg-accent bg-opacity-10 px-2 py-1 rounded">
                          Shared
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default MainApp;
