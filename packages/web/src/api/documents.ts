import { request, API_URL } from './request';
import type { ApiResponse } from './request';
import type { Document, ProcedureTemplate, ProcedureTemplateWithContent } from './types';

export const documentsApi = {
  getAllDocuments: () =>
    request<{ documents: Document[] }>(`/documents`),

  getPatientDocuments: (patientId: string) =>
    request<{ documents: Document[] }>(`/documents/patient/${patientId}`),

  getProcedureTemplates: () =>
    request<{ templates: ProcedureTemplate[] }>(`/procedure-templates`),

  getProcedureTemplate: (id: string) =>
    request<{ template: ProcedureTemplateWithContent }>(`/procedure-templates/${id}`),

  getProcedureTemplateDownloadUrl: (id: string) =>
    `${API_URL}/api/procedure-templates/${id}/download`,

  uploadDocument: async (patientId: string, file: File, description?: string, category: 'scanned_document' | 'letter' | 'operative_note' = 'scanned_document'): Promise<ApiResponse<{ document: Document }>> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (description) {
      formData.append('description', description);
    }

    try {
      const response = await fetch(`${API_URL}/api/documents/patient/${patientId}`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Upload failed' };
      }

      return { data };
    } catch (error) {
      return { error: 'Network error. Please try again.' };
    }
  },

  getDocumentUrl: (documentId: string) => `${API_URL}/api/documents/${documentId}/download`,

  deleteDocument: (id: string) =>
    request<{ message: string }>(`/documents/${id}`, { method: 'DELETE' }),
};
