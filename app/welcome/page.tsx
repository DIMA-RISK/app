"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./welcome.module.css";

export default function WelcomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const router = useRouter();

  function handleAccept() {
    router.push("/onboarding");
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <img src="/img/logo.svg" alt="DIMA Risk" className={styles.logo} />

        <h1 className={styles.heading}>
          Welcome to <span className={styles.accent}>DIMA Risk</span>
        </h1>
        <p className={styles.subheading}>
          Your AI-powered risk intelligence platform is ready to be configured.
          <br />
          We&apos;ll run a background scan and collect a few details about your
          organization — then your live dashboard will be ready.
        </p>

        <div className={styles.pillars}>
          <div className={styles.pillar}>
            <span className={styles.pillarIcon}>⚙</span>
            <h3 className={styles.pillarTitle}>Background Scan</h3>
            <p className={styles.pillarText}>
              Our AI engine scans your environment while you answer a few
              quick questions.
            </p>
          </div>
          <div className={styles.pillar}>
            <span className={styles.pillarIcon}>◈</span>
            <h3 className={styles.pillarTitle}>Risk Profiling</h3>
            <p className={styles.pillarText}>
              We build your organization&apos;s risk profile across cyber,
              compliance, and operational domains.
            </p>
          </div>
          <div className={styles.pillar}>
            <span className={styles.pillarIcon}>▣</span>
            <h3 className={styles.pillarTitle}>Live Dashboard</h3>
            <p className={styles.pillarText}>
              Results are stored and surfaced the moment your scan
              completes — no waiting required.
            </p>
          </div>
        </div>

        <button
          className={styles.ctaButton}
          onClick={() => setModalOpen(true)}
        >
          Get Started
        </button>
        <p className={styles.timeHint}>Takes about 5 minutes</p>
      </div>

      {modalOpen && (
        <div
          className={styles.overlay}
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2 className={styles.modalTitle}>
              Data Collection, Network Scanning &amp; Privacy Disclaimer
            </h2>
            <p className={styles.legalMeta}>
              Version 1.0 · Effective Date: May 2026 · Jurisdictions: USA · European Union · Canada
            </p>

            <div className={styles.legalScroll}>
              <div className={styles.legalWarning}>
                <strong>⚠ IMPORTANT — PLEASE READ CAREFULLY BEFORE PROCEEDING</strong>
                <br />
                By completing this registration form and accessing the DIMA Risk Solutions platform,
                you confirm that you have read, understood, and agree to the data collection practices,
                network scanning activities, and privacy terms described in this notice. If you do not
                agree, do not proceed with registration.
                <br /><br />
                This disclaimer does not constitute legal advice. DIMA Risk Solutions recommends that
                your organisation obtain independent legal counsel to assess compliance obligations
                under applicable law.
              </div>

              <p className={styles.legalSection}>
                <strong>1. Who We Are and What This Platform Does</strong>
                <br />
                DIMA Risk Solutions (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates a risk management platform that
                assists organisations in identifying, quantifying, and remediating cybersecurity and
                compliance risk. The platform supports assessment processes through data collection and
                network scanning tools described in this notice. The platform is operated by DIMA Risk
                Solutions, based in Surrey, British Columbia, Canada.
              </p>

              <p className={styles.legalSection}>
                <strong>2. Information We Collect at Registration</strong>
              </p>

              <p className={styles.legalSubSection}>2.1 Company Information (Publicly Available)</p>
              <p className={styles.legalSection}>
                We collect company information that is publicly available through LinkedIn, company
                websites, and other public sources. This includes: legal company name and registered
                business name; registered business address and principal place of business; publicly
                listed contact details (general email addresses, phone numbers). This information is
                collected solely for the purpose of configuring your organisation&apos;s risk profile and
                is not used for marketing purposes.
              </p>

              <p className={styles.legalSubSection}>2.2 Administrator Account Information (Personal Data)</p>
              <p className={styles.legalSection}>
                We collect only the following information from the designated platform administrator:
                full name; authentication credentials (encrypted). The administrator is the individual
                your organisation designates as the responsible contact for the platform.
              </p>

              <p className={styles.legalSubSection}>2.3 Data Collected by the Network Scanner</p>
              <p className={styles.legalSection}>
                When you enable the network scanning tool, the platform automatically collects technical
                data about your organisation&apos;s publicly accessible infrastructure, including: open port
                and service enumeration; TLS/SSL certificate analysis; DNS record analysis; known
                vulnerability identification (CVE comparison); security header configuration. All scan
                data is used exclusively to generate your organisation&apos;s risk assessment. No data is
                exfiltrated from your systems, no vulnerabilities are exploited, and no internal or
                private networks are accessed.
              </p>

              <p className={styles.legalSubSection}>2.4 Data Collected via the Compliance Questionnaire</p>
              <p className={styles.legalSection}>
                The compliance questionnaire collects: current security controls and policies; compliance
                framework status and known gaps (e.g. ISO 27001, SOC 2, PIPEDA, GDPR); data handling
                and classification practices; third-party vendor and access management practices; incident
                response and business continuity arrangements; risk tolerance and appetite statements.
                Responses are treated as confidential and are never shared with third parties without
                your explicit written consent.
              </p>

              <p className={styles.legalSection}>
                <strong>3. Network Scanning Tool — Critical Notice</strong>
                <br />
                By proceeding with registration and enabling the scanning tool, you represent and warrant
                that: you are an authorised representative of the organisation with authority to consent
                to network scanning activities; you have obtained all necessary internal approvals; you
                understand that the tool will interrogate publicly accessible IP addresses, domains,
                ports, and services; you accept full responsibility for ensuring scanning activities
                comply with your organisation&apos;s internal policies and applicable legal obligations; you
                will not use the scanning tool against systems you are not authorised to scan.
              </p>

              <p className={styles.legalSubSection}>3.1 What the Network Scanning Tool Does</p>
              <p className={styles.legalSection}>
                The tool performs: port and service enumeration; TLS/SSL certificate analysis; DNS record
                analysis; vulnerability identification (CVE databases); configuration assessment of
                visible security headers; email security assessment (SPF, DKIM, DMARC). The tool does
                NOT perform intrusive penetration testing, does NOT attempt to exploit vulnerabilities,
                does NOT access or exfiltrate data, and does NOT scan internal networks.
              </p>

              <p className={styles.legalSubSection}>3.2 Data Generated by Network Scanning</p>
              <p className={styles.legalSection}>
                Scan results are stored within the platform and used exclusively to generate your
                organisation&apos;s risk assessment report. Scan data is not shared with third parties and
                not used for benchmarking without explicit consent.
              </p>

              <p className={styles.legalSection}>
                <strong>4. Legal Basis for Processing — Jurisdiction-Specific</strong>
              </p>

              <p className={styles.legalSubSection}>4.1 European Union — GDPR</p>
              <table className={styles.legalTable}>
                <thead>
                  <tr><th>Legal Basis</th><th>Application</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Art. 6(1)(b) — Contract</td>
                    <td>Processing necessary for the performance of the service agreement.</td>
                  </tr>
                  <tr>
                    <td>Art. 6(1)(a) — Consent</td>
                    <td>Processing of administrator contact data for platform communications.</td>
                  </tr>
                  <tr>
                    <td>Art. 6(1)(f) — Legitimate Interests</td>
                    <td>Processing of publicly available company information for risk assessment.</td>
                  </tr>
                </tbody>
              </table>
              <p className={styles.legalSection} style={{ marginTop: "0.5rem" }}>
                International transfers of EEA personal data to Canada are governed by the European
                Commission&apos;s adequacy decision for Canada under PIPEDA. Where data is processed by
                sub-processors outside Canada or the EEA, Standard Contractual Clauses (SCCs) or
                equivalent safeguards are implemented.
              </p>

              <p className={styles.legalSubSection}>4.2 United States — Applicable Privacy Laws</p>
              <p className={styles.legalSection}>
                DIMA Risk Solutions complies with: CCPA / CPRA (California residents); FTC Act
                Section 5; and applicable state-level privacy laws (Virginia CDPA, Colorado CPA,
                Connecticut CTDPA). We do not sell personal information and do not share it for
                cross-context behavioural advertising. California residents may exercise rights by
                contacting connect@dimarisk.com.
              </p>

              <p className={styles.legalSubSection}>4.3 Canada — PIPEDA and Provincial Privacy Laws</p>
              <p className={styles.legalSection}>
                DIMA Risk Solutions is subject to PIPEDA and PIPA (British Columbia). We comply with
                all ten PIPEDA principles: accountability, identifying purposes, consent, limiting
                collection, limiting use and disclosure, accuracy, safeguards, openness, individual
                access, and challenging compliance. Quebec residents: we comply with Loi 25. A privacy
                impact assessment (PIA) has been conducted for this platform.
              </p>

              <p className={styles.legalSection}>
                <strong>5. How We Use the Information</strong>
                <br />
                We use information exclusively for: provisioning and managing your platform account;
                configuring and executing risk assessments; generating risk reports and compliance gap
                analyses; communicating with the designated administrator; improving risk assessment
                methodologies (anonymised, aggregated data only); and complying with legal obligations.
                We do not use personal data for marketing, profiling, automated decision-making with
                legal effects, or any purpose not described above without explicit consent.
              </p>

              <p className={styles.legalSection}>
                <strong>6. Data Retention</strong>
              </p>
              <table className={styles.legalTable}>
                <thead>
                  <tr><th>Data Category</th><th>Retention Period</th></tr>
                </thead>
                <tbody>
                  <tr><td>Administrator personal data</td><td>Active account + 2 years after termination</td></tr>
                  <tr><td>Company information (public data)</td><td>Active account + 1 year after termination</td></tr>
                  <tr><td>Network scan results</td><td>Active account + 1 year after termination</td></tr>
                  <tr><td>Risk assessment reports</td><td>Active account + 3 years after termination</td></tr>
                  <tr><td>Audit logs</td><td>7 years from creation</td></tr>
                </tbody>
              </table>
              <p className={styles.legalSection} style={{ marginTop: "0.5rem" }}>
                Deletion requests may be submitted to connect@dimarisk.com, subject to overriding
                legal obligations.
              </p>

              <p className={styles.legalSection}>
                <strong>7. Your Rights</strong>
              </p>
              <table className={styles.legalTable}>
                <thead>
                  <tr><th>Right</th><th>Availability</th></tr>
                </thead>
                <tbody>
                  <tr><td>Access — obtain a copy of your personal data</td><td>GDPR · PIPEDA · CCPA · Law 25</td></tr>
                  <tr><td>Correction — rectify inaccurate data</td><td>GDPR · PIPEDA · CPRA · Law 25</td></tr>
                  <tr><td>Deletion — request erasure</td><td>GDPR · CCPA · Law 25 (subject to exceptions)</td></tr>
                  <tr><td>Portability — receive data in machine-readable format</td><td>GDPR · CPRA · Law 25</td></tr>
                  <tr><td>Objection — object to certain processing</td><td>GDPR</td></tr>
                  <tr><td>Withdraw consent</td><td>GDPR · PIPEDA · Law 25</td></tr>
                  <tr><td>Lodge a complaint with a supervisory authority</td><td>GDPR · PIPEDA · Law 25</td></tr>
                </tbody>
              </table>
              <p className={styles.legalSection} style={{ marginTop: "0.5rem" }}>
                To exercise any right, contact our Privacy Officer at connect@dimarisk.com. Response
                times: 30 days (GDPR); 45 days (CCPA); as soon as reasonably practicable (PIPEDA).
              </p>

              <p className={styles.legalSection}>
                <strong>8. Security Measures</strong>
                <br />
                DIMA Risk Solutions implements: encryption in transit (TLS 1.2+) and at rest (AES-256);
                role-based access controls and multi-factor authentication; regular security assessments
                and vulnerability management; incident response procedures compliant with GDPR
                (72-hour), PIPEDA (as soon as feasible), and applicable US state law requirements;
                and staff training on data protection.
              </p>

              <p className={styles.legalSection}>
                <strong>9. Third-Party Sub-Processors</strong>
                <br />
                DIMA Risk Solutions may engage third-party sub-processors (e.g., cloud hosting
                providers). All sub-processors are bound by data processing agreements requiring
                equivalent data protection standards. A list of current sub-processors is available
                upon written request to connect@dimarisk.com.
              </p>

              <p className={styles.legalSection}>
                <strong>10. Changes to This Notice</strong>
                <br />
                DIMA Risk Solutions reserves the right to update this notice to reflect changes in
                applicable law, regulatory guidance, or platform functionality. Material changes will
                be notified to registered administrators by email at least 30 days prior to the
                effective date. Continued use following notification constitutes acceptance.
              </p>

              <p className={styles.legalSection}>
                <strong>11. Contact — Privacy Officer</strong>
                <br />
                DIMA Risk Solutions — Privacy Officer<br />
                Email: connect@dimarisk.com<br />
                Website: dimarisk.com<br />
                Address: Surrey, British Columbia, Canada<br /><br />
                For GDPR inquiries, our EU representative may be contacted at the above address. For
                CCPA requests, include &quot;CCPA Privacy Request&quot; in the subject line. For PIPEDA or
                Law 25 inquiries, reference your province of residence.
              </p>
            </div>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                I have read and understood this Data Collection, Network Scanning &amp; Privacy
                Disclaimer in full. I am authorised to register on behalf of the named organisation,
                consent to data collection and processing as described, and authorise DIMA Risk
                Solutions to perform network scanning of my organisation&apos;s publicly accessible
                infrastructure as described in Section 3.
              </span>
            </label>

            <div className={styles.modalActions}>
              <button
                className={styles.declineButton}
                onClick={() => {
                  setModalOpen(false);
                  setAccepted(false);
                }}
              >
                Decline
              </button>
              <button
                className={styles.acceptButton}
                disabled={!accepted}
                onClick={handleAccept}
              >
                Accept &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
