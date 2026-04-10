-- Add currency to clinic_settings table
ALTER TABLE clinic_settings 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'NZD', 'EUR', 'AUD', 'GBP'));


