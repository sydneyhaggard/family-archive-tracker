import React, { useState, useEffect } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { addDoc, updateDoc, doc, collection, serverTimestamp, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, MAX_FILE_SIZE, GEMINI_API_KEY, GEMINI_API_URL } from '../config/firebase';

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

function ItemFormModal({ isOpen, onClose, item, user, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    transcription: '',
    relatedDate: '',
    itemType: '',
    category: '',
    physicalLocation: '',
  });
  const [mediaFiles, setMediaFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title || '',
        description: item.description || '',
        transcription: item.transcription || '',
        relatedDate: item.relatedDate || '',
        itemType: item.itemType || '',
        category: item.category || '',
        physicalLocation: item.physicalLocation || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        transcription: '',
        relatedDate: '',
        itemType: '',
        category: '',
        physicalLocation: '',
      });
    }
    setMediaFiles([]);
    setError('');
  }, [item, isOpen]);

  // Add ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen && !uploading && !isTranscribing) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, uploading, isTranscribing, onClose]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      setError(`Some files exceed the ${maxSizeMB}MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }
    
    setMediaFiles(files);
    setError('');
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

  const handleGenerateTranscription = async () => {
    if (mediaFiles.length === 0) {
      setError('Please select files first to generate transcription.');
      return;
    }

    setIsTranscribing(true);
    setError('');
    
    try {
      let generatedTranscription = formData.transcription || '';

      for (const file of mediaFiles) {
        // Check if file is a document or image
        const isDocument = file.type.includes('pdf') || 
                         file.type.includes('document') || 
                         file.type.includes('text') ||
                         file.name.match(/\.(pdf|doc|docx|txt)$/i);
        
        const isImage = file.type.startsWith('image/');
        
        if (isDocument || isImage) {
          console.log(`Generating transcription for ${file.name}...`);
          const transcription = await transcribeDocument(file, null);
          
          if (transcription) {
            // Append to transcription field
            if (generatedTranscription) {
              generatedTranscription += `\n\n--- ${file.name} ---\n${transcription}`;
            } else {
              generatedTranscription = `--- ${file.name} ---\n${transcription}`;
            }
          }
        }
      }

      handleInputChange('transcription', generatedTranscription);
      console.log('Transcription generation complete');
    } catch (err) {
      console.error('Error generating transcription:', err);
      setError(`Error generating transcription: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.itemType || !formData.category) {
      setError('Please fill in all required fields (Title, Item Type, Category)');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      let uploadedFiles = [];
      let totalTranscription = formData.transcription;

      // Upload media files
      if (mediaFiles.length > 0) {
        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i];
          setUploadProgress(((i / mediaFiles.length) * 50).toFixed(0));

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

          // Auto-transcribe documents and images
          const isDocument = file.type.includes('pdf') || 
                           file.type.includes('document') || 
                           file.type.includes('text') ||
                           file.name.match(/\.(pdf|doc|docx|txt)$/i);
          
          const isImage = file.type.startsWith('image/');
          
          if (isDocument || isImage) {
            console.log(`Attempting to transcribe ${isImage ? 'image' : 'document'}: ${file.name}`);
            setUploadProgress(((i / mediaFiles.length) * 50 + 25).toFixed(0));
            const transcription = await transcribeDocument(file, downloadURL);
            if (transcription) {
              console.log(`Transcription successful for ${file.name}, length: ${transcription.length}`);
              fileData.transcription = transcription;
              // Append to main transcription field
              if (totalTranscription) {
                totalTranscription += `\n\n--- ${file.name} ---\n${transcription}`;
              } else {
                totalTranscription = `--- ${file.name} ---\n${transcription}`;
              }
            } else {
              console.log(`No transcription returned for ${file.name}`);
            }
          }

          uploadedFiles.push(fileData);
        }

        setUploadProgress(75);

        // Update user storage
        const totalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          storageUsed: increment(totalSize)
        });
      }

      setUploadProgress(90);

      // Save or update item
      const itemData = {
        ...formData,
        transcription: totalTranscription,
        ownerId: user.uid,
        ownerEmail: user.email,
        updatedAt: serverTimestamp(),
      };

      if (item) {
        // Update existing item
        const itemRef = doc(db, 'archiveItems', item.id);
        await updateDoc(itemRef, {
          ...itemData,
          files: [...(item.files || []), ...uploadedFiles]
        });
      } else {
        // Create new item
        itemData.files = uploadedFiles;
        itemData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'archiveItems'), itemData);
      }

      setUploadProgress(100);
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving item:', err);
      setError(`Error saving item: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
              disabled={uploading}
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold text-primary">
              {item ? 'Edit Archive Item' : 'Add Archive Item'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter item title"
              />
            </div>

            {/* Item Type and Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Item Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.itemType}
                  onChange={(e) => handleInputChange('itemType', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select item type...</option>
                  {ITEM_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select category...</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Related Date and Physical Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Related Date
                </label>
                <input
                  type="date"
                  value={formData.relatedDate}
                  onChange={(e) => handleInputChange('relatedDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Physical Location
                </label>
                <input
                  type="text"
                  value={formData.physicalLocation}
                  onChange={(e) => handleInputChange('physicalLocation', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Where is this item stored?"
                />
              </div>
            </div>

            {/* Media Files */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Media (Images, Videos, Documents)
              </label>
              <div className="bg-gray-50 p-4 rounded-lg mb-3">
                <p className="text-sm text-gray-600">
                  Maximum file size: <strong className="text-primary">{(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)} MB</strong> per file
                </p>
                <p className="text-sm text-gray-600">
                  Documents will be automatically transcribed using AI
                </p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-secondary"
              />
              {mediaFiles.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  {mediaFiles.length} file(s) selected
                </div>
              )}
            </div>

            {/* Description (Rich Text) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <CKEditor
                  editor={ClassicEditor}
                  data={formData.description}
                  onChange={(event, editor) => {
                    const data = editor.getData();
                    handleInputChange('description', data);
                  }}
                  config={{
                    toolbar: [
                      'heading', '|',
                      'bold', 'italic', 'underline', 'strikethrough', '|',
                      'bulletedList', 'numberedList', '|',
                      'link', '|',
                      'undo', 'redo'
                    ],
                    placeholder: 'Enter description...'
                  }}
                />
              </div>
            </div>

            {/* Transcription (Rich Text) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Transcription
              </label>
              <p className="text-xs text-gray-500 mb-2">
                This field will be automatically populated for uploaded documents. You can also add or edit transcription manually.
              </p>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <CKEditor
                  editor={ClassicEditor}
                  data={formData.transcription}
                  onChange={(event, editor) => {
                    const data = editor.getData();
                    handleInputChange('transcription', data);
                  }}
                  config={{
                    toolbar: [
                      'heading', '|',
                      'bold', 'italic', 'underline', '|',
                      'bulletedList', 'numberedList', '|',
                      'undo', 'redo'
                    ],
                    placeholder: 'Transcription will appear here...'
                  }}
                />
              </div>
              {/* Generate Transcription Button */}
              <button
                type="button"
                onClick={handleGenerateTranscription}
                disabled={isTranscribing || mediaFiles.length === 0 || uploading}
                className={`mt-3 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  isTranscribing || mediaFiles.length === 0 || uploading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-secondary text-white hover:bg-primary'
                }`}
              >
                {isTranscribing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating Transcription...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Generate Transcription from Files</span>
                  </>
                )}
              </button>
              {mediaFiles.length === 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Upload files first to generate transcription
                </p>
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
                  {uploadProgress < 50 ? 'Uploading files...' :
                   uploadProgress < 75 ? 'Transcribing documents...' :
                   uploadProgress < 90 ? 'Updating storage...' :
                   'Saving item...'}
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
                disabled={uploading}
                className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50"
              >
                {uploading ? 'Saving...' : (item ? 'Update Item' : 'Create Item')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ItemFormModal;
