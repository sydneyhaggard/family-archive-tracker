import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
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
      // For text files, read directly
      if (file.type === 'text/plain') {
        const text = await file.text();
        return text;
      }

      // For other documents, use Gemini API
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

      const requestBody = {
        contents: [{
          parts: [
            {
              text: "Please extract and transcribe all text content from this document. Maintain the structure and formatting as much as possible. Provide only the transcribed text without any additional commentary."
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
        throw new Error('Failed to generate transcription');
      }

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        return data.candidates[0].content.parts[0].text;
      }
      
      return '';
    } catch (error) {
      console.error('Transcription error:', error);
      return '';
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

          // Auto-transcribe documents
          const isDocument = file.type.includes('pdf') || 
                           file.type.includes('document') || 
                           file.type.includes('text') ||
                           file.name.match(/\.(pdf|doc|docx|txt)$/i);
          
          if (isDocument) {
            setUploadProgress(((i / mediaFiles.length) * 50 + 25).toFixed(0));
            const transcription = await transcribeDocument(file, downloadURL);
            if (transcription) {
              fileData.transcription = transcription;
              // Append to main transcription field
              if (totalTranscription) {
                totalTranscription += `\n\n--- ${file.name} ---\n${transcription}`;
              } else {
                totalTranscription = `--- ${file.name} ---\n${transcription}`;
              }
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
              <ReactQuill
                theme="snow"
                value={formData.description}
                onChange={(value) => handleInputChange('description', value)}
                className="bg-white"
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link'],
                    ['clean']
                  ]
                }}
              />
            </div>

            {/* Transcription (Rich Text) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Transcription
              </label>
              <p className="text-xs text-gray-500 mb-2">
                This field will be automatically populated for uploaded documents. You can also add or edit transcription manually.
              </p>
              <ReactQuill
                theme="snow"
                value={formData.transcription}
                onChange={(value) => handleInputChange('transcription', value)}
                className="bg-white"
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['clean']
                  ]
                }}
              />
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
