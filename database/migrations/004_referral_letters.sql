-- Referral Letter Scanning Schema
-- Stores scanned referral letters and OCR results for batch processing

-- Store scanned referral letters (not tied to patient initially)
CREATE TABLE referral_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by UUID REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_size INTEGER,
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store OCR results for referral scans
CREATE TABLE referral_ocr_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_scan_id UUID REFERENCES referral_scans(id) ON DELETE CASCADE,
    raw_text TEXT,
    confidence_score DECIMAL(5,4),
    extracted_data JSONB,
    -- Extracted patient info
    patient_first_name VARCHAR(100),
    patient_last_name VARCHAR(100),
    patient_dob DATE,
    patient_phone VARCHAR(20),
    -- Extracted referral info
    referring_physician VARCHAR(200),
    referring_facility VARCHAR(200),
    reason_for_referral TEXT,
    -- Matching
    matched_patient_id UUID REFERENCES patients(id),
    match_confidence DECIMAL(5,4),
    -- Resolution
    resolution_status VARCHAR(20) DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'created', 'added', 'skipped')),
    resolved_patient_id UUID REFERENCES patients(id),
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_referral_scans_status ON referral_scans(processing_status);
CREATE INDEX idx_referral_scans_uploaded_by ON referral_scans(uploaded_by);
CREATE INDEX idx_referral_ocr_resolution ON referral_ocr_results(resolution_status);
CREATE INDEX idx_referral_ocr_scan_id ON referral_ocr_results(referral_scan_id);
CREATE INDEX idx_referral_ocr_matched_patient ON referral_ocr_results(matched_patient_id);

-- Comments for documentation
COMMENT ON TABLE referral_scans IS 'Stores scanned referral letter files for batch processing';
COMMENT ON TABLE referral_ocr_results IS 'Stores OCR extraction results and patient matching for referral scans';
COMMENT ON COLUMN referral_ocr_results.resolution_status IS 'pending: awaiting review, created: new patient created, added: added to existing patient, skipped: dismissed';
