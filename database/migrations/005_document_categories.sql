-- Add document category to distinguish between document types
ALTER TABLE documents ADD COLUMN category VARCHAR(50) DEFAULT 'scanned_document'
  CHECK (category IN ('scanned_document', 'letter', 'operative_note'));

CREATE INDEX idx_documents_category ON documents(category);
