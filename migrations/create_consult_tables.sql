-- Create consult sessions table
CREATE TABLE IF NOT EXISTS consults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  practitioner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  consult_type TEXT NOT NULL CHECK (consult_type IN ('initial', 'follow-up', 'check-in')),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'recording', 'processing', 'complete')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create consult transcripts table
CREATE TABLE IF NOT EXISTS consult_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consult_id UUID REFERENCES consults(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create consult outputs table
CREATE TABLE IF NOT EXISTS consult_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consult_id UUID REFERENCES consults(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('SOAP', 'DAP', 'Narrative', 'Patient Summary')),
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_consults_client_id ON consults(client_id);
CREATE INDEX IF NOT EXISTS idx_consults_practitioner_id ON consults(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_consults_status ON consults(status);
CREATE INDEX IF NOT EXISTS idx_consult_transcripts_consult_id ON consult_transcripts(consult_id);
CREATE INDEX IF NOT EXISTS idx_consult_outputs_consult_id ON consult_outputs(consult_id);
CREATE INDEX IF NOT EXISTS idx_consult_outputs_type ON consult_outputs(type);

-- Enable RLS
ALTER TABLE consults ENABLE ROW LEVEL SECURITY;
ALTER TABLE consult_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE consult_outputs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consults
CREATE POLICY "Users can view their own consults"
  ON consults FOR SELECT
  USING (auth.uid() = practitioner_id);

CREATE POLICY "Users can create their own consults"
  ON consults FOR INSERT
  WITH CHECK (auth.uid() = practitioner_id);

CREATE POLICY "Users can update their own consults"
  ON consults FOR UPDATE
  USING (auth.uid() = practitioner_id);

CREATE POLICY "Users can delete their own consults"
  ON consults FOR DELETE
  USING (auth.uid() = practitioner_id);

-- RLS Policies for consult_transcripts
CREATE POLICY "Users can view transcripts for their consults"
  ON consult_transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consults
      WHERE consults.id = consult_transcripts.consult_id
      AND consults.practitioner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create transcripts for their consults"
  ON consult_transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consults
      WHERE consults.id = consult_transcripts.consult_id
      AND consults.practitioner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update transcripts for their consults"
  ON consult_transcripts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM consults
      WHERE consults.id = consult_transcripts.consult_id
      AND consults.practitioner_id = auth.uid()
    )
  );

-- RLS Policies for consult_outputs
CREATE POLICY "Users can view outputs for their consults"
  ON consult_outputs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consults
      WHERE consults.id = consult_outputs.consult_id
      AND consults.practitioner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create outputs for their consults"
  ON consult_outputs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consults
      WHERE consults.id = consult_outputs.consult_id
      AND consults.practitioner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update outputs for their consults"
  ON consult_outputs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM consults
      WHERE consults.id = consult_outputs.consult_id
      AND consults.practitioner_id = auth.uid()
    )
  );















