import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Document, ProcedureTemplate } from '../api/client';

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [procedureTemplates, setProcedureTemplates] = useState<ProcedureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'patient-documents' | 'templates'>('templates');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [documentsRes, templatesRes] = await Promise.all([
      api.getAllDocuments(),
      api.getProcedureTemplates(),
    ]);
    if (documentsRes.data) {
      setDocuments(documentsRes.data.documents);
    }
    if (templatesRes.data) {
      setProcedureTemplates(templatesRes.data.templates);
    }
    setLoading(false);
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      searchQuery === '' ||
      doc.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc as any).patientFirstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc as any).patientLastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc as any).patientMrn?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-navy-500 dark:text-navy-400 font-body">Loading documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 dark:text-navy-100">Documents</h1>
          <p className="text-navy-500 dark:text-navy-400 font-body mt-1">
            {activeTab === 'templates'
              ? `${procedureTemplates.length} procedure templates`
              : `${filteredDocuments.length} patient documents`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-clinical-200 dark:border-navy-700">
        <TabButton active={activeTab === 'templates'} onClick={() => setActiveTab('templates')}>
          <TemplateIcon className="w-4 h-4" />
          Procedure Templates
        </TabButton>
        <TabButton active={activeTab === 'patient-documents'} onClick={() => setActiveTab('patient-documents')}>
          <DocumentIcon className="w-4 h-4" />
          Patient Documents
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="card-clinical p-6">
            <p className="text-navy-600 dark:text-navy-300 font-body mb-6">
              Reference documents for common otolaryngology procedures. Download and share with patients for pre-operative education.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {procedureTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 bg-clinical-50 dark:bg-navy-800 rounded-xl border border-clinical-200 dark:border-navy-700 hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                      <FileTextIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-navy-900 dark:text-navy-100 mb-1">
                        {template.name}
                      </h3>
                      <p className="text-sm text-navy-500 dark:text-navy-400 mb-2">
                        {template.category}
                      </p>
                      <p className="text-sm text-navy-600 dark:text-navy-300 font-body mb-3">
                        {template.description}
                      </p>
                      <a
                        href={api.getProcedureTemplateDownloadUrl(template.id)}
                        download
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <DownloadIcon className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'patient-documents' && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="card-clinical p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400" />
              <input
                type="text"
                placeholder="Search by filename, patient name, or MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-clinical pl-10 w-full"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="sm:w-64">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-clinical w-full"
            >
              <option value="all">All Categories</option>
              <option value="scanned_document">Scanned Document</option>
              <option value="letter">Letter</option>
              <option value="operative_note">Operative Note</option>
            </select>
          </div>
        </div>
      </div>

          {/* Documents Table */}
          <div className="card-clinical overflow-hidden">
        {filteredDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <DocumentIcon className="w-16 h-16 text-navy-300 dark:text-navy-600 mx-auto mb-4" />
            <p className="text-navy-900 dark:text-navy-100 font-display font-medium">
              {searchQuery || categoryFilter !== 'all' ? 'No documents found' : 'No documents uploaded'}
            </p>
            <p className="text-navy-500 dark:text-navy-400 font-body text-sm mt-1">
              {searchQuery || categoryFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Documents will appear here when uploaded to patient charts'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-clinical-50 dark:bg-navy-800 border-b border-clinical-200 dark:border-navy-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-navy-700 dark:text-navy-300 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-navy-700 dark:text-navy-300 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-navy-700 dark:text-navy-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-navy-700 dark:text-navy-300 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-navy-700 dark:text-navy-300 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-navy-700 dark:text-navy-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-100 dark:divide-navy-700">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-clinical-50 dark:hover:bg-navy-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                          {doc.mimeType === 'application/pdf' ? (
                            <PdfIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-navy-900 dark:text-navy-100 truncate font-body text-sm">
                            {doc.originalName}
                          </p>
                          {doc.description && (
                            <p className="text-xs text-navy-500 dark:text-navy-400 truncate">{doc.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/patients/${doc.patientId}`}
                        className="text-teal-600 dark:text-teal-400 hover:underline font-body text-sm"
                      >
                        {(doc as any).patientFirstName} {(doc as any).patientLastName}
                      </Link>
                      <p className="text-xs text-navy-500 dark:text-navy-400">MRN: {(doc as any).patientMrn}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryStyle(doc.category)}`}>
                        {formatCategory(doc.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-navy-900 dark:text-navy-100 font-body">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-navy-500 dark:text-navy-400">
                        by {(doc as any).uploaderFirstName} {(doc as any).uploaderLastName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-navy-700 dark:text-navy-300 font-body">
                        {formatFileSize(doc.fileSize)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={api.getDocumentUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 text-sm font-medium rounded-lg transition-colors"
                      >
                        <DownloadIcon className="w-4 h-4" />
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getCategoryStyle(category: string): string {
  const styles: Record<string, string> = {
    scanned_document: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    letter: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    operative_note: 'bg-coral-100 dark:bg-coral-900/30 text-coral-700 dark:text-coral-400',
  };
  return styles[category] || styles.scanned_document;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
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

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
        active
          ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-400'
          : 'text-navy-500 dark:text-navy-400 border-transparent hover:text-navy-700 dark:hover:text-navy-200'
      }`}
    >
      {children}
    </button>
  );
}

function TemplateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
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
