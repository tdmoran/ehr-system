import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePatient } from '../hooks/usePatients';
import { api, Encounter } from '../api/client';

export default function PatientChart() {
  const { id } = useParams<{ id: string }>();
  const { patient, loading: patientLoading } = usePatient(id!);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'encounters' | 'medications' | 'labs'>('overview');

  useEffect(() => {
    if (id) {
      api.getPatientEncounters(id).then(({ data }) => {
        if (data) setEncounters(data.encounters);
      });
    }
  }, [id]);

  if (patientLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-navy-500 font-body">Loading patient...</span>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-navy-900 font-display font-medium">Patient not found</p>
          <Link to="/patients" className="text-teal-600 font-body text-sm hover:underline mt-2 inline-block">
            Back to patients
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'encounters', label: 'Encounters' },
    { id: 'medications', label: 'Medications' },
    { id: 'labs', label: 'Lab Results' },
  ] as const;

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm font-body">
        <Link to="/patients" className="text-navy-500 hover:text-navy-700">Patients</Link>
        <svg className="w-4 h-4 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-navy-900 font-medium">{patient.lastName}, {patient.firstName}</span>
      </nav>

      {/* Patient Header */}
      <div className="card-clinical p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <span className="font-display font-bold text-3xl text-white">
              {patient.firstName[0]}{patient.lastName[0]}
            </span>
          </div>

          {/* Patient Info */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-navy-900">
                  {patient.lastName}, {patient.firstName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-navy-500 font-body text-sm">
                  <span className="font-mono bg-navy-50 px-2 py-0.5 rounded">{patient.mrn}</span>
                  <span>{calculateAge(patient.dateOfBirth)} years old</span>
                  <span className="capitalize">{patient.gender || 'Unknown'}</span>
                  <span>DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary">Edit Patient</button>
                <button className="btn-primary">New Encounter</button>
              </div>
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Phone</p>
                <p className="font-display font-medium text-navy-900 mt-1">{patient.phone || '—'}</p>
              </div>
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Insurance</p>
                <p className="font-display font-medium text-navy-900 mt-1">{patient.insuranceProvider || '—'}</p>
              </div>
              <div className="p-3 bg-coral-50 rounded-lg border border-coral-100">
                <p className="text-xs text-coral-600 font-body uppercase tracking-wide">Allergies</p>
                <p className="font-display font-medium text-coral-700 mt-1">Penicillin, Shellfish</p>
              </div>
              <div className="p-3 bg-clinical-50 rounded-lg">
                <p className="text-xs text-navy-500 font-body uppercase tracking-wide">Primary Care</p>
                <p className="font-display font-medium text-navy-900 mt-1">Dr. Smith</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-clinical-200">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-display font-medium text-sm transition-colors relative ${
                activeTab === tab.id
                  ? 'text-teal-600'
                  : 'text-navy-500 hover:text-navy-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Vitals */}
            <div className="card-clinical overflow-hidden">
              <div className="px-5 py-4 border-b border-clinical-200 bg-clinical-50">
                <h3 className="font-display font-semibold text-navy-900">Latest Vitals</h3>
              </div>
              <div className="p-5 space-y-4">
                <VitalRow label="Blood Pressure" value="118/76" unit="mmHg" status="normal" />
                <VitalRow label="Heart Rate" value="72" unit="bpm" status="normal" />
                <VitalRow label="Temperature" value="98.4" unit="°F" status="normal" />
                <VitalRow label="Weight" value="145" unit="lbs" status="normal" />
                <VitalRow label="Height" value="5 ft 5 in" unit="" status="normal" />
              </div>
            </div>

            {/* Active Medications */}
            <div className="card-clinical overflow-hidden">
              <div className="px-5 py-4 border-b border-clinical-200 bg-clinical-50 flex items-center justify-between">
                <h3 className="font-display font-semibold text-navy-900">Active Medications</h3>
                <span className="badge badge-neutral">2</span>
              </div>
              <div className="divide-y divide-clinical-100">
                <MedicationRow name="Lisinopril" dosage="10mg" frequency="Once daily" />
                <MedicationRow name="Vitamin D3" dosage="2000 IU" frequency="Once daily" />
              </div>
            </div>

            {/* Recent Labs */}
            <div className="card-clinical overflow-hidden">
              <div className="px-5 py-4 border-b border-clinical-200 bg-clinical-50 flex items-center justify-between">
                <h3 className="font-display font-semibold text-navy-900">Recent Labs</h3>
                <button className="text-sm text-teal-600 font-medium hover:text-teal-700 font-body">View All</button>
              </div>
              <div className="divide-y divide-clinical-100">
                <LabRow name="Hemoglobin A1c" value="5.4%" status="normal" date="Jan 15" />
                <LabRow name="Total Cholesterol" value="195 mg/dL" status="normal" date="Jan 15" />
                <LabRow name="LDL" value="120 mg/dL" status="borderline" date="Jan 15" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'encounters' && (
          <div className="card-clinical overflow-hidden">
            <div className="px-6 py-4 border-b border-clinical-200 flex items-center justify-between">
              <h3 className="font-display font-semibold text-navy-900">Encounter History</h3>
              <button className="btn-primary text-sm py-2">New Encounter</button>
            </div>
            {encounters.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-navy-500 font-body">No encounters recorded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-clinical-100">
                {encounters.map((encounter) => (
                  <div key={encounter.id} className="p-6 hover:bg-clinical-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="font-display font-medium text-navy-900">
                            {new Date(encounter.encounterDate).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <span className={`badge ${
                            encounter.status === 'signed' ? 'badge-success' :
                            encounter.status === 'completed' ? 'badge-neutral' :
                            'badge-warning'
                          }`}>
                            {encounter.status === 'in_progress' ? 'In Progress' :
                             encounter.status === 'completed' ? 'Completed' : 'Signed'}
                          </span>
                        </div>
                        <p className="text-navy-500 font-body mt-1">{encounter.chiefComplaint || 'No chief complaint recorded'}</p>
                      </div>
                      <button className="text-teal-600 hover:text-teal-700 font-medium text-sm font-body">
                        View
                      </button>
                    </div>
                    {encounter.diagnosisCodes && encounter.diagnosisCodes.length > 0 && (
                      <div className="mt-3 flex gap-2">
                        {encounter.diagnosisCodes.map((code) => (
                          <span key={code} className="font-mono text-xs bg-navy-50 text-navy-600 px-2 py-1 rounded">
                            {code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'medications' && (
          <div className="card-clinical p-6">
            <p className="text-navy-500 font-body text-center py-8">Medications tab content</p>
          </div>
        )}

        {activeTab === 'labs' && (
          <div className="card-clinical p-6">
            <p className="text-navy-500 font-body text-center py-8">Lab results tab content</p>
          </div>
        )}
      </div>
    </div>
  );
}

function VitalRow({ label, value, unit, status }: { label: string; value: string; unit: string; status: 'normal' | 'abnormal' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-navy-500 font-body text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-display font-semibold ${status === 'normal' ? 'text-navy-900' : 'text-coral-600'}`}>
          {value}
        </span>
        <span className="text-navy-400 text-sm font-body">{unit}</span>
      </div>
    </div>
  );
}

function MedicationRow({ name, dosage, frequency }: { name: string; dosage: string; frequency: string }) {
  return (
    <div className="px-5 py-4">
      <p className="font-display font-medium text-navy-900">{name}</p>
      <p className="text-sm text-navy-500 font-body">{dosage} • {frequency}</p>
    </div>
  );
}

function LabRow({ name, value, status, date }: { name: string; value: string; status: 'normal' | 'abnormal' | 'borderline'; date: string }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between">
      <div>
        <p className="font-display font-medium text-navy-900">{name}</p>
        <p className="text-xs text-navy-400 font-body">{date}</p>
      </div>
      <div className="text-right">
        <p className={`font-mono text-sm ${
          status === 'normal' ? 'text-teal-600' :
          status === 'abnormal' ? 'text-coral-600' :
          'text-amber-600'
        }`}>
          {value}
        </p>
        <span className={`badge text-xs mt-1 ${
          status === 'normal' ? 'badge-success' :
          status === 'abnormal' ? 'badge-danger' :
          'badge-warning'
        }`}>
          {status}
        </span>
      </div>
    </div>
  );
}
