import React, { useState, useEffect, useCallback } from 'react';

function MediaGallery({ files, initialIndex = 0, isOpen, onClose, onEditFile }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);

  // Reset index when opening with a new initial index
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsLoading(true);
    }
  }, [isOpen, initialIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        goToPrevious();
        break;
      case 'ArrowRight':
        goToNext();
        break;
      default:
        break;
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when gallery is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !files || files.length === 0) return null;

  const currentFile = files[currentIndex];
  const isImage = currentFile?.type?.startsWith('image');
  const isVideo = currentFile?.type?.startsWith('video');
  const isAudio = currentFile?.type?.startsWith('audio');

  const goToPrevious = () => {
    setIsLoading(true);
    setCurrentIndex((prev) => (prev === 0 ? files.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setIsLoading(true);
    setCurrentIndex((prev) => (prev === files.length - 1 ? 0 : prev + 1));
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(currentFile.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = currentFile.name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(currentFile.url, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    window.open(currentFile.url, '_blank');
  };

  const renderMedia = () => {
    if (isImage) {
      return (
        <div className="relative flex items-center justify-center w-full h-full">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
            </div>
          )}
          <img
            src={currentFile.url}
            alt={currentFile.name}
            className="max-w-full max-h-full object-contain"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </div>
      );
    }

    if (isVideo) {
      return (
        <video
          src={currentFile.url}
          controls
          autoPlay
          className="max-w-full max-h-full object-contain"
          onLoadedData={() => setIsLoading(false)}
        >
          Your browser does not support the video tag.
        </video>
      );
    }

    if (isAudio) {
      return (
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="text-8xl">🎵</div>
          <audio
            src={currentFile.url}
            controls
            autoPlay
            className="w-full max-w-md"
            onLoadedData={() => setIsLoading(false)}
          >
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    // Default for documents/other files
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-white">
        <div className="text-9xl">📄</div>
        <p className="text-xl">{currentFile.name}</p>
        <p className="text-gray-400">
          {(currentFile.size / (1024 * 1024)).toFixed(2)} MB
        </p>
        <button
          onClick={handleOpenInNewTab}
          className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
        >
          Open File
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <span className="text-white font-medium">
            {currentIndex + 1} / {files.length}
          </span>
          <span className="text-gray-300 truncate max-w-xs md:max-w-md">
            {currentFile.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Download Button */}
          {onEditFile && currentFile?.type?.startsWith('image') && (
            <button
              onClick={() => {
                onClose();
                onEditFile(currentFile);
              }}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition"
              title="Edit image"
            >
              <span className="text-lg">✏️</span>
            </button>
          )}
          <button
            onClick={handleDownload}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition"
            title="Download"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          {/* Open in New Tab Button */}
          <button
            onClick={handleOpenInNewTab}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition"
            title="Open in new tab"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition"
            title="Close (Esc)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pt-16 pb-24">
        {renderMedia()}
      </div>

      {/* Navigation Arrows - Only show if multiple files */}
      {files.length > 1 && (
        <>
          {/* Previous Button */}
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition z-10"
            title="Previous (←)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Next Button */}
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition z-10"
            title="Next (→)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Thumbnail Strip */}
      {files.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
            {files.map((file, index) => {
              const isThumbImage = file?.type?.startsWith('image');
              const isThumbVideo = file?.type?.startsWith('video');
              const isThumbAudio = file?.type?.startsWith('audio');

              return (
                <button
                  key={index}
                  onClick={() => {
                    setIsLoading(true);
                    setCurrentIndex(index);
                  }}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${index === currentIndex
                      ? 'border-white scale-110'
                      : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                >
                  {isThumbImage ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : isThumbVideo ? (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-2xl">
                      🎬
                    </div>
                  ) : isThumbAudio ? (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-2xl">
                      🎵
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-2xl">
                      📄
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* File Info Footer - shown when single file or for additional info */}
      {files.length === 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
          <div className="text-center text-gray-300 text-sm">
            {currentFile.name} • {(currentFile.size / (1024 * 1024)).toFixed(2)} MB
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaGallery;
