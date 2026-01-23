import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { usePatients } from '../hooks/usePatients';
import { api, CreatePatientInput } from '../api/client';

const initialFormData: CreatePatientInput = {
  mrn: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  email: '',
  phone: '',
  addressLine1: '',
  city: '',
  state: '',
  zip: '',
  insuranceProvider: '',
  insuranceId: '',
};

function generateMRN(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MRN-${timestamp}${random}`.substring(0, 12);
}

export default function Patients() {
  const { patients, loading, search, setSearch, refetch } = usePatients();
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [formData, setFormData] = useState<CreatePatientInput>(initialFormData);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOpenModal = () => {
    setFormData({ ...initialFormData, mrn: generateMRN() });
    setFormError('');
    setShowNewPatient(true);
  };

  const handleCloseModal = () => {
    setShowNewPatient(false);
    setFormData(initialFormData);
    setFormError('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    // Basic validation
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.dateOfBirth) {
      setFormError('Please fill in all required fields.');
      setSubmitting(false);
      return;
    }

    const { data, error } = await api.createPatient(formData);

    if (error) {
      setFormError(error);
      setSubmitting(false);
      return;
    }

    if (data) {
      handleCloseModal();
      refetch();
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Patients</h1>
          <p className="text-navy-500 font-body mt-1">
            Manage patient records and access charts
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="btn-primary inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Patient
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card-clinical p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, MRN, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-clinical pl-12"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Patient List */}
      <div className="card-clinical overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-clinical-50 border-b border-clinical-200 text-sm font-medium text-navy-600 font-body">
          <div className="col-span-4">Patient</div>
          <div className="col-span-2">MRN</div>
          <div className="col-span-2">Date of Birth</div>
          <div className="col-span-2">Phone</div>
          <div className="col-span-2">Last Visit</div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-navy-500 font-body">Loading patients...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && patients.length === 0 && (
          <div className="p-12 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-navy-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-navy-900 font-display font-medium">No patients found</p>
            <p className="text-navy-500 font-body text-sm mt-1">
              {search ? 'Try adjusting your search criteria' : 'Add your first patient to get started'}
            </p>
          </div>
        )}

        {/* Patient Rows */}
        {!loading && patients.length > 0 && (
          <div className="divide-y divide-clinical-100">
            {patients.map((patient, index) => (
              <Link
                key={patient.id}
                to={`/patients/${patient.id}`}
                className={`block md:grid md:grid-cols-12 gap-4 px-6 py-4 hover:bg-clinical-50 transition-colors animate-slide-up stagger-${Math.min(index + 1, 5)}`}
                style={{ animationFillMode: 'backwards' }}
              >
                {/* Patient Name - Always visible */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center flex-shrink-0">
                    <span className="font-display font-semibold text-navy-600">
                      {patient.firstName[0]}{patient.lastName[0]}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-medium text-navy-900 truncate">
                      {patient.lastName}, {patient.firstName}
                    </p>
                    <p className="text-sm text-navy-400 font-body md:hidden">
                      {patient.mrn}
                    </p>
                  </div>
                </div>

                {/* MRN */}
                <div className="hidden md:flex col-span-2 items-center">
                  <span className="font-mono text-sm text-navy-600">{patient.mrn}</span>
                </div>

                {/* DOB */}
                <div className="hidden md:flex col-span-2 items-center">
                  <span className="text-navy-600 font-body">
                    {new Date(patient.dateOfBirth).toLocaleDateString()}
                  </span>
                </div>

                {/* Phone */}
                <div className="hidden md:flex col-span-2 items-center">
                  <span className="text-navy-600 font-body">{patient.phone || '—'}</span>
                </div>

                {/* Last Visit */}
                <div className="hidden md:flex col-span-2 items-center justify-between">
                  <span className="text-navy-500 font-body text-sm">Jan 15, 2024</span>
                  <svg className="w-5 h-5 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && patients.length > 0 && (
          <div className="px-6 py-4 bg-clinical-50 border-t border-clinical-200 flex items-center justify-between">
            <p className="text-sm text-navy-500 font-body">
              Showing <span className="font-medium text-navy-700">{patients.length}</span> patients
            </p>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-sm font-medium text-navy-600 bg-white border border-navy-200 rounded-lg hover:bg-navy-50 disabled:opacity-50" disabled>
                Previous
              </button>
              <button className="px-3 py-1.5 text-sm font-medium text-navy-600 bg-white border border-navy-200 rounded-lg hover:bg-navy-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Patient Modal */}
      {showNewPatient && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-clinical-xl max-w-2xl w-full my-8 animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-clinical-200">
              <h2 className="font-display text-xl font-bold text-navy-900">Add New Patient</h2>
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto">
                {formError && (
                  <div className="p-4 bg-coral-50 border border-coral-200 rounded-lg">
                    <p className="text-coral-700 text-sm font-body flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {formError}
                    </p>
                  </div>
                )}

                {/* Basic Information */}
                <div>
                  <h3 className="font-display font-semibold text-navy-900 mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="mrn" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        MRN <span className="text-coral-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="mrn"
                        name="mrn"
                        value={formData.mrn}
                        onChange={handleInputChange}
                        className="input-clinical font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="dateOfBirth" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Date of Birth <span className="text-coral-500">*</span>
                      </label>
                      <input
                        type="date"
                        id="dateOfBirth"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        className="input-clinical"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        First Name <span className="text-coral-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="input-clinical"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Last Name <span className="text-coral-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="input-clinical"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="gender" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Gender
                      </label>
                      <select
                        id="gender"
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="input-clinical"
                      >
                        <option value="">Select...</option>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="555-123-4567"
                        className="input-clinical"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="patient@email.com"
                        className="input-clinical"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="font-display font-semibold text-navy-900 mb-4">Address</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="addressLine1" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        id="addressLine1"
                        name="addressLine1"
                        value={formData.addressLine1}
                        onChange={handleInputChange}
                        placeholder="123 Main Street"
                        className="input-clinical"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="col-span-2">
                        <label htmlFor="city" className="block text-sm font-medium text-navy-700 font-body mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="input-clinical"
                        />
                      </div>
                      <div>
                        <label htmlFor="state" className="block text-sm font-medium text-navy-700 font-body mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          maxLength={2}
                          placeholder="IL"
                          className="input-clinical"
                        />
                      </div>
                      <div>
                        <label htmlFor="zip" className="block text-sm font-medium text-navy-700 font-body mb-1">
                          ZIP
                        </label>
                        <input
                          type="text"
                          id="zip"
                          name="zip"
                          value={formData.zip}
                          onChange={handleInputChange}
                          maxLength={10}
                          placeholder="62701"
                          className="input-clinical"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Insurance */}
                <div>
                  <h3 className="font-display font-semibold text-navy-900 mb-4">Insurance</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="insuranceProvider" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Insurance Provider
                      </label>
                      <input
                        type="text"
                        id="insuranceProvider"
                        name="insuranceProvider"
                        value={formData.insuranceProvider}
                        onChange={handleInputChange}
                        placeholder="Blue Cross Blue Shield"
                        className="input-clinical"
                      />
                    </div>
                    <div>
                      <label htmlFor="insuranceId" className="block text-sm font-medium text-navy-700 font-body mb-1">
                        Member ID
                      </label>
                      <input
                        type="text"
                        id="insuranceId"
                        name="insuranceId"
                        value={formData.insuranceId}
                        onChange={handleInputChange}
                        placeholder="ABC123456789"
                        className="input-clinical"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end p-6 border-t border-clinical-200 bg-clinical-50 rounded-b-2xl">
                <button type="button" onClick={handleCloseModal} className="btn-secondary" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={submitting}>
                  {submitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Patient'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
