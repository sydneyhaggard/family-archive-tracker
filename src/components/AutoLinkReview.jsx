import React, { useState } from 'react';

/**
 * AutoLinkReview - Component for reviewing ambiguous auto-link suggestions
 * 
 * Displays a list of ambiguous suggestions found in the transcription
 * Allows user to:
 * 1. Link a suggestion to a specific person (Approve)
 * 2. Ignore a suggestion (Reject)
 * 3. Create a new person for a suggestion (Future - currently handled by ignore + manual add)
 */
function AutoLinkReview({
    suggestions,
    onLinkPerson,
    onIgnoreSuggestion
}) {
    const [processingId, setProcessingId] = useState(null);

    if (!suggestions || suggestions.length === 0) return null;

    const handleLink = async (suggestion, person) => {
        setProcessingId(suggestion.originalText);
        await onLinkPerson(suggestion, person);
        setProcessingId(null);
    };

    const handleIgnore = async (suggestion) => {
        setProcessingId(suggestion.originalText);
        await onIgnoreSuggestion(suggestion);
        setProcessingId(null);
    };

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
                    <span>⚠️</span> Review Suggested People
                </h3>
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
                    {suggestions.length} pending
                </span>
            </div>

            <p className="text-sm text-amber-700 mb-5">
                The system found names in the transcription that might match existing people in your archive. Please confirm the correct matches.
            </p>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {suggestions.map((suggestion, index) => {
                    const isProcessing = processingId === suggestion.originalText;

                    return (
                        <div
                            key={`${index}-${suggestion.originalText}`}
                            className={`bg-white p-4 rounded-lg border border-amber-100 shadow-sm transition-opacity ${isProcessing ? 'opacity-50 pointer-events-none' : ''
                                }`}
                        >
                            <p className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                <span className="text-gray-500 text-sm font-normal">Found in text:</span>
                                <span className="bg-yellow-100 px-2 py-0.5 rounded text-amber-900 border border-yellow-200">
                                    "{suggestion.originalText}"
                                </span>
                            </p>

                            <div className="space-y-2 mb-3">
                                {suggestion.candidates && suggestion.candidates.length > 0 ? (
                                    suggestion.candidates.map((candidate, cIndex) => (
                                        <div
                                            key={cIndex}
                                            className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                {candidate.person.photoURL ? (
                                                    <img
                                                        src={candidate.person.photoURL}
                                                        alt=""
                                                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 border border-blue-200">
                                                        {candidate.person.name?.charAt(0) || '?'}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-gray-900">{candidate.person.name}</p>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        {candidate.person.birthDate && (
                                                            <span>Born: {candidate.person.birthDate}</span>
                                                        )}
                                                        <span className={`px-1.5 py-0.5 rounded ${candidate.confidence > 0.8 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {(candidate.confidence * 100).toFixed(0)}% Match
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleLink(suggestion, candidate.person)}
                                                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-md font-medium transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            >
                                                Link
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 italic p-2">No direct matches found.</p>
                                )}
                            </div>

                            <div className="flex justify-end pt-2 border-t border-gray-50">
                                <button
                                    onClick={() => handleIgnore(suggestion)}
                                    className="text-xs text-gray-500 hover:text-gray-700 hover:underline flex items-center gap-1 transition-colors"
                                >
                                    <span>✕</span> Ignore this suggestion
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default AutoLinkReview;
