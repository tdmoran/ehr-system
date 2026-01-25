import { useState, useRef, useCallback } from 'react';
import { api, ReferralUploadResult } from '../../api/client';

interface ReferralScannerProps {
  onUploadComplete: () => void;
}

export function ReferralScanner({ onUploadComplete }: ReferralScannerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<ReferralUploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'].includes(file.type)
    );

    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files].slice(0, 10));
      setError(null);
    } else {
      setError('Only PDF, JPEG, PNG, and TIFF files are allowed.');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files].slice(0, 10));
      setError(null);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);

    const { data, error: apiError } = await api.uploadReferralScans(selectedFiles);

    if (apiError) {
      setError(apiError);
      setUploading(false);
      return;
    }

    if (data) {
      setUploadResults(data.referrals);
      setSelectedFiles([]);
      onUploadComplete();
    }

    setUploading(false);
  };

  const clearResults = () => {
    setUploadResults([]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-teal-400 dark:hover:border-teal-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
          onChange={handleFileSelect}
          className="hidden"
        />
        <DocumentIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          Drop referral letters here or click to browse
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Supports PDF, JPEG, PNG, and TIFF files (max 10 files, 20MB each)
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Selected Files ({selectedFiles.length})
            </h4>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear all
            </button>
          </div>
          <ul className="space-y-2">
            {selectedFiles.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between bg-white dark:bg-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <FileIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full px-4 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <SpinnerIcon className="w-5 h-5 animate-spin" />
                Uploading & Processing...
              </>
            ) : (
              <>
                <UploadIcon className="w-5 h-5" />
                Upload & Process {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}

      {/* Upload results */}
      {uploadResults.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300">
                {uploadResults.length} file{uploadResults.length !== 1 ? 's' : ''} uploaded for processing
              </h4>
            </div>
            <button
              onClick={clearResults}
              className="text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
            >
              Dismiss
            </button>
          </div>
          <p className="text-sm text-green-700 dark:text-green-400">
            The system is now extracting patient information from the uploaded referral letters.
            Pending referrals will appear in the list below once processing is complete.
          </p>
        </div>
      )}
    </div>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
