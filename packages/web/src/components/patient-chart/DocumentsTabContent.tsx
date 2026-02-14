import { useRef } from 'react';
import { api, Document, OcrResult } from '../../api/client';
import { OcrProcessingPanel } from '../ocr/OcrProcessingPanel';

interface DocumentsTabContentProps {
  scannedDocuments: Document[];
  uploading: boolean;
  uploadError: string;
  ocrResults: Record<string, OcrResult>;
  selectedDocumentForOcr: Document | null;
  showExtractedFields: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShowExtractedFields: (doc: Document) => void;
  onOcrProcessingComplete: (result: OcrResult) => void;
  onSelectForOcr: (doc: Document) => void;
  onDeleteDocument: (docId: string) => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function OcrStatusBadge({ result }: { result?: OcrResult }) {
  if (!result) return null;
  switch (result.processingStatus) {
    case 'completed':
      return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">OCR Complete</span>;
    case 'processing':
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Processing
        </span>
      );
    case 'failed':
      return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">OCR Failed</span>;
    default:
      return null;
  }
}

export function DocumentsTabContent({
  scannedDocuments,
  uploading,
  uploadError,
  ocrResults,
  selectedDocumentForOcr,
  showExtractedFields,
  onFileSelect,
  onShowExtractedFields,
  onOcrProcessingComplete,
  onSelectForOcr,
  onDeleteDocument,
}: DocumentsTabContentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="card-clinical overflow-hidden">
      <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
        <h3 className="font-display font-semibold text-navy-900">Scanned Documents</h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.tiff"
            onChange={onFileSelect}
            className="hidden"
            id="document-upload"
          />
          <label
            htmlFor="document-upload"
            className={`btn-primary text-sm py-2 cursor-pointer inline-flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Upload Document
              </>
            )}
          </label>
        </div>
      </div>

      {uploadError && (
        <div className="mx-6 mt-4 p-4 bg-coral-50 border border-coral-200 rounded-lg">
          <p className="text-coral-700 text-sm font-body">{uploadError}</p>
        </div>
      )}

      {scannedDocuments.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-navy-50 dark:bg-navy-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-navy-300 dark:text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-navy-900 dark:text-navy-100 font-display font-medium">No documents uploaded</p>
          <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1 mb-3">
            Upload referral letters, lab results, imaging reports, or other clinical documents
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-navy-400 dark:text-navy-500">
            <span className="px-2 py-1 bg-clinical-50 dark:bg-navy-800 rounded">PDF</span>
            <span className="px-2 py-1 bg-clinical-50 dark:bg-navy-800 rounded">JPG</span>
            <span className="px-2 py-1 bg-clinical-50 dark:bg-navy-800 rounded">PNG</span>
            <span className="px-2 py-1 bg-clinical-50 dark:bg-navy-800 rounded">DICOM</span>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-clinical-100">
          {scannedDocuments.map((doc) => (
            <div key={doc.id} className="p-4 hover:bg-clinical-50 transition-colors">
              <div className="flex items-center gap-4">
                <a href={api.getDocumentUrl(doc.id)} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-coral-50 flex items-center justify-center flex-shrink-0 hover:bg-coral-100 transition-colors">
                  {doc.mimeType === 'application/pdf' ? (
                    <svg className="w-5 h-5 text-coral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  ) : (
                    <svg className="w-5 h-5 text-coral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                  )}
                </a>
                <a href={api.getDocumentUrl(doc.id)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 hover:opacity-80 transition-opacity cursor-pointer">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-medium text-navy-900 truncate hover:text-teal-600">{doc.originalName}</p>
                    <OcrStatusBadge result={ocrResults[doc.id]} />
                  </div>
                  <p className="text-sm text-navy-500 font-body">
                    {formatFileSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </a>
                <div className="flex items-center gap-2">
                  {ocrResults[doc.id]?.processingStatus === 'completed' && (
                    <button
                      onClick={() => onShowExtractedFields(doc)}
                      className="px-3 py-1.5 text-sm bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors flex items-center gap-1.5"
                      title="Review extracted fields"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
                      Review Fields
                    </button>
                  )}
                  <a href={api.getDocumentUrl(doc.id)} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-navy-100 text-teal-600 transition-colors" title="View document">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </a>
                  <button onClick={() => onDeleteDocument(doc.id)} className="p-2 rounded-lg hover:bg-coral-50 text-navy-400 hover:text-coral-600 transition-colors" title="Delete document">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              </div>

              {selectedDocumentForOcr?.id === doc.id && !showExtractedFields && (
                <div className="mt-4">
                  <OcrProcessingPanel documentId={doc.id} onProcessingComplete={onOcrProcessingComplete} />
                </div>
              )}

              {!ocrResults[doc.id] && selectedDocumentForOcr?.id !== doc.id && (
                <div className="mt-3 flex justify-end">
                  <button onClick={() => onSelectForOcr(doc)} className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Process with OCR
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
