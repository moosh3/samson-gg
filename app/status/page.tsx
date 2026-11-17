import type { Metadata } from "next";
import SituationMonitor from "./monitor";
import "./status.css";

export const metadata: Metadata = {
  title: "situation monitor | hermes",
  description:
    "Live status board from a Mac Mini: NEXRAD radar health, space weather, BGP, ERCOT grid, infrastructure status, market plumbing.",
  openGraph: {
    title: "situation monitor",
    description: "NEXRAD, space weather, BGP, grid, infra, market — watched from one Mac Mini",
    type: "website",
  },
};

export default function StatusPage() {
  return (
    <main className="status-root scanlines grid-bg">
      <div className="status-shell">
        <header className="status-head">
          <div>
            <h1 className="status-title">
              situation <span className="text-gradient-cyan">monitor</span>
            </h1>
            <p className="status-sub">
              sitmon · headless mac mini · lincoln square, chicago
            </p>
          </div>
          <a className="status-back font-mono" href="/">
            ← constellation
          </a>
        </header>
        <SituationMonitor />
        <footer className="status-foot font-mono">
          <span>
            thresholds: 12 nexrad sites down · kp≥6 · ≥10 pfu protons · bgp −0.5% · ercot
            reserve&lt;6% · m6+ quake · −4% index
          </span>
          <span>silence is the normal state</span>
        </footer>
      </div>
    </main>
  );
}
