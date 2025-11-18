import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, increment, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, MAX_FILE_SIZE, GEMINI_API_KEY, GEMINI_API_URL } from '../config/firebase';

// Batch Upload Modal Component - allows uploading multiple files at once
// Each file will be saved as its own individual archive item
const ITEM_TYPES = [
  'Book',
  'Document',
  'Photo',
  'Video',
  'Audio Recording',
  'Artwork',
  'Clothing',
  'Jewelry',
  'Furniture',
  'Tool',
  'Toy',
  'Letter/Correspondence',
  'Certificate',
  'Newspaper',
  'Other'
];

const CATEGORIES = [
  'Family History',
  'Military',
  'Education',
  'Religious',
  'Professional',
  'Personal',
  'Medical',
  'Legal',
  'Financial',
  'Genealogy',
  'Other'
];

function BatchUploadModal({ isOpen, onClose, user, onSave }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultItemType, setDefaultItemType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [enableTranscription, setEnableTranscription] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([]);
      setDefaultCategory('');
      setDefaultItemType('');
      setError('');
      setUploadProgress(0);
      setCurrentFileIndex(0);
      setTotalFiles(0);
    }
  }, [isOpen]);

  // Add ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen && !uploading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, uploading, onClose]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      setError(`Some files exceed the ${maxSizeMB}MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }
    
    setSelectedFiles(files);
    setTotalFiles(files.length);
    setError('');
  };

  const getItemTypeFromFile = (file) => {
    // Auto-detect item type based on file type
    if (file.type.startsWith('image/')) return 'Photo';
    if (file.type.startsWith('video/')) return 'Video';
    if (file.type.startsWith('audio/')) return 'Audio Recording';
    if (file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text')) {
      return 'Document';
    }
    return 'Other';
  };

  const transcribeDocument = async (file, downloadURL) => {
    try {
      // Check if API key is configured
      if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not configured. Skipping transcription.');
        return '';
      }

      // For text files, read directly
      if (file.type === 'text/plain') {
        const text = await file.text();
        return text;
      }

      // For other documents and images, use Gemini API
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      // Different prompts for images vs documents
      const isImage = file.type.startsWith('image/');
      const promptText = isImage 
        ? "Please extract and transcribe all visible text from this image. Include any text from signs, documents, labels, or other written content visible in the image. If there is no text, describe what you see in the image in detail."
        : "Please extract and transcribe all text content from this document. Maintain the structure and formatting as much as possible. Provide only the transcribed text without any additional commentary.";

      const requestBody = {
        contents: [{
          parts: [
            {
              text: promptText
            },
            {
              inline_data: {
                mime_type: file.type,
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 8192,
        }
      };

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini API error:', response.status, errorData);
        throw new Error(`Failed to generate transcription: ${response.status}`);
      }

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        const transcription = data.candidates[0].content.parts[0].text;
        console.log(`Successfully transcribed ${file.name}: ${transcription.substring(0, 100)}...`);
        return transcription;
      }
      
      console.warn('No transcription candidates returned from API for', file.name);
      return '';
    } catch (error) {
      console.error(`Transcription error for ${file.name}:`, error);
      return '';
    }
  };

  const handleBatchUpload = async (e) => {
    e.preventDefault();
    setError('');

    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    if (!defaultCategory || !defaultItemType) {
      setError('Please select default Category and Item Type');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentFileIndex(i + 1);
        
        // Upload file to storage
        const timestamp = Date.now();
        const fileRef = ref(storage, `users/${user.uid}/items/${timestamp}_${file.name}`);
        const uploadResult = await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        const fileData = {
          name: file.name,
          url: downloadURL,
          type: file.type,
          size: file.size,
          path: fileRef.fullPath,
          uploadedAt: new Date().toISOString()
        };

        // Generate transcription if enabled
        let transcription = '';
        const isDocument = file.type.includes('pdf') || 
                         file.type.includes('document') || 
                         file.type.includes('text') ||
                         file.name.match(/\.(pdf|doc|docx|txt)$/i);
        
        const isImage = file.type.startsWith('image/');
        
        if (enableTranscription && (isDocument || isImage)) {
          console.log(`Attempting to transcribe ${isImage ? 'image' : 'document'}: ${file.name}`);
          transcription = await transcribeDocument(file, downloadURL);
          if (transcription) {
            console.log(`Transcription successful for ${file.name}, length: ${transcription.length}`);
            fileData.transcription = transcription;
          }
        }

        // Create title from filename (remove extension)
        const title = file.name.replace(/\.[^/.]+$/, '');
        
        // Determine item type (use default or auto-detect)
        const itemType = defaultItemType || getItemTypeFromFile(file);

        // Create archive item
        const itemData = {
          title: title,
          description: `Batch uploaded file: ${file.name}`,
          transcription: transcription || '',
          relatedDate: '',
          itemType: itemType,
          category: defaultCategory,
          physicalLocation: '',
          imagePosition: 'center',
          tags: ['batch-upload'],
          files: [fileData],
          ownerId: user.uid,
          ownerEmail: user.email,
          ownerName: user.displayName || user.email,
          ownerPhotoURL: user.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'archiveItems'), itemData);

        // Update user storage
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          storageUsed: increment(file.size)
        });

        // Update progress
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error in batch upload:', err);
      setError(`Error uploading files: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentFileIndex(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
              disabled={uploading}
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold text-primary">
              Batch Upload Files
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              Upload multiple files at once. Each file will be saved as its own archive item.
            </p>
          </div>

          <form onSubmit={handleBatchUpload} className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            {/* Default Settings */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Default Settings for All Items</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Default Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={defaultCategory}
                    onChange={(e) => setDefaultCategory(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select category...</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Default Item Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={defaultItemType}
                    onChange={(e) => setDefaultItemType(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Auto-detect from file type</option>
                    {ITEM_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave as "Auto-detect" to automatically determine type based on file
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableTranscription}
                    onChange={(e) => setEnableTranscription(e.target.checked)}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable AI transcription for documents and images
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Automatically extract text from uploaded files using AI (may increase upload time)
                </p>
              </div>
            </div>

            {/* File Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Files to Upload
              </label>
              <div className="bg-gray-50 p-4 rounded-lg mb-3">
                <p className="text-sm text-gray-600">
                  Maximum file size: <strong className="text-primary">{(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)} MB</strong> per file
                </p>
                <p className="text-sm text-gray-600">
                  Each file will become a separate archive item with its filename as the title
                </p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-secondary"
              />
              
              {selectedFiles.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Selected Files ({selectedFiles.length}):
                  </p>
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    <ul className="divide-y divide-gray-200">
                      {selectedFiles.map((file, index) => (
                        <li key={index} className="px-4 py-2 flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {file.type.startsWith('image/') ? (
                              <span className="text-2xl">🖼️</span>
                            ) : file.type.startsWith('video/') ? (
                              <span className="text-2xl">🎥</span>
                            ) : file.type.startsWith('audio/') ? (
                              <span className="text-2xl">🎵</span>
                            ) : (
                              <span className="text-2xl">📄</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <span className="inline-block px-2 py-1 text-xs font-medium text-white bg-primary rounded">
                              {defaultItemType || getItemTypeFromFile(file)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600">
                  Uploading file {currentFileIndex} of {totalFiles}... ({uploadProgress}%)
                </span>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || selectedFiles.length === 0}
                className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? `Uploading... (${currentFileIndex}/${totalFiles})` : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default BatchUploadModal;
