import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

function AllItemsListView({ user, refreshTrigger }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const itemsPerPage = 50;
  const navigate = useNavigate();

  useEffect(() => {
    loadAllItems();
  }, [user, refreshTrigger]);

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
      setCurrentPage(1); // Reset to first page when items reload
    } catch (error) {
      console.error('Error loading items:', error);
      setLoading(false);
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = items.slice(startIndex, endIndex);

  const handleOpenUserModal = (item) => {
    // Get items uploaded by this user
    const userItems = items.filter(i => i.ownerId === item.ownerId);
    
    setSelectedUser({
      id: item.ownerId,
      name: item.ownerName,
      email: item.ownerEmail,
      photoURL: item.ownerPhotoURL,
      itemCount: userItems.length,
      items: userItems
    });
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setUserModalOpen(false);
    setSelectedUser(null);
  };

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">View Every Archive Item In Database</h2>
            <p className="text-gray-600 mt-2">Complete list of all archive items accessible to you</p>
          </div>
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
          <>
            {/* Results Summary */}
            <div className="mb-4 text-sm text-gray-600">
              Showing {startIndex + 1}-{Math.min(endIndex, items.length)} of {items.length} items
            </div>

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
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Uploaded By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedItems.map((item, index) => (
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenUserModal(item)}
                            className="flex items-center hover:bg-gray-100 rounded-lg px-2 py-1 -mx-2 transition-colors"
                          >
                            {item.ownerPhotoURL ? (
                              <img
                                src={item.ownerPhotoURL}
                                alt={item.ownerName || item.ownerEmail}
                                className="w-6 h-6 rounded-full mr-2"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold mr-2">
                                {(item.ownerName || item.ownerEmail || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <div className="text-sm text-gray-700 hover:text-primary">{item.ownerName || item.ownerEmail || 'Unknown'}</div>
                          </button>
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-700 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Last
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* User Profile Modal */}
      {userModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
                <button
                  onClick={handleCloseUserModal}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
                >
                  &times;
                </button>
                <h2 className="text-2xl font-bold text-primary">User Profile</h2>
              </div>

              <div className="p-6 space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  {selectedUser.photoURL ? (
                    <img
                      src={selectedUser.photoURL}
                      alt={selectedUser.name || selectedUser.email}
                      className="w-20 h-20 rounded-full border-4 border-white shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold border-4 border-white shadow-md">
                      {(selectedUser.name || selectedUser.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {selectedUser.name || 'No Name'}
                    </h3>
                    <p className="text-gray-600">{selectedUser.email}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      User ID: {selectedUser.id}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-primary">{selectedUser.itemCount}</div>
                    <div className="text-sm text-gray-600 mt-1">Archive Items</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {selectedUser.id === user.uid ? 'You' : 'Other'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {selectedUser.id === user.uid ? 'This is you!' : 'User Type'}
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Items Uploaded by This User
                  </h3>
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Title
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Category
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Type
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedUser.items.slice(0, 50).map((item, index) => (
                          <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {item.title || 'Untitled'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {item.category || 'N/A'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {item.itemType || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {selectedUser.items.length > 50 && (
                      <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 text-center border-t">
                        Showing first 50 of {selectedUser.items.length} items
                      </div>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCloseUserModal}
                    className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllItemsListView;
