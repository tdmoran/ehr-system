-- OCR Document Processing Tables
-- Migration: 003_ocr_processing.sql
-- Description: Tables for storing OCR results and field mappings for auto-population

-- Table to store OCR processing results for documents
CREATE TABLE document_ocr_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    raw_text TEXT,
    confidence_score DECIMAL(5,4),
    document_type VARCHAR(50),  -- 'referral', 'lab_result', 'intake_form', 'unknown'
    extracted_data JSONB,
    processing_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store extracted field mappings for patient auto-population
CREATE TABLE ocr_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ocr_result_id UUID REFERENCES document_ocr_results(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id),
    field_name VARCHAR(100) NOT NULL,
    extracted_value TEXT NOT NULL,
    original_value TEXT,
    confidence_score DECIMAL(5,4),
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'applied', 'rejected'
    applied_at TIMESTAMP,
    applied_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient lookups
CREATE INDEX idx_ocr_results_document ON document_ocr_results(document_id);
CREATE INDEX idx_ocr_results_status ON document_ocr_results(processing_status);
CREATE INDEX idx_ocr_mappings_patient ON ocr_field_mappings(patient_id);
CREATE INDEX idx_ocr_mappings_ocr_result ON ocr_field_mappings(ocr_result_id);
CREATE INDEX idx_ocr_mappings_status ON ocr_field_mappings(status);

-- Add comment for documentation
COMMENT ON TABLE document_ocr_results IS 'Stores OCR processing results for scanned documents';
COMMENT ON TABLE ocr_field_mappings IS 'Stores extracted patient fields from OCR with status tracking';
COMMENT ON COLUMN document_ocr_results.document_type IS 'Type of document: referral, lab_result, intake_form, unknown';
COMMENT ON COLUMN document_ocr_results.extracted_data IS 'JSONB containing all extracted structured data';
COMMENT ON COLUMN ocr_field_mappings.original_value IS 'Original patient field value before OCR update';
