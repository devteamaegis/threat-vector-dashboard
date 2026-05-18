-- Run once in the Supabase SQL editor.
-- Ensures the columns the /api/inbound-tip and /api/translate routes write to exist.
-- Idempotent — safe to re-run.

ALTER TABLE tips ADD COLUMN IF NOT EXISTS english_translation   text;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS multilingual_call     boolean DEFAULT false;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS caller_language       text;

-- Heatmap / location fields (kept here for new installs)
ALTER TABLE tips ADD COLUMN IF NOT EXISTS call_lat              float8;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS call_lng              float8;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS location_context      text;

-- Gemini / consensus fields
ALTER TABLE tips ADD COLUMN IF NOT EXISTS gemini_level          integer;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS gemini_reasoning      text;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS consensus             boolean DEFAULT false;

-- Bayesian Monte Carlo result fields
ALTER TABLE tips ADD COLUMN IF NOT EXISTS bayes_probability_pct integer;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS bayes_ci_low_pct      integer;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS bayes_ci_high_pct     integer;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS bayes_features_hit    text[];
ALTER TABLE tips ADD COLUMN IF NOT EXISTS bayes_top_drivers     jsonb;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS threat_level          integer;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS three_model_consensus boolean DEFAULT false;
