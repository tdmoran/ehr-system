export type UserRole = 'provider' | 'nurse' | 'admin' | 'billing';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  insuranceProvider: string | null;
  insuranceId: string | null;
  active: boolean;
}

export interface Vitals {
  bp?: string;
  hr?: number;
  temp?: number;
  weight?: number;
  height?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
}

export type EncounterStatus = 'in_progress' | 'completed' | 'signed';

export interface Encounter {
  id: string;
  patientId: string;
  providerId: string;
  encounterDate: string;
  chiefComplaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  vitals: Vitals | null;
  diagnosisCodes: string[];
  status: EncounterStatus;
  signedAt: string | null;
}

export type AllergySeverity = 'mild' | 'moderate' | 'severe';

export interface Allergy {
  id: string;
  patientId: string;
  allergen: string;
  reaction: string | null;
  severity: AllergySeverity | null;
}

export interface Medication {
  id: string;
  patientId: string;
  prescriberId: string;
  drugName: string;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  notes: string | null;
}

export interface LabResult {
  id: string;
  patientId: string;
  orderingProviderId: string;
  testName: string;
  testDate: string | null;
  resultValue: string | null;
  resultUnit: string | null;
  referenceRange: string | null;
  abnormal: boolean;
  notes: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
  details?: Array<{ field: string; message: string }>;
}
