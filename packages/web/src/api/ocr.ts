import { request } from './request';
import type { OcrResult, OcrFieldMapping, Patient } from './types';

export const ocrApi = {
  processDocumentOcr: (documentId: string) =>
    request<{ message: string; ocrResultId: string; status: string }>(`/ocr/documents/${documentId}/process`, {
      method: 'POST',
    }),

  getOcrResult: (documentId: string) =>
    request<{ ocrResult: OcrResult }>(`/ocr/documents/${documentId}/result`),

  getExtractedFields: (documentId: string) =>
    request<{ ocrResult: OcrResult; fieldMappings: OcrFieldMapping[] }>(`/ocr/documents/${documentId}/extracted-fields`),

  applyOcrFields: (documentId: string, fieldIds: string[]) =>
    request<{ message: string; updatedFields: string[]; patient: Patient }>(`/ocr/documents/${documentId}/apply-fields`, {
      method: 'POST',
      body: JSON.stringify({ fieldIds }),
    }),

  rejectOcrFields: (documentId: string, fieldIds: string[]) =>
    request<{ message: string; rejectedCount: number }>(`/ocr/documents/${documentId}/reject-fields`, {
      method: 'POST',
      body: JSON.stringify({ fieldIds }),
    }),
};
