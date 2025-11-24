import React, { useState } from 'react';
import { parseGedcomFile } from '../utils/gedcomParser';
import { useGedcomImport } from '../hooks/useGedcomImport';

/**
 * Component for uploading and importing GEDCOM files
 * Provides preview of people found and batch import functionality
 */
function GedcomUpload({ user, onImportComplete }) {
  const { importing, progress, error: importError, importPeople } = useGedcomImport();
  const [file, setFile] = useState(null);
  const [parsedPeople, setParsedPeople] = useState([]);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Filter people for display
  const filteredPeople = parsedPeople.filter(person =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (person.birthYear && person.birthYear.toString().includes(searchTerm))
  );

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file extension
    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.ged') && !fileName.endsWith('.gedcom')) {
      setParseError('Please select a valid GEDCOM file (.ged or .gedcom)');
      return;
    }

    setFile(selectedFile);
    setParsedPeople([]);
    setParseError('');
    setImportResult(null);
    setParsing(true);

    try {
      const people = await parseGedcomFile(selectedFile);
      setParsedPeople(people);
      
      if (people.length === 0) {
        setParseError('No individual records found in this GEDCOM file.');
      }
    } catch (err) {
      setParseError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (parsedPeople.length === 0) return;

    try {
      setImportResult(null);
      const result = await importPeople(parsedPeople, skipDuplicates);
      setImportResult(result);
      
      if (onImportComplete) {
        onImportComplete(result);
      }
    } catch (err) {
      // Error is handled by the hook
    }
  };

  const handleClear = () => {
    setFile(null);
    setParsedPeople([]);
    setParseError('');
    setImportResult(null);
    setSearchTerm('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div>
            <h1 className="text-3xl font-bold text-primary">GEDCOM Import</h1>
            <p className="text-gray-600 mt-1">Import family tree data from GEDCOM files into Related People</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* File Upload Section */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload GEDCOM File</h2>
          
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="flex-1">
              <label className="block">
                <span className="sr-only">Choose GEDCOM file</span>
                <input
                  type="file"
                  accept=".ged,.gedcom"
                  onChange={handleFileSelect}
                  disabled={parsing || importing}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-3 file:px-6
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-white
                    hover:file:bg-secondary
                    file:cursor-pointer file:transition-colors
                    disabled:opacity-50"
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Supported formats: .ged, .gedcom
              </p>
            </div>

            {file && (
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <p className="font-medium text-gray-700">{file.name}</p>
                  <p className="text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={handleClear}
                  disabled={importing}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {parsing && (
            <div className="mt-4 flex items-center gap-2 text-gray-600">
              <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Parsing GEDCOM file...
            </div>
          )}

          {parseError && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {parseError}
            </div>
          )}
        </div>

        {/* Preview Section */}
        {parsedPeople.length > 0 && !importResult && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Preview ({parsedPeople.length} people found)
                </h2>
                <p className="text-gray-500 text-sm">
                  Review the individuals found in the GEDCOM file before importing
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  Skip duplicates
                </label>
                
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300 disabled:opacity-50"
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing {progress.current}/{progress.total}...
                    </span>
                  ) : (
                    `Confirm Import (${parsedPeople.length} people)`
                  )}
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name or birth year..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            {/* Progress Bar */}
            {importing && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1 text-center">
                  Importing {progress.current} of {progress.total} people...
                </p>
              </div>
            )}

            {/* Preview Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Birth Year
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPeople.slice(0, 100).map((person, index) => (
                    <tr key={person.gedcomId || index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {person.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {person.birthYear || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-md truncate">
                        {person.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredPeople.length > 100 && (
                <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 text-center">
                  Showing 100 of {filteredPeople.length} people. All will be imported.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Import Complete!</h2>
              
              <p className="text-lg text-gray-600 mb-4">
                Successfully imported <span className="font-semibold text-primary">{importResult.imported}</span> people
                {importResult.skipped > 0 && (
                  <span> ({importResult.skipped} duplicates skipped)</span>
                )}
              </p>
              
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleClear}
                  className="px-6 py-2 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300"
                >
                  Import Another File
                </button>
                <a
                  href="/people"
                  className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition duration-300"
                >
                  View Related People
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Import Error */}
        {importError && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <h3 className="font-semibold mb-1">Import Error</h3>
              <p>{importError}</p>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!file && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">About GEDCOM Import</h2>
            
            <div className="prose max-w-none text-gray-600">
              <p className="mb-4">
                GEDCOM (Genealogical Data Communication) is a standard file format for exchanging 
                genealogical data between different genealogy software programs.
              </p>
              
              <h3 className="text-lg font-medium text-gray-800 mb-2">What gets imported:</h3>
              <ul className="list-disc list-inside mb-4 space-y-1">
                <li>Individual names</li>
                <li>Birth dates and places</li>
                <li>Death dates</li>
                <li>Gender information</li>
                <li>Notes and occupation</li>
              </ul>
              
              <h3 className="text-lg font-medium text-gray-800 mb-2">Supported sources:</h3>
              <ul className="list-disc list-inside mb-4 space-y-1">
                <li>Ancestry.com exports</li>
                <li>FamilySearch GEDCOM files</li>
                <li>MyHeritage exports</li>
                <li>Most genealogy software exports</li>
              </ul>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> Family relationships (FAM records) are not currently imported. 
                  Only individual person records will be added to your Related People collection.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GedcomUpload;
