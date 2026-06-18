-- ============================================================
-- DIMA Risk — Full Platform Schema Migration
-- Run this in the Supabase SQL editor
-- ============================================================


-- =====================
-- 1. FRAMEWORKS reference table
-- =====================
CREATE TABLE IF NOT EXISTS frameworks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  region      TEXT,
  description TEXT,
  has_dataset BOOLEAN DEFAULT false,
  active      BOOLEAN DEFAULT true
);

INSERT INTO frameworks (id, name, region, description, has_dataset) VALUES
  ('pipeda',   'PIPEDA',        'canada',        'Personal Information Protection and Electronic Documents Act', true),
  ('hipaa',    'HIPAA',         'usa',           'Health Insurance Portability and Accountability Act',         true),
  ('soc2',     'SOC 2',         'international', 'Service Organization Control 2',                              false),
  ('law25',    'Quebec Law 25', 'canada',        'Act to Modernize Legislative Provisions re: Personal Info',   false),
  ('iso27001', 'ISO 27001',     'international', 'Information Security Management System',                      false),
  ('iso27002', 'ISO 27002',     'international', 'Code of Practice for Information Security Controls',          false),
  ('gdpr',     'GDPR',          'international', 'General Data Protection Regulation',                          false),
  ('fippa',    'FIPPA',         'canada',        'Freedom of Information and Protection of Privacy Act',        false)
ON CONFLICT (id) DO NOTHING;


-- =====================
-- 2. PIPEDA — merge general + healthcare into one table
-- =====================
ALTER TABLE pipeda_questions ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

-- Copy all healthcare-specific PIPEDA questions with new non-conflicting IDs
INSERT INTO pipeda_questions
  (id, question_code, question_id, business_question, pipeda_controls, control_n,
   compliance_statement, compliance_statement_id, reference, category)
SELECT
  (SELECT COALESCE(MAX(id), 0) FROM pipeda_questions) + ROW_NUMBER() OVER (),
  question_code, question_id, business_question, pipeda_controls, control_n,
  compliance_statement, compliance_statement_id, reference, 'healthcare'
FROM pipeda_healthcare_questions
ON CONFLICT DO NOTHING;

-- PIPEDA evidence options (mirrors HIPAA_KPIs structure)
-- Populated later per question; structure matches HIPAA_KPIs
CREATE TABLE IF NOT EXISTS pipeda_evidence_options (
  id          BIGSERIAL PRIMARY KEY,
  evidence    TEXT NOT NULL,
  evidence_id BIGINT,
  question_id INT  NOT NULL   -- references pipeda_questions.question_id
);


-- =====================
-- 3. ORGANIZATIONS — bridge to fact_software_results
-- =====================
-- fact_software_results.org_uid is BIGINT; organizations.id is UUID.
-- This column lets us join them once the scan system assigns a numeric org id.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_uid BIGINT UNIQUE;


-- =====================
-- 4. FRAMEWORK ASSIGNMENTS
-- Determines which frameworks each org must complete based on industry + country
-- =====================
CREATE TABLE IF NOT EXISTS framework_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_id  TEXT NOT NULL REFERENCES frameworks(id),
  auto_assigned BOOLEAN DEFAULT true,
  assigned_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, framework_id)
);

-- Called right after org registers.
-- Assigns the correct framework(s) and opens the first assessment session.
-- Uses exact industry names from the registration form.
CREATE OR REPLACE FUNCTION assign_frameworks_for_org(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_industry TEXT;
  v_country  TEXT;
  v_framework TEXT;
BEGIN
  SELECT trim(industry), trim(org_country)
  INTO v_industry, v_country
  FROM organizations
  WHERE user_id = p_user_id;

  v_framework := NULL;

  -- CANADA: PIPEDA applies to all five industries
  IF v_country = 'CA' THEN
    IF v_industry IN ('Healthcare', 'Healthtech', 'Education', 'Fintech', 'Finance') THEN
      v_framework := 'pipeda';
    END IF;

  -- USA: HIPAA only for Healthcare and Healthtech; nothing else has a dataset yet
  ELSIF v_country = 'US' THEN
    IF v_industry IN ('Healthcare', 'Healthtech') THEN
      v_framework := 'hipaa';
    END IF;
  END IF;

  IF v_framework IS NOT NULL THEN
    -- Assign the framework
    INSERT INTO framework_assignments (user_id, framework_id)
    VALUES (p_user_id, v_framework)
    ON CONFLICT DO NOTHING;

    -- Open the first assessment session, snapshotting industry + country
    INSERT INTO assessment_sessions (user_id, framework_id, industry, org_country)
    VALUES (p_user_id, v_framework, v_industry, v_country)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;


-- =====================
-- 5. ASSESSMENT SESSIONS
-- One session per org per framework; tracks the human questionnaire run.
-- industry + org_country are snapshotted at session creation so question
-- fetching stays correct even if the org later edits their profile.
-- Links to fact_software_results for the automated scan side.
-- =====================
CREATE TABLE IF NOT EXISTS assessment_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_id       TEXT NOT NULL REFERENCES frameworks(id),
  industry           TEXT NOT NULL,   -- snapshot: 'Healthcare' | 'Healthtech' | 'Education' | 'Fintech' | 'Finance'
  org_country        TEXT NOT NULL,   -- snapshot: country code at session creation
  software_result_id BIGINT REFERENCES fact_software_results(id),
  status             TEXT NOT NULL DEFAULT 'in_progress'
                       CHECK (status IN ('in_progress', 'completed')),
  started_at         TIMESTAMPTZ DEFAULT now(),
  completed_at       TIMESTAMPTZ
);


-- =====================
-- 6. QUESTIONNAIRE RESPONSES
-- One row per question per session
-- =====================
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  question_id  INT  NOT NULL,
  framework_id TEXT NOT NULL REFERENCES frameworks(id),
  -- 'yes' = fully compliant, 'partial' = partially, 'no' = not compliant, 'na' = not applicable
  response     TEXT CHECK (response IN ('yes', 'no', 'partial', 'na')),
  notes        TEXT,
  answered_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, question_id, framework_id)
);


-- =====================
-- 7. SELECTED EVIDENCE
-- Which KPI/evidence items the org selected per response
-- =====================
CREATE TABLE IF NOT EXISTS selected_evidence (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id  UUID NOT NULL REFERENCES questionnaire_responses(id) ON DELETE CASCADE,
  evidence_id  INT  NOT NULL,    -- references HIPAA_KPIs.id or pipeda_evidence_options.id
  framework_id TEXT NOT NULL REFERENCES frameworks(id)
);


-- =====================
-- 8. MATURITY SCORES
-- Per domain per framework per session
-- Level 1-5: Initial → Developing → Defined → Managed → Optimized
-- =====================
CREATE TABLE IF NOT EXISTS maturity_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  framework_id   TEXT NOT NULL REFERENCES frameworks(id),
  domain         TEXT,           -- e.g. 'Physical Safeguards', 'Accountability'
  raw_score      NUMERIC(5,2),
  maturity_level INT CHECK (maturity_level BETWEEN 1 AND 5),
  label          TEXT,           -- 'Initial', 'Developing', 'Defined', 'Managed', 'Optimized'
  calculated_at  TIMESTAMPTZ DEFAULT now()
);


-- =====================
-- 9. RISK SCORES
-- 4 components × 25 pts = 100 pt total scale
-- =====================
CREATE TABLE IF NOT EXISTS risk_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  framework_id     TEXT NOT NULL REFERENCES frameworks(id),
  likelihood_score NUMERIC(5,2) CHECK (likelihood_score BETWEEN 0 AND 25),
  impact_score     NUMERIC(5,2) CHECK (impact_score BETWEEN 0 AND 25),
  control_score    NUMERIC(5,2) CHECK (control_score BETWEEN 0 AND 25),
  exposure_score   NUMERIC(5,2) CHECK (exposure_score BETWEEN 0 AND 25),
  total_score      NUMERIC(5,2) GENERATED ALWAYS AS (
                     COALESCE(likelihood_score, 0) + COALESCE(impact_score, 0) +
                     COALESCE(control_score, 0)    + COALESCE(exposure_score, 0)
                   ) STORED,
  risk_band        TEXT CHECK (risk_band IN ('critical', 'high', 'medium', 'low')),
  calculated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, framework_id)
);


-- =====================
-- 10. FINANCIAL IMPACT
-- Breach cost + regulatory fines + remediation cost
-- =====================
CREATE TABLE IF NOT EXISTS financial_impact (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  estimated_breach_cost NUMERIC(14,2),
  regulatory_fines_min  NUMERIC(14,2),
  regulatory_fines_max  NUMERIC(14,2),
  remediation_cost      NUMERIC(14,2),
  total_exposure_min    NUMERIC(14,2),
  total_exposure_max    NUMERIC(14,2),
  currency              TEXT DEFAULT 'CAD',
  calculated_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id)
);


-- =====================
-- 11. VENDORS
-- Third-party vendors that access org data
-- =====================
CREATE TABLE IF NOT EXISTS vendors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT,
  data_types   TEXT[],    -- types of data they access
  risk_level   TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  has_dpa      BOOLEAN DEFAULT false,  -- Data Processing Agreement in place
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);


-- =====================
-- 12. REMEDIATION ROADMAP
-- Action items generated from the assessment
-- =====================
CREATE TABLE IF NOT EXISTS remediation_roadmap (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT CHECK (category IN ('technical', 'administrative', 'physical')),
  priority     TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  effort       TEXT CHECK (effort IN ('quick-win', 'medium', 'complex')),
  status       TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  due_date     DATE,
  assigned_to  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);


-- =====================
-- 13. ROW LEVEL SECURITY
-- =====================
ALTER TABLE framework_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_responses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_evidence        ENABLE ROW LEVEL SECURITY;
ALTER TABLE maturity_scores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_impact         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_roadmap      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own framework_assignments"   ON framework_assignments
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own assessment_sessions"     ON assessment_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own questionnaire_responses" ON questionnaire_responses
  FOR ALL USING (
    session_id IN (SELECT id FROM assessment_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "own selected_evidence"       ON selected_evidence
  FOR ALL USING (
    response_id IN (
      SELECT qr.id FROM questionnaire_responses qr
      JOIN assessment_sessions s ON s.id = qr.session_id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "own maturity_scores"         ON maturity_scores
  FOR ALL USING (
    session_id IN (SELECT id FROM assessment_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "own risk_scores"             ON risk_scores
  FOR ALL USING (
    session_id IN (SELECT id FROM assessment_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "own financial_impact"        ON financial_impact
  FOR ALL USING (
    session_id IN (SELECT id FROM assessment_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "own vendors"                 ON vendors
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own remediation_roadmap"     ON remediation_roadmap
  FOR ALL USING (user_id = auth.uid());


-- =====================
-- 14. VIEW: questions for a session
-- The app calls this with a session_id — it returns the correct
-- question rows based on framework + industry snapshot.
-- PIPEDA Healthcare/Healthtech → all categories
-- PIPEDA other industries     → 'general' only
-- HIPAA                       → all hipaa_questions
-- =====================
CREATE OR REPLACE VIEW v_session_questions AS
  -- PIPEDA questions
  SELECT
    s.id                AS session_id,
    s.user_id,
    s.framework_id,
    'pipeda'::text      AS source_table,
    q.id                AS question_id,
    q.question_code,
    q.business_question AS question_text,
    q.pipeda_controls   AS domain,
    q.compliance_statement,
    q.reference,
    q.category
  FROM assessment_sessions s
  JOIN pipeda_questions q ON s.framework_id = 'pipeda'
  WHERE
    (s.user_id = auth.uid() OR auth.uid() IS NULL)
    AND (
      -- Healthcare & Healthtech get general + healthcare-specific questions
      (s.industry IN ('Healthcare', 'Healthtech') AND q.category IN ('general', 'healthcare'))
      OR
      -- Education, Fintech, Finance get general questions only
      (s.industry IN ('Education', 'Fintech', 'Finance') AND q.category = 'general')
    )

  UNION ALL

  -- HIPAA questions
  SELECT
    s.id                  AS session_id,
    s.user_id,
    s.framework_id,
    'hipaa'::text         AS source_table,
    q.id                  AS question_id,
    NULL                  AS question_code,
    q.questionaire        AS question_text,
    q."HIPPA_controls"    AS domain,
    q.statement           AS compliance_statement,
    NULL                  AS reference,
    NULL                  AS category
  FROM assessment_sessions s
  JOIN hipaa_questions q ON s.framework_id = 'hipaa'
  WHERE (s.user_id = auth.uid() OR auth.uid() IS NULL);


-- =====================
-- 15. INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_fw_assign_user       ON framework_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user        ON assessment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_framework   ON assessment_sessions(framework_id);
CREATE INDEX IF NOT EXISTS idx_sessions_sw_result   ON assessment_sessions(software_result_id);
CREATE INDEX IF NOT EXISTS idx_qr_session           ON questionnaire_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_qr_question          ON questionnaire_responses(question_id, framework_id);
CREATE INDEX IF NOT EXISTS idx_maturity_session     ON maturity_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_risk_session         ON risk_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_session      ON remediation_roadmap(session_id);
CREATE INDEX IF NOT EXISTS idx_vendors_user         ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_orgs_org_uid         ON organizations(org_uid);

-- Add onboarding_completed flag (used by middleware to route post-registration flow)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- =====================
-- ADDENDUM: Org Risk Profile columns + Scoring Functions
-- Run this after the initial migration
-- =====================

-- Org risk profile inputs (used by the 4-component scoring formula)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS patient_records_count  BIGINT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_storage_gb        NUMERIC(10,2)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_health_data        BOOLEAN         DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_financial_data     BOOLEAN         DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_pii_data           BOOLEAN         DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_sensitivity_level INT             DEFAULT 3 CHECK (data_sensitivity_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS vendor_count           INT             DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_vendor_access_level INT            DEFAULT 1 CHECK (max_vendor_access_level BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS vendor_data_share_pct  NUMERIC(5,2)    DEFAULT 0 CHECK (vendor_data_share_pct BETWEEN 0 AND 100);

-- Unique constraint on maturity_scores so we can upsert per domain
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_maturity_session_fw_domain'
  ) THEN
    ALTER TABLE maturity_scores
      ADD CONSTRAINT uq_maturity_session_fw_domain UNIQUE (session_id, framework_id, domain);
  END IF;
END $$;

-- =====================
-- SCORING FUNCTION
-- Runs all 4 components (each worth 25 pts) and writes to risk_scores + maturity_scores
-- Formula from concept manual:
--   1. exposure_score   = Data Volume Risk   = min(25, Records/10000 + GB/100)
--   2. impact_score     = Data Sensitivity   = (Level×3) + Health(+8) + Financial(+5) + PII(+4), max 25
--   3. control_score    = Third-Party Risk   = min(25, Vendors×2 + AccessLevel×3 + Share%/4)
--   4. likelihood_score = Compliance Gap     = (failed/total) × 25
-- =====================
CREATE OR REPLACE FUNCTION calculate_risk_score(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id         UUID;
  v_framework_id    TEXT;
  v_records         BIGINT;
  v_gb              NUMERIC;
  v_has_health      BOOLEAN;
  v_has_financial   BOOLEAN;
  v_has_pii         BOOLEAN;
  v_sensitivity     INT;
  v_vendors         INT;
  v_access_level    INT;
  v_share_pct       NUMERIC;
  v_volume_risk     NUMERIC;
  v_sensitivity_risk NUMERIC;
  v_third_party_risk NUMERIC;
  v_gap_risk        NUMERIC;
  v_gap_pct         NUMERIC;
  v_failed          INT;
  v_total           INT;
  v_risk_band       TEXT;
BEGIN
  SELECT s.user_id, s.framework_id
  INTO   v_user_id, v_framework_id
  FROM   assessment_sessions s
  WHERE  s.id = p_session_id;

  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(o.patient_records_count, 0),
    COALESCE(o.data_storage_gb, 0),
    COALESCE(o.has_health_data, false),
    COALESCE(o.has_financial_data, false),
    COALESCE(o.has_pii_data, false),
    COALESCE(o.data_sensitivity_level, 3),
    COALESCE(o.vendor_count, 0),
    COALESCE(o.max_vendor_access_level, 1),
    COALESCE(o.vendor_data_share_pct, 0)
  INTO v_records, v_gb, v_has_health, v_has_financial, v_has_pii,
       v_sensitivity, v_vendors, v_access_level, v_share_pct
  FROM organizations o WHERE o.user_id = v_user_id;

  -- Component 1: Data Volume → exposure_score
  v_volume_risk := LEAST(25, (v_records::NUMERIC / 10000.0) + (v_gb / 100.0));

  -- Component 2: Data Sensitivity → impact_score
  v_sensitivity_risk := (v_sensitivity * 3)
    + CASE WHEN v_has_health     THEN 8 ELSE 0 END
    + CASE WHEN v_has_financial  THEN 5 ELSE 0 END
    + CASE WHEN v_has_pii        THEN 4 ELSE 0 END;
  v_sensitivity_risk := LEAST(25, v_sensitivity_risk);

  -- Component 3: Third-Party → control_score
  v_third_party_risk := LEAST(25, (v_vendors * 2.0) + (v_access_level * 3.0) + (v_share_pct / 4.0));

  -- Component 4: Compliance Gap → likelihood_score
  SELECT
    COUNT(*) FILTER (WHERE r.response IN ('no', 'partial')),
    COUNT(*) FILTER (WHERE r.response != 'na')
  INTO v_failed, v_total
  FROM questionnaire_responses r WHERE r.session_id = p_session_id;

  v_gap_pct  := CASE WHEN v_total > 0 THEN (v_failed::NUMERIC / v_total) * 100 ELSE 50 END;
  v_gap_risk := (v_gap_pct / 100.0) * 25;

  -- Risk band
  v_risk_band := CASE
    WHEN (v_volume_risk + v_sensitivity_risk + v_third_party_risk + v_gap_risk) >= 75 THEN 'critical'
    WHEN (v_volume_risk + v_sensitivity_risk + v_third_party_risk + v_gap_risk) >= 50 THEN 'high'
    WHEN (v_volume_risk + v_sensitivity_risk + v_third_party_risk + v_gap_risk) >= 25 THEN 'medium'
    ELSE 'low'
  END;

  INSERT INTO risk_scores (
    session_id, framework_id,
    likelihood_score, impact_score, control_score, exposure_score,
    risk_band
  ) VALUES (
    p_session_id, v_framework_id,
    ROUND(v_gap_risk, 2), ROUND(v_sensitivity_risk, 2),
    ROUND(v_third_party_risk, 2), ROUND(v_volume_risk, 2),
    v_risk_band
  )
  ON CONFLICT (session_id, framework_id) DO UPDATE SET
    likelihood_score = EXCLUDED.likelihood_score,
    impact_score     = EXCLUDED.impact_score,
    control_score    = EXCLUDED.control_score,
    exposure_score   = EXCLUDED.exposure_score,
    risk_band        = EXCLUDED.risk_band,
    calculated_at    = NOW();

  -- Maturity scores per domain
  INSERT INTO maturity_scores (session_id, framework_id, domain, raw_score, maturity_level, label)
  SELECT
    p_session_id,
    v_framework_id,
    COALESCE(vq.domain, 'General'),
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE qr.response = 'yes')
      / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0)
    , 2),
    CASE
      WHEN COUNT(*) FILTER (WHERE qr.response != 'na') = 0 THEN 1
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.9 THEN 5
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.75 THEN 4
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.5 THEN 3
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.25 THEN 2
      ELSE 1
    END,
    CASE
      WHEN COUNT(*) FILTER (WHERE qr.response != 'na') = 0 THEN 'Initial'
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.9 THEN 'Optimized'
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.75 THEN 'Managed'
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.5 THEN 'Defined'
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.25 THEN 'Developing'
      ELSE 'Initial'
    END
  FROM v_session_questions vq
  LEFT JOIN questionnaire_responses qr
    ON  qr.session_id  = p_session_id
    AND qr.question_id = vq.question_id
    AND qr.framework_id = vq.framework_id
  WHERE vq.session_id = p_session_id
  GROUP BY COALESCE(vq.domain, 'General')
  ON CONFLICT ON CONSTRAINT uq_maturity_session_fw_domain DO UPDATE SET
    raw_score     = EXCLUDED.raw_score,
    maturity_level = EXCLUDED.maturity_level,
    label         = EXCLUDED.label,
    calculated_at = NOW();

END; $$;

-- NOTE: The updated calculate_risk_score() with EWNAF integration is at the bottom of this file (ADDENDUM 2).

-- =====================
-- FINANCIAL IMPACT FUNCTION
-- Breach cost (IBM 2024 rates) + regulatory fines based on compliance gap
-- =====================
CREATE OR REPLACE FUNCTION calculate_financial_impact(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id       UUID;
  v_framework_id  TEXT;
  v_records       BIGINT;
  v_has_health    BOOLEAN;
  v_has_financial BOOLEAN;
  v_share_pct     NUMERIC;
  v_failed        INT;
  v_total         INT;
  v_gap_pct       NUMERIC;
  v_records_at_risk NUMERIC;
  v_per_record    NUMERIC;
  v_breach_cost   NUMERIC;
  v_fine_min      NUMERIC;
  v_fine_max      NUMERIC;
BEGIN
  SELECT s.user_id, s.framework_id
  INTO   v_user_id, v_framework_id
  FROM   assessment_sessions s WHERE s.id = p_session_id;

  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(o.patient_records_count, 0),
    COALESCE(o.has_health_data, false),
    COALESCE(o.has_financial_data, false),
    COALESCE(o.vendor_data_share_pct, 0)
  INTO v_records, v_has_health, v_has_financial, v_share_pct
  FROM organizations o WHERE o.user_id = v_user_id;

  SELECT
    COUNT(*) FILTER (WHERE r.response IN ('no', 'partial')),
    COUNT(*) FILTER (WHERE r.response != 'na')
  INTO v_failed, v_total
  FROM questionnaire_responses r WHERE r.session_id = p_session_id;

  v_gap_pct := CASE WHEN v_total > 0 THEN (v_failed::NUMERIC / v_total) * 100 ELSE 50 END;

  -- Records exposed = total × vendor share %
  v_records_at_risk := v_records * (v_share_pct / 100.0);

  -- Per-record breach cost (IBM 2024)
  v_per_record := CASE
    WHEN v_has_health     THEN 10.93
    WHEN v_has_financial  THEN 5.85
    ELSE 4.35
  END;

  v_breach_cost := v_records_at_risk * v_per_record;

  -- Regulatory fines by framework + gap severity
  IF v_framework_id = 'pipeda' THEN
    v_fine_min := CASE WHEN v_gap_pct > 50 THEN 100000 WHEN v_gap_pct > 25 THEN 25000 ELSE 0 END;
    v_fine_max := v_fine_min;
  ELSIF v_framework_id = 'hipaa' THEN
    v_fine_min := CASE WHEN v_gap_pct > 50 THEN 1500000 WHEN v_gap_pct > 25 THEN 250000 ELSE 100 END;
    v_fine_max := v_fine_min;
  ELSE
    v_fine_min := 0; v_fine_max := 0;
  END IF;

  INSERT INTO financial_impact (
    session_id, estimated_breach_cost,
    regulatory_fines_min, regulatory_fines_max,
    total_exposure_min, total_exposure_max
  ) VALUES (
    p_session_id,
    ROUND(v_breach_cost, 2),
    v_fine_min, v_fine_max,
    ROUND(v_breach_cost + v_fine_min, 2),
    ROUND(v_breach_cost + v_fine_max, 2)
  )
  ON CONFLICT (session_id) DO UPDATE SET
    estimated_breach_cost  = EXCLUDED.estimated_breach_cost,
    regulatory_fines_min   = EXCLUDED.regulatory_fines_min,
    regulatory_fines_max   = EXCLUDED.regulatory_fines_max,
    total_exposure_min     = EXCLUDED.total_exposure_min,
    total_exposure_max     = EXCLUDED.total_exposure_max,
    calculated_at          = NOW();
END; $$;

-- =====================
-- ADDENDUM 2: org_ip + EWNAF scan integration
-- Run this block in Supabase SQL Editor
-- =====================

-- Network IP captured at registration — used by the EWNAF scanner
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_ip TEXT;

-- Updated calculate_risk_score: Component 4 now blends questionnaire gap (60%)
-- with EWNAF technical gap (40%) when a scan result is available.
CREATE OR REPLACE FUNCTION calculate_risk_score(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id          UUID;
  v_framework_id     TEXT;
  v_org_uid          BIGINT;
  v_records          BIGINT;
  v_gb               NUMERIC;
  v_has_health       BOOLEAN;
  v_has_financial    BOOLEAN;
  v_has_pii          BOOLEAN;
  v_sensitivity      INT;
  v_vendors          INT;
  v_access_level     INT;
  v_share_pct        NUMERIC;
  v_volume_risk      NUMERIC;
  v_sensitivity_risk NUMERIC;
  v_third_party_risk NUMERIC;
  v_gap_risk         NUMERIC;
  v_gap_pct          NUMERIC;
  v_failed           INT;
  v_total            INT;
  v_ewnaf_overall    NUMERIC;
  v_ewnaf_high_risk  NUMERIC;
  v_ewnaf_defense    NUMERIC;
  v_gap_pct_combined NUMERIC;
  v_risk_band        TEXT;
BEGIN
  SELECT s.user_id, s.framework_id
  INTO   v_user_id, v_framework_id
  FROM   assessment_sessions s
  WHERE  s.id = p_session_id;

  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(o.patient_records_count, 0),
    COALESCE(o.data_storage_gb, 0),
    COALESCE(o.has_health_data, false),
    COALESCE(o.has_financial_data, false),
    COALESCE(o.has_pii_data, false),
    COALESCE(o.data_sensitivity_level, 3),
    COALESCE(o.vendor_count, 0),
    COALESCE(o.max_vendor_access_level, 1),
    COALESCE(o.vendor_data_share_pct, 0),
    o.org_uid
  INTO v_records, v_gb, v_has_health, v_has_financial, v_has_pii,
       v_sensitivity, v_vendors, v_access_level, v_share_pct, v_org_uid
  FROM organizations o WHERE o.user_id = v_user_id;

  -- Component 1: Data Volume → exposure_score
  v_volume_risk := LEAST(25, (v_records::NUMERIC / 10000.0) + (v_gb / 100.0));

  -- Component 2: Data Sensitivity → impact_score
  v_sensitivity_risk := (v_sensitivity * 3)
    + CASE WHEN v_has_health     THEN 8 ELSE 0 END
    + CASE WHEN v_has_financial  THEN 5 ELSE 0 END
    + CASE WHEN v_has_pii        THEN 4 ELSE 0 END;
  v_sensitivity_risk := LEAST(25, v_sensitivity_risk);

  -- Component 3: Third-Party → control_score
  v_third_party_risk := LEAST(25, (v_vendors * 2.0) + (v_access_level * 3.0) + (v_share_pct / 4.0));

  -- Component 4: Compliance Gap → likelihood_score
  SELECT
    COUNT(*) FILTER (WHERE r.response IN ('no', 'partial')),
    COUNT(*) FILTER (WHERE r.response != 'na')
  INTO v_failed, v_total
  FROM questionnaire_responses r WHERE r.session_id = p_session_id;

  v_gap_pct := CASE WHEN v_total > 0 THEN (v_failed::NUMERIC / v_total) * 100 ELSE 50 END;

  -- Pull the latest EWNAF scan result for this org (real shape: score.overall, score.high_risk_count)
  SELECT
    (r.results->'score'->>'overall')::NUMERIC,
    (r.results->'score'->>'high_risk_count')::NUMERIC
  INTO   v_ewnaf_overall, v_ewnaf_high_risk
  FROM   fact_software_results r
  WHERE  r.org_uid = v_org_uid
  ORDER  BY r.created_at DESC
  LIMIT  1;

  -- Derive a 0-100 defense score: starts at 100, reduced by overall risk and high-risk findings
  IF v_ewnaf_overall IS NOT NULL THEN
    v_ewnaf_defense := GREATEST(0, LEAST(100,
      100 - (v_ewnaf_overall * 2) - (COALESCE(v_ewnaf_high_risk, 0) * 15)
    ));
  ELSE
    v_ewnaf_defense := NULL;
  END IF;

  -- Blend: 60% questionnaire gap + 40% EWNAF technical gap (if scan available)
  IF v_ewnaf_defense IS NOT NULL THEN
    v_gap_pct_combined := 0.6 * v_gap_pct + 0.4 * (100.0 - v_ewnaf_defense);
  ELSE
    v_gap_pct_combined := v_gap_pct;
  END IF;

  v_gap_risk := (v_gap_pct_combined / 100.0) * 25;

  -- Risk band (from concept manual: 80+ Critical, 60-80 High, 40-60 Medium, <40 Low)
  v_risk_band := CASE
    WHEN (v_volume_risk + v_sensitivity_risk + v_third_party_risk + v_gap_risk) >= 80 THEN 'critical'
    WHEN (v_volume_risk + v_sensitivity_risk + v_third_party_risk + v_gap_risk) >= 60 THEN 'high'
    WHEN (v_volume_risk + v_sensitivity_risk + v_third_party_risk + v_gap_risk) >= 40 THEN 'medium'
    ELSE 'low'
  END;

  INSERT INTO risk_scores (
    session_id, framework_id,
    likelihood_score, impact_score, control_score, exposure_score,
    risk_band
  ) VALUES (
    p_session_id, v_framework_id,
    ROUND(v_gap_risk, 2), ROUND(v_sensitivity_risk, 2),
    ROUND(v_third_party_risk, 2), ROUND(v_volume_risk, 2),
    v_risk_band
  )
  ON CONFLICT (session_id, framework_id) DO UPDATE SET
    likelihood_score = EXCLUDED.likelihood_score,
    impact_score     = EXCLUDED.impact_score,
    control_score    = EXCLUDED.control_score,
    exposure_score   = EXCLUDED.exposure_score,
    risk_band        = EXCLUDED.risk_band,
    calculated_at    = NOW();

  -- Maturity scores per domain (unchanged from v1)
  INSERT INTO maturity_scores (session_id, framework_id, domain, raw_score, maturity_level, label)
  SELECT
    p_session_id,
    v_framework_id,
    COALESCE(vq.domain, 'General'),
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE qr.response = 'yes')
      / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0)
    , 2),
    CASE
      WHEN COUNT(*) FILTER (WHERE qr.response != 'na') = 0 THEN 1
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.9 THEN 5
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.75 THEN 4
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.5 THEN 3
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.25 THEN 2
      ELSE 1
    END,
    CASE
      WHEN COUNT(*) FILTER (WHERE qr.response != 'na') = 0 THEN 'Initial'
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.9 THEN 'Optimized'
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.75 THEN 'Managed'
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.5 THEN 'Defined'
      WHEN (COUNT(*) FILTER (WHERE qr.response = 'yes'))::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0) >= 0.25 THEN 'Developing'
      ELSE 'Initial'
    END
  FROM v_session_questions vq
  LEFT JOIN questionnaire_responses qr
    ON  qr.session_id   = p_session_id
    AND qr.question_id  = vq.question_id
    AND qr.framework_id = vq.framework_id
  WHERE vq.session_id = p_session_id
  GROUP BY COALESCE(vq.domain, 'General')
  ON CONFLICT ON CONSTRAINT uq_maturity_session_fw_domain DO UPDATE SET
    raw_score      = EXCLUDED.raw_score,
    maturity_level = EXCLUDED.maturity_level,
    label          = EXCLUDED.label,
    calculated_at  = NOW();

END; $$;

-- =====================
-- ADDENDUM 3: Evidence Files — file upload registry
-- Run this block in the Supabase SQL Editor
-- =====================
CREATE TABLE IF NOT EXISTS evidence_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES assessment_sessions(id) ON DELETE SET NULL,
  original_name TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  file_size     BIGINT,
  content_type  TEXT,
  category      TEXT DEFAULT 'General',
  control_ref   TEXT,
  notes         TEXT,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE evidence_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own evidence_files" ON evidence_files
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_evidence_files_user ON evidence_files(user_id);

-- =====================
-- ADDENDUM 4: priority_rank — correct severity ordering on remediation_roadmap
-- Text sort puts 'low' above 'medium' alphabetically; this generated column fixes it.
-- Run this block in the Supabase SQL Editor.
-- =====================
ALTER TABLE remediation_roadmap
  ADD COLUMN IF NOT EXISTS priority_rank INT GENERATED ALWAYS AS (
    CASE priority
      WHEN 'critical' THEN 0
      WHEN 'high'     THEN 1
      WHEN 'medium'   THEN 2
      WHEN 'low'      THEN 3
      ELSE 4
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_roadmap_priority_rank
  ON remediation_roadmap(priority_rank);
