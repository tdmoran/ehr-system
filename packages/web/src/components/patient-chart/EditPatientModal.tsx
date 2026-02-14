import { FormEvent } from 'react';
import { CreatePatientInput } from '../../api/client';

interface EditPatientModalProps {
  mrn: string;
  editForm: Partial<CreatePatientInput>;
  editFormError: string;
  editSubmitting: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function EditPatientModal({
  mrn,
  editForm,
  editFormError,
  editSubmitting,
  onInputChange,
  onSubmit,
  onClose,
}: EditPatientModalProps) {
  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-clinical-xl max-w-2xl w-full my-8 animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-clinical-200">
          <div>
            <h2 className="font-display text-xl font-bold text-navy-900">Edit Patient</h2>
            <p className="text-navy-500 font-body text-sm mt-1">
              MRN: {mrn}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-navy-50 flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="p-6 space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto">
            {editFormError && (
              <div className="p-4 bg-coral-50 border border-coral-200 rounded-lg">
                <p className="text-coral-700 text-sm font-body flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {editFormError}
                </p>
              </div>
            )}

            {/* Basic Information */}
            <div>
              <h3 className="font-display font-semibold text-navy-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-navy-700 font-body mb-1">
                    First Name <span className="text-coral-500">*</span>
                  </label>
                  <input type="text" id="firstName" name="firstName" value={editForm.firstName || ''} onChange={onInputChange} className="input-clinical" required />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-navy-700 font-body mb-1">
                    Last Name <span className="text-coral-500">*</span>
                  </label>
                  <input type="text" id="lastName" name="lastName" value={editForm.lastName || ''} onChange={onInputChange} className="input-clinical" required />
                </div>
                <div>
                  <label htmlFor="dateOfBirth" className="block text-sm font-medium text-navy-700 font-body mb-1">
                    Date of Birth <span className="text-coral-500">*</span>
                  </label>
                  <input type="date" id="dateOfBirth" name="dateOfBirth" value={editForm.dateOfBirth || ''} onChange={onInputChange} className="input-clinical" required />
                </div>
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-navy-700 font-body mb-1">Gender</label>
                  <select id="gender" name="gender" value={editForm.gender || ''} onChange={onInputChange} className="input-clinical">
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="font-display font-semibold text-navy-900 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-navy-700 font-body mb-1">Phone</label>
                  <input type="tel" id="phone" name="phone" value={editForm.phone || ''} onChange={onInputChange} placeholder="(555) 123-4567" className="input-clinical" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-navy-700 font-body mb-1">Email</label>
                  <input type="email" id="email" name="email" value={editForm.email || ''} onChange={onInputChange} placeholder="patient@example.com" className="input-clinical" />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="font-display font-semibold text-navy-900 mb-4">Address</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="addressLine1" className="block text-sm font-medium text-navy-700 font-body mb-1">Street Address</label>
                  <input type="text" id="addressLine1" name="addressLine1" value={editForm.addressLine1 || ''} onChange={onInputChange} placeholder="123 Main Street" className="input-clinical" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label htmlFor="city" className="block text-sm font-medium text-navy-700 font-body mb-1">City</label>
                    <input type="text" id="city" name="city" value={editForm.city || ''} onChange={onInputChange} className="input-clinical" />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-navy-700 font-body mb-1">State</label>
                    <input type="text" id="state" name="state" value={editForm.state || ''} onChange={onInputChange} placeholder="CA" maxLength={2} className="input-clinical" />
                  </div>
                  <div>
                    <label htmlFor="zip" className="block text-sm font-medium text-navy-700 font-body mb-1">ZIP Code</label>
                    <input type="text" id="zip" name="zip" value={editForm.zip || ''} onChange={onInputChange} placeholder="12345" maxLength={10} className="input-clinical" />
                  </div>
                </div>
              </div>
            </div>

            {/* Insurance */}
            <div>
              <h3 className="font-display font-semibold text-navy-900 mb-4">Insurance</h3>
              <div>
                <label htmlFor="insuranceProvider" className="block text-sm font-medium text-navy-700 font-body mb-1">Insurance Provider</label>
                <input type="text" id="insuranceProvider" name="insuranceProvider" value={editForm.insuranceProvider || ''} onChange={onInputChange} placeholder="e.g., Blue Cross Blue Shield" className="input-clinical" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 bg-clinical-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={editSubmitting}>Cancel</button>
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={editSubmitting}>
              {editSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
