import React from 'react';
import { deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';

function ItemDetailModal({ isOpen, onClose, item, user, onEdit, onDelete }) {
  if (!isOpen || !item) return null;

  const isOwner = item.ownerId === user.uid;

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this archive item? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete files from storage
      if (item.files && item.files.length > 0) {
        let totalSize = 0;
        for (const file of item.files) {
          try {
            const fileRef = ref(storage, file.path);
            await deleteObject(fileRef);
            totalSize += file.size;
          } catch (error) {
            console.error('Error deleting file:', error);
          }
        }

        // Update user's storage usage
        if (totalSize > 0) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            storageUsed: increment(-totalSize)
          });
        }
      }

      // Delete item document
      await deleteDoc(doc(db, 'archiveItems', item.id));
      onDelete();
      onClose();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Error deleting item: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const stripHtml = (html) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
            >
              &times;
            </button>
          </div>

          <div className="p-6">
            {/* Header Section */}
            <div className="border-b border-gray-200 pb-6 mb-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-3">{item.title}</h2>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-block px-3 py-1 text-sm font-medium text-white bg-primary rounded-full">
                  {item.itemType}
                </span>
                <span className="inline-block px-3 py-1 text-sm font-medium text-white bg-secondary rounded-full">
                  {item.category}
                </span>
                {!isOwner && (
                  <span className="inline-block px-3 py-1 text-sm font-medium text-accent bg-accent bg-opacity-10 rounded-full">
                    Shared with you
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Owner:</span>
                  <span className="text-gray-600">{item.ownerEmail}</span>
                </div>
                
                {item.relatedDate && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Related Date:</span>
                    <span className="text-gray-600">{formatDate(item.relatedDate)}</span>
                  </div>
                )}
                
                {item.physicalLocation && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Physical Location:</span>
                    <span className="text-gray-600">{item.physicalLocation}</span>
                  </div>
                )}

                {item.createdAt && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Added:</span>
                    <span className="text-gray-600">
                      {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Media Section */}
            {item.files && item.files.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary mb-3">
                  Media ({item.files.length} file{item.files.length !== 1 ? 's' : ''})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {item.files.map((file, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition">
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        {file.type?.startsWith('image') ? (
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-36 object-cover"
                          />
                        ) : file.type?.startsWith('video') ? (
                          <video
                            src={file.url}
                            className="w-full h-36 object-cover"
                            controls
                          />
                        ) : (
                          <div className="w-full h-36 flex items-center justify-center bg-gray-50 text-5xl text-gray-400">
                            📄
                          </div>
                        )}
                        <div className="p-2 text-xs text-gray-700 text-center break-words">
                          {file.name}
                          <div className="text-gray-500 text-xs mt-1">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description Section */}
            {item.description && stripHtml(item.description) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary mb-3">Description</h3>
                <div 
                  className="prose max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: item.description }}
                />
              </div>
            )}

            {/* Transcription Section */}
            {item.transcription && stripHtml(item.transcription) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary mb-3">Transcription</h3>
                <div 
                  className="prose max-w-none text-gray-700 bg-blue-50 p-4 rounded-lg border border-blue-200"
                  dangerouslySetInnerHTML={{ __html: item.transcription }}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
              {isOwner && (
                <>
                  <button
                    onClick={() => {
                      onEdit(item);
                      onClose();
                    }}
                    className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition duration-300"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemDetailModal;
