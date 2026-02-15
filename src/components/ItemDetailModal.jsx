import React, { useState, useEffect } from 'react';
import { deleteDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import ItemEventLinker from './ItemEventLinker';
import ProvenanceTracker from './ProvenanceTracker';
import MediaGallery from './MediaGallery';
import ImageEditorModal from './ImageEditorModal';
import AISuggestionsReview from './AISuggestionsReview';
import { useNERAnalysis } from '../hooks/useNERAnalysis';
import { useRelatedPeople } from '../hooks/useRelatedPeople';

function ItemDetailModal({ isOpen, onClose, item, user, onEdit, onDelete }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFile, setEditorFile] = useState(null);
  const [liveItem, setLiveItem] = useState(item);

  // Keep liveItem in sync with prop changes
  useEffect(() => {
    setLiveItem(item);
  }, [item]);

  // Re-fetch item from Firestore to get updated data
  const refreshItem = async () => {
    if (!item?.id) return;
    try {
      const itemRef = doc(db, 'archiveItems', item.id);
      const snap = await getDoc(itemRef);
      if (snap.exists()) {
        setLiveItem({ id: snap.id, ...snap.data(), isOwner: item.isOwner });
      }
    } catch (err) {
      console.error('Failed to refresh item:', err);
    }
  };

  const { analyze, analyzing, results: nerResults, error: nerError, reset: resetNER } = useNERAnalysis();
  const { peopleList } = useRelatedPeople();

  // Add ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen && !galleryOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose, galleryOpen]);

  // Reset gallery and NER state when modal opens/closes
  const openEditor = (fileObj) => {
    setEditorFile(fileObj);
    setEditorOpen(true);
  };

  useEffect(() => {
    if (!isOpen) {
      setGalleryOpen(false);
      setGalleryIndex(0);
      setShowAISuggestions(false);
      setEditorOpen(false);
      setEditorFile(null);
      resetNER();
    }
  }, [isOpen, resetNER]);

  const openGallery = (index = 0) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  // Handle AI analysis
  const handleAnalyzeContent = async () => {
    // Gather content to analyze
    const contentParts = [];

    const currentData = liveItem || item;
    if (currentData.description) {
      contentParts.push(stripHtml(currentData.description));
    }
    if (currentData.transcription) {
      contentParts.push(stripHtml(currentData.transcription));
    }
    if (currentData.title) {
      contentParts.push(currentData.title);
    }

    const content = contentParts.join('\n\n');

    if (!content.trim()) {
      alert('No text content available to analyze. Add a description or transcription first.');
      return;
    }

    try {
      await analyze({
        content,
        existingPeople: peopleList,
        useCloudFunction: false // Use local analysis for now
      });
      setShowAISuggestions(true);
    } catch (err) {
      console.error('Analysis error:', err);
      alert('Analysis failed: ' + err.message);
    }
  };

  // Handle applying AI suggestions
  const handleApplySuggestions = async (appliedData) => {
    console.log('Applied AI suggestions:', appliedData);
    // The AISuggestionsReview component handles linking people
    // Additional handling for dates/locations/summary can be added here
    if (onDelete) {
      onDelete(); // Refresh the item data
    }
  };

  if (!isOpen || !item) return null;

  // Use liveItem (refreshed from Firestore after edits) for all rendering
  // Shadow the prop name so all existing references use the fresh data
  const currentItem = liveItem || item;

  const isOwner = currentItem.ownerId === user.uid;

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this archive item? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete files from storage
      if (currentItem.files && currentItem.files.length > 0) {
        let totalSize = 0;
        for (const file of currentItem.files) {
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
      await deleteDoc(doc(db, 'archiveItems', currentItem.id));
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
    <div className="fixed inset-0 glass-effect bg-opacity-0 z-50 overflow-y-auto">
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
              <h2 className="text-3xl font-bold text-accent mb-3">{currentItem.title}</h2>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-block px-3 py-1 text-sm font-medium text-white bg-primary rounded-full">
                  {currentItem.itemType}
                </span>
                <span className="inline-block px-3 py-1 text-sm font-medium text-white bg-secondary rounded-full">
                  {currentItem.category}
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
                  <span className="text-gray-600">{currentItem.ownerEmail}</span>
                </div>

                {currentItem.relatedDate && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Related Date:</span>
                    <span className="text-gray-600">{formatDate(currentItem.relatedDate)}</span>
                  </div>
                )}

                {currentItem.physicalLocation && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Physical Location:</span>
                    <span className="text-gray-600">{currentItem.physicalLocation}</span>
                  </div>
                )}

                {currentItem.createdAt && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Added:</span>
                    <span className="text-gray-600">
                      {new Date(currentItem.createdAt.seconds * 1000).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Media Section - Prominent Preview */}
            {currentItem.files && currentItem.files.length > 0 && (
              <div className="mb-6">
                {/* Primary File Preview */}
                <div className="mb-4">
                  {(() => {
                    const primaryFile = currentItem.files[0];
                    const isImage = primaryFile?.type?.startsWith('image');
                    const isVideo = primaryFile?.type?.startsWith('video');
                    const isAudio = primaryFile?.type?.startsWith('audio');

                    return (
                      <div
                        className="relative bg-gray-900 rounded-xl overflow-hidden cursor-pointer group"
                        onClick={() => openGallery(0)}
                      >
                        {isImage && (
                          <div className="relative">
                            <img
                              src={primaryFile.url}
                              alt={primaryFile.name}
                              className="w-full max-h-96 object-contain mx-auto"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-white/90 rounded-full p-3">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {isVideo && (
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <video
                              src={primaryFile.url}
                              controls
                              className="w-full max-h-96 mx-auto"
                            >
                              Your browser does not support the video tag.
                            </video>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openGallery(0);
                              }}
                              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition"
                              title="Open in fullscreen"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                              </svg>
                            </button>
                          </div>
                        )}
                        {isAudio && (
                          <div className="p-8 flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                            <div className="text-6xl">🎵</div>
                            <audio
                              src={primaryFile.url}
                              controls
                              className="w-full max-w-md"
                            >
                              Your browser does not support the audio tag.
                            </audio>
                          </div>
                        )}
                        {!isImage && !isVideo && !isAudio && (
                          <div className="p-8 flex flex-col items-center gap-4">
                            <div className="text-6xl">📄</div>
                            <p className="text-white text-lg">{primaryFile.name}</p>
                            <p className="text-gray-400">
                              {(primaryFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(primaryFile.url, '_blank');
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                            >
                              Open File
                            </button>
                          </div>
                        )}

                        {/* Gallery indicator for multiple files */}
                        {currentItem.files.length > 1 && (
                          <div className="absolute top-3 left-3 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                            1 / {currentItem.files.length}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="absolute top-3 right-3 flex gap-2">
                          {isImage && isOwner && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditor(primaryFile);
                              }}
                              className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition"
                              title="Edit image"
                            >
                              <span className="text-sm">✏️</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Download the file
                              const link = document.createElement('a');
                              link.href = primaryFile.url;
                              link.download = primaryFile.name;
                              link.target = '_blank';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition"
                            title="Download"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(primaryFile.url, '_blank');
                            }}
                            className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition"
                            title="Open in new tab"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Thumbnail Grid for Multiple Files */}
                {currentItem.files.length > 1 && (
                  <div>
                    <h3 className="text-lg font-semibold text-primary mb-3">
                      All Files ({currentItem.files.length})
                    </h3>
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {currentItem.files.map((file, index) => {
                        const isImage = file?.type?.startsWith('image');
                        const isVideo = file?.type?.startsWith('video');
                        const isAudio = file?.type?.startsWith('audio');

                        return (
                          <button
                            key={index}
                            onClick={() => openGallery(index)}
                            className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-primary transition group"
                          >
                            {isImage ? (
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            ) : isVideo ? (
                              <div className="w-full h-full bg-gray-700 flex items-center justify-center text-3xl">
                                🎬
                              </div>
                            ) : isAudio ? (
                              <div className="w-full h-full bg-gray-700 flex items-center justify-center text-3xl">
                                🎵
                              </div>
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-3xl">
                                📄
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 text-white font-medium transition-opacity text-xs text-center px-1">
                                View
                              </span>
                            </div>
                            {isImage && isOwner && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditor(file);
                                }}
                                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                title="Edit image"
                              >
                                <span className="text-xs">✏️</span>
                              </button>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description Section */}
            {currentItem.description && stripHtml(currentItem.description) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary mb-3">Description</h3>
                <div
                  className="prose max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: currentItem.description }}
                />
              </div>
            )}

            {/* Transcription Section */}
            {currentItem.transcription && stripHtml(currentItem.transcription) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-primary mb-3">Transcription</h3>
                <div
                  className="prose max-w-none text-gray-700 bg-blue-50 p-4 rounded-lg border border-blue-200"
                  dangerouslySetInnerHTML={{ __html: currentItem.transcription }}
                />
              </div>
            )}

            {/* AI Analysis Section */}
            {isOwner && (currentItem.description || currentItem.transcription) && (
              <div className="mb-6">
                {!showAISuggestions ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleAnalyzeContent}
                      disabled={analyzing}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50 flex items-center gap-2 shadow-md"
                    >
                      {analyzing ? (
                        <>
                          <span className="animate-spin">🔄</span>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <span>🤖</span>
                          AI: Extract Metadata
                        </>
                      )}
                    </button>
                    <span className="text-sm text-gray-500">
                      Automatically detect people, dates, and locations
                    </span>
                  </div>
                ) : (
                  <AISuggestionsReview
                    results={nerResults}
                    itemId={currentItem.id}
                    onApply={handleApplySuggestions}
                    onDismiss={() => {
                      setShowAISuggestions(false);
                      resetNER();
                    }}
                    onClose={() => {
                      setShowAISuggestions(false);
                      resetNER();
                    }}
                  />
                )}
                {nerError && (
                  <p className="mt-2 text-sm text-red-600">
                    Analysis error: {nerError}
                  </p>
                )}
              </div>
            )}

            {/* Event Association Section */}
            {isOwner && (
              <div className="mb-6">
                <ItemEventLinker item={currentItem} onUpdate={onDelete} />
              </div>
            )}

            {/* Provenance / Transfer Log Section */}
            {isOwner && (
              <div className="mb-6">
                <ProvenanceTracker itemId={currentItem.id} />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
              {isOwner && (
                <>
                  <button
                    onClick={() => {
                      onEdit(currentItem);
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

      {/* Full-page Media Gallery */}
      <MediaGallery
        files={currentItem.files || []}
        initialIndex={galleryIndex}
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onEditFile={isOwner ? openEditor : undefined}
      />

      {/* Image Editor */}
      <ImageEditorModal
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditorFile(null);
        }}
        file={editorFile}
        item={currentItem}
        user={user}
        onSave={async () => {
          await refreshItem();
          if (onDelete) onDelete(); // also refresh parent list
        }}
      />
    </div>
  );
}

export default ItemDetailModal;
