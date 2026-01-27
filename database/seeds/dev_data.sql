-- Development seed data
-- DO NOT use real patient information

-- Insert test users with bcrypt hashed passwords
-- Demo passwords: doc@t.co and sec@t.co use "123", others use "password123"

-- Admin user
INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES
('a0000000-0000-0000-0000-000000000001', 'admin@example.com', '$2b$10$hkCFa4g6UL4PzHft.gVNNesI5KyTV.wWV38AtP9pX6dPC4H24lWzy', 'Admin', 'User', 'admin');

-- Provider (doctor)
INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES
('a0000000-0000-0000-0000-000000000002', 'doc@t.co', '$2b$10$vM5iu7K8OAQi.sjr3CvM1OOzqHb.hnOUBL4M4dw9E4HE9N/qxZRQi', 'Tom', 'Moran', 'provider');

-- Nurse
INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES
('a0000000-0000-0000-0000-000000000003', 'nursejones@example.com', '$2b$10$hkCFa4g6UL4PzHft.gVNNesI5KyTV.wWV38AtP9pX6dPC4H24lWzy', 'Sarah', 'Jones', 'nurse');

-- Secretary (linked to Dr. Moran)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, provider_id) VALUES
('a0000000-0000-0000-0000-000000000004', 'sec@t.co', '$2b$10$vM5iu7K8OAQi.sjr3CvM1OOzqHb.hnOUBL4M4dw9E4HE9N/qxZRQi', 'Emily', 'Smith', 'secretary', 'a0000000-0000-0000-0000-000000000002');

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
INSERT INTO encounters (patient_id, provider_id, encounter_date, chief_complaint, subjective, objective, assessment, plan, status, signed_at) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '7 days',
 'Annual physical exam',
 'Patient presents for routine annual physical. No acute complaints. Reports occasional headaches.',
 'General appearance: well-nourished, no acute distress.',
 'Healthy adult female. Tension headaches.',
 'Return in 1 year or as needed.',
 'signed',
 NOW() - INTERVAL '7 days');

INSERT INTO encounters (patient_id, provider_id, encounter_date, chief_complaint, subjective, objective, assessment, plan, status) VALUES
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '1 day',
 'Follow-up',
 'Patient returns for follow-up. Reports good compliance. Occasional fatigue.',
 'Exam normal.',
 'Condition stable.',
 'Continue current management. Follow up in 3 months.',
 'completed');

