import React, { useState } from 'react';
import { useProvenanceLog } from '../hooks/useProvenanceLog';

/**
 * Component for tracking provenance (transfer history) of an archive item
 * Displays a table of transfer log entries with add/delete functionality
 */
function ProvenanceTracker({ itemId }) {
  const { logEntries, loading, error, addLogEntry, deleteLogEntry } = useProvenanceLog(itemId);
  const [formData, setFormData] = useState({
    transferDate: '',
    transferorName: '',
    method: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.transferDate) {
      setFormError('Transfer date is required');
      return;
    }

    if (!formData.transferorName.trim()) {
      setFormError('Transferor name is required');
      return;
    }

    if (!formData.method.trim()) {
      setFormError('Transfer method is required');
      return;
    }

    try {
      setSaving(true);
      
      // Convert date string to Firestore Timestamp
      const transferDate = new Date(formData.transferDate);
      
      await addLogEntry({
        transferDate: transferDate,
        transferorName: formData.transferorName,
        method: formData.method,
        notes: formData.notes
      });
      
      // Reset form
      setFormData({
        transferDate: '',
        transferorName: '',
        method: '',
        notes: ''
      });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (logId) => {
    if (!window.confirm('Are you sure you want to delete this transfer log entry? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteLogEntry(logId);
    } catch (err) {
      alert(`Error deleting log entry: ${err.message}`);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-500 text-sm">Loading provenance log...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Provenance / Transfer Log</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
          Error loading provenance log: {error}
        </div>
      )}

      {/* Add Entry Form */}
      <div className="mb-6 bg-white rounded-lg p-4 border border-gray-200">
        <h4 className="text-md font-medium text-gray-700 mb-3">Add Transfer Log Entry</h4>
        
        {formError && (
          <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
            {formError}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transfer Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.transferDate}
                onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })}
                required
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:bg-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transferor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.transferorName}
                onChange={(e) => setFormData({ ...formData, transferorName: e.target.value })}
                required
                disabled={saving}
                placeholder="Name of person/entity who gave the item"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:bg-gray-100"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Method <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                required
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:bg-gray-100"
              >
                <option value="">Select method...</option>
                <option value="Gift">Gift</option>
                <option value="Inheritance">Inheritance</option>
                <option value="Purchase">Purchase</option>
                <option value="Found">Found</option>
                <option value="Donation">Donation</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={saving}
                placeholder="e.g., Received with the original box"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:bg-gray-100"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-secondary transition duration-300 disabled:opacity-50 text-sm"
            >
              {saving ? 'Adding...' : 'Add Transfer Log Entry'}
            </button>
          </div>
        </form>
      </div>

      {/* Transfer Log Table */}
      {logEntries.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm bg-white rounded-lg border border-gray-200">
          No transfer history recorded yet. Add an entry above to track the provenance of this item.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transferor Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(entry.transferDate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {entry.transferorName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {entry.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {entry.notes || <span className="text-gray-400 italic">No notes</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {logEntries.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {logEntries.length} transfer{logEntries.length !== 1 ? 's' : ''} recorded
        </p>
      )}
    </div>
  );
}

export default ProvenanceTracker;
