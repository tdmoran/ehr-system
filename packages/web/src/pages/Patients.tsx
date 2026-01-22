import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePatients } from '../hooks/usePatients';

export default function Patients() {
  const { patients, loading, search, setSearch } = usePatients();
  const [showNewPatient, setShowNewPatient] = useState(false);

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
          onClick={() => setShowNewPatient(true)}
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

      {/* New Patient Modal Placeholder */}
      {showNewPatient && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-clinical-xl max-w-lg w-full p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-navy-900">Add New Patient</h2>
              <button
                onClick={() => setShowNewPatient(false)}
                className="w-8 h-8 rounded-lg hover:bg-navy-50 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-navy-500 font-body text-center py-8">
              Patient registration form would go here.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowNewPatient(false)} className="btn-secondary">
                Cancel
              </button>
              <button className="btn-primary">Save Patient</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
