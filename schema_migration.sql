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

-- =====================
-- ADDENDUM 5: org_invitations — team member invite flow (admin / viewer roles)
-- Run this block in the Supabase SQL Editor.
-- =====================
CREATE TABLE IF NOT EXISTS org_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by    UUID NOT NULL REFERENCES auth.users(id),
  invited_at    TIMESTAMPTZ DEFAULT now(),
  accepted_by   UUID REFERENCES auth.users(id),
  accepted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_email  ON org_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitations_org    ON org_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON org_invitations(status);

-- RLS
ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;

-- Org owner can manage all invitations for their org
CREATE POLICY "org owner manages invitations"
  ON org_invitations FOR ALL
  TO authenticated
  USING (
    org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

-- Invited user can read (and accept) their own invitation
CREATE POLICY "invited user reads own invitation"
  ON org_invitations FOR SELECT
  TO authenticated
  USING (invited_email = auth.email());

CREATE POLICY "invited user accepts own invitation"
  ON org_invitations FOR UPDATE
  TO authenticated
  USING  (invited_email = auth.email() AND status = 'pending')
  WITH CHECK (status = 'accepted' AND accepted_by = auth.uid());

-- =====================
-- ADDENDUM 6: alert_states — persisted read/dismissed status for generated alerts
-- Alerts on the Alerts page are computed on the fly from risk/compliance/roadmap
-- data (no underlying row per alert). This table tracks per-user read/dismissed
-- state keyed by the deterministic alert id (e.g. "risk-critical", "task-<uuid>")
-- so "Mark read" / "Dismiss" persist across reloads and the sidebar badge count
-- stays in sync with the Alerts page.
-- Run this block in the Supabase SQL Editor.
-- =====================
CREATE TABLE IF NOT EXISTS alert_states (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id     TEXT NOT NULL,
  read_at      TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  UNIQUE (user_id, alert_id)
);

ALTER TABLE alert_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own alert_states" ON alert_states
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_alert_states_user ON alert_states(user_id);

-- =====================
-- ADDENDUM 7: link remediation_roadmap tasks to their source questionnaire question
-- Lets resolving an Action Plan task flip the underlying questionnaire answer to
-- 'yes' (and reopening it revert that answer), so the risk score actually moves
-- when remediation work is completed instead of staying frozen at assessment time.
-- Run this block in the Supabase SQL Editor.
-- =====================
ALTER TABLE remediation_roadmap
  ADD COLUMN IF NOT EXISTS question_id INT;

-- NULLs don't conflict with each other under a UNIQUE constraint, so existing
-- (unlinked) rows are unaffected — only new question-linked rows are deduped.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_roadmap_session_question'
  ) THEN
    ALTER TABLE remediation_roadmap
      ADD CONSTRAINT uq_roadmap_session_question UNIQUE (session_id, question_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_roadmap_question ON remediation_roadmap(question_id);

-- =====================
-- ADDENDUM 8: beta_codes + invite_beta_user() — invite-only registration gate
-- Run `SELECT invite_beta_user('person@company.com');` in the SQL editor to
-- invite someone: generates a single-use code tied to their email, stores it,
-- and fires a webhook (via pg_net) to /api/beta-invite which emails them a
-- "Register Here" link with the code pre-filled.
--
-- Requires the pg_net extension: Database -> Extensions -> enable "pg_net".
-- Run this block in the Supabase SQL Editor.
-- =====================
CREATE TABLE IF NOT EXISTS beta_codes (
  code       TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE beta_codes ENABLE ROW LEVEL SECURITY;
-- No public policies — only the service-role (admin client) and this function
-- ever touch this table.

CREATE OR REPLACE FUNCTION invite_beta_user(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
BEGIN
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO beta_codes (code, email) VALUES (v_code, lower(trim(p_email)));

  PERFORM net.http_post(
    url     := 'https://app.dimarisk.com/api/beta-invite',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-beta-invite-secret', 'c79a09894c7891963a1cd9aa87aa1751d5f0f43409ede85c'
    ),
    body    := jsonb_build_object('email', lower(trim(p_email)), 'code', v_code)
  );

  RETURN v_code;
END;
$$;

-- =====================
-- ADDENDUM 9: ROI inputs + outputs for the Executive Summary ROI card
-- ROI is derived from the same session's risk score + financial_impact figures,
-- not a separate calculator — see calculate_financial_impact() below.
-- Run this block in the Supabase SQL Editor.
-- =====================
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS business_size  TEXT CHECK (business_size IN ('micro','small','medium','large','enterprise')),
  ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS employee_count INT;

ALTER TABLE financial_impact
  ADD COLUMN IF NOT EXISTS investment_total     NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS investment_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS benefits_total_3yr    NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS benefits_breakdown    JSONB,
  ADD COLUMN IF NOT EXISTS net_benefit_3yr       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS roi_pct               NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS payback_months        NUMERIC(8,1);

-- Updated calculate_financial_impact: adds 3-year ROI projection (investment cost,
-- quantified benefits, net benefit, ROI%, payback period) on top of the existing
-- breach-cost + regulatory-fine calculation. Formulas per the ROI concept doc:
--   Investment = Tech&Infra($35K-$750K by risk score) + Professional Services
--     ($20K-$500K by risk score) + Training($250/employee) + Maintenance
--     (~15%/yr of Tech+Services, 3yr — no explicit range given for this line item)
--   all scaled by business-size multiplier (Enterprise 2.5x / Large 1.8x /
--   Medium 1.3x / Small 1.0x / Micro 0.7x).
--   Benefits (3yr) = 75% breach-cost avoidance + 85% regulatory-fine avoidance +
--     (1.5%+1%+0.5%)*3 of annual revenue (continuity+reputation+efficiency) +
--     cyber-insurance discount (up to $75K, scaled by size) + compliance-cost
--     avoidance ($75K-$150K by risk score).
-- Skips ROI fields (leaves NULL) when annual_revenue hasn't been set yet, so
-- orgs that onboarded before this shipped don't error.
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
  v_risk_score    NUMERIC;
  v_business_size TEXT;
  v_revenue       NUMERIC;
  v_employees     INT;
  v_size_mult     NUMERIC;
  v_tech_infra    NUMERIC;
  v_prof_services NUMERIC;
  v_training      NUMERIC;
  v_maintenance   NUMERIC;
  v_investment    NUMERIC;
  v_breach_avoid  NUMERIC;
  v_fine_avoid    NUMERIC;
  v_continuity    NUMERIC;
  v_reputation    NUMERIC;
  v_efficiency    NUMERIC;
  v_insurance     NUMERIC;
  v_compliance    NUMERIC;
  v_benefits      NUMERIC;
  v_net_benefit   NUMERIC;
  v_roi_pct       NUMERIC;
  v_payback       NUMERIC;
  v_investment_breakdown JSONB;
  v_benefits_breakdown   JSONB;
BEGIN
  SELECT s.user_id, s.framework_id
  INTO   v_user_id, v_framework_id
  FROM   assessment_sessions s WHERE s.id = p_session_id;

  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(o.patient_records_count, 0),
    COALESCE(o.has_health_data, false),
    COALESCE(o.has_financial_data, false),
    COALESCE(o.vendor_data_share_pct, 0),
    o.business_size, o.annual_revenue, o.employee_count
  INTO v_records, v_has_health, v_has_financial, v_share_pct,
       v_business_size, v_revenue, v_employees
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

  -- ROI projection — only when the org has filled in its business profile
  IF v_revenue IS NOT NULL THEN
    SELECT COALESCE(rs.total_score, 0) INTO v_risk_score
    FROM risk_scores rs WHERE rs.session_id = p_session_id;

    v_size_mult := CASE v_business_size
      WHEN 'enterprise' THEN 2.5
      WHEN 'large'       THEN 1.8
      WHEN 'medium'       THEN 1.3
      WHEN 'small'       THEN 1.0
      WHEN 'micro'       THEN 0.7
      ELSE 1.0
    END;

    v_tech_infra    := (35000 + 715000 * (v_risk_score / 100.0)) * v_size_mult;
    v_prof_services := (20000 + 480000 * (v_risk_score / 100.0)) * v_size_mult;
    v_training      := 250 * COALESCE(v_employees, 0);
    v_maintenance   := 0.15 * (v_tech_infra + v_prof_services) * 3;
    v_investment    := v_tech_infra + v_prof_services + v_training + v_maintenance;

    v_breach_avoid := v_breach_cost * 0.75;
    v_fine_avoid   := v_fine_max * 0.85;
    v_continuity   := v_revenue * 0.015 * 3;
    v_reputation   := v_revenue * 0.01 * 3;
    v_efficiency   := v_revenue * 0.005 * 3;
    v_insurance    := 75000 * (v_size_mult / 2.5);
    v_compliance   := 75000 + 75000 * (v_risk_score / 100.0);
    v_benefits     := v_breach_avoid + v_fine_avoid + v_continuity + v_reputation
                       + v_efficiency + v_insurance + v_compliance;

    v_net_benefit := v_benefits - v_investment;
    v_roi_pct     := CASE WHEN v_investment > 0 THEN (v_net_benefit / v_investment) * 100 ELSE NULL END;
    v_payback     := CASE WHEN v_benefits > 0 THEN v_investment / (v_benefits / 36.0) ELSE NULL END;

    v_investment_breakdown := jsonb_build_object(
      'technology_infrastructure', ROUND(v_tech_infra, 2),
      'professional_services',     ROUND(v_prof_services, 2),
      'security_training',         ROUND(v_training, 2),
      'maintenance_operations',    ROUND(v_maintenance, 2)
    );
    v_benefits_breakdown := jsonb_build_object(
      'breach_cost_avoidance',     ROUND(v_breach_avoid, 2),
      'regulatory_fine_avoidance', ROUND(v_fine_avoid, 2),
      'business_continuity',       ROUND(v_continuity, 2),
      'reputation_protection',     ROUND(v_reputation, 2),
      'operational_efficiency',    ROUND(v_efficiency, 2),
      'cyber_insurance_discount',  ROUND(v_insurance, 2),
      'compliance_cost_avoidance', ROUND(v_compliance, 2)
    );
  ELSE
    v_investment := NULL; v_benefits := NULL; v_net_benefit := NULL;
    v_roi_pct := NULL; v_payback := NULL;
    v_investment_breakdown := NULL; v_benefits_breakdown := NULL;
  END IF;

  INSERT INTO financial_impact (
    session_id, estimated_breach_cost,
    regulatory_fines_min, regulatory_fines_max,
    total_exposure_min, total_exposure_max,
    investment_total, investment_breakdown,
    benefits_total_3yr, benefits_breakdown,
    net_benefit_3yr, roi_pct, payback_months
  ) VALUES (
    p_session_id,
    ROUND(v_breach_cost, 2),
    v_fine_min, v_fine_max,
    ROUND(v_breach_cost + v_fine_min, 2),
    ROUND(v_breach_cost + v_fine_max, 2),
    ROUND(v_investment, 2), v_investment_breakdown,
    ROUND(v_benefits, 2), v_benefits_breakdown,
    ROUND(v_net_benefit, 2), ROUND(v_roi_pct, 2), ROUND(v_payback, 1)
  )
  ON CONFLICT (session_id) DO UPDATE SET
    estimated_breach_cost  = EXCLUDED.estimated_breach_cost,
    regulatory_fines_min   = EXCLUDED.regulatory_fines_min,
    regulatory_fines_max   = EXCLUDED.regulatory_fines_max,
    total_exposure_min     = EXCLUDED.total_exposure_min,
    total_exposure_max     = EXCLUDED.total_exposure_max,
    investment_total       = EXCLUDED.investment_total,
    investment_breakdown   = EXCLUDED.investment_breakdown,
    benefits_total_3yr     = EXCLUDED.benefits_total_3yr,
    benefits_breakdown     = EXCLUDED.benefits_breakdown,
    net_benefit_3yr        = EXCLUDED.net_benefit_3yr,
    roi_pct                = EXCLUDED.roi_pct,
    payback_months         = EXCLUDED.payback_months,
    calculated_at          = NOW();
END; $$;

-- =====================
-- ADDENDUM 10: risk_register_entries — manually-curated enterprise risk register
-- Replaces the old "Risk Register" page, which was just a relabeled view of
-- remediation_roadmap tasks. Each entry is one risk: probability band, financial
-- impact (direct/regulatory/recovery), framework tags, division/owner, and
-- treatment status. Register totals, the "outside appetite" count, and
-- per-entry treatment ROI are all derived from these same fields in the app
-- layer — not separate calculators.
-- Run this block in the Supabase SQL Editor.
-- =====================
CREATE TABLE IF NOT EXISTS risk_register_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  category                TEXT NOT NULL CHECK (category IN ('operational','financial','strategic','compliance','technology','reputational')),
  probability_band        TEXT NOT NULL CHECK (probability_band IN ('low','medium','high','critical')),
  impact_direct           NUMERIC(14,2) NOT NULL DEFAULT 0,
  impact_regulatory       NUMERIC(14,2) NOT NULL DEFAULT 0,
  impact_recovery         NUMERIC(14,2) NOT NULL DEFAULT 0,
  framework_tags          TEXT[] NOT NULL DEFAULT '{}',
  division                TEXT,
  owner                   TEXT,
  treatment_status        TEXT NOT NULL DEFAULT 'untreated' CHECK (treatment_status IN ('untreated','in_progress','done')),
  probability_after_band  TEXT CHECK (probability_after_band IN ('low','medium','high','critical')),
  treatment_cost          NUMERIC(14,2),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE risk_register_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own risk_register_entries" ON risk_register_entries
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_risk_register_user ON risk_register_entries(user_id);

-- =====================
-- ADDENDUM 11: critical_controls — per-framework checklist for the
-- 4-framework Compliance Gap Risk formula (ISO 27001 + HIPAA + PIPEDA + GDPR).
-- Each org marks which of the 4-5 critical controls per framework are present.
-- Gap % = (missing controls) ÷ (total controls) × 100.
-- This feeds (ISO + HIPAA + PIPEDA + GDPR) ÷ 4 in calculate_risk_score().
-- Run this block in the Supabase SQL Editor.
-- =====================
CREATE TABLE IF NOT EXISTS critical_controls (
  id           SERIAL PRIMARY KEY,
  framework_id TEXT NOT NULL,
  control_ref  TEXT NOT NULL,
  control_name TEXT NOT NULL,
  UNIQUE (framework_id, control_ref)
);

INSERT INTO critical_controls (framework_id, control_ref, control_name) VALUES
  ('iso27001', 'A.8.2',    'Information Classification'),
  ('iso27001', 'A.9.1',    'Access Control Policy'),
  ('iso27001', 'A.10.1',   'Cryptographic Controls'),
  ('iso27001', 'A.13.2',   'Information Transfer'),
  ('iso27001', 'A.15.1',   'Supplier Relationships'),
  ('gdpr',     'Art.32',   'Security of Processing'),
  ('gdpr',     'Art.28',   'Processor Agreements'),
  ('gdpr',     'Art.44',   'International Transfers'),
  ('gdpr',     'Art.25',   'Data Protection by Design'),
  ('gdpr',     'Art.33',   'Breach Notification'),
  ('hipaa',    '§164.308', 'Administrative Safeguards'),
  ('hipaa',    '§164.310', 'Physical Safeguards'),
  ('hipaa',    '§164.312', 'Technical Safeguards'),
  ('hipaa',    '§164.314', 'Organizational Requirements'),
  ('hipaa',    'BAA',      'Business Associate Agreements'),
  ('pipeda',   'P7',       'Principle 7 Safeguards'),
  ('pipeda',   'P3',       'Principle 3 Consent'),
  ('pipeda',   'P4',       'Principle 4 Limiting Collection'),
  ('pipeda',   'BN',       'Breach Notification')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS critical_control_responses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  control_id INT  NOT NULL REFERENCES critical_controls(id),
  present    BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, control_id)
);

ALTER TABLE critical_control_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own critical_control_responses" ON critical_control_responses
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ccr_user ON critical_control_responses(user_id);

-- Updated calculate_risk_score: Component 4 (Compliance Gap) now averages
-- gap % across three frameworks:
--   1. Assigned framework (PIPEDA or HIPAA) — from questionnaire_responses
--   2. ISO 27001 — from critical_control_responses (5 controls)
--   3. GDPR    — from critical_control_responses (5 controls)
-- Controls without a response row default to "missing" (worst-case gap),
-- so new orgs start at 100% gap and improve as they fill in controls.
-- EWNAF blend (60%/40%) from ADDENDUM 2 still applies to the averaged gap.
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
  v_failed           INT;
  v_total            INT;
  v_gap_pct          NUMERIC;   -- assigned-framework questionnaire gap
  v_iso_gap          NUMERIC;   -- ISO 27001 critical controls gap
  v_gdpr_gap         NUMERIC;   -- GDPR critical controls gap
  v_gap_avg          NUMERIC;   -- averaged gap across 3 frameworks
  v_ewnaf_overall    NUMERIC;
  v_ewnaf_high_risk  NUMERIC;
  v_ewnaf_defense    NUMERIC;
  v_gap_combined     NUMERIC;
  v_risk_band        TEXT;
BEGIN
  SELECT s.user_id, s.framework_id
  INTO   v_user_id, v_framework_id
  FROM   assessment_sessions s WHERE s.id = p_session_id;

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

  -- Component 1: Data Volume
  v_volume_risk := LEAST(25, (v_records::NUMERIC / 10000.0) + (v_gb / 100.0));

  -- Component 2: Data Sensitivity
  v_sensitivity_risk := (v_sensitivity * 3)
    + CASE WHEN v_has_health    THEN 8 ELSE 0 END
    + CASE WHEN v_has_financial THEN 5 ELSE 0 END
    + CASE WHEN v_has_pii      THEN 4 ELSE 0 END;
  v_sensitivity_risk := LEAST(25, v_sensitivity_risk);

  -- Component 3: Third-Party
  v_third_party_risk := LEAST(25, (v_vendors * 2.0) + (v_access_level * 3.0) + (v_share_pct / 4.0));

  -- Component 4: Compliance Gap — multi-framework average
  -- 4a. Assigned framework gap from questionnaire
  SELECT
    COUNT(*) FILTER (WHERE r.response IN ('no', 'partial')),
    COUNT(*) FILTER (WHERE r.response != 'na')
  INTO v_failed, v_total
  FROM questionnaire_responses r WHERE r.session_id = p_session_id;

  v_gap_pct := CASE WHEN v_total > 0 THEN (v_failed::NUMERIC / v_total) * 100 ELSE 50 END;

  -- 4b. ISO 27001 critical controls gap (defaults to 100% if no responses exist)
  SELECT
    (COUNT(*) FILTER (WHERE NOT COALESCE(r.present, false)))::NUMERIC
    / NULLIF(COUNT(*), 0) * 100
  INTO v_iso_gap
  FROM critical_controls c
  LEFT JOIN critical_control_responses r
    ON r.control_id = c.id AND r.user_id = v_user_id
  WHERE c.framework_id = 'iso27001';
  v_iso_gap := COALESCE(v_iso_gap, 100);

  -- 4c. GDPR critical controls gap (defaults to 100% if no responses exist)
  SELECT
    (COUNT(*) FILTER (WHERE NOT COALESCE(r.present, false)))::NUMERIC
    / NULLIF(COUNT(*), 0) * 100
  INTO v_gdpr_gap
  FROM critical_controls c
  LEFT JOIN critical_control_responses r
    ON r.control_id = c.id AND r.user_id = v_user_id
  WHERE c.framework_id = 'gdpr';
  v_gdpr_gap := COALESCE(v_gdpr_gap, 100);

  -- 4d. Average across the three frameworks
  v_gap_avg := (v_gap_pct + v_iso_gap + v_gdpr_gap) / 3.0;

  -- 4e. EWNAF technical blend (60%/40% from ADDENDUM 2)
  SELECT
    (r.results->'score'->>'overall')::NUMERIC,
    (r.results->'score'->>'high_risk_count')::NUMERIC
  INTO v_ewnaf_overall, v_ewnaf_high_risk
  FROM fact_software_results r
  WHERE r.org_uid = v_org_uid
  ORDER BY r.created_at DESC LIMIT 1;

  IF v_ewnaf_overall IS NOT NULL THEN
    v_ewnaf_defense := GREATEST(0, LEAST(100,
      100 - (v_ewnaf_overall * 2) - (COALESCE(v_ewnaf_high_risk, 0) * 15)
    ));
    v_gap_combined := 0.6 * v_gap_avg + 0.4 * (100.0 - v_ewnaf_defense);
  ELSE
    v_gap_combined := v_gap_avg;
  END IF;

  v_gap_risk := (v_gap_combined / 100.0) * 25;

  v_risk_band := CASE
    WHEN (v_volume_risk + v_sensitivity_risk + v_third_party_risk + v_gap_risk) >= 80 THEN 'critical'
    WHEN (v_volume_risk + v_sensitivity_risk + v_third_party_risk + v_gap_risk) >= 60 THEN 'high'
    WHEN (v_volume_risk + v_sensitivity_risk + v_third_party_risk + v_gap_risk) >= 40 THEN 'medium'
    ELSE 'low'
  END;

  INSERT INTO risk_scores (
    session_id, framework_id,
    likelihood_score, impact_score, control_score, exposure_score, risk_band
  ) VALUES (
    p_session_id, v_framework_id,
    ROUND(v_gap_risk, 2), ROUND(v_sensitivity_risk, 2),
    ROUND(v_third_party_risk, 2), ROUND(v_volume_risk, 2), v_risk_band
  )
  ON CONFLICT (session_id, framework_id) DO UPDATE SET
    likelihood_score = EXCLUDED.likelihood_score,
    impact_score     = EXCLUDED.impact_score,
    control_score    = EXCLUDED.control_score,
    exposure_score   = EXCLUDED.exposure_score,
    risk_band        = EXCLUDED.risk_band,
    calculated_at    = NOW();

  -- Maturity scores per domain (unchanged)
  INSERT INTO maturity_scores (session_id, framework_id, domain, raw_score, maturity_level, label)
  SELECT
    p_session_id, v_framework_id,
    COALESCE(vq.domain, 'General'),
    ROUND(100.0 * COUNT(*) FILTER (WHERE qr.response = 'yes')
      / NULLIF(COUNT(*) FILTER (WHERE qr.response != 'na'), 0), 2),
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
    ON qr.session_id  = p_session_id
    AND qr.question_id = vq.question_id
    AND qr.framework_id = vq.framework_id
  WHERE vq.session_id = p_session_id
  GROUP BY COALESCE(vq.domain, 'General')
  ON CONFLICT ON CONSTRAINT uq_maturity_session_fw_domain DO UPDATE SET
    raw_score      = EXCLUDED.raw_score,
    maturity_level = EXCLUDED.maturity_level,
    label          = EXCLUDED.label,
    calculated_at  = NOW();
END; $$;

-- Updated calculate_financial_impact: replaces the simplified gap%→flat-dollar
-- fine tiers with real regulatory enforcement data (2026):
--   PIPEDA (federal): C$100K criminal max via AG referral (no direct OPC fines)
--   Quebec Law 25: C$10M/2% revenue (standard) or C$25M/4% revenue (serious)
--   HIPAA: 4-tier culpability structure ($145–$2.19M annual cap per provision)
--   GDPR: 2-tier structure (€10M/2% or €20M/4% revenue), applied as additional
--         fine on top of the assigned-framework fine since GDPR applies globally.
-- The GDPR gap % is read from critical_control_responses (ADDENDUM 11 table).
CREATE OR REPLACE FUNCTION calculate_financial_impact(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id         UUID;
  v_framework_id    TEXT;
  v_records         BIGINT;
  v_has_health      BOOLEAN;
  v_has_financial   BOOLEAN;
  v_share_pct       NUMERIC;
  v_failed          INT;
  v_total           INT;
  v_gap_pct         NUMERIC;
  v_records_at_risk NUMERIC;
  v_per_record      NUMERIC;
  v_breach_cost     NUMERIC;
  v_fine_min        NUMERIC;
  v_fine_max        NUMERIC;
  v_gdpr_gap        NUMERIC;
  v_gdpr_fine       NUMERIC;
  v_revenue         NUMERIC;
  v_employees       INT;
  v_business_size   TEXT;
  v_risk_score      NUMERIC;
  v_size_mult       NUMERIC;
  v_tech_infra      NUMERIC;
  v_prof_services   NUMERIC;
  v_training        NUMERIC;
  v_maintenance     NUMERIC;
  v_investment      NUMERIC;
  v_breach_avoid    NUMERIC;
  v_fine_avoid      NUMERIC;
  v_continuity      NUMERIC;
  v_reputation      NUMERIC;
  v_efficiency      NUMERIC;
  v_insurance       NUMERIC;
  v_compliance      NUMERIC;
  v_benefits        NUMERIC;
  v_net_benefit     NUMERIC;
  v_roi_pct         NUMERIC;
  v_payback         NUMERIC;
  v_investment_breakdown JSONB;
  v_benefits_breakdown   JSONB;
BEGIN
  SELECT s.user_id, s.framework_id
  INTO   v_user_id, v_framework_id
  FROM   assessment_sessions s WHERE s.id = p_session_id;

  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(o.patient_records_count, 0),
    COALESCE(o.has_health_data, false),
    COALESCE(o.has_financial_data, false),
    COALESCE(o.vendor_data_share_pct, 0),
    o.annual_revenue,
    o.employee_count,
    o.business_size
  INTO v_records, v_has_health, v_has_financial, v_share_pct,
       v_revenue, v_employees, v_business_size
  FROM organizations o WHERE o.user_id = v_user_id;

  SELECT
    COUNT(*) FILTER (WHERE r.response IN ('no', 'partial')),
    COUNT(*) FILTER (WHERE r.response != 'na')
  INTO v_failed, v_total
  FROM questionnaire_responses r WHERE r.session_id = p_session_id;

  v_gap_pct := CASE WHEN v_total > 0 THEN (v_failed::NUMERIC / v_total) * 100 ELSE 50 END;

  v_records_at_risk := v_records * (v_share_pct / 100.0);

  v_per_record := CASE
    WHEN v_has_health    THEN 10.93
    WHEN v_has_financial THEN 5.85
    ELSE 4.35
  END;

  v_breach_cost := v_records_at_risk * v_per_record;

  -- Assigned-framework fines using real enforcement data
  IF v_framework_id = 'pipeda' THEN
    -- PIPEDA: C$100K criminal max (federal, referral only)
    -- Quebec Law 25 (applies broadly to Canadian orgs): revenue-based tiers
    v_fine_min := 100000;  -- PIPEDA criminal max (conservative floor)
    v_fine_max := CASE
      WHEN v_gap_pct > 50 THEN GREATEST(25000000, COALESCE(v_revenue, 0) * 0.04)  -- Law 25 serious
      WHEN v_gap_pct > 25 THEN GREATEST(10000000, COALESCE(v_revenue, 0) * 0.02)  -- Law 25 standard
      ELSE 100000
    END;

  ELSIF v_framework_id = 'hipaa' THEN
    -- HIPAA 4-tier culpability structure
    v_fine_min := CASE
      WHEN v_gap_pct > 75 THEN 73011   -- Tier 4: willful neglect
      WHEN v_gap_pct > 50 THEN 14602   -- Tier 3: willful neglect, corrected
      WHEN v_gap_pct > 25 THEN 1461    -- Tier 2: reasonable cause
      ELSE 145                          -- Tier 1: no knowledge
    END;
    v_fine_max := CASE
      WHEN v_gap_pct > 50 THEN 2190294  -- Tier 3/4 annual cap per provision
      WHEN v_gap_pct > 25 THEN 250000   -- Tier 2 representative accumulation
      ELSE 73011                         -- Tier 1 per-violation max
    END;
  ELSE
    v_fine_min := 0; v_fine_max := 0;
  END IF;

  -- GDPR additional fine (applies globally — org may process EU resident data)
  -- Tier 1 (administrative): GREATEST(€10M≈$15M, 2% global revenue)
  -- Tier 2 (substantive): GREATEST(€20M≈$30M, 4% global revenue)
  SELECT
    (COUNT(*) FILTER (WHERE NOT COALESCE(r.present, false)))::NUMERIC
    / NULLIF(COUNT(*), 0) * 100
  INTO v_gdpr_gap
  FROM critical_controls c
  LEFT JOIN critical_control_responses r ON r.control_id = c.id AND r.user_id = v_user_id
  WHERE c.framework_id = 'gdpr';

  v_gdpr_gap := COALESCE(v_gdpr_gap, 100);
  v_gdpr_fine := CASE
    WHEN v_gdpr_gap > 50 THEN GREATEST(30000000, COALESCE(v_revenue, 0) * 0.04)
    WHEN v_gdpr_gap > 25 THEN GREATEST(15000000, COALESCE(v_revenue, 0) * 0.02)
    ELSE 150000  -- minimum administrative exposure (€100K≈$150K)
  END;

  -- Total regulatory exposure = assigned framework + GDPR
  v_fine_max := v_fine_max + v_gdpr_fine;

  -- ROI projection (unchanged logic, just updated fine inputs flow through)
  IF v_revenue IS NOT NULL THEN
    SELECT COALESCE(rs.total_score, 0) INTO v_risk_score
    FROM risk_scores rs WHERE rs.session_id = p_session_id;

    v_size_mult := CASE v_business_size
      WHEN 'enterprise' THEN 2.5 WHEN 'large' THEN 1.8 WHEN 'medium' THEN 1.3
      WHEN 'small' THEN 1.0 WHEN 'micro' THEN 0.7 ELSE 1.0
    END;

    v_tech_infra    := (35000 + 715000 * (v_risk_score / 100.0)) * v_size_mult;
    v_prof_services := (20000 + 480000 * (v_risk_score / 100.0)) * v_size_mult;
    v_training      := 250 * COALESCE(v_employees, 0);
    v_maintenance   := 0.15 * (v_tech_infra + v_prof_services) * 3;
    v_investment    := v_tech_infra + v_prof_services + v_training + v_maintenance;

    v_breach_avoid := v_breach_cost * 0.75;
    v_fine_avoid   := v_fine_max * 0.85;
    v_continuity   := v_revenue * 0.015 * 3;
    v_reputation   := v_revenue * 0.01  * 3;
    v_efficiency   := v_revenue * 0.005 * 3;
    v_insurance    := 75000 * (v_size_mult / 2.5);
    v_compliance   := 75000 + 75000 * (v_risk_score / 100.0);
    v_benefits     := v_breach_avoid + v_fine_avoid + v_continuity + v_reputation
                       + v_efficiency + v_insurance + v_compliance;

    v_net_benefit := v_benefits - v_investment;
    v_roi_pct     := CASE WHEN v_investment > 0 THEN (v_net_benefit / v_investment) * 100 ELSE NULL END;
    v_payback     := CASE WHEN v_benefits  > 0 THEN v_investment / (v_benefits / 36.0)  ELSE NULL END;

    v_investment_breakdown := jsonb_build_object(
      'technology_infrastructure', ROUND(v_tech_infra, 2),
      'professional_services',     ROUND(v_prof_services, 2),
      'security_training',         ROUND(v_training, 2),
      'maintenance_operations',    ROUND(v_maintenance, 2)
    );
    v_benefits_breakdown := jsonb_build_object(
      'breach_cost_avoidance',     ROUND(v_breach_avoid, 2),
      'regulatory_fine_avoidance', ROUND(v_fine_avoid, 2),
      'business_continuity',       ROUND(v_continuity, 2),
      'reputation_protection',     ROUND(v_reputation, 2),
      'operational_efficiency',    ROUND(v_efficiency, 2),
      'cyber_insurance_discount',  ROUND(v_insurance, 2),
      'compliance_cost_avoidance', ROUND(v_compliance, 2)
    );
  ELSE
    v_investment := NULL; v_benefits := NULL; v_net_benefit := NULL;
    v_roi_pct := NULL; v_payback := NULL;
    v_investment_breakdown := NULL; v_benefits_breakdown := NULL;
  END IF;

  INSERT INTO financial_impact (
    session_id, estimated_breach_cost,
    regulatory_fines_min, regulatory_fines_max,
    total_exposure_min, total_exposure_max,
    investment_total, investment_breakdown,
    benefits_total_3yr, benefits_breakdown,
    net_benefit_3yr, roi_pct, payback_months
  ) VALUES (
    p_session_id,
    ROUND(v_breach_cost, 2),
    v_fine_min, v_fine_max,
    ROUND(v_breach_cost + v_fine_min, 2),
    ROUND(v_breach_cost + v_fine_max, 2),
    ROUND(v_investment, 2), v_investment_breakdown,
    ROUND(v_benefits,   2), v_benefits_breakdown,
    ROUND(v_net_benefit, 2), ROUND(v_roi_pct, 2), ROUND(v_payback, 1)
  )
  ON CONFLICT (session_id) DO UPDATE SET
    estimated_breach_cost  = EXCLUDED.estimated_breach_cost,
    regulatory_fines_min   = EXCLUDED.regulatory_fines_min,
    regulatory_fines_max   = EXCLUDED.regulatory_fines_max,
    total_exposure_min     = EXCLUDED.total_exposure_min,
    total_exposure_max     = EXCLUDED.total_exposure_max,
    investment_total       = EXCLUDED.investment_total,
    investment_breakdown   = EXCLUDED.investment_breakdown,
    benefits_total_3yr     = EXCLUDED.benefits_total_3yr,
    benefits_breakdown     = EXCLUDED.benefits_breakdown,
    net_benefit_3yr        = EXCLUDED.net_benefit_3yr,
    roi_pct                = EXCLUDED.roi_pct,
    payback_months         = EXCLUDED.payback_months,
    calculated_at          = NOW();
END; $$;

-- =====================
-- ADDENDUM 12: GDPR Gap Analysis Tool
-- 10-section self-assessment (GDPR GA Tool v2.0, digitized).
-- Scoring: compliance % = (Yes + 0.5*Q.Yes) / applicable * 100
-- Run this block in the Supabase SQL Editor.
-- =====================
CREATE TABLE IF NOT EXISTS gdpr_sections (
  id   INT  PRIMARY KEY,
  name TEXT NOT NULL
);
INSERT INTO gdpr_sections (id, name) VALUES
  (1,'Governance'),(2,'Risk Management'),(3,'GDPR Project'),
  (4,'DPO'),(5,'Roles & Responsibilities'),(6,'Scope of Compliance'),
  (7,'Process Analysis'),(8,'PIMS'),(9,'ISMS / Article 32'),
  (10,'Rights of Data Subjects')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS gdpr_questions (
  id         SERIAL  PRIMARY KEY,
  section_id INT     NOT NULL REFERENCES gdpr_sections(id),
  question   TEXT    NOT NULL,
  mandatory  BOOLEAN NOT NULL DEFAULT true,
  sort_order INT     NOT NULL
);
INSERT INTO gdpr_questions (section_id, question, mandatory, sort_order) VALUES
  (1,'Is the CEO aware of the need to address GDPR?',true,1),
  (1,'Is the Board of Directors aware of the need to address GDPR?',true,2),
  (1,'Are Senior Managers aware of the need to address GDPR?',true,3),
  (1,'Are Functional Managers aware of the need to address GDPR?',true,4),
  (1,'Has the board designated an accountable director for GDPR?',true,5),
  (1,'Is GDPR a standing item on the board agenda?',true,6),
  (1,'Does the board receive regular compliance audit reports?',true,7),
  (2,'Is GDPR risk (fines/legal exposure) tracked on the corporate risk register?',true,1),
  (2,'Is privacy risk to data subjects tracked on the corporate risk register?',true,2),
  (2,'Does the risk methodology cover both GDPR risk and privacy risk to data subjects?',true,3),
  (2,'Does the internal control framework include privacy risk?',true,4),
  (2,'Does the internal audit plan include GDPR compliance?',true,5),
  (3,'Is there a dedicated GDPR project team?',true,1),
  (3,'Does the GDPR project team have visible top-management support?',true,2),
  (3,'Is there a clear delivery plan against a target compliance date?',true,3),
  (3,'Are the planned GDPR deliverables realistically achievable?',true,4),
  (3,'Are project resources adequate?',true,5),
  (3,'Does the project team have the necessary GDPR knowledge and training?',true,6),
  (4,'Has a Data Protection Officer (DPO) been appointed?',true,1),
  (4,'Does the DPO have independence in their reporting arrangements?',true,2),
  (4,'Does the DPO have direct access to top management?',true,3),
  (4,'Is the DPO adequately resourced?',true,4),
  (4,'Does the DPO have sufficient GDPR knowledge and competence?',true,5),
  (4,'Does the DPO stay current with GDPR developments?',true,6),
  (4,'Does the DPO have adequate cybersecurity knowledge?',true,7),
  (4,'Does the DPO authority level match the scope of the privacy compliance framework?',true,8),
  (5,'Does HR hold formal responsibility for personal data processing in its function?',true,1),
  (5,'Does Marketing hold formal responsibility for personal data processing in its function?',true,2),
  (5,'Does Sales hold formal responsibility for personal data processing in its function?',true,3),
  (5,'Does Procurement hold formal responsibility for personal data processing in its function?',true,4),
  (5,'Does IT hold formal responsibility for personal data processing in its function?',true,5),
  (5,'Is GDPR included in staff onboarding and induction?',true,6),
  (5,'Is there a mandatory ongoing GDPR awareness program?',true,7),
  (5,'Has all staff completed the GDPR awareness program?',true,8),
  (6,'Has the scope of the privacy compliance framework been defined?',true,1),
  (6,'Is the legal entity in scope identified?',true,2),
  (6,'Has personal data collected in other countries been identified?',false,3),
  (6,'Has personal data stored or processed in other countries been identified?',false,4),
  (6,'Have all third parties that might receive shared data been identified?',true,5),
  (6,'Are GDPR-compliant data processing contracts in place with all third parties?',true,6),
  (6,'Have all cloud service providers been identified?',true,7),
  (6,'Has controller vs. processor status been determined for each third-party relationship?',true,8),
  (6,'Are GDPR-compliant contracts in place specifically for cloud-based processing?',true,9),
  (7,'Has a data processing activity inventory (Article 30 records of processing) been completed?',true,1),
  (8,'Are consent processes GDPR-compliant and documented?',true,1),
  (8,'Is there a working consent-withdrawal mechanism?',true,2),
  (8,'Has employee data processing been moved off a consent basis where better legal bases apply?',true,3),
  (8,'Is consent granular and not bundled with other terms?',true,4),
  (8,'Are Article 13 notices published (data collected directly from data subjects)?',true,5),
  (8,'Are Article 14 notices issued (data collected from other sources)?',true,6),
  (8,'Are data processing activities documented per Article 30?',true,7),
  (8,'Is there a data protection policy?',true,8),
  (8,'Is there a functioning Data Subject Access Request (DSAR) process?',true,9),
  (8,'Is there a need-to-know access provisioning policy?',true,10),
  (8,'Is there a records management policy?',true,11),
  (8,'Is there a data classification policy?',true,12),
  (8,'Is there a change management policy linked to DPIA review?',true,13),
  (8,'Is there a data retention policy?',true,14),
  (8,'Have databases potentially holding data past its retention period been identified?',true,15),
  (8,'Is there an incident response process?',true,16),
  (8,'Is there a data breach reporting process?',true,17),
  (8,'Is there a contract management process covering SLAs, security, and controller/processor obligations?',true,18),
  (9,'Is there an encryption policy referencing a recognized standard such as FIPS 140-2?',true,1),
  (9,'Are mobile devices encrypted?',true,2),
  (9,'Are databases encrypted?',true,3),
  (9,'Is pseudonymization used where appropriate?',true,4),
  (9,'Is email encrypted?',true,5),
  (9,'Is external network penetration testing conducted regularly?',true,6),
  (9,'Is internal network penetration testing conducted regularly?',true,7),
  (9,'Are websites and applications regularly security tested?',true,8),
  (9,'Is there an information security policy that explicitly references protection of data subjects?',true,9),
  (9,'Is Cyber Essentials implemented?',false,10),
  (9,'Is Cyber Essentials Plus implemented?',false,11),
  (9,'Is BS 10012 implemented?',false,12),
  (9,'Is ISO 27001 implemented?',false,13),
  (9,'Is PCI DSS implemented?',false,14),
  (10,'Does the organization have working procedures to facilitate data subject rights?',true,1),
  (10,'Is there a working procedure for the Right to be Informed?',true,2),
  (10,'Is there a working procedure for the Right of Access?',true,3),
  (10,'Is there a working procedure for the Right to Rectification?',true,4),
  (10,'Is there a working procedure for the Right to Erasure?',true,5),
  (10,'Is there a working procedure for the Right to Restrict Processing?',true,6),
  (10,'Is there a working procedure for the Right to Data Portability?',true,7),
  (10,'Is there a working procedure for the Right to Object?',true,8),
  (10,'Is there a working procedure for Rights Related to Automated Decision-Making?',true,9)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS gdpr_responses (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id INT     NOT NULL REFERENCES gdpr_questions(id),
  response    TEXT    CHECK (response IN ('yes','no','q_yes')),
  documented  BOOLEAN,
  comments    TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, question_id)
);
ALTER TABLE gdpr_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gdpr_responses" ON gdpr_responses FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_gdpr_responses_user ON gdpr_responses(user_id);

CREATE TABLE IF NOT EXISTS gdpr_process_register (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  process_name      TEXT    NOT NULL,
  data_subjects     TEXT,
  controller_status TEXT    CHECK (controller_status IN ('controller','joint_controller','processor','dont_know')),
  personal_data     BOOLEAN DEFAULT false,
  special_category  BOOLEAN DEFAULT false,
  children_data     BOOLEAN DEFAULT false,
  lawful_basis      TEXT,
  data_volume       TEXT    CHECK (data_volume IN ('minimal','low','medium','high','very_high')),
  shared_with       TEXT,
  outsourced        TEXT,
  transborder       TEXT,
  gdpr_compliant    TEXT    CHECK (gdpr_compliant IN ('yes','no','q_yes')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE gdpr_process_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gdpr_process_register" ON gdpr_process_register FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_gdpr_process_user ON gdpr_process_register(user_id);

-- =====================
-- ADDENDUM 13: ISO 27001 Certification Tracker
-- 15-phase certification project workflow + 114 Annex A controls (ISO 27001:2013)
-- for the Statement of Applicability (Phase 5).
-- Phase 4 risk assessment reads from risk_register_entries, not a separate list.
-- Run this block in the Supabase SQL Editor.
-- =====================
CREATE TABLE IF NOT EXISTS iso27001_phases (
  id          INT  PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT
);

INSERT INTO iso27001_phases (id, name, description) VALUES
  (1,  'Form the ISO 27001 team',              'Assign roles and responsibilities for the certification effort'),
  (2,  'Scope the ISMS',                        'Define ISMS boundaries and brief leadership on scope'),
  (3,  'Draft ISMS policy documentation',       'Build the policy framework, customize templates, publish final policies'),
  (4,  'Run the risk assessment',               'Establish methodology, identify and score risks using the risk register, assign treatment plans'),
  (5,  'Complete the Statement of Applicability','Review all 114 Annex A controls, select/justify inclusion or exclusion per control'),
  (6,  'Roll out policies and controls',        'Communicate to staff, track acknowledgment, monitor control effectiveness'),
  (7,  'Train the organization',                'Security awareness training, staff training on top risks, communicate consequences'),
  (8,  'Assemble audit evidence',               'Compile required documents and records ahead of external audit'),
  (9,  'Internal audit',                        'Scope against Clauses 4-10 and Annex A, use independent auditor, log and remediate findings'),
  (10, 'Stage 1 external audit',                'Select accredited auditor, undergo documentation review, get readiness feedback'),
  (11, 'Act on Stage 1 findings',               'Confirm requirements addressed, resolve nonconformities, confirm third-party obligations met'),
  (12, 'Stage 2 external audit',                'Undergo the full Stage 2 audit'),
  (13, 'Act on Stage 2 findings',               'Log and resolve any nonconformities from Stage 2'),
  (14, 'Ongoing surveillance',                  'Annual/quarterly reviews, surveillance audits, annual risk reassessment, board briefings'),
  (15, 'Continuous improvement',                'Track ISMS weaknesses to closure, maintain nonconformity/corrective-action log')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS iso27001_tracker (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase_id      INT   NOT NULL REFERENCES iso27001_phases(id),
  status        TEXT  NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','complete')),
  notes         TEXT,
  evidence_link TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, phase_id)
);

ALTER TABLE iso27001_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own iso27001_tracker" ON iso27001_tracker FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_iso_tracker_user ON iso27001_tracker(user_id);

-- ISO 27001:2013 Annex A controls (114 controls across 14 clauses)
CREATE TABLE IF NOT EXISTS iso27001_annex_a (
  id      TEXT PRIMARY KEY,  -- e.g. 'A.5.1.1'
  clause  TEXT NOT NULL,
  name    TEXT NOT NULL
);

INSERT INTO iso27001_annex_a (id, clause, name) VALUES
  ('A.5.1.1','A.5 Information Security Policies','Policies for information security'),
  ('A.5.1.2','A.5 Information Security Policies','Review of the policies for information security'),
  ('A.6.1.1','A.6 Organization of Information Security','Information security roles and responsibilities'),
  ('A.6.1.2','A.6 Organization of Information Security','Segregation of duties'),
  ('A.6.1.3','A.6 Organization of Information Security','Contact with authorities'),
  ('A.6.1.4','A.6 Organization of Information Security','Contact with special interest groups'),
  ('A.6.1.5','A.6 Organization of Information Security','Information security in project management'),
  ('A.6.2.1','A.6 Organization of Information Security','Mobile device policy'),
  ('A.6.2.2','A.6 Organization of Information Security','Teleworking'),
  ('A.7.1.1','A.7 Human Resource Security','Screening'),
  ('A.7.1.2','A.7 Human Resource Security','Terms and conditions of employment'),
  ('A.7.2.1','A.7 Human Resource Security','Management responsibilities'),
  ('A.7.2.2','A.7 Human Resource Security','Information security awareness, education and training'),
  ('A.7.2.3','A.7 Human Resource Security','Disciplinary process'),
  ('A.7.3.1','A.7 Human Resource Security','Termination or change of employment responsibilities'),
  ('A.8.1.1','A.8 Asset Management','Inventory of assets'),
  ('A.8.1.2','A.8 Asset Management','Ownership of assets'),
  ('A.8.1.3','A.8 Asset Management','Acceptable use of assets'),
  ('A.8.1.4','A.8 Asset Management','Return of assets'),
  ('A.8.2.1','A.8 Asset Management','Classification of information'),
  ('A.8.2.2','A.8 Asset Management','Labelling of information'),
  ('A.8.2.3','A.8 Asset Management','Handling of assets'),
  ('A.8.3.1','A.8 Asset Management','Management of removable media'),
  ('A.8.3.2','A.8 Asset Management','Disposal of media'),
  ('A.8.3.3','A.8 Asset Management','Physical media transfer'),
  ('A.9.1.1','A.9 Access Control','Access control policy'),
  ('A.9.1.2','A.9 Access Control','Access to networks and network services'),
  ('A.9.2.1','A.9 Access Control','User registration and de-registration'),
  ('A.9.2.2','A.9 Access Control','User access provisioning'),
  ('A.9.2.3','A.9 Access Control','Management of privileged access rights'),
  ('A.9.2.4','A.9 Access Control','Management of secret authentication information of users'),
  ('A.9.2.5','A.9 Access Control','Review of user access rights'),
  ('A.9.2.6','A.9 Access Control','Removal or adjustment of access rights'),
  ('A.9.3.1','A.9 Access Control','Use of secret authentication information'),
  ('A.9.4.1','A.9 Access Control','Information access restriction'),
  ('A.9.4.2','A.9 Access Control','Secure log-on procedures'),
  ('A.9.4.3','A.9 Access Control','Password management system'),
  ('A.9.4.4','A.9 Access Control','Use of privileged utility programs'),
  ('A.9.4.5','A.9 Access Control','Access control to program source code'),
  ('A.10.1.1','A.10 Cryptography','Policy on the use of cryptographic controls'),
  ('A.10.1.2','A.10 Cryptography','Key management'),
  ('A.11.1.1','A.11 Physical and Environmental Security','Physical security perimeter'),
  ('A.11.1.2','A.11 Physical and Environmental Security','Physical entry controls'),
  ('A.11.1.3','A.11 Physical and Environmental Security','Securing offices, rooms and facilities'),
  ('A.11.1.4','A.11 Physical and Environmental Security','Protecting against external and environmental threats'),
  ('A.11.1.5','A.11 Physical and Environmental Security','Working in secure areas'),
  ('A.11.1.6','A.11 Physical and Environmental Security','Delivery and loading areas'),
  ('A.11.2.1','A.11 Physical and Environmental Security','Equipment siting and protection'),
  ('A.11.2.2','A.11 Physical and Environmental Security','Supporting utilities'),
  ('A.11.2.3','A.11 Physical and Environmental Security','Cabling security'),
  ('A.11.2.4','A.11 Physical and Environmental Security','Equipment maintenance'),
  ('A.11.2.5','A.11 Physical and Environmental Security','Removal of assets'),
  ('A.11.2.6','A.11 Physical and Environmental Security','Security of equipment and assets off-premises'),
  ('A.11.2.7','A.11 Physical and Environmental Security','Secure disposal or reuse of equipment'),
  ('A.11.2.8','A.11 Physical and Environmental Security','Unattended user equipment'),
  ('A.11.2.9','A.11 Physical and Environmental Security','Clear desk and clear screen policy'),
  ('A.12.1.1','A.12 Operations Security','Documented operating procedures'),
  ('A.12.1.2','A.12 Operations Security','Change management'),
  ('A.12.1.3','A.12 Operations Security','Capacity management'),
  ('A.12.1.4','A.12 Operations Security','Separation of development, testing and operational environments'),
  ('A.12.2.1','A.12 Operations Security','Controls against malware'),
  ('A.12.3.1','A.12 Operations Security','Information backup'),
  ('A.12.4.1','A.12 Operations Security','Event logging'),
  ('A.12.4.2','A.12 Operations Security','Protection of log information'),
  ('A.12.4.3','A.12 Operations Security','Administrator and operator logs'),
  ('A.12.4.4','A.12 Operations Security','Clock synchronisation'),
  ('A.12.5.1','A.12 Operations Security','Installation of software on operational systems'),
  ('A.12.6.1','A.12 Operations Security','Management of technical vulnerabilities'),
  ('A.12.6.2','A.12 Operations Security','Restrictions on software installation'),
  ('A.12.7.1','A.12 Operations Security','Information systems audit controls'),
  ('A.13.1.1','A.13 Communications Security','Network controls'),
  ('A.13.1.2','A.13 Communications Security','Security of network services'),
  ('A.13.1.3','A.13 Communications Security','Segregation in networks'),
  ('A.13.2.1','A.13 Communications Security','Information transfer policies and procedures'),
  ('A.13.2.2','A.13 Communications Security','Agreements on information transfer'),
  ('A.13.2.3','A.13 Communications Security','Electronic messaging'),
  ('A.13.2.4','A.13 Communications Security','Confidentiality or non-disclosure agreements'),
  ('A.14.1.1','A.14 System Acquisition, Development and Maintenance','Information security requirements analysis and specification'),
  ('A.14.1.2','A.14 System Acquisition, Development and Maintenance','Securing application services on public networks'),
  ('A.14.1.3','A.14 System Acquisition, Development and Maintenance','Protecting application services transactions'),
  ('A.14.2.1','A.14 System Acquisition, Development and Maintenance','Secure development policy'),
  ('A.14.2.2','A.14 System Acquisition, Development and Maintenance','System change control procedures'),
  ('A.14.2.3','A.14 System Acquisition, Development and Maintenance','Technical review of applications after operating platform changes'),
  ('A.14.2.4','A.14 System Acquisition, Development and Maintenance','Restrictions on changes to software packages'),
  ('A.14.2.5','A.14 System Acquisition, Development and Maintenance','Secure system engineering principles'),
  ('A.14.2.6','A.14 System Acquisition, Development and Maintenance','Secure development environment'),
  ('A.14.2.7','A.14 System Acquisition, Development and Maintenance','Outsourced development'),
  ('A.14.2.8','A.14 System Acquisition, Development and Maintenance','System security testing'),
  ('A.14.2.9','A.14 System Acquisition, Development and Maintenance','System acceptance testing'),
  ('A.14.3.1','A.14 System Acquisition, Development and Maintenance','Protection of test data'),
  ('A.15.1.1','A.15 Supplier Relationships','Information security policy for supplier relationships'),
  ('A.15.1.2','A.15 Supplier Relationships','Addressing security within supplier agreements'),
  ('A.15.1.3','A.15 Supplier Relationships','Information and communication technology supply chain'),
  ('A.15.2.1','A.15 Supplier Relationships','Monitoring and review of supplier services'),
  ('A.15.2.2','A.15 Supplier Relationships','Managing changes to supplier services'),
  ('A.16.1.1','A.16 Information Security Incident Management','Responsibilities and procedures'),
  ('A.16.1.2','A.16 Information Security Incident Management','Reporting information security events'),
  ('A.16.1.3','A.16 Information Security Incident Management','Reporting information security weaknesses'),
  ('A.16.1.4','A.16 Information Security Incident Management','Assessment of and decision on information security events'),
  ('A.16.1.5','A.16 Information Security Incident Management','Response to information security incidents'),
  ('A.16.1.6','A.16 Information Security Incident Management','Learning from information security incidents'),
  ('A.16.1.7','A.16 Information Security Incident Management','Collection of evidence'),
  ('A.17.1.1','A.17 Business Continuity Management','Planning information security continuity'),
  ('A.17.1.2','A.17 Business Continuity Management','Implementing information security continuity'),
  ('A.17.1.3','A.17 Business Continuity Management','Verify, review and evaluate information security continuity'),
  ('A.17.2.1','A.17 Business Continuity Management','Availability of information processing facilities'),
  ('A.18.1.1','A.18 Compliance','Identification of applicable legislation and contractual requirements'),
  ('A.18.1.2','A.18 Compliance','Intellectual property rights'),
  ('A.18.1.3','A.18 Compliance','Protection of records'),
  ('A.18.1.4','A.18 Compliance','Privacy and protection of personally identifiable information'),
  ('A.18.1.5','A.18 Compliance','Regulation of cryptographic controls'),
  ('A.18.2.1','A.18 Compliance','Independent review of information security'),
  ('A.18.2.2','A.18 Compliance','Compliance with security policies and standards'),
  ('A.18.2.3','A.18 Compliance','Technical compliance review')
ON CONFLICT DO NOTHING;

-- Statement of Applicability: per-org applicability decision per Annex A control
CREATE TABLE IF NOT EXISTS iso27001_soa (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  control_id   TEXT  NOT NULL REFERENCES iso27001_annex_a(id),
  applicable   BOOLEAN NOT NULL DEFAULT true,
  implemented  BOOLEAN NOT NULL DEFAULT false,
  justification TEXT,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, control_id)
);

ALTER TABLE iso27001_soa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own iso27001_soa" ON iso27001_soa FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_soa_user ON iso27001_soa(user_id);

-- =====================
-- ADDENDUM 14: KPI surfacing data tables
-- board_meetings   → Board Risk Oversight Frequency (ISO 31000, Clause 5.4)
-- security_incidents → Time-to-Detect / MTTD (NIST NRF)
-- Run this block in the Supabase SQL Editor.
-- =====================
CREATE TABLE IF NOT EXISTS board_meetings (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_date     DATE  NOT NULL,
  risk_agenda_item BOOLEAN NOT NULL DEFAULT false,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE board_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own board_meetings" ON board_meetings FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_board_meetings_user ON board_meetings(user_id);

CREATE TABLE IF NOT EXISTS security_incidents (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT  NOT NULL,
  severity        TEXT  NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  occurred_at     TIMESTAMPTZ NOT NULL,
  detected_at     TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own security_incidents" ON security_incidents FOR ALL USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_incidents_user ON security_incidents(user_id);
