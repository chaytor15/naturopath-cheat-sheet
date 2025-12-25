-- Add address fields to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS street1 TEXT,
ADD COLUMN IF NOT EXISTS street2 TEXT,
ADD COLUMN IF NOT EXISTS suburb TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS postcode TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- Add index on country for potential filtering
CREATE INDEX IF NOT EXISTS idx_clients_country ON clients(country);





