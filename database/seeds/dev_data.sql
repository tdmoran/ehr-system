-- Development seed data
-- DO NOT use real patient information

-- Insert test users with bcrypt hashed passwords
-- All passwords are: password123

-- Admin user
INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES
('a0000000-0000-0000-0000-000000000001', 'admin@example.com', '$2b$10$8KzaNdKIMyOkASCBqfLrMeeDH.tSyl4hfc439LHD1x9SLlAJDbYcG', 'Admin', 'User', 'admin');

-- Provider (doctor)
INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES
('a0000000-0000-0000-0000-000000000002', 'drsmith@example.com', '$2b$10$8KzaNdKIMyOkASCBqfLrMeeDH.tSyl4hfc439LHD1x9SLlAJDbYcG', 'John', 'Smith', 'provider');

-- Nurse
INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES
('a0000000-0000-0000-0000-000000000003', 'nursejones@example.com', '$2b$10$8KzaNdKIMyOkASCBqfLrMeeDH.tSyl4hfc439LHD1x9SLlAJDbYcG', 'Sarah', 'Jones', 'nurse');

-- Insert test patients (fake data)
INSERT INTO patients (id, mrn, first_name, last_name, date_of_birth, gender, email, phone, address_line1, city, state, zip, insurance_provider, insurance_id) VALUES
('b0000000-0000-0000-0000-000000000001', 'MRN-001', 'Alice', 'Johnson', '1985-03-15', 'female', 'alice.j@email.com', '555-0101', '123 Main St', 'Springfield', 'IL', '62701', 'Blue Cross', 'BC-12345'),
('b0000000-0000-0000-0000-000000000002', 'MRN-002', 'Bob', 'Williams', '1972-07-22', 'male', 'bob.w@email.com', '555-0102', '456 Oak Ave', 'Springfield', 'IL', '62702', 'Aetna', 'AE-67890'),
('b0000000-0000-0000-0000-000000000003', 'MRN-003', 'Carol', 'Davis', '1990-11-08', 'female', 'carol.d@email.com', '555-0103', '789 Pine Rd', 'Springfield', 'IL', '62703', 'United Health', 'UH-11111');

-- Insert allergies
INSERT INTO allergies (patient_id, allergen, reaction, severity) VALUES
('b0000000-0000-0000-0000-000000000001', 'Penicillin', 'Rash, hives', 'moderate'),
('b0000000-0000-0000-0000-000000000001', 'Shellfish', 'Anaphylaxis', 'severe'),
('b0000000-0000-0000-0000-000000000002', 'Aspirin', 'GI upset', 'mild');

-- Insert sample encounters
INSERT INTO encounters (patient_id, provider_id, encounter_date, chief_complaint, subjective, objective, assessment, plan, vitals, diagnosis_codes, status, signed_at) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '7 days',
 'Annual physical exam',
 'Patient presents for routine annual physical. No acute complaints. Reports occasional headaches.',
 'BP 118/76, HR 72, Temp 98.4F, Weight 145 lbs. General appearance: well-nourished, no acute distress.',
 'Healthy adult female. Tension headaches.',
 'Continue current medications. Return in 1 year or as needed.',
 '{"bp": "118/76", "hr": 72, "temp": 98.4, "weight": 145, "height": 65}',
 ARRAY['Z00.00', 'G44.209'],
 'signed',
 NOW() - INTERVAL '7 days');

INSERT INTO encounters (patient_id, provider_id, encounter_date, chief_complaint, subjective, objective, assessment, plan, vitals, diagnosis_codes, status) VALUES
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '1 day',
 'Follow-up for diabetes',
 'Patient returns for diabetes follow-up. Reports good compliance with medications. Occasional fatigue.',
 'BP 132/84, HR 78, Weight 195 lbs. Foot exam normal.',
 'Type 2 diabetes, controlled. HTN, borderline.',
 'Continue Metformin. Recheck A1c in 3 months. Dietary counseling provided.',
 '{"bp": "132/84", "hr": 78, "temp": 98.6, "weight": 195}',
 ARRAY['E11.9', 'R53.83'],
 'completed');

-- Insert medications
INSERT INTO medications (patient_id, prescriber_id, drug_name, dosage, frequency, route, start_date, active) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Lisinopril', '10mg', 'Once daily', 'oral', CURRENT_DATE - INTERVAL '1 year', true),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Vitamin D3', '2000 IU', 'Once daily', 'oral', CURRENT_DATE - INTERVAL '6 months', true),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Metformin', '500mg', 'Twice daily', 'oral', CURRENT_DATE - INTERVAL '2 years', true);

-- Insert lab results
INSERT INTO lab_results (patient_id, ordering_provider_id, test_name, test_date, result_value, result_unit, reference_range, abnormal) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Hemoglobin A1c', NOW() - INTERVAL '7 days', '5.4', '%', '4.0-5.6', false),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Total Cholesterol', NOW() - INTERVAL '7 days', '195', 'mg/dL', '<200', false),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Hemoglobin A1c', NOW() - INTERVAL '30 days', '7.2', '%', '4.0-5.6', true);
