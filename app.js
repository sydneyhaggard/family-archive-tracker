// Global variables
let currentUser = null;
let allItems = [];
let userStorageUsage = 0;

// Authentication state observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('user-display').textContent = user.email;
        
        await updateStorageQuota();
        loadArchiveItems();
    } else {
        currentUser = null;
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('app-section').style.display = 'none';
    }
});

// Toggle between sign in and sign up forms
function toggleAuthForm() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    }
}

// Sign up new user
async function signUp() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    
    if (!name || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Update user profile with name
        await userCredential.user.updateProfile({
            displayName: name
        });
        
        // Create user document in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            storageUsed: 0
        });
        
        alert('Account created successfully!');
    } catch (error) {
        console.error('Sign up error:', error);
        alert('Error: ' + error.message);
    }
}

// Sign in existing user
async function signIn() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error('Sign in error:', error);
        alert('Error: ' + error.message);
    }
}

// Sign out user
async function signOut() {
    try {
        await auth.signOut();
        allItems = [];
        userStorageUsage = 0;
    } catch (error) {
        console.error('Sign out error:', error);
        alert('Error signing out');
    }
}

// Calculate and update storage quota display
async function updateStorageQuota() {
    try {
        // Get user's storage usage from Firestore
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        userStorageUsage = userData?.storageUsed || 0;
        
        // Calculate storage in MB
        const storageMB = (userStorageUsage / (1024 * 1024)).toFixed(2);
        
        // Firebase Storage free tier is 5 GB, showing as example
        const maxStorageGB = 5;
        const maxStorageMB = maxStorageGB * 1024;
        const usagePercent = ((userStorageUsage / (maxStorageMB * 1024 * 1024)) * 100).toFixed(1);
        
        const storageDisplay = document.getElementById('storage-quota');
        storageDisplay.textContent = `Storage: ${storageMB} MB / ${maxStorageGB} GB (${usagePercent}%)`;
        
        // Warn if approaching quota
        if (usagePercent >= STORAGE_QUOTA_WARNING_THRESHOLD * 100) {
            storageDisplay.style.color = 'var(--danger-color)';
            storageDisplay.style.fontWeight = 'bold';
        } else {
            storageDisplay.style.color = 'var(--text-light)';
            storageDisplay.style.fontWeight = 'normal';
        }
    } catch (error) {
        console.error('Error updating storage quota:', error);
    }
}

// Load archive items
async function loadArchiveItems() {
    try {
        const itemsContainer = document.getElementById('items-container');
        const noItems = document.getElementById('no-items');
        
        itemsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Loading...</p>';
        
        // Get items owned by user
        const ownedItems = await db.collection('archiveItems')
            .where('ownerId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        // Get items shared with user
        const sharedItems = await db.collection('archiveItems')
            .where('sharedWith', 'array-contains', currentUser.email)
            .orderBy('createdAt', 'desc')
            .get();
        
        // Combine and deduplicate items
        const itemsMap = new Map();
        
        ownedItems.forEach(doc => {
            itemsMap.set(doc.id, { id: doc.id, ...doc.data(), isOwner: true });
        });
        
        sharedItems.forEach(doc => {
            if (!itemsMap.has(doc.id)) {
                itemsMap.set(doc.id, { id: doc.id, ...doc.data(), isOwner: false });
            }
        });
        
        allItems = Array.from(itemsMap.values());
        
        // Update category filter
        updateCategoryFilter();
        
        // Display items
        displayItems(allItems);
        
        if (allItems.length === 0) {
            itemsContainer.innerHTML = '';
            noItems.style.display = 'block';
        } else {
            noItems.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading items:', error);
        alert('Error loading archive items: ' + error.message);
    }
}

// Display items in grid
function displayItems(items) {
    const itemsContainer = document.getElementById('items-container');
    
    if (items.length === 0) {
        itemsContainer.innerHTML = '<div class="col-span-full text-center py-16 text-gray-500 text-lg">No items found</div>';
        return;
    }
    
    itemsContainer.innerHTML = items.map(item => {
        const thumbnail = item.files && item.files.length > 0 
            ? (item.files[0].type.startsWith('image') 
                ? `<img src="${item.files[0].url}" alt="${item.title}" class="w-full h-48 object-cover">`
                : `<div class="w-full h-48 flex items-center justify-center text-6xl text-gray-400">📄</div>`)
            : `<div class="w-full h-48 flex items-center justify-center text-6xl text-gray-400">📦</div>`;
        
        const sharedLabel = !item.isOwner ? '<span class="text-xs font-medium text-accent bg-accent bg-opacity-10 px-2 py-1 rounded">Shared with you</span>' : '';
        const filesCount = item.files ? item.files.length : 0;
        
        return `
            <div class="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer transition transform hover:shadow-xl hover:-translate-y-1" onclick="viewItem('${item.id}')">
                <div class="bg-gray-100">
                    ${thumbnail}
                </div>
                <div class="p-5">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-gray-800 mb-1">${escapeHtml(item.title)}</h3>
                            <span class="inline-block px-3 py-1 text-xs font-medium text-white bg-primary rounded-full">${escapeHtml(item.category)}</span>
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm mt-2 line-clamp-2">${escapeHtml(item.description || 'No description')}</p>
                    <div class="flex justify-between items-center mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
                        <span>📁 ${filesCount} file${filesCount !== 1 ? 's' : ''}</span>
                        ${sharedLabel}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update category filter dropdown
function updateCategoryFilter() {
    const categoryFilter = document.getElementById('category-filter');
    const categories = [...new Set(allItems.map(item => item.category))].sort();
    
    categoryFilter.innerHTML = '<option value="all">All Categories</option>' +
        categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
}

// Filter items by category
function filterByCategory() {
    const selectedCategory = document.getElementById('category-filter').value;
    const searchTerm = document.getElementById('search-box').value.toLowerCase();
    
    let filtered = allItems;
    
    if (selectedCategory !== 'all') {
        filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(item => 
            item.title.toLowerCase().includes(searchTerm) ||
            (item.description && item.description.toLowerCase().includes(searchTerm)) ||
            item.category.toLowerCase().includes(searchTerm)
        );
    }
    
    displayItems(filtered);
}

// Search items
function searchItems() {
    filterByCategory(); // Reuse the same filtering logic
}

// Show add item modal
function showAddItemModal() {
    document.getElementById('item-modal').classList.remove('hidden');
    document.getElementById('modal-title').textContent = 'Add Archive Item';
    document.getElementById('item-form').reset();
    document.getElementById('item-id').value = '';
    document.getElementById('file-preview').innerHTML = '';
    document.getElementById('upload-progress').classList.add('hidden');
    
    // Update max file size display
    const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    document.getElementById('max-file-size').textContent = `${maxSizeMB} MB`;
}

// Close item modal
function closeItemModal() {
    document.getElementById('item-modal').classList.add('hidden');
}

// Save archive item
async function saveItem(event) {
    event.preventDefault();
    
    const title = document.getElementById('item-title').value.trim();
    const description = document.getElementById('item-description').value.trim();
    const category = document.getElementById('item-category').value.trim();
    const date = document.getElementById('item-date').value.trim();
    const location = document.getElementById('item-location').value.trim();
    const sharedWithInput = document.getElementById('item-shared-with').value.trim();
    const itemId = document.getElementById('item-id').value;
    const files = document.getElementById('item-files').files;
    
    if (!title || !category) {
        alert('Please fill in required fields (Title and Category)');
        return;
    }
    
    try {
        // Validate file sizes
        let totalFileSize = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > MAX_FILE_SIZE) {
                const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
                alert(`File "${file.name}" exceeds maximum size of ${maxSizeMB} MB. Please choose a smaller file.`);
                return;
            }
            totalFileSize += file.size;
        }
        
        // Check if total upload would exceed a reasonable limit
        if (totalFileSize > MAX_FILE_SIZE * 5) { // Max 50 MB per item
            alert('Total file size for this item exceeds 50 MB. Please reduce the number or size of files.');
            return;
        }
        
        // Parse shared with emails
        const sharedWith = sharedWithInput 
            ? sharedWithInput.split(',').map(email => email.trim()).filter(email => email)
            : [];
        
        // Upload files if any
        let uploadedFiles = [];
        if (files.length > 0) {
            document.getElementById('upload-progress').classList.remove('hidden');
            document.getElementById('progress-text').textContent = 'Uploading files...';
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const progressPercent = ((i / files.length) * 100).toFixed(0);
                document.getElementById('progress-fill').style.width = progressPercent + '%';
                document.getElementById('progress-text').textContent = `Uploading ${i + 1}/${files.length}...`;
                
                const fileRef = storage.ref(`users/${currentUser.uid}/items/${Date.now()}_${file.name}`);
                const uploadTask = await fileRef.put(file);
                const downloadURL = await uploadTask.ref.getDownloadURL();
                
                const fileData = {
                    name: file.name,
                    url: downloadURL,
                    type: file.type,
                    size: file.size,
                    path: fileRef.fullPath
                };
                
                // Check if file is a document and generate transcription
                if (isDocumentFile(file)) {
                    document.getElementById('progress-text').textContent = `Generating transcription for ${file.name}...`;
                    try {
                        const transcription = await generateTranscription(file, downloadURL);
                        fileData.transcription = transcription;
                        fileData.hasTranscription = true;
                    } catch (error) {
                        console.error('Error generating transcription:', error);
                        fileData.transcription = 'Transcription failed: ' + error.message;
                        fileData.hasTranscription = false;
                    }
                } else if (file.type.startsWith('image/')) {
                    // For images, generate description using Gemini Vision
                    document.getElementById('progress-text').textContent = `Analyzing image ${file.name}...`;
                    try {
                        const description = await generateImageDescription(file, downloadURL);
                        fileData.aiDescription = description;
                        fileData.hasAIDescription = true;
                    } catch (error) {
                        console.error('Error generating image description:', error);
                        fileData.aiDescription = 'Analysis failed: ' + error.message;
                        fileData.hasAIDescription = false;
                    }
                }
                
                uploadedFiles.push(fileData);
            }
            
            document.getElementById('progress-fill').style.width = '100%';
            document.getElementById('progress-text').textContent = 'Upload complete!';
            
            // Update user's storage usage
            await updateUserStorage(totalFileSize);
        }
        
        // Create/update item document
        const itemData = {
            title,
            description,
            category,
            date,
            location,
            sharedWith,
            ownerId: currentUser.uid,
            ownerEmail: currentUser.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (itemId) {
            // Update existing item
            if (uploadedFiles.length > 0) {
                // Append new files to existing ones
                await db.collection('archiveItems').doc(itemId).update({
                    ...itemData,
                    files: firebase.firestore.FieldValue.arrayUnion(...uploadedFiles)
                });
            } else {
                await db.collection('archiveItems').doc(itemId).update(itemData);
            }
        } else {
            // Create new item
            itemData.files = uploadedFiles;
            itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('archiveItems').add(itemData);
        }
        
        closeItemModal();
        await loadArchiveItems();
        alert('Archive item saved successfully!');
    } catch (error) {
        console.error('Error saving item:', error);
        alert('Error saving item: ' + error.message);
    }
}

// Update user storage usage
async function updateUserStorage(additionalBytes) {
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        await userRef.update({
            storageUsed: firebase.firestore.FieldValue.increment(additionalBytes)
        });
        await updateStorageQuota();
    } catch (error) {
        console.error('Error updating storage usage:', error);
    }
}

// Check if file is a document type
function isDocumentFile(file) {
    const documentTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/html',
        'application/rtf',
        'text/markdown'
    ];
    return documentTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.md');
}

// Convert file to base64
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Generate transcription for documents using Gemini API
async function generateTranscription(file, downloadURL) {
    try {
        // For text files, read the content directly
        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            const text = await file.text();
            return text;
        }
        
        // For PDFs and other documents, use Gemini to extract text
        const base64Data = await fileToBase64(file);
        
        const requestBody = {
            contents: [{
                parts: [
                    {
                        text: "Please extract and transcribe all text content from this document. Maintain the structure and formatting as much as possible. If this is a handwritten document, transcribe the handwriting. Provide only the transcribed text without any additional commentary."
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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to generate transcription');
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0) {
            const transcription = data.candidates[0].content.parts[0].text;
            return transcription;
        } else {
            throw new Error('No transcription generated');
        }
    } catch (error) {
        console.error('Transcription error:', error);
        throw error;
    }
}

// Generate AI description for images using Gemini Vision
async function generateImageDescription(file, downloadURL) {
    try {
        const base64Data = await fileToBase64(file);
        
        const requestBody = {
            contents: [{
                parts: [
                    {
                        text: "Analyze this image and provide a detailed description. Include: 1) What is visible in the image, 2) Any text or writing visible, 3) The approximate time period or era (if determinable), 4) Any notable people, places, or objects. Be thorough but concise."
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
                temperature: 0.4,
                topK: 32,
                topP: 1,
                maxOutputTokens: 2048,
            }
        };
        
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to generate description');
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0) {
            const description = data.candidates[0].content.parts[0].text;
            return description;
        } else {
            throw new Error('No description generated');
        }
    } catch (error) {
        console.error('Image description error:', error);
        throw error;
    }
}

// View item details
async function viewItem(itemId) {
    try {
        const doc = await db.collection('archiveItems').doc(itemId).get();
        
        if (!doc.exists) {
            alert('Item not found');
            return;
        }
        
        const item = { id: doc.id, ...doc.data() };
        const isOwner = item.ownerId === currentUser.uid;
        
        const filesHtml = item.files && item.files.length > 0 
            ? `
                <div class="mt-6">
                    <h3 class="text-lg font-semibold text-primary mb-3">Files (${item.files.length})</h3>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        ${item.files.map((file, index) => {
                            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                            let fileCard = '';
                            
                            if (file.type.startsWith('image')) {
                                fileCard = `
                                    <div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition">
                                        <a href="${file.url}" target="_blank">
                                            <img src="${file.url}" alt="${file.name}" class="w-full h-36 object-cover">
                                            <div class="p-2 text-xs text-gray-700 text-center break-words">${escapeHtml(file.name)} (${fileSizeMB} MB)</div>
                                        </a>
                                        ${file.hasAIDescription ? `
                                            <div class="p-2 border-t border-gray-200">
                                                <button onclick="showAIDescription(${index}, '${item.id}')" class="text-xs text-blue-600 hover:underline flex items-center gap-1 w-full justify-center">
                                                    <span>🤖</span> View AI Analysis
                                                </button>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            } else if (file.type.startsWith('video')) {
                                fileCard = `
                                    <div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition">
                                        <a href="${file.url}" target="_blank">
                                            <video src="${file.url}" class="w-full h-36 object-cover" controls></video>
                                            <div class="p-2 text-xs text-gray-700 text-center break-words">${escapeHtml(file.name)} (${fileSizeMB} MB)</div>
                                        </a>
                                    </div>
                                `;
                            } else {
                                fileCard = `
                                    <div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition">
                                        <a href="${file.url}" target="_blank">
                                            <div class="w-full h-36 flex items-center justify-center bg-gray-50 text-5xl text-gray-400">📄</div>
                                            <div class="p-2 text-xs text-gray-700 text-center break-words">${escapeHtml(file.name)} (${fileSizeMB} MB)</div>
                                        </a>
                                        ${file.hasTranscription ? `
                                            <div class="p-2 border-t border-gray-200">
                                                <button onclick="showTranscription(${index}, '${item.id}')" class="text-xs text-blue-600 hover:underline flex items-center gap-1 w-full justify-center">
                                                    <span>📝</span> View Transcription
                                                </button>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }
                            return fileCard;
                        }).join('')}
                    </div>
                </div>
            `
            : '<p class="text-gray-500 mt-4">No files attached</p>';
        
        const sharedInfo = item.sharedWith && item.sharedWith.length > 0
            ? `<div class="flex items-center gap-2"><strong class="text-gray-700">Shared with:</strong> <span class="text-gray-600">${item.sharedWith.join(', ')}</span></div>`
            : '';
        
        const ownerInfo = !isOwner 
            ? `<div class="flex items-center gap-2"><strong class="text-gray-700">Owner:</strong> <span class="text-gray-600">${item.ownerEmail}</span></div>`
            : '';
        
        const viewContent = `
            <div class="border-b border-gray-200 pb-4 mb-6">
                <h2 class="text-3xl font-bold text-gray-800 mb-2">${escapeHtml(item.title)}</h2>
                <span class="inline-block px-3 py-1 text-sm font-medium text-white bg-primary rounded-full">${escapeHtml(item.category)}</span>
                <div class="flex flex-wrap gap-4 mt-4 text-sm">
                    ${item.date ? `<div class="flex items-center gap-2"><strong class="text-gray-700">Date:</strong> <span class="text-gray-600">${escapeHtml(item.date)}</span></div>` : ''}
                    ${item.location ? `<div class="flex items-center gap-2"><strong class="text-gray-700">Location:</strong> <span class="text-gray-600">${escapeHtml(item.location)}</span></div>` : ''}
                    ${ownerInfo}
                    ${sharedInfo}
                </div>
            </div>
            
            ${item.description ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-primary mb-2">Description</h3>
                    <p class="text-gray-700 leading-relaxed">${escapeHtml(item.description)}</p>
                </div>
            ` : ''}
            
            ${filesHtml}
            
            <div class="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                ${isOwner ? `
                    <button onclick="editItem('${item.id}')" class="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300">Edit</button>
                    <button onclick="deleteItem('${item.id}')" class="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition duration-300">Delete</button>
                ` : ''}
                <button onclick="closeViewModal()" class="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300">Close</button>
            </div>
        `;
        
        document.getElementById('view-content').innerHTML = viewContent;
        document.getElementById('view-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Error viewing item:', error);
        alert('Error loading item details');
    }
}

// Close view modal
function closeViewModal() {
    document.getElementById('view-modal').classList.add('hidden');
}

// Show transcription modal
async function showTranscription(fileIndex, itemId) {
    try {
        const doc = await db.collection('archiveItems').doc(itemId).get();
        const item = doc.data();
        const file = item.files[fileIndex];
        
        if (!file.transcription) {
            alert('No transcription available for this file');
            return;
        }
        
        // Create a modal to display transcription
        const modalHtml = `
            <div id="transcription-modal" class="fixed inset-0 bg-black bg-opacity-50 z-[60] overflow-y-auto">
                <div class="flex items-center justify-center min-h-screen p-4">
                    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
                        <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex justify-between items-center">
                            <div>
                                <h2 class="text-2xl font-bold text-primary">Document Transcription</h2>
                                <p class="text-sm text-gray-600 mt-1">${escapeHtml(file.name)}</p>
                            </div>
                            <button onclick="closeTranscriptionModal()" class="text-gray-400 hover:text-gray-600 text-3xl font-bold">&times;</button>
                        </div>
                        <div class="p-6">
                            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <pre class="whitespace-pre-wrap text-sm text-gray-800 font-mono">${escapeHtml(file.transcription)}</pre>
                            </div>
                            <div class="flex justify-end gap-3 mt-6">
                                <button onclick="copyTranscription()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                    📋 Copy to Clipboard
                                </button>
                                <button onclick="downloadTranscription('${escapeHtml(file.name)}', \`${file.transcription.replace(/`/g, '\\`')}\`)" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                                    💾 Download as TXT
                                </button>
                                <button onclick="closeTranscriptionModal()" class="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing transcription modal
        const existingModal = document.getElementById('transcription-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Store transcription in a global variable for copying
        window.currentTranscription = file.transcription;
    } catch (error) {
        console.error('Error showing transcription:', error);
        alert('Error loading transcription');
    }
}

// Show AI description modal
async function showAIDescription(fileIndex, itemId) {
    try {
        const doc = await db.collection('archiveItems').doc(itemId).get();
        const item = doc.data();
        const file = item.files[fileIndex];
        
        if (!file.aiDescription) {
            alert('No AI description available for this image');
            return;
        }
        
        // Create a modal to display AI description
        const modalHtml = `
            <div id="ai-description-modal" class="fixed inset-0 bg-black bg-opacity-50 z-[60] overflow-y-auto">
                <div class="flex items-center justify-center min-h-screen p-4">
                    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
                        <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex justify-between items-center">
                            <div>
                                <h2 class="text-2xl font-bold text-primary">AI Image Analysis</h2>
                                <p class="text-sm text-gray-600 mt-1">${escapeHtml(file.name)}</p>
                            </div>
                            <button onclick="closeAIDescriptionModal()" class="text-gray-400 hover:text-gray-600 text-3xl font-bold">&times;</button>
                        </div>
                        <div class="p-6">
                            <div class="mb-4">
                                <img src="${file.url}" alt="${escapeHtml(file.name)}" class="w-full max-h-96 object-contain rounded-lg border border-gray-200">
                            </div>
                            <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <h3 class="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                    <span>🤖</span> AI-Generated Description
                                </h3>
                                <p class="text-gray-800 leading-relaxed whitespace-pre-wrap">${escapeHtml(file.aiDescription)}</p>
                            </div>
                            <div class="flex justify-end gap-3 mt-6">
                                <button onclick="copyAIDescription()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                    📋 Copy to Clipboard
                                </button>
                                <button onclick="closeAIDescriptionModal()" class="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing AI description modal
        const existingModal = document.getElementById('ai-description-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Store description in a global variable for copying
        window.currentAIDescription = file.aiDescription;
    } catch (error) {
        console.error('Error showing AI description:', error);
        alert('Error loading AI description');
    }
}

// Close transcription modal
function closeTranscriptionModal() {
    const modal = document.getElementById('transcription-modal');
    if (modal) {
        modal.remove();
    }
}

// Close AI description modal
function closeAIDescriptionModal() {
    const modal = document.getElementById('ai-description-modal');
    if (modal) {
        modal.remove();
    }
}

// Copy transcription to clipboard
function copyTranscription() {
    if (window.currentTranscription) {
        navigator.clipboard.writeText(window.currentTranscription).then(() => {
            alert('Transcription copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy transcription');
        });
    }
}

// Copy AI description to clipboard
function copyAIDescription() {
    if (window.currentAIDescription) {
        navigator.clipboard.writeText(window.currentAIDescription).then(() => {
            alert('AI description copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy description');
        });
    }
}

// Download transcription as TXT file
function downloadTranscription(fileName, transcription) {
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.replace(/\.[^/.]+$/, '') + '_transcription.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Edit item
async function editItem(itemId) {
    try {
        closeViewModal();
        
        const doc = await db.collection('archiveItems').doc(itemId).get();
        const item = doc.data();
        
        document.getElementById('modal-title').textContent = 'Edit Archive Item';
        document.getElementById('item-id').value = itemId;
        document.getElementById('item-title').value = item.title || '';
        document.getElementById('item-description').value = item.description || '';
        document.getElementById('item-category').value = item.category || '';
        document.getElementById('item-date').value = item.date || '';
        document.getElementById('item-location').value = item.location || '';
        document.getElementById('item-shared-with').value = item.sharedWith ? item.sharedWith.join(', ') : '';
        
        document.getElementById('item-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading item for edit:', error);
        alert('Error loading item');
    }
}

// Delete item
async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this archive item? This action cannot be undone.')) {
        return;
    }
    
    try {
        const doc = await db.collection('archiveItems').doc(itemId).get();
        const item = doc.data();
        
        // Delete files from storage
        if (item.files && item.files.length > 0) {
            let totalSize = 0;
            for (const file of item.files) {
                try {
                    const fileRef = storage.ref(file.path);
                    await fileRef.delete();
                    totalSize += file.size;
                } catch (error) {
                    console.error('Error deleting file:', error);
                }
            }
            
            // Update user's storage usage
            if (totalSize > 0) {
                const userRef = db.collection('users').doc(currentUser.uid);
                await userRef.update({
                    storageUsed: firebase.firestore.FieldValue.increment(-totalSize)
                });
            }
        }
        
        // Delete item document
        await db.collection('archiveItems').doc(itemId).delete();
        
        closeViewModal();
        await loadArchiveItems();
        await updateStorageQuota();
        alert('Archive item deleted successfully');
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item: ' + error.message);
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Toggle export menu
function toggleExportMenu() {
    const menu = document.getElementById('export-menu');
    menu.classList.toggle('hidden');
}

// Close export menu when clicking outside
document.addEventListener('click', function(event) {
    const exportButton = document.getElementById('export-button');
    const exportMenu = document.getElementById('export-menu');
    
    if (exportButton && exportMenu && !exportButton.contains(event.target) && !exportMenu.contains(event.target)) {
        exportMenu.classList.add('hidden');
    }
});

// Export data to CSV
async function exportToCSV() {
    try {
        // Close the export menu
        document.getElementById('export-menu').classList.add('hidden');
        
        if (allItems.length === 0) {
            alert('No items to export');
            return;
        }
        
        // CSV headers
        const headers = ['ID', 'Title', 'Description', 'Category', 'Date', 'Location', 'Owner Email', 'Shared With', 'Files Count', 'Total File Size (MB)', 'File Names', 'Has Transcriptions', 'Has AI Descriptions', 'Created At', 'Updated At'];
        
        // Convert items to CSV rows
        const rows = allItems.map(item => {
            const filesCount = item.files ? item.files.length : 0;
            const totalFileSize = item.files ? item.files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024) : 0;
            const fileNames = item.files ? item.files.map(f => f.name).join('; ') : '';
            const sharedWith = item.sharedWith ? item.sharedWith.join('; ') : '';
            const hasTranscriptions = item.files ? item.files.some(f => f.hasTranscription) : false;
            const hasAIDescriptions = item.files ? item.files.some(f => f.hasAIDescription) : false;
            
            return [
                item.id,
                escapeCSV(item.title),
                escapeCSV(item.description || ''),
                escapeCSV(item.category),
                escapeCSV(item.date || ''),
                escapeCSV(item.location || ''),
                escapeCSV(item.ownerEmail),
                escapeCSV(sharedWith),
                filesCount,
                totalFileSize.toFixed(2),
                escapeCSV(fileNames),
                hasTranscriptions ? 'Yes' : 'No',
                hasAIDescriptions ? 'Yes' : 'No',
                item.createdAt ? new Date(item.createdAt.seconds * 1000).toISOString() : '',
                item.updatedAt ? new Date(item.updatedAt.seconds * 1000).toISOString() : ''
            ];
        });
        
        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `family_archive_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('Archive data exported successfully as CSV!');
    } catch (error) {
        console.error('Error exporting to CSV:', error);
        alert('Error exporting data: ' + error.message);
    }
}

// Escape CSV values
function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // If value contains comma, newline, or double quote, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
}

// Export data to SQL
async function exportToSQL() {
    try {
        // Close the export menu
        document.getElementById('export-menu').classList.add('hidden');
        
        if (allItems.length === 0) {
            alert('No items to export');
            return;
        }
        
        // SQL file header
        let sqlContent = `-- Family Archive Tracker Export
-- Generated: ${new Date().toISOString()}
-- User: ${currentUser.email}
-- Total Items: ${allItems.length}

-- Create archive_items table
CREATE TABLE IF NOT EXISTS archive_items (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    date VARCHAR(100),
    location VARCHAR(500),
    owner_email VARCHAR(255) NOT NULL,
    shared_with TEXT,
    files_count INT DEFAULT 0,
    total_file_size_mb DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Create archive_files table
CREATE TABLE IF NOT EXISTS archive_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    file_size_mb DECIMAL(10,2),
    storage_path TEXT,
    has_transcription BOOLEAN DEFAULT FALSE,
    transcription LONGTEXT,
    has_ai_description BOOLEAN DEFAULT FALSE,
    ai_description TEXT,
    FOREIGN KEY (item_id) REFERENCES archive_items(id) ON DELETE CASCADE
);

-- Insert archive items
`;
        
        // Generate INSERT statements for items
        allItems.forEach(item => {
            const filesCount = item.files ? item.files.length : 0;
            const totalFileSize = item.files ? item.files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024) : 0;
            const sharedWith = item.sharedWith ? item.sharedWith.join('; ') : '';
            const createdAt = item.createdAt ? new Date(item.createdAt.seconds * 1000).toISOString().replace('T', ' ').split('.')[0] : null;
            const updatedAt = item.updatedAt ? new Date(item.updatedAt.seconds * 1000).toISOString().replace('T', ' ').split('.')[0] : null;
            
            sqlContent += `INSERT INTO archive_items (id, title, description, category, date, location, owner_email, shared_with, files_count, total_file_size_mb, created_at, updated_at) VALUES (
    ${escapeSQLString(item.id)},
    ${escapeSQLString(item.title)},
    ${escapeSQLString(item.description || '')},
    ${escapeSQLString(item.category)},
    ${escapeSQLString(item.date || '')},
    ${escapeSQLString(item.location || '')},
    ${escapeSQLString(item.ownerEmail)},
    ${escapeSQLString(sharedWith)},
    ${filesCount},
    ${totalFileSize.toFixed(2)},
    ${createdAt ? "'" + createdAt + "'" : 'NULL'},
    ${updatedAt ? "'" + updatedAt + "'" : 'NULL'}
);\n\n`;
            
            // Generate INSERT statements for files
            if (item.files && item.files.length > 0) {
                item.files.forEach(file => {
                    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                    sqlContent += `INSERT INTO archive_files (item_id, file_name, file_url, file_type, file_size_bytes, file_size_mb, storage_path, has_transcription, transcription, has_ai_description, ai_description) VALUES (
    ${escapeSQLString(item.id)},
    ${escapeSQLString(file.name)},
    ${escapeSQLString(file.url)},
    ${escapeSQLString(file.type)},
    ${file.size},
    ${fileSizeMB},
    ${escapeSQLString(file.path)},
    ${file.hasTranscription ? 'TRUE' : 'FALSE'},
    ${escapeSQLString(file.transcription || '')},
    ${file.hasAIDescription ? 'TRUE' : 'FALSE'},
    ${escapeSQLString(file.aiDescription || '')}
);\n`;
                });
                sqlContent += '\n';
            }
        });
        
        // Add summary comments
        sqlContent += `
-- Export Summary
-- Total archive items: ${allItems.length}
-- Total files: ${allItems.reduce((sum, item) => sum + (item.files ? item.files.length : 0), 0)}
-- Total storage used: ${(allItems.reduce((sum, item) => sum + (item.files ? item.files.reduce((s, f) => s + f.size, 0) : 0), 0) / (1024 * 1024)).toFixed(2)} MB
`;
        
        // Create blob and download
        const blob = new Blob([sqlContent], { type: 'application/sql;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `family_archive_export_${new Date().toISOString().split('T')[0]}.sql`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('Archive data exported successfully as SQL!');
    } catch (error) {
        console.error('Error exporting to SQL:', error);
        alert('Error exporting data: ' + error.message);
    }
}

// Escape SQL strings
function escapeSQLString(value) {
    if (value === null || value === undefined || value === '') return 'NULL';
    const stringValue = String(value);
    // Escape single quotes and wrap in quotes
    return "'" + stringValue.replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
}

// Utility function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Close modals when clicking outside
window.onclick = function(event) {
    const itemModal = document.getElementById('item-modal');
    const viewModal = document.getElementById('view-modal');
    
    if (event.target === itemModal) {
        closeItemModal();
    }
    if (event.target === viewModal) {
        closeViewModal();
    }
}

// File input preview
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('item-files');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const preview = document.getElementById('file-preview');
            preview.innerHTML = '';
            
            const files = this.files;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                
                const previewItem = document.createElement('div');
                previewItem.className = 'relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-300';
                previewItem.title = `${file.name} (${fileSizeMB} MB)`;
                
                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(file);
                    img.className = 'w-full h-full object-cover';
                    previewItem.appendChild(img);
                } else {
                    const icon = document.createElement('div');
                    icon.className = 'w-full h-full flex items-center justify-center bg-gray-50 text-3xl';
                    icon.textContent = '📄';
                    previewItem.appendChild(icon);
                }
                
                preview.appendChild(previewItem);
            }
        });
    }
});
