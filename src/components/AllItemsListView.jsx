import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

function AllItemsListView({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadAllItems();
  }, [user]);

  const loadAllItems = async () => {
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
      
      // Sort items by creation date descending
      const allItems = Array.from(itemsMap.values()).sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });
      
      setItems(allItems);
      setLoading(false);
    } catch (error) {
      console.error('Error loading items:', error);
      setLoading(false);
    }
  };

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">View Every Archive Item In Database</h2>
            <p className="text-gray-600 mt-2">Complete list of all archive items accessible to you</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition duration-300 shadow-md hover:shadow-lg"
          >
            ← Back to Home
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">Loading archive items...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">No archive items found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-primary">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Title
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Item Type
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.title || 'Untitled'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{item.category || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{item.itemType || 'N/A'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <p className="text-sm text-gray-700">
                Total items: <span className="font-semibold">{items.length}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AllItemsListView;
