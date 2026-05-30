"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../utils/supabase/client";
import { saveOnboardingAnswers, queueScanJob } from "./actions";
import styles from "./onboarding.module.css";

type Answer = "yes" | "no" | "partial" | "na";

interface Question {
  session_id: string;
  question_id: number;
  framework_id: string;
  question_text: string;
  domain: string;
  compliance_statement: string | null;
}

interface OrgProfile {
  patient_records_count: number;
  data_storage_gb: number;
  has_health_data: boolean;
  has_financial_data: boolean;
  has_pii_data: boolean;
  data_sensitivity_level: number;
  vendor_count: number;
  max_vendor_access_level: number;
  vendor_data_share_pct: number;
}

const SENSITIVITY_LABELS: Record<number, string> = {
  1: "Public — No risk if disclosed",
  2: "Internal Use — Low risk",
  3: "Confidential — Moderate risk",
  4: "Restricted — High risk",
  5: "Top Secret — Critical risk",
};

const VENDOR_ACCESS_LABELS: Record<number, string> = {
  1: "Read-Only — View data only",
  2: "Limited Write — Specific updates",
  3: "Full Access — Create, read, update, delete",
  4: "Administrative — Complete system control",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrgProfile>({
    patient_records_count: 0,
    data_storage_gb: 0,
    has_health_data: false,
    has_financial_data: false,
    has_pii_data: false,
    data_sensitivity_level: 3,
    vendor_count: 0,
    max_vendor_access_level: 1,
    vendor_data_share_pct: 0,
  });

  useEffect(() => {
    async function load() {
      // Queue the network scan immediately — runs in background while user answers questions
      queueScanJob();

      const supabase = createClient();
      const { data, error } = await supabase
        .from("v_session_questions")
        .select("session_id, question_id, framework_id, question_text, domain, compliance_statement");

      if (error) { setError(error.message); setLoading(false); return; }
      setQuestions(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const domains = [...new Set(questions.map((q) => q.domain ?? "General"))];
  // Last step index = domains.length (org profile step)
  const isOrgProfileStep = step === domains.length;
  const isLastQuestionnaireStep = step === domains.length - 1;
  const currentDomain = domains[step];
  const domainQuestions = questions.filter((q) => (q.domain ?? "General") === currentDomain);
  const totalAnswered = Object.keys(answers).length;
  const totalQuestions = questions.length;

  function answerKey(q: Question) {
    return `${q.question_id}_${q.framework_id}`;
  }

  function setAnswer(q: Question, value: Answer) {
    setAnswers((prev) => ({ ...prev, [answerKey(q)]: value }));
  }

  function updateOrg<K extends keyof OrgProfile>(key: K, value: OrgProfile[K]) {
    setOrgProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function handleComplete() {
    setSaving(true);
    setError(null);

    const entries = questions
      .filter((q) => answers[answerKey(q)])
      .map((q) => ({
        session_id: q.session_id,
        question_id: q.question_id,
        framework_id: q.framework_id,
        response: answers[answerKey(q)] as Answer,
      }));

    const { error: err } = await saveOnboardingAnswers(entries, orgProfile);
    if (err) { setError(err); setSaving(false); return; }
    router.push("/scanning");
  }

  async function handleSkip() {
    setSaving(true);
    const { error: err } = await saveOnboardingAnswers([], orgProfile);
    if (err) { setError(err); setSaving(false); return; }
    router.push("/scanning");
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Loading your compliance questionnaire…</p>
          </div>
        </div>
      </main>
    );
  }

  // No framework assigned — still collect org profile for scoring
  if (questions.length === 0) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <img src="/img/logo.svg" alt="DIMA Risk" className={styles.logo} />
            <div className={styles.headerText}>
              <h1 className={styles.title}>Organization Profile</h1>
              <p className={styles.subtitle}>
                Tell us about your data environment so we can calculate your risk score.
              </p>
            </div>
          </div>
          <OrgProfileForm profile={orgProfile} onChange={updateOrg} />
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.navRow}>
            <button className={styles.ghostBtn} onClick={handleSkip} disabled={saving}>
              Skip for now
            </button>
            <button className={styles.primaryBtn} onClick={handleComplete} disabled={saving}>
              {saving ? "Calculating…" : "Go to Dashboard"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <img src="/img/logo.svg" alt="DIMA Risk" className={styles.logo} />
          <div className={styles.headerText}>
            <h1 className={styles.title}>
              {isOrgProfileStep ? "Organization Profile" : "Compliance Questionnaire"}
            </h1>
            <p className={styles.subtitle}>
              {isOrgProfileStep
                ? "One last step — tell us about your data environment to generate your risk score."
                : "Answer each question based on your current practices. You can update these later."}
            </p>
          </div>
        </div>

        {/* Phase indicator */}
        <div className={styles.phaseRow}>
          <div className={`${styles.phaseStep} ${!isOrgProfileStep ? styles.phaseActive : styles.phaseDone}`}>
            <span className={styles.phaseBadge}>{isOrgProfileStep ? "✓" : "1"}</span>
            Compliance Questionnaire
          </div>
          <div className={styles.phaseConnector} />
          <div className={`${styles.phaseStep} ${isOrgProfileStep ? styles.phaseActive : styles.phaseIdle}`}>
            <span className={styles.phaseBadge}>2</span>
            Organization Profile
          </div>
        </div>

        {!isOrgProfileStep && (
          <>
            {/* Overall progress */}
            <div className={styles.progressSection}>
              <div className={styles.progressInfo}>
                <span className={styles.progressLabel}>{totalAnswered} of {totalQuestions} answered</span>
                <span className={styles.progressLabel}>Domain {step + 1} of {domains.length}</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill}
                  style={{ width: `${totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Domain step tabs */}
            <div className={styles.stepTabs}>
              {domains.map((d, i) => (
                <button
                  key={d}
                  className={`${styles.stepTab} ${i === step ? styles.stepTabActive : ""} ${i < step ? styles.stepTabDone : ""}`}
                  onClick={() => setStep(i)}
                >
                  {i < step && <span className={styles.checkIcon}>✓</span>}
                  <span className={styles.stepNum}>{i + 1}</span>
                  <span className={styles.stepName}>{d}</span>
                </button>
              ))}
            </div>

            {/* Current domain questions */}
            <div className={styles.domainSection}>
              <h2 className={styles.domainTitle}>{currentDomain}</h2>
              <p className={styles.domainHint}>
                {domainQuestions.length} question{domainQuestions.length !== 1 ? "s" : ""} in this section
              </p>

              <div className={styles.questionList}>
                {domainQuestions.map((q, i) => {
                  const selected = answers[answerKey(q)];
                  return (
                    <div key={answerKey(q)} className={`${styles.questionCard} ${selected ? styles.questionCardAnswered : ""}`}>
                      <div className={styles.questionTop}>
                        <span className={styles.questionNum}>Q{i + 1}</span>
                        <p className={styles.questionText}>{q.question_text}</p>
                      </div>
                      {q.compliance_statement && (
                        <p className={styles.complianceNote}>{q.compliance_statement}</p>
                      )}
                      <div className={styles.answerBtns}>
                        {(["yes", "no", "partial", "na"] as Answer[]).map((opt) => (
                          <button
                            key={opt}
                            className={`${styles.answerBtn} ${styles[`answer_${opt}`]} ${selected === opt ? styles.answerSelected : ""}`}
                            onClick={() => setAnswer(q, opt)}
                          >
                            {opt === "yes" ? "Yes" : opt === "no" ? "No" : opt === "partial" ? "Partial" : "N/A"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {isOrgProfileStep && (
          <OrgProfileForm profile={orgProfile} onChange={updateOrg} />
        )}

        {error && <p className={styles.errorMsg}>{error}</p>}

        {/* Navigation */}
        <div className={styles.navRow}>
          <button className={styles.ghostBtn} onClick={handleSkip} disabled={saving}>
            Skip for now
          </button>
          <div className={styles.navRight}>
            {step > 0 && (
              <button className={styles.secondaryBtn} onClick={() => setStep((s) => s - 1)} disabled={saving}>
                Previous
              </button>
            )}
            {isOrgProfileStep ? (
              <button className={styles.primaryBtn} onClick={handleComplete} disabled={saving}>
                {saving ? "Calculating score…" : "Complete Setup"}
              </button>
            ) : isLastQuestionnaireStep ? (
              <button className={styles.primaryBtn} onClick={() => setStep(domains.length)} disabled={saving}>
                Next: Organization Profile
              </button>
            ) : (
              <button className={styles.primaryBtn} onClick={() => setStep((s) => s + 1)} disabled={saving}>
                Next Section
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function OrgProfileForm({
  profile,
  onChange,
}: {
  profile: OrgProfile;
  onChange: <K extends keyof OrgProfile>(key: K, value: OrgProfile[K]) => void;
}) {
  return (
    <div className={styles.orgForm}>
      <div className={styles.orgFormSection}>
        <h3 className={styles.orgFormTitle}>Data Volume</h3>
        <div className={styles.orgFormGrid}>
          <div className={styles.orgField}>
            <label className={styles.orgLabel}>Number of patient / customer records</label>
            <input
              type="number" min={0} className={styles.orgInput}
              value={profile.patient_records_count}
              onChange={(e) => onChange("patient_records_count", parseInt(e.target.value) || 0)}
            />
          </div>
          <div className={styles.orgField}>
            <label className={styles.orgLabel}>Data storage size (GB)</label>
            <input
              type="number" min={0} step={0.1} className={styles.orgInput}
              value={profile.data_storage_gb}
              onChange={(e) => onChange("data_storage_gb", parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      <div className={styles.orgFormSection}>
        <h3 className={styles.orgFormTitle}>Data Sensitivity</h3>
        <p className={styles.orgFormHint}>What types of data does your organization store?</p>
        <div className={styles.checkboxGroup}>
          {([
            ["has_health_data", "Health / Medical data (PHI, patient records)"],
            ["has_financial_data", "Financial data (payment, banking)"],
            ["has_pii_data", "Personal Identifiable Information (PII)"],
          ] as [keyof OrgProfile, string][]).map(([key, label]) => (
            <label key={key} className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={profile[key] as boolean}
                onChange={(e) => onChange(key, e.target.checked as OrgProfile[typeof key])}
                className={styles.checkbox}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className={styles.orgField} style={{ marginTop: "1rem" }}>
          <label className={styles.orgLabel}>
            Highest data sensitivity level — <span style={{ color: "#9b7de2" }}>
              {SENSITIVITY_LABELS[profile.data_sensitivity_level]}
            </span>
          </label>
          <input
            type="range" min={1} max={5} step={1}
            value={profile.data_sensitivity_level}
            onChange={(e) => onChange("data_sensitivity_level", parseInt(e.target.value))}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>L1 Public</span><span>L2 Internal</span><span>L3 Confidential</span><span>L4 Restricted</span><span>L5 Top Secret</span>
          </div>
        </div>
      </div>

      <div className={styles.orgFormSection}>
        <h3 className={styles.orgFormTitle}>Third-Party Vendor Access</h3>
        <div className={styles.orgFormGrid}>
          <div className={styles.orgField}>
            <label className={styles.orgLabel}>Number of vendors with data access</label>
            <input
              type="number" min={0} className={styles.orgInput}
              value={profile.vendor_count}
              onChange={(e) => onChange("vendor_count", parseInt(e.target.value) || 0)}
            />
          </div>
          <div className={styles.orgField}>
            <label className={styles.orgLabel}>% of data shared with vendors</label>
            <input
              type="number" min={0} max={100} className={styles.orgInput}
              value={profile.vendor_data_share_pct}
              onChange={(e) => onChange("vendor_data_share_pct", parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className={styles.orgField}>
          <label className={styles.orgLabel}>
            Highest vendor access level — <span style={{ color: "#9b7de2" }}>
              {VENDOR_ACCESS_LABELS[profile.max_vendor_access_level]}
            </span>
          </label>
          <input
            type="range" min={1} max={4} step={1}
            value={profile.max_vendor_access_level}
            onChange={(e) => onChange("max_vendor_access_level", parseInt(e.target.value))}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>Read-Only</span><span>Limited</span><span>Full</span><span>Admin</span>
          </div>
        </div>
      </div>
    </div>
  );
}
