-- Add regime_trabalho column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS regime_trabalho TEXT;

-- Update the comment for documentation
COMMENT ON COLUMN public.profiles.regime_trabalho IS 'Work regime: Horista or Mensalista';