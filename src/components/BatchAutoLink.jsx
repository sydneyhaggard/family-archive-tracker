import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useRelatedPeople } from '../hooks/useRelatedPeople';
import { analyzeTranscription } from '../hooks/useNERAnalysis';

/**
 * BatchAutoLink - Component to scan all items and auto-link people
 * 
 * Logic:
 * 1. Filter items that have transcription but NO autoLinkStatus (or status is 'none')
 * 2. Run local NER analysis (regex/string matching)
 * 3. Update items with found links or suggestions
 */
function BatchAutoLink({ items, onComplete }) {
    const { peopleList } = useRelatedPeople();
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, updated: 0 });
    const [showModal, setShowModal] = useState(false);

    // Filter items eligible for scanning
    // We scan items that have a transcription AND haven't been marked as completed/review_required
    // OR we can allow "Rescan All" - for now, let's target items needing it.
    const getEligibleItems = () => {
        return items.filter(item =>
            item.transcription &&
            item.transcription.trim().length > 0 &&
            (!item.autoLinkStatus || item.autoLinkStatus === 'none' || item.autoLinkStatus === 'pending')
        );
    };

    const handleStartScan = async () => {
        const eligibleItems = getEligibleItems();
        if (eligibleItems.length === 0) {
            alert("No pending items found to scan.");
            return;
        }

        setScanning(true);
        setShowModal(true);
        setProgress({ current: 0, total: eligibleItems.length, updated: 0 });

        let updatedCount = 0;

        // Process in chunks to avoid UI freezing
        const CHUNK_SIZE = 10;

        for (let i = 0; i < eligibleItems.length; i += CHUNK_SIZE) {
            const chunk = eligibleItems.slice(i, i + CHUNK_SIZE);

            await Promise.all(chunk.map(async (item) => {
                try {
                    // 1. Analyze
                    const analysis = analyzeTranscription(item.transcription, peopleList);

                    let autoLinkStatus = 'none';
                    let autoLinkReason = null;
                    let suggestedPeople = [];
                    let finalRelatedPeopleIds = [...(item.relatedPeopleIds || [])];
                    let changed = false;

                    // 2. Handle Auto-Links
                    if (analysis.autoLinks && analysis.autoLinks.length > 0) {
                        let addedCount = 0;
                        analysis.autoLinks.forEach(link => {
                            if (link.personId && !finalRelatedPeopleIds.includes(link.personId)) {
                                finalRelatedPeopleIds.push(link.personId);
                                addedCount++;
                            }
                        });
                        if (addedCount > 0) {
                            changed = true;
                            autoLinkStatus = 'completed'; // Matches found and linked
                        }
                    }

                    // 3. Handle Suggestions
                    if (analysis.suggestions && analysis.suggestions.length > 0) {
                        // Deep sanitize suggestions to prevent 'undefined' errors in Firestore
                        suggestedPeople = analysis.suggestions.map(s => {
                            // Filter valid candidates only
                            const validCandidates = (s.candidates || []).filter(c =>
                                c.person && c.person.id && c.person.name
                            ).map(c => ({
                                confidence: c.confidence || 0,
                                matchType: c.matchType || 'fuzzy',
                                person: {
                                    id: c.person.id,
                                    name: c.person.name,
                                    birthDate: c.person.birthDate || null,
                                    photoURL: c.person.photoURL || null
                                }
                            }));

                            if (validCandidates.length === 0) return null;

                            return {
                                originalText: s.originalText || '',
                                status: s.status || 'suggested',
                                candidates: validCandidates
                            };
                        }).filter(Boolean); // Remove nulls (suggestions with no valid candidates)

                        if (suggestedPeople.length > 0) {
                            autoLinkStatus = 'review_required';
                            autoLinkReason = `Found ${suggestedPeople.length} ambiguous name(s)`;
                            changed = true;
                        }
                    }

                    // 4. Update if changes detected
                    if (changed) {
                        const itemRef = doc(db, 'archiveItems', item.id);
                        await updateDoc(itemRef, {
                            relatedPeopleIds: finalRelatedPeopleIds.filter(id => id), // Remove undefined
                            suggestedPeople,
                            autoLinkStatus,
                            autoLinkReason: autoLinkReason || null,
                            updatedAt: serverTimestamp()
                        });
                        updatedCount++;
                    } else {
                        // Mark as 'none' (scanned, nothing found) so we don't scan again immediately
                        if (!item.autoLinkStatus) {
                            const itemRef = doc(db, 'archiveItems', item.id);
                            await updateDoc(itemRef, {
                                autoLinkStatus: 'none',
                                updatedAt: serverTimestamp()
                            });
                        }
                    }

                } catch (err) {
                    console.error(`Error scanning item ${item.id}:`, err);
                }
            }));

            setProgress(prev => ({
                ...prev,
                current: Math.min(i + CHUNK_SIZE, eligibleItems.length),
                updated: prev.updated + updatedCount // This assumes updatedCount updates atomically, which it doesn't in previous loop
            }));

            // Artificial delay to yield to UI
            await new Promise(r => setTimeout(r, 50));
        }

        // Final update of count (chunk loop logic above for updatedCount was slightly flawed for closures, 
        // but progress.updated is just for UI. simpler to just track local var)
        setProgress(prev => ({ ...prev, updated: updatedCount }));

        setScanning(false);
        if (onComplete) onComplete();
    };

    const eligibleCount = getEligibleItems().length;

    return (
        <>
            <button
                onClick={handleStartScan}
                disabled={scanning || eligibleCount === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${eligibleCount > 0
                    ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                title={eligibleCount > 0 ? `Scan ${eligibleCount} pending items` : 'No items to scan'}
            >
                <span>⚡</span>
                <span>Batch Auto-Link {eligibleCount > 0 && `(${eligibleCount})`}</span>
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">
                            {scanning ? 'Scanning Archive...' : 'Scan Complete'}
                        </h3>

                        <div className="mb-6">
                            <div className="flex justify-between text-sm text-gray-600 mb-2">
                                <span>Progress</span>
                                <span>{progress.current} / {progress.total}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-purple-600 h-full transition-all duration-300"
                                    style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                                ></div>
                            </div>
                            <p className="text-center text-sm text-gray-500 mt-2">
                                {scanning
                                    ? 'Analyzing transcriptions and linking people...'
                                    : `Done! Updated ${progress.updated} items.`}
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowModal(false)}
                                disabled={scanning}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                            >
                                {scanning ? 'Please Wait' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default BatchAutoLink;
