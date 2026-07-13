"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkScanStatus, rescoreWithScan } from "../onboarding/actions";
import styles from "./scanning.module.css";

const SCAN_PHASES = [
  "Connecting to your network...",
  "Enumerating open ports and services...",
  "Analysing DNS configurations...",
  "Evaluating data exfiltration controls...",
  "Checking network segmentation...",
  "Assessing DLP policies...",
  "Inspecting banner disclosure...",
  "Measuring adaptive response...",
  "Cross-correlating findings...",
  "Calculating your technical risk score...",
];

export default function ScanningPage() {
  const router = useRouter();
  const [phase, setPhase] = useState(SCAN_PHASES[0]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const progressRef = useRef(0);
  const phaseIndexRef = useRef(0);

  useEffect(() => {
    // Advance phase message every 8 seconds
    const phaseInterval = setInterval(() => {
      const next = Math.min(phaseIndexRef.current + 1, SCAN_PHASES.length - 1);
      phaseIndexRef.current = next;
      setPhase(SCAN_PHASES[next]);
    }, 8000);

    // Smoothly advance progress bar (never reaches 100 until scan is confirmed done)
    const progressInterval = setInterval(() => {
      progressRef.current = Math.min(progressRef.current + 0.4, 92);
      setProgress(progressRef.current);
    }, 500);

    // Poll for scan completion every 6 seconds
    const pollInterval = setInterval(async () => {
      const { done: scanDone } = await checkScanStatus();
      if (scanDone) {
        clearInterval(phaseInterval);
        clearInterval(progressInterval);
        clearInterval(pollInterval);

        setPhase("Analysis complete — generating your risk profile...");
        setProgress(100);
        setDone(true);

        await rescoreWithScan();
        router.push("/dashboard");
      }
    }, 6000);

    return () => {
      clearInterval(phaseInterval);
      clearInterval(progressInterval);
      clearInterval(pollInterval);
    };
  }, [router]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <img src="/img/logo.svg" alt="DIMA Risk" className={styles.logo} />

        <h1 className={styles.title}>Scanning Your Network</h1>
        <p className={styles.subtitle}>
          Your compliance questionnaire has been saved. While your answers are being analysed,
          DIMA is running a passive technical audit of your network environment.
        </p>

        <div className={styles.scanBox}>
          <div className={styles.pulseRing} />
          <div className={styles.pulseRing2} />
          <div className={styles.scanCore}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" strokeLinecap="round" />
              <path d="M12 8v4l3 3" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <div className={styles.phaseWrap}>
          <p className={styles.phaseText}>{phase}</p>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%`, transition: done ? "width 0.6s ease" : "width 0.5s linear" }}
            />
          </div>
          <span className={styles.progressPct}>{Math.round(progress)}%</span>
        </div>

        <div className={styles.findings}>
          {SCAN_CHECKS.map((check, i) => {
            // Tie each check's state to the progress bar, not the slow phase
            // timer — the scan often completes before the timer climbs, which
            // previously left every step after the first unlit. When done, all
            // steps read complete.
            const completedSteps = done
              ? SCAN_CHECKS.length
              : Math.min(SCAN_CHECKS.length - 1, Math.floor((progress / 100) * SCAN_CHECKS.length));
            const state = i < completedSteps ? styles.findingDone : i === completedSteps ? styles.findingActive : "";
            return (
              <div key={check} className={`${styles.findingRow} ${state}`}>
                <span className={styles.findingDot} />
                <span className={styles.findingLabel}>{check}</span>
              </div>
            );
          })}
        </div>

        <p className={styles.note}>
          This may take a few minutes. Do not close this tab — you will be automatically redirected
          to your dashboard when complete.
        </p>
      </div>
    </main>
  );
}

const SCAN_CHECKS = [
  "Port & service enumeration",
  "DNS filtering controls",
  "Data exfiltration policy",
  "Network segmentation",
  "Banner disclosure",
  "Rate limiting & IDS",
  "DLP effectiveness",
  "Behavioural analysis",
];
