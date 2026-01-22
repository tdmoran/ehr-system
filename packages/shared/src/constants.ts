export const USER_ROLES = ['provider', 'nurse', 'admin', 'billing'] as const;

export const ENCOUNTER_STATUSES = ['in_progress', 'completed', 'signed'] as const;

export const ALLERGY_SEVERITIES = ['mild', 'moderate', 'severe'] as const;

export const MEDICATION_ROUTES = [
  'oral',
  'topical',
  'intravenous',
  'intramuscular',
  'subcutaneous',
  'inhaled',
  'rectal',
  'sublingual',
] as const;

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;
