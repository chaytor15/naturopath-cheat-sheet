-- Add buffer_time_minutes to clinic_settings table
ALTER TABLE clinic_settings 
ADD COLUMN IF NOT EXISTS buffer_time_minutes integer DEFAULT 15;




