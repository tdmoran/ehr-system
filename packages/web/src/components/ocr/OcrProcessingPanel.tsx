import { useState, useEffect } from 'react';
import { api, OcrResult } from '../../api/client';

interface OcrProcessingPanelProps {
  documentId: string;
  onProcessingComplete: (ocrResult: OcrResult) => void;
}

export function OcrProcessingPanel({ documentId, onProcessingComplete }: OcrProcessingPanelProps) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);

  // Check for existing OCR result on mount
  useEffect(() => {
    checkExistingResult();
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [documentId]);

  async function checkExistingResult() {
    const { data } = await api.getOcrResult(documentId);
    if (data?.ocrResult) {
      setOcrResult(data.ocrResult);
      setStatus(data.ocrResult.processingStatus === 'completed' ? 'completed' :
                data.ocrResult.processingStatus === 'failed' ? 'failed' :
                data.ocrResult.processingStatus === 'processing' ? 'processing' : 'idle');

      if (data.ocrResult.processingStatus === 'processing') {
        startPolling();
      } else if (data.ocrResult.processingStatus === 'completed') {
        onProcessingComplete(data.ocrResult);
      }
    }
  }

  function startPolling() {
    const interval = window.setInterval(async () => {
      const { data } = await api.getOcrResult(documentId);
      if (data?.ocrResult) {
        setOcrResult(data.ocrResult);
        if (data.ocrResult.processingStatus === 'completed') {
          setStatus('completed');
          clearInterval(interval);
          setPollingInterval(null);
          onProcessingComplete(data.ocrResult);
        } else if (data.ocrResult.processingStatus === 'failed') {
          setStatus('failed');
          setError(data.ocrResult.errorMessage || 'Processing failed');
          clearInterval(interval);
          setPollingInterval(null);
        }
      }
    }, 2000);
    setPollingInterval(interval);
  }

  async function handleProcess() {
    setStatus('processing');
    setError(null);

    const { data, error: apiError } = await api.processDocumentOcr(documentId);

    if (apiError) {
      setStatus('failed');
      setError(apiError);
      return;
    }

    if (data) {
      startPolling();
    }
  }

  function getConfidenceColor(confidence: number | null): string {
    if (!confidence) return 'text-gray-500 dark:text-gray-400';
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }

  function getDocumentTypeLabel(type: string | null): string {
    switch (type) {
      case 'referral': return 'Referral Letter';
      case 'lab_result': return 'Lab Result';
      case 'intake_form': return 'Intake Form';
      default: return 'Unknown Document Type';
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">OCR Processing</h4>
        {status === 'idle' && (
          <button
            onClick={handleProcess}
            className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
          >
            Process with OCR
          </button>
        )}
      </div>

      {status === 'processing' && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Extracting text from document...</span>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-600 dark:text-red-400">{error || 'Processing failed'}</p>
          <button
            onClick={handleProcess}
            className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {status === 'completed' && ocrResult && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Type:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {getDocumentTypeLabel(ocrResult.documentType)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
            <span className={`font-medium ${getConfidenceColor(ocrResult.confidenceScore)}`}>
              {ocrResult.confidenceScore ? `${(ocrResult.confidenceScore * 100).toFixed(1)}%` : 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Text extracted successfully</span>
          </div>
        </div>
      )}
    </div>
  );
}
