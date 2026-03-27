import React, { useState } from 'react';

/**
 * Reusable component for editing array-based table fields (residences, military service, etc.)
 * @param {Object} props
 * @param {string} props.title - Section title (e.g., "Residences", "Military Service")
 * @param {Array} props.data - Array of row objects
 * @param {Function} props.onChange - Callback when data changes: (newData) => void
 * @param {Array} props.columns - Column definitions: [{ key, label, type, placeholder }]
 * @param {boolean} props.disabled - Whether the table is read-only
 */
export function TableFieldEditor({ 
  title, 
  data = [], 
  onChange, 
  columns = [],
  disabled = false 
}) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingRow, setEditingRow] = useState({});

  // Start adding a new row
  const handleAdd = () => {
    const emptyRow = {};
    columns.forEach(col => {
      emptyRow[col.key] = '';
    });
    setEditingRow(emptyRow);
    setEditingIndex(data.length); // New row index
  };

  // Start editing an existing row
  const handleEdit = (index) => {
    setEditingRow({ ...data[index] });
    setEditingIndex(index);
  };

  // Save the current row being edited
  const handleSave = () => {
    const newData = [...data];
    if (editingIndex === data.length) {
      // Adding new row
      newData.push(editingRow);
    } else {
      // Updating existing row
      newData[editingIndex] = editingRow;
    }
    onChange(newData);
    setEditingIndex(null);
    setEditingRow({});
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingIndex(null);
    setEditingRow({});
  };

  // Delete a row
  const handleDelete = (index) => {
    const newData = data.filter((_, i) => i !== index);
    onChange(newData);
  };

  // Update a field in the editing row
  const handleFieldChange = (key, value) => {
    setEditingRow({ ...editingRow, [key]: value });
  };

  // Check if editing row is valid (at least one field filled)
  const isEditingRowValid = () => {
    return columns.some(col => {
      const value = editingRow[col.key];
      return value && value.toString().trim() !== '';
    });
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
        {!disabled && editingIndex === null && (
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-1 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            + Add
          </button>
        )}
      </div>

      {data.length === 0 && editingIndex === null ? (
        <p className="text-gray-500 text-sm italic">No entries yet</p>
      ) : (
        <div className="space-y-2">
          {/* Display existing rows */}
          {data.map((row, index) => (
            <div key={index}>
              {editingIndex === index ? (
                // Editing mode
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    {columns.map(col => (
                      <div key={col.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {col.label}
                        </label>
                        {col.type === 'textarea' ? (
                          <textarea
                            value={editingRow[col.key] || ''}
                            onChange={(e) => handleFieldChange(col.key, e.target.value)}
                            placeholder={col.placeholder}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            rows={2}
                          />
                        ) : col.type === 'date' ? (
                          <input
                            type="date"
                            value={editingRow[col.key] || ''}
                            onChange={(e) => handleFieldChange(col.key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                          />
                        ) : (
                          <input
                            type="text"
                            value={editingRow[col.key] || ''}
                            onChange={(e) => handleFieldChange(col.key, e.target.value)}
                            placeholder={col.placeholder}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!isEditingRowValid()}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start justify-between">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {columns.map(col => {
                      const value = row[col.key];
                      if (!value) return null;
                      return (
                        <div key={col.key} className="text-sm">
                          <span className="font-medium text-gray-700">{col.label}:</span>{' '}
                          <span className="text-gray-900">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                  {!disabled && (
                    <div className="flex gap-2 ml-4">
                      <button
                        type="button"
                        onClick={() => handleEdit(index)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add new row form */}
          {editingIndex === data.length && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {columns.map(col => (
                  <div key={col.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {col.label}
                    </label>
                    {col.type === 'textarea' ? (
                      <textarea
                        value={editingRow[col.key] || ''}
                        onChange={(e) => handleFieldChange(col.key, e.target.value)}
                        placeholder={col.placeholder}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        rows={2}
                      />
                    ) : col.type === 'date' ? (
                      <input
                        type="date"
                        value={editingRow[col.key] || ''}
                        onChange={(e) => handleFieldChange(col.key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    ) : (
                      <input
                        type="text"
                        value={editingRow[col.key] || ''}
                        onChange={(e) => handleFieldChange(col.key, e.target.value)}
                        placeholder={col.placeholder}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isEditingRowValid()}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
