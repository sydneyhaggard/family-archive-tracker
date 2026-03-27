import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCookbooks } from '../hooks/useCookbooks';
import { useRecipes } from '../hooks/useRecipes';
import RecipeForm from './RecipeForm';
import RecipeDetailModal from './RecipeDetailModal';

/**
 * CookbookManager - Main page for viewing and managing cookbooks and their recipes
 */
function CookbookManager({ user }) {
  const { cookbooks, loading, error, addCookbook, updateCookbook, deleteCookbook, getRecipeCount } = useCookbooks();
  const { getRecipesByCookbook, deleteRecipe } = useRecipes();
  
  // Cookbook modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCookbook, setEditingCookbook] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    publicationDate: '',
    description: ''
  });
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Recipe counts for each cookbook
  const [recipeCounts, setRecipeCounts] = useState({});

  // Recipe selector modal state
  const [isRecipeSelectorOpen, setIsRecipeSelectorOpen] = useState(false);
  const [selectedCookbookForRecipes, setSelectedCookbookForRecipes] = useState(null);
  const [cookbookRecipes, setCookbookRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [recipeSearchTerm, setRecipeSearchTerm] = useState('');

  // Recipe form modal state
  const [isRecipeFormOpen, setIsRecipeFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);

  // Recipe detail modal state (view mode)
  const [isRecipeDetailOpen, setIsRecipeDetailOpen] = useState(false);
  const [viewingRecipe, setViewingRecipe] = useState(null);

  // Load recipe counts for all cookbooks
  useEffect(() => {
    const loadCounts = async () => {
      const counts = {};
      for (const cookbook of cookbooks) {
        counts[cookbook.id] = await getRecipeCount(cookbook.id);
      }
      setRecipeCounts(counts);
    };
    
    if (cookbooks.length > 0) {
      loadCounts();
    }
  }, [cookbooks, getRecipeCount]);

  // Filter cookbooks by search term
  const filteredCookbooks = cookbooks.filter(cookbook =>
    cookbook.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cookbook.author && cookbook.author.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filter recipes by search term
  const filteredRecipes = cookbookRecipes.filter(recipe =>
    recipe.name.toLowerCase().includes(recipeSearchTerm.toLowerCase())
  );

  // Open modal for adding new cookbook
  const handleOpenModal = (cookbook = null) => {
    if (cookbook) {
      setEditingCookbook(cookbook);
      setFormData({
        title: cookbook.title || '',
        author: cookbook.author || '',
        publicationDate: cookbook.publicationDate || '',
        description: cookbook.description || ''
      });
      setCoverImagePreview(cookbook.coverImageUrl || null);
    } else {
      setEditingCookbook(null);
      setFormData({
        title: '',
        author: '',
        publicationDate: '',
        description: ''
      });
      setCoverImagePreview(null);
    }
    setCoverImageFile(null);
    setFormError('');
    setIsModalOpen(true);
  };

  // Close cookbook modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingCookbook(null);
    setFormData({
      title: '',
      author: '',
      publicationDate: '',
      description: ''
    });
    setCoverImageFile(null);
    setCoverImagePreview(null);
    setFormError('');
  }, []);

  // ESC key handler for modals
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (isRecipeFormOpen) {
          setIsRecipeFormOpen(false);
          setEditingRecipe(null);
        } else if (isRecipeSelectorOpen && !saving) {
          handleCloseRecipeSelector();
        } else if (isModalOpen && !saving) {
          handleCloseModal();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen, isRecipeSelectorOpen, isRecipeFormOpen, saving, handleCloseModal]);

  // Handle cover image selection
  const handleCoverImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please select an image file');
      return;
    }

    setCoverImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Remove cover image
  const handleRemoveCoverImage = () => {
    setCoverImageFile(null);
    setCoverImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle cookbook form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Title is required');
      return;
    }

    try {
      setSaving(true);

      if (editingCookbook) {
        // Update existing cookbook
        await updateCookbook(editingCookbook.id, {
          title: formData.title.trim(),
          author: formData.author.trim(),
          publicationDate: formData.publicationDate,
          description: formData.description.trim()
        }, coverImageFile);
      } else {
        // Add new cookbook
        await addCookbook({
          title: formData.title.trim(),
          author: formData.author.trim(),
          publicationDate: formData.publicationDate,
          description: formData.description.trim(),
          coverImageFile: coverImageFile
        });
      }

      handleCloseModal();
    } catch (err) {
      console.error('Error saving cookbook:', err);
      setFormError(err.message || 'Error saving cookbook');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete cookbook
  const handleDelete = async (cookbookId, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this cookbook? All recipes will also be deleted.')) {
      try {
        await deleteCookbook(cookbookId);
      } catch (err) {
        console.error('Error deleting cookbook:', err);
        alert('Error deleting cookbook: ' + err.message);
      }
    }
  };

  // Open recipe selector for a cookbook
  const handleOpenRecipeSelector = async (cookbook) => {
    setSelectedCookbookForRecipes(cookbook);
    setRecipeSearchTerm('');
    setLoadingRecipes(true);
    setIsRecipeSelectorOpen(true);

    try {
      const recipes = await getRecipesByCookbook(cookbook.id);
      setCookbookRecipes(recipes);
    } catch (err) {
      console.error('Error loading recipes:', err);
      setCookbookRecipes([]);
    } finally {
      setLoadingRecipes(false);
    }
  };

  // Close recipe selector
  const handleCloseRecipeSelector = () => {
    setIsRecipeSelectorOpen(false);
    setSelectedCookbookForRecipes(null);
    setCookbookRecipes([]);
    setRecipeSearchTerm('');
  };

  // Open recipe form for adding new recipe
  const handleAddRecipe = () => {
    setEditingRecipe(null);
    setIsRecipeFormOpen(true);
  };

  // Open recipe detail modal for viewing
  const handleViewRecipe = (recipe) => {
    setViewingRecipe(recipe);
    setIsRecipeDetailOpen(true);
  };

  // Open recipe form for editing
  const handleEditRecipe = (recipe) => {
    setIsRecipeDetailOpen(false);
    setViewingRecipe(null);
    setEditingRecipe(recipe);
    setIsRecipeFormOpen(true);
  };

  // Handle recipe saved (refresh the recipes list)
  const handleRecipeSaved = async () => {
    setIsRecipeFormOpen(false);
    setEditingRecipe(null);
    
    // Refresh recipes list
    if (selectedCookbookForRecipes) {
      try {
        const recipes = await getRecipesByCookbook(selectedCookbookForRecipes.id);
        setCookbookRecipes(recipes);
        // Update recipe count
        setRecipeCounts(prev => ({
          ...prev,
          [selectedCookbookForRecipes.id]: recipes.length
        }));
      } catch (err) {
        console.error('Error refreshing recipes:', err);
      }
    }
  };

  // Handle recipe delete
  const handleDeleteRecipe = async (recipeId) => {
    if (window.confirm('Are you sure you want to delete this recipe?')) {
      try {
        await deleteRecipe(recipeId);
        // Refresh recipes list
        if (selectedCookbookForRecipes) {
          const recipes = await getRecipesByCookbook(selectedCookbookForRecipes.id);
          setCookbookRecipes(recipes);
          setRecipeCounts(prev => ({
            ...prev,
            [selectedCookbookForRecipes.id]: recipes.length
          }));
        }
      } catch (err) {
        console.error('Error deleting recipe:', err);
        alert('Error deleting recipe: ' + err.message);
      }
    }
  };

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <h2 className="headline">Cookbooks</h2>
          <button
            onClick={() => handleOpenModal()}
            className="button"
          >
            + Add Cookbook
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search cookbooks by title or author..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 input outlined focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <svg
              className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            Error loading cookbooks: {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-16">
            <p className="text-teal text-lg">Loading cookbooks...</p>
          </div>
        ) : filteredCookbooks.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-6xl block mb-4">📚</span>
            <p className="text-teal text-lg mb-4">
              {searchTerm ? 'No cookbooks found matching your search.' : 'No cookbooks yet. Add your first cookbook!'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => handleOpenModal()}
                className="button"
              >
                + Add Cookbook
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCookbooks.map(cookbook => (
              <div
                key={cookbook.id}
                className="glass-effect border border-white/20 rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => handleOpenRecipeSelector(cookbook)}
              >
                {/* Cover Image */}
                <div className="h-48 bg-gray-800">
                  {cookbook.coverImageUrl ? (
                    <img
                      src={cookbook.coverImageUrl}
                      alt={cookbook.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-6xl">📖</span>
                    </div>
                  )}
                </div>

                {/* Cookbook Info */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-1 truncate">
                    {cookbook.title}
                  </h3>
                  {cookbook.author && (
                    <p className="text-sm text-teal mb-2">
                      By {cookbook.author}
                    </p>
                  )}
                  {cookbook.description && (
                    <p className="text-white text-sm line-clamp-2 mb-3">
                      {cookbook.description}
                    </p>
                  )}
                  
                  {/* Recipe count badge */}
                  <div className="flex items-center gap-2 text-sm text-secondary mb-3">
                    <span>🍳</span>
                    <span>{recipeCounts[cookbook.id] || 0} recipes</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-600">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenRecipeSelector(cookbook);
                      }}
                      className="flex-1 button outlined small"
                    >
                      View Recipes
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(cookbook);
                      }}
                      className="px-3 py-1.5 text-teal hover:text-white transition"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => handleDelete(cookbook.id, e)}
                      className="px-3 py-1.5 text-red-400 hover:text-red-300 transition"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Cookbook Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 glass-effect z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              handleCloseModal();
            }
          }}
        >
          <div 
            className="flex items-center justify-center min-h-screen p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !saving) {
                handleCloseModal();
              }
            }}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
                <button
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
                >
                  &times;
                </button>
                <h2 className="text-2xl font-bold text-primary">
                  {editingCookbook ? 'Edit Cookbook' : 'Add Cookbook'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {formError && (
                  <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {formError}
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
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Cookbook title"
                  />
                </div>

                {/* Author */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Author
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Author name"
                  />
                </div>

                {/* Publication Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Publication Date
                  </label>
                  <input
                    type="date"
                    value={formData.publicationDate}
                    onChange={(e) => setFormData({ ...formData, publicationDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Cover Image */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cover Image
                  </label>
                  {coverImagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={coverImagePreview}
                        alt="Cover preview"
                        className="w-32 h-48 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveCoverImage}
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
                      onChange={handleCoverImageSelect}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-secondary"
                    />
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter a description for this cookbook..."
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
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
                    {saving ? 'Saving...' : (editingCookbook ? 'Update Cookbook' : 'Add Cookbook')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Selector Modal */}
      {isRecipeSelectorOpen && selectedCookbookForRecipes && (
        <div 
          className="fixed inset-0 glass-effect z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseRecipeSelector();
            }
          }}
        >
          <div 
            className="flex items-center justify-center min-h-screen p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseRecipeSelector();
              }
            }}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <button
                  onClick={handleCloseRecipeSelector}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
                >
                  &times;
                </button>
                <h2 className="text-2xl font-bold text-primary">
                  {selectedCookbookForRecipes.title}
                </h2>
                {selectedCookbookForRecipes.author && (
                  <p className="text-gray-600">By {selectedCookbookForRecipes.author}</p>
                )}
              </div>

              {/* Search and Add Recipe Bar */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex gap-4 items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search recipes..."
                    value={recipeSearchTerm}
                    onChange={(e) => setRecipeSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <svg
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button
                  onClick={handleAddRecipe}
                  className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition whitespace-nowrap"
                >
                  + Add Recipe
                </button>
              </div>

              {/* Recipes List */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingRecipes ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading recipes...</p>
                  </div>
                ) : filteredRecipes.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-5xl block mb-4">🍳</span>
                    <p className="text-gray-500 mb-4">
                      {recipeSearchTerm ? 'No recipes found matching your search.' : 'No recipes in this cookbook yet.'}
                    </p>
                    {!recipeSearchTerm && (
                      <button
                        onClick={handleAddRecipe}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition"
                      >
                        + Add First Recipe
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRecipes.map(recipe => (
                      <div
                        key={recipe.id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition cursor-pointer"
                        onClick={() => handleViewRecipe(recipe)}
                      >
                        {/* Recipe Image */}
                        <div className="h-32 bg-gray-100">
                          {recipe.imageUrl ? (
                            <img
                              src={recipe.imageUrl}
                              alt={recipe.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-4xl">🍽️</span>
                            </div>
                          )}
                        </div>

                        {/* Recipe Info */}
                        <div className="p-3">
                          <h4 className="font-semibold text-gray-800 truncate">
                            {recipe.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span>{recipe.ingredients?.length || 0} ingredients</span>
                            <span>•</span>
                            <span>{recipe.directions?.length || 0} steps</span>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewRecipe(recipe);
                              }}
                              className="flex-1 text-sm px-3 py-1 bg-primary text-white rounded hover:bg-secondary transition"
                            >
                              View
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditRecipe(recipe);
                              }}
                              className="text-sm px-3 py-1 border border-primary text-primary rounded hover:bg-primary hover:text-white transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRecipe(recipe.id);
                              }}
                              className="text-sm px-3 py-1 text-red-500 hover:bg-red-50 rounded transition"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleCloseRecipeSelector}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Form Modal */}
      {isRecipeFormOpen && selectedCookbookForRecipes && (
        <RecipeForm
          isOpen={isRecipeFormOpen}
          onClose={() => {
            setIsRecipeFormOpen(false);
            setEditingRecipe(null);
          }}
          onSave={handleRecipeSaved}
          cookbook={selectedCookbookForRecipes}
          recipe={editingRecipe}
        />
      )}

      {/* Recipe Detail Modal (View Mode) */}
      <RecipeDetailModal
        isOpen={isRecipeDetailOpen}
        onClose={() => {
          setIsRecipeDetailOpen(false);
          setViewingRecipe(null);
        }}
        recipe={viewingRecipe}
        onEdit={handleEditRecipe}
      />
    </div>
  );
}

export default CookbookManager;
