import React, { useEffect } from 'react';

/**
 * RecipeDetailModal - View-only modal for displaying recipe details
 */
function RecipeDetailModal({ isOpen, onClose, recipe, onEdit }) {
  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !recipe) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
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
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold text-primary pr-8">
              {recipe.name}
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Recipe Image */}
            {recipe.imageUrl && (
              <div className="flex justify-center">
                <img
                  src={recipe.imageUrl}
                  alt={recipe.name}
                  className="max-w-full max-h-80 object-contain rounded-lg shadow-md"
                />
              </div>
            )}

            {/* Recipe Transcription */}
            {recipe.transcription && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span>📜</span> Original Transcription
                </h3>
                <div 
                  className="prose max-w-none text-gray-700 bg-amber-50 p-4 rounded-lg border border-amber-200"
                  dangerouslySetInnerHTML={{ __html: recipe.transcription }}
                />
              </div>
            )}

            {/* Ingredients */}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span>🥄</span> Ingredients
                </h3>
                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 w-1/3">Amount</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Ingredient</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipe.ingredients.map((ingredient, index) => (
                        <tr key={index} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-700 font-medium">
                            {ingredient.amount || '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {ingredient.item || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Directions */}
            {recipe.directions && recipe.directions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span>👨‍🍳</span> Directions
                </h3>
                <ol className="space-y-3">
                  {recipe.directions.map((step, index) => (
                    <li key={index} className="flex gap-4">
                      <span className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </span>
                      <p className="text-gray-700 pt-1 flex-1">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Empty state for recipes with no content */}
            {!recipe.transcription && 
             (!recipe.ingredients || recipe.ingredients.length === 0) && 
             (!recipe.directions || recipe.directions.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl block mb-3">📝</span>
                <p>This recipe doesn't have any details yet.</p>
                <p className="text-sm">Click "Edit Recipe" to add ingredients and directions.</p>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {recipe.ingredients?.length || 0} ingredient{recipe.ingredients?.length !== 1 ? 's' : ''} • {recipe.directions?.length || 0} step{recipe.directions?.length !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onClose();
                  onEdit(recipe);
                }}
                className="px-5 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition"
              >
                Edit Recipe
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecipeDetailModal;
