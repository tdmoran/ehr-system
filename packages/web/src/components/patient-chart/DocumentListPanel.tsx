import { api, Document } from '../../api/client';

interface DocumentListPanelProps {
  title: string;
  uploadLabel: string;
  uploadId: string;
  emptyIcon: 'letter' | 'operative';
  emptyTitle: string;
  emptyDescription: string;
  documents: Document[];
  uploading: boolean;
  iconColor: string;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteDocument: (docId: string) => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const icons = {
  letter: (
    <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  operative: (
    <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  ),
};

const itemIcons: Record<string, JSX.Element> = {
  letter: (
    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  operative: (
    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  ),
};

const itemBgColors: Record<string, string> = {
  letter: 'bg-blue-50',
  operative: 'bg-purple-50',
};

export function DocumentListPanel({
  title,
  uploadLabel,
  uploadId,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  documents,
  uploading,
  iconColor: _iconColor,
  onFileSelect,
  onDeleteDocument,
}: DocumentListPanelProps) {
  return (
    <div className="card-clinical overflow-hidden">
      <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
        <h3 className="font-display font-semibold text-navy-900">{title}</h3>
        <div>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.tiff" onChange={onFileSelect} className="hidden" id={uploadId} />
          <label
            htmlFor={uploadId}
            className={`btn-primary text-sm py-2 cursor-pointer inline-flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {uploadLabel}
          </label>
        </div>
      </div>
      {documents.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-navy-50 flex items-center justify-center mx-auto mb-4">
            {icons[emptyIcon]}
          </div>
          <p className="text-navy-900 font-display font-medium">{emptyTitle}</p>
          <p className="text-navy-500 font-body text-sm mt-1">{emptyDescription}</p>
        </div>
      ) : (
        <div className="divide-y divide-clinical-100">
          {documents.map((doc) => (
            <a
              key={doc.id}
              href={api.getDocumentUrl(doc.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 hover:bg-clinical-50 transition-colors flex items-center gap-4 cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-lg ${itemBgColors[emptyIcon]} flex items-center justify-center flex-shrink-0`}>
                {itemIcons[emptyIcon]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-medium text-navy-900 truncate hover:text-teal-600">{doc.originalName}</p>
                <p className="text-sm text-navy-500 font-body">
                  {formatFileSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); onDeleteDocument(doc.id); }}
                className="p-2 rounded-lg hover:bg-coral-50 text-navy-400 hover:text-coral-600 transition-colors"
                title="Delete"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              </button>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
