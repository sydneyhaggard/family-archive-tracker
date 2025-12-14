import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { useRecipes } from '../hooks/useRecipes';
import { GEMINI_API_KEY, GEMINI_API_URL } from '../config/firebase';

/**
 * RecipeForm - Modal form for adding/editing recipes
 * Features: Recipe Name, Image upload, CKEditor transcription, Ingredients table, Directions list
 */
function RecipeForm({ isOpen, onClose, onSave, cookbook, recipe = null }) {
  const { addRecipe, updateRecipe } = useRecipes();
  
  const [formData, setFormData] = useState({
    name: '',
    transcription: '',
    ingredients: [{ amount: '', item: '' }],
    directions: ['']
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isExtractingIngredients, setIsExtractingIngredients] = useState(false);
  const [isExtractingDirections, setIsExtractingDirections] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize form with recipe data when editing
  useEffect(() => {
    if (recipe) {
      setFormData({
        name: recipe.name || '',
        transcription: recipe.transcription || '',
        ingredients: recipe.ingredients?.length > 0 
          ? recipe.ingredients 
          : [{ amount: '', item: '' }],
        directions: recipe.directions?.length > 0 
          ? recipe.directions 
          : ['']
      });
      setImagePreview(recipe.imageUrl || null);
    } else {
      setFormData({
        name: '',
        transcription: '',
        ingredients: [{ amount: '', item: '' }],
        directions: ['']
      });
      setImagePreview(null);
    }
    setImageFile(null);
    setFormError('');
  }, [recipe, isOpen]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, saving, onClose]);

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please select an image file');
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Remove image
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Transcribe image using Gemini API
  const transcribeImage = async (file) => {
    try {
      if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not configured. Skipping transcription.');
        return '';
      }

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

      const promptText = "Please extract and transcribe all visible text from this recipe image. Include the recipe title, ingredients list, and cooking instructions/directions. Maintain the structure and formatting as much as possible. If there is no text, describe what you see in the image.";

      const requestBody = {
        contents: [{
          parts: [
            { text: promptText },
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
        console.log(`Successfully transcribed recipe image`);
        return transcription;
      }

      console.warn('No transcription candidates returned from API');
      return '';
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  };

  // Handle generate transcription button click
  const handleGenerateTranscription = async () => {
    if (!imageFile) {
      setFormError('Please upload a recipe image first to generate transcription.');
      return;
    }

    // Check if transcription field already has content
    if (formData.transcription && formData.transcription.trim()) {
      if (!window.confirm('The transcription field already has content. Do you want to replace it with the new transcription?')) {
        return;
      }
    }

    setIsTranscribing(true);
    setFormError('');

    try {
      const transcription = await transcribeImage(imageFile);
      if (transcription) {
        setFormData({ ...formData, transcription: transcription });
      } else {
        setFormError('Could not extract text from the image. Please transcribe manually.');
      }
    } catch (err) {
      console.error('Error generating transcription:', err);
      setFormError(`Error generating transcription: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Extract ingredients from transcription using Gemini
  const handleExtractIngredients = async () => {
    if (!formData.transcription || !formData.transcription.trim()) {
      setFormError('Please add a transcription first to extract ingredients.');
      return;
    }

    // Check if ingredients already have content
    const hasContent = formData.ingredients.some(ing => ing.amount.trim() || ing.item.trim());
    if (hasContent) {
      if (!window.confirm('The ingredients field already has content. Do you want to replace it?')) {
        return;
      }
    }

    setIsExtractingIngredients(true);
    setFormError('');

    try {
      if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured.');
      }

      const promptText = `Extract the ingredients from the following recipe transcription. Return ONLY a JSON array of objects with "amount" and "item" fields. Be precise with amounts (e.g., "1 cup", "2 tbsp", "1/2 tsp"). If no amount is specified, use an empty string for amount.

Example output format:
[{"amount": "1 cup", "item": "flour"}, {"amount": "2", "item": "eggs"}, {"amount": "", "item": "salt to taste"}]

Recipe transcription:
${formData.transcription.replace(/<[^>]*>/g, ' ').trim()}`;

      const requestBody = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 4096,
        }
      };

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        const text = data.candidates[0].content.parts[0].text;
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          const ingredients = JSON.parse(jsonMatch[0]);
          if (Array.isArray(ingredients) && ingredients.length > 0) {
            setFormData({ ...formData, ingredients });
            return;
          }
        }
      }
      setFormError('Could not extract ingredients. Please enter them manually.');
    } catch (err) {
      console.error('Error extracting ingredients:', err);
      setFormError(`Error extracting ingredients: ${err.message}`);
    } finally {
      setIsExtractingIngredients(false);
    }
  };

  // Extract directions from transcription using Gemini
  const handleExtractDirections = async () => {
    if (!formData.transcription || !formData.transcription.trim()) {
      setFormError('Please add a transcription first to extract directions.');
      return;
    }

    // Check if directions already have content
    const hasContent = formData.directions.some(dir => dir.trim());
    if (hasContent) {
      if (!window.confirm('The directions field already has content. Do you want to replace it?')) {
        return;
      }
    }

    setIsExtractingDirections(true);
    setFormError('');

    try {
      if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured.');
      }

      const promptText = `Extract the cooking directions/instructions from the following recipe transcription. Return ONLY a JSON array of strings, where each string is one step. Keep each step clear and concise.

Example output format:
["Preheat oven to 350°F.", "Mix flour and sugar in a bowl.", "Add eggs and stir until combined."]

Recipe transcription:
${formData.transcription.replace(/<[^>]*>/g, ' ').trim()}`;

      const requestBody = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 4096,
        }
      };

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        const text = data.candidates[0].content.parts[0].text;
        // Extract JSON array from response (handle markdown code blocks)
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const directions = JSON.parse(jsonMatch[0]);
          if (Array.isArray(directions) && directions.length > 0) {
            setFormData({ ...formData, directions });
            return;
          }
        }
      }
      setFormError('Could not extract directions. Please enter them manually.');
    } catch (err) {
      console.error('Error extracting directions:', err);
      setFormError(`Error extracting directions: ${err.message}`);
    } finally {
      setIsExtractingDirections(false);
    }
  };

  // Ingredient handlers
  const handleIngredientChange = (index, field, value) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const handleAddIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { amount: '', item: '' }]
    });
  };

  const handleRemoveIngredient = (index) => {
    if (formData.ingredients.length === 1) return;
    const newIngredients = formData.ingredients.filter((_, i) => i !== index);
    setFormData({ ...formData, ingredients: newIngredients });
  };

  // Direction handlers
  const handleDirectionChange = (index, value) => {
    const newDirections = [...formData.directions];
    newDirections[index] = value;
    setFormData({ ...formData, directions: newDirections });
  };

  const handleAddDirection = () => {
    setFormData({
      ...formData,
      directions: [...formData.directions, '']
    });
  };

  const handleRemoveDirection = (index) => {
    if (formData.directions.length === 1) return;
    const newDirections = formData.directions.filter((_, i) => i !== index);
    setFormData({ ...formData, directions: newDirections });
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Recipe name is required');
      return;
    }

    try {
      setSaving(true);

      // Filter out empty ingredients and directions
      const cleanedIngredients = formData.ingredients.filter(
        ing => ing.amount.trim() || ing.item.trim()
      );
      const cleanedDirections = formData.directions.filter(
        dir => dir.trim()
      );

      if (recipe) {
        // Update existing recipe
        await updateRecipe(recipe.id, {
          name: formData.name.trim(),
          transcription: formData.transcription,
          ingredients: cleanedIngredients,
          directions: cleanedDirections
        }, imageFile);
      } else {
        // Add new recipe
        await addRecipe({
          name: formData.name.trim(),
          cookbookId: cookbook.id,
          transcription: formData.transcription,
          ingredients: cleanedIngredients,
          directions: cleanedDirections,
          imageFile: imageFile
        });
      }

      onSave();
    } catch (err) {
      console.error('Error saving recipe:', err);
      setFormError(err.message || 'Error saving recipe');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-center min-h-screen p-4 pt-10">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
            <button
              onClick={onClose}
              disabled={saving}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold text-primary">
              {recipe ? 'Edit Recipe' : 'Add Recipe'}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              in {cookbook.title}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {formError && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {formError}
              </div>
            )}

            {/* Recipe Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Recipe Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Grandma's Apple Pie"
              />
            </div>

            {/* Recipe Image */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Recipe Image
              </label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Recipe preview"
                    className="w-48 h-36 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-secondary"
                />
              )}
            </div>

            {/* Recipe Transcription (CKEditor) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Recipe Transcription
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Transcribe the original recipe text here, preserving the original wording.
              </p>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <CKEditor
                  editor={ClassicEditor}
                  data={formData.transcription}
                  onChange={(event, editor) => {
                    const data = editor.getData();
                    setFormData({ ...formData, transcription: data });
                  }}
                  config={{
                    toolbar: [
                      'heading', '|',
                      'bold', 'italic', 'underline', '|',
                      'bulletedList', 'numberedList', '|',
                      'undo', 'redo'
                    ],
                    placeholder: 'Transcribe the original recipe text here...'
                  }}
                />
              </div>
              {/* Generate Transcription Button */}
              <button
                type="button"
                onClick={handleGenerateTranscription}
                disabled={isTranscribing || !imageFile || saving}
                className={`mt-3 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  isTranscribing || !imageFile || saving
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
                    <span>Generate Transcription from Image</span>
                  </>
                )}
              </button>
              {!imageFile && (
                <p className="text-xs text-gray-500 mt-2">
                  Upload a recipe image first to generate transcription
                </p>
              )}
            </div>

            {/* Ingredients Table */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Ingredients
                </label>
                <button
                  type="button"
                  onClick={handleExtractIngredients}
                  disabled={isExtractingIngredients || !formData.transcription?.trim() || saving}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors flex items-center gap-1 ${
                    isExtractingIngredients || !formData.transcription?.trim() || saving
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-secondary text-white hover:bg-primary'
                  }`}
                >
                  {isExtractingIngredients ? (
                    <>
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Auto-Fill from Transcription</span>
                    </>
                  )}
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 w-1/3">Amount</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Ingredient</th>
                      <th className="px-4 py-2 w-16"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.ingredients.map((ingredient, index) => (
                      <tr key={index} className="border-t border-gray-100">
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={ingredient.amount}
                            onChange={(e) => handleIngredientChange(index, 'amount', e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="1 cup"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={ingredient.item}
                            onChange={(e) => handleIngredientChange(index, 'item', e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="flour"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(index)}
                            disabled={formData.ingredients.length === 1}
                            className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Remove ingredient"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={handleAddIngredient}
                className="mt-2 text-sm text-primary hover:text-secondary font-medium"
              >
                + Add Ingredient
              </button>
            </div>

            {/* Directions List */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Directions
                </label>
                <button
                  type="button"
                  onClick={handleExtractDirections}
                  disabled={isExtractingDirections || !formData.transcription?.trim() || saving}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors flex items-center gap-1 ${
                    isExtractingDirections || !formData.transcription?.trim() || saving
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-secondary text-white hover:bg-primary'
                  }`}
                >
                  {isExtractingDirections ? (
                    <>
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Auto-Fill from Transcription</span>
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-2">
                {formData.directions.map((direction, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <span className="w-8 h-8 flex-shrink-0 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold mt-1">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <textarea
                        value={direction}
                        onChange={(e) => handleDirectionChange(index, e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                        placeholder={`Step ${index + 1}...`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDirection(index)}
                      disabled={formData.directions.length === 1}
                      className="mt-2 text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove step"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddDirection}
                className="mt-3 text-sm text-primary hover:text-secondary font-medium"
              >
                + Add Step
              </button>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50"
              >
                {saving ? 'Saving...' : (recipe ? 'Update Recipe' : 'Add Recipe')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RecipeForm;
