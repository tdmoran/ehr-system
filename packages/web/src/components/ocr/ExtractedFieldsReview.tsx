import { useState, useEffect } from 'react';
import { api, OcrFieldMapping, Patient } from '../../api/client';

interface ExtractedFieldsReviewProps {
  documentId: string;
  patient: Patient;
  onClose: () => void;
  onFieldsApplied: () => void;
}

interface FieldSelection {
  [fieldId: string]: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  dateOfBirth: 'Date of Birth',
  gender: 'Gender',
  phone: 'Phone',
  email: 'Email',
  addressLine1: 'Address Line 1',
  addressLine2: 'Address Line 2',
  city: 'City',
  state: 'State',
  zip: 'ZIP Code',
  insuranceProvider: 'Insurance Provider',
  insuranceId: 'Insurance ID',
  emergencyContactName: 'Emergency Contact Name',
  emergencyContactPhone: 'Emergency Contact Phone',
};

export function ExtractedFieldsReview({
  documentId,
  patient,
  onClose,
  onFieldsApplied,
}: ExtractedFieldsReviewProps) {
  const [fieldMappings, setFieldMappings] = useState<OcrFieldMapping[]>([]);
  const [selectedFields, setSelectedFields] = useState<FieldSelection>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExtractedFields();
  }, [documentId]);

  async function loadExtractedFields() {
    setLoading(true);
    const { data, error: apiError } = await api.getExtractedFields(documentId);

    if (apiError) {
      setError(apiError);
      setLoading(false);
      return;
    }

    if (data) {
      // Filter to only show pending fields
      const pendingFields = data.fieldMappings.filter((m) => m.status === 'pending');
      setFieldMappings(pendingFields);

      // Pre-select fields with high confidence
      const initialSelection: FieldSelection = {};
      pendingFields.forEach((field) => {
        initialSelection[field.id] = (field.confidenceScore ?? 0) >= 0.8;
      });
      setSelectedFields(initialSelection);
    }

    setLoading(false);
  }

  function toggleField(fieldId: string) {
    setSelectedFields((prev) => ({
      ...prev,
      [fieldId]: !prev[fieldId],
    }));
  }

  function selectAll() {
    const newSelection: FieldSelection = {};
    fieldMappings.forEach((field) => {
      newSelection[field.id] = true;
    });
    setSelectedFields(newSelection);
  }

  function deselectAll() {
    setSelectedFields({});
  }

  async function handleApply() {
    const selectedIds = Object.entries(selectedFields)
      .filter(([, selected]) => selected)
      .map(([id]) => id);

    if (selectedIds.length === 0) {
      setError('Please select at least one field to apply');
      return;
    }

    setApplying(true);
    setError(null);

    const { error: apiError } = await api.applyOcrFields(documentId, selectedIds);

    if (apiError) {
      setError(apiError);
      setApplying(false);
      return;
    }

    // Reject the unselected fields
    const unselectedIds = Object.entries(selectedFields)
      .filter(([, selected]) => !selected)
      .map(([id]) => id);

    if (unselectedIds.length > 0) {
      await api.rejectOcrFields(documentId, unselectedIds);
    }

    setApplying(false);
    onFieldsApplied();
  }

  function getConfidenceBadge(confidence: number | null) {
    if (!confidence) {
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
          N/A
        </span>
      );
    }

    if (confidence >= 0.9) {
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
          High ({(confidence * 100).toFixed(0)}%)
        </span>
      );
    }

    if (confidence >= 0.7) {
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
          Medium ({(confidence * 100).toFixed(0)}%)
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
        Low ({(confidence * 100).toFixed(0)}%)
      </span>
    );
  }

  function getCurrentValue(fieldName: string): string {
    const value = (patient as unknown as Record<string, unknown>)[fieldName];
    return value ? String(value) : '(empty)';
  }

  const selectedCount = Object.values(selectedFields).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Review Extracted Fields
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Compare extracted values with current patient data and select fields to update
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-teal-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : fieldMappings.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No patient fields were extracted from this document.</p>
            </div>
          ) : (
            <>
              {/* Quick actions */}
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={selectAll}
                  className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
                >
                  Deselect All
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedCount} of {fieldMappings.length} selected
                </span>
              </div>

              {/* Field list */}
              <div className="space-y-3">
                {fieldMappings.map((field) => (
                  <div
                    key={field.id}
                    className={`border rounded-lg p-4 transition-colors cursor-pointer ${
                      selectedFields[field.id]
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => toggleField(field.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={selectedFields[field.id] || false}
                          onChange={() => toggleField(field.id)}
                          className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                        />
                      </div>

                      {/* Field info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {FIELD_LABELS[field.fieldName] || field.fieldName}
                          </span>
                          {getConfidenceBadge(field.confidenceScore)}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400 block mb-1">Current:</span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {getCurrentValue(field.fieldName)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400 block mb-1">Extracted:</span>
                            <span className="text-gray-900 dark:text-white font-medium">
                              {field.extractedValue}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
            <button
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applying || selectedCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {applying && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              Apply {selectedCount} Field{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
