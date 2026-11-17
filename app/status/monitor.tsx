"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- data shape (mirrors situation_export.py) ---------- */

type Point = { t: string | null; v: number };

type Payload = {
  generated_at: string;
  source_updated: string | null;
  quiet: boolean;
  radar: {
    board: string | null;
    sites: number | null;
    down: string[];
    late: string[];
    down_count: number;
    series: Point[];
    as_of: string | null;
  };
  space: {
    g: number;
    s: number;
    r: number;
    kp: number | null;
    proton: number | null;
    scales_time?: string;
    series: { kp: Point[]; proton: Point[] };
  };
  nws: { extreme_active: number | null; series: Point[] };
  bgp: {
    countries: Record<
      string,
      { prefixes: number; delta_pct_24h: number | null; series: Point[] }
    >;
    as_of: string | null;
    source: string;
  };
  grid: {
    demand?: number;
    available?: number;
    capacity?: number;
    reserve_pct?: number | null;
    updated?: string | null;
    series: Point[];
  };
  quake: { count_24h_m45: number | null; series: Point[] };
  infra: {
    cloudflare?: string;
    github?: string;
    aws?: string;
    azure?: string;
    gcp_open?: number | null;
    faa_ground_stops?: string[];
    kev_total?: number | null;
    kev_24h?: number | null;
  };
  market: {
    halts_today?: number;
    index_etf_halts?: string[];
    halt_wave_max?: number;
    index?: { spx: number | null; ndx: number | null };
    series: { spx: Point[]; ndx: Point[]; halts: Point[] };
  };
  services: {
    as_of: string | null;
    swept: number | null;
    sweep_seconds: number | null;
    spiking_count: number;
    series: Point[];
    items: {
      name: string;
      reports: number | null;
      p90: number | null;
      z: number | null;
      status: string | null;
      since: string | null;
    }[];
  };
  alerts: { t: string; text: string }[];
  thresholds: Record<string, number>;
};

/* ---------- helpers ---------- */

const ARTIFACT = "board-side lag, not an outage";

function amt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function ago(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "unknown";
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m ago` : `${Math.floor(h / 24)}d ago`;
}

type Tone = "ok" | "warn" | "alert" | "idle";

function toneClass(t: Tone) {
  return `tile tile-${t}`;
}

function Sparkline({
  pts,
  invert = false,
  height = 42,
  color,
}: {
  pts: Point[];
  invert?: boolean;
  height?: number;
  color?: string;
}) {
  const w = 240;
  const h = height;
  const path = useMemo(() => {
    if (!pts || pts.length < 2) return "";
    const vs = pts.map((p) => p.v);
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    const span = max - min || 1;
    return pts
      .map((p, i) => {
        const x = (i / (pts.length - 1)) * w;
        const norm = (p.v - min) / span;
        const y = (invert ? norm : 1 - norm) * (h - 4) + 2;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [pts, invert, h]);

  if (!path) {
    return <div className="spark-empty font-mono">no history yet</div>;
  }
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img">
      <path d={path} fill="none" stroke={color || "var(--accent-cyan)"} strokeWidth="1.5" />
    </svg>
  );
}

function Dot({ tone }: { tone: Tone }) {
  return <span className={`dot dot-${tone} ${tone === "alert" ? "animate-glow-pulse" : ""}`} />;
}

/* ---------- monitor ---------- */

export default function SituationMonitor() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/situation.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as Payload;
        if (!cancelled) {
          setData(j);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "fetch failed");
      }
    };
    load();
    timer.current = setInterval(() => {
      load();
      setTick((n) => n + 1);
    }, 60000);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  // tick forces a re-render so "as of Nm ago" ages even if the fetch is cached
  void tick;

  if (!data) {
    return (
      <div className="loading font-mono">
        {err ? `snapshot unavailable (${err})` : "loading snapshot…"}
      </div>
    );
  }

  const th = data.thresholds;
  const radarDown = data.radar.down_count ?? 0;
  const kp = data.space.kp;
  const proton = data.space.proton;
  const reserve = data.grid.reserve_pct ?? null;
  const spx = data.market.index?.spx ?? null;
  const ndx = data.market.index?.ndx ?? null;
  const halts = data.market.halts_today ?? null;
  const wave = data.market.halt_wave_max ?? null;

  const radarTone: Tone = radarDown >= th.radar_down ? "alert" : radarDown >= 6 ? "warn" : "ok";
  const kpTone: Tone = (kp ?? 0) >= th.kp ? "alert" : (kp ?? 0) >= 4 ? "warn" : "ok";
  const protonTone: Tone = (proton ?? 0) >= th.proton_pfu ? "alert" : (proton ?? 0) >= 1 ? "warn" : "ok";
  const gridTone: Tone =
    reserve === null ? "idle" : reserve < th.ercot_reserve_pct ? "alert" : reserve < 15 ? "warn" : "ok";
  const idxTone: Tone =
    spx === null ? "idle" : spx <= th.index_pct ? "alert" : spx <= -2 ? "warn" : "ok";
  const haltTone: Tone = (wave ?? 0) >= th.halt_wave ? "alert" : (halts ?? 0) >= 50 ? "warn" : "ok";
  const nwsTone: Tone =
    (data.nws.extreme_active ?? 0) >= th.nws_extreme_count ? "warn" : "ok";

  const svcItems = data.services.items || [];
  const topSvc = svcItems[0];
  const svcTone: Tone =
    data.services.spiking_count >= 4
      ? "alert"
      : data.services.spiking_count >= 1
      ? "warn"
      : "ok";

  const bgpEntries = Object.entries(data.bgp.countries || {});
  const worstBgp = bgpEntries.reduce<number>(
    (acc, [, v]) => Math.min(acc, v.delta_pct_24h ?? 0),
    0
  );
  const bgpTone: Tone = worstBgp <= -th.bgp_drop_pct ? "alert" : worstBgp <= -0.2 ? "warn" : "ok";

  const infraTone: Tone =
    data.infra.aws === "degraded" || data.infra.azure === "degraded" || (data.infra.gcp_open ?? 0) > 0
      ? "warn"
      : data.infra.cloudflare === "major" || data.infra.cloudflare === "critical" ||
        data.infra.github === "major" || data.infra.github === "critical"
      ? "alert"
      : "ok";

  return (
    <section className="monitor">
      {/* --- kpi row --- */}
      <div className="kpis">
        <div className={toneClass(radarTone)}>
          <div className="tile-label font-mono">
            <Dot tone={radarTone} /> nexrad down
          </div>
          <div className="tile-value">
            {radarDown}
            <span className="tile-unit">/{data.radar.sites ?? "—"}</span>
          </div>
          <div className="tile-note font-mono">
            {radarDown === 0 ? "all sites reporting" : `alert at ${th.radar_down}`}
            {data.radar.late.length ? ` · ${data.radar.late.length} late` : ""}
          </div>
        </div>

        <div className={toneClass(kpTone)}>
          <div className="tile-label font-mono">
            <Dot tone={kpTone} /> kp index
          </div>
          <div className="tile-value">
            {kp === null ? "—" : kp.toFixed(2)}
            <span className="tile-unit">G{data.space.g}</span>
          </div>
          <div className="tile-note font-mono">
            geoscale G{data.space.g} · S{data.space.s} · R{data.space.r}
          </div>
        </div>

        <div className={toneClass(protonTone)}>
          <div className="tile-label font-mono">
            <Dot tone={protonTone} /> protons ≥10mev
          </div>
          <div className="tile-value">
            {proton === null ? "—" : proton.toFixed(2)}
            <span className="tile-unit">pfu</span>
          </div>
          <div className="tile-note font-mono">storm at {th.proton_pfu} pfu</div>
        </div>

        <div className={toneClass(bgpTone)}>
          <div className="tile-label font-mono">
            <Dot tone={bgpTone} /> bgp visibility
          </div>
          <div className="tile-value">
            {bgpEntries.length}
            <span className="tile-unit">countries</span>
          </div>
          <div className="tile-note font-mono">
            worst 24h {worstBgp === 0 ? "flat" : `${worstBgp.toFixed(2)}%`} · ioda
          </div>
        </div>

        <div className={toneClass(gridTone)}>
          <div className="tile-label font-mono">
            <Dot tone={gridTone} /> ercot reserve
          </div>
          <div className="tile-value">
            {reserve === null ? "—" : reserve.toFixed(1)}
            <span className="tile-unit">%</span>
          </div>
          <div className="tile-note font-mono">
            {data.grid.demand ? `${(data.grid.demand / 1000).toFixed(1)} gw demand` : "texas grid"}
          </div>
        </div>

        <div className={toneClass(idxTone)}>
          <div className="tile-label font-mono">
            <Dot tone={idxTone} /> spx / ndx
          </div>
          <div className="tile-value">
            {spx === null ? "—" : `${spx.toFixed(2)}%`}
          </div>
          <div className="tile-note font-mono">
            ndx {ndx === null ? "—" : `${ndx.toFixed(2)}%`} · breaker at −7%
          </div>
        </div>

        <div className={toneClass(haltTone)}>
          <div className="tile-label font-mono">
            <Dot tone={haltTone} /> halts today
          </div>
          <div className="tile-value">{halts === null ? "—" : halts}</div>
          <div className="tile-note font-mono">wave max {wave ?? "—"} · alert at {th.halt_wave}</div>
        </div>

        <div className={toneClass(svcTone)}>
          <div className="tile-label font-mono">
            <Dot tone={svcTone} /> services spiking
          </div>
          <div className="tile-value">
            {data.services.spiking_count}
            <span className="tile-unit">/{data.services.swept ?? "—"}</span>
          </div>
          <div className="tile-note font-mono">
            {topSvc ? `${topSvc.name} ${topSvc.z}x` : "downdetector"} ·{" "}
            {ago(data.services.as_of)}
          </div>
        </div>

        <div className={toneClass(nwsTone)}>
          <div className="tile-label font-mono">
            <Dot tone={nwsTone} /> nws extreme
          </div>
          <div className="tile-value">{data.nws.extreme_active ?? "—"}</div>
          <div className="tile-note font-mono">active extreme-severity alerts</div>
        </div>
      </div>

      {/* --- panels --- */}
      <div className="panels">
        <article className="panel">
          <h2 className="font-mono">nexrad health · 24h</h2>
          <Sparkline pts={data.radar.series} invert color="var(--accent-cyan)" />
          <p className="panel-note font-mono">
            board {data.radar.board ?? "—"} · {amt(data.radar.as_of)}
            {data.radar.down.length ? (
              <>
                <br />
                <span className="down-list">{data.radar.down.join(" ")}</span>
              </>
            ) : null}
          </p>
        </article>

        <article className="panel">
          <h2 className="font-mono">space weather · 24h</h2>
          <Sparkline pts={data.space.series.kp} color="var(--accent-purple)" />
          <div className="spark-caption font-mono">
            kp peak {Math.max(...(data.space.series.kp.map((p) => p.v) || [0])).toFixed(2)}
          </div>
          <Sparkline pts={data.space.series.proton} color="var(--accent-pink)" height={28} />
          <div className="spark-caption font-mono">proton flux pfu</div>
        </article>

        <article className="panel">
          <h2 className="font-mono">bgp prefixes · 24h</h2>
          <div className="bgp-grid">
            {bgpEntries.map(([cc, v]) => (
              <div key={cc} className="bgp-row font-mono">
                <span className="bgp-cc">{cc}</span>
                <span className="bgp-val">{v.prefixes.toLocaleString()}</span>
                <span
                  className={
                    (v.delta_pct_24h ?? 0) <= -th.bgp_drop_pct
                      ? "bgp-delta bad"
                      : (v.delta_pct_24h ?? 0) < 0
                      ? "bgp-delta soft"
                      : "bgp-delta"
                  }
                >
                  {v.delta_pct_24h === null ? "—" : `${v.delta_pct_24h.toFixed(2)}%`}
                </span>
              </div>
            ))}
            {bgpEntries.length === 0 && <div className="bgp-row font-mono">no data</div>}
          </div>
        </article>

        <article className="panel">
          <h2 className="font-mono">grid &amp; market</h2>
          <Sparkline pts={data.grid.series} invert color="var(--accent-green)" height={28} />
          <div className="spark-caption font-mono">
            ercot reserve % · {data.grid.available ? `${(data.grid.available / 1000).toFixed(1)} gw available` : "—"}
          </div>
          <Sparkline pts={data.market.series.spx} color="var(--accent-cyan)" height={28} />
          <div className="spark-caption font-mono">spx intraday %</div>
        </article>

        <article className="panel">
          <h2 className="font-mono">infrastructure</h2>
          <ul className="infra-list font-mono">
            <li>
              <span>cloudflare</span>
              <span className={data.infra.cloudflare === "none" ? "" : "soft"}>{data.infra.cloudflare ?? "—"}</span>
            </li>
            <li>
              <span>github</span>
              <span className={data.infra.github === "none" ? "" : "soft"}>{data.infra.github ?? "—"}</span>
            </li>
            <li>
              <span>aws</span>
              <span className={data.infra.aws === "none" ? "" : "soft"}>{data.infra.aws ?? "—"}</span>
            </li>
            <li>
              <span>azure</span>
              <span className={data.infra.azure === "none" ? "" : "soft"}>{data.infra.azure ?? "—"}</span>
            </li>
            <li>
              <span>gcp incidents</span>
              <span className={(data.infra.gcp_open ?? 0) > 0 ? "soft" : ""}>{data.infra.gcp_open ?? "—"}</span>
            </li>
            <li>
              <span>faa ground stops</span>
              <span>{data.infra.faa_ground_stops?.length ? data.infra.faa_ground_stops.join(" ") : "none"}</span>
            </li>
            <li>
              <span>cisa kev</span>
              <span>
                {data.infra.kev_total ?? "—"}
                {data.infra.kev_24h ? ` (+${data.infra.kev_24h} in 24h)` : ""}
              </span>
            </li>
            <li>
              <span>m4.5+ quakes 24h</span>
              <span>{data.quake.count_24h_m45 ?? "—"}</span>
            </li>
          </ul>
        </article>

        <article className="panel">
          <h2 className="font-mono">service reports · downdetector</h2>
          <Sparkline pts={data.services.series} color="var(--accent-pink)" height={30} />
          <div className="spark-caption font-mono">
            peak spike ratio across {data.services.swept ?? "—"} services ·{" "}
            {data.services.sweep_seconds ? `${data.services.sweep_seconds}s sweep` : "no sweep yet"}
          </div>
          <ul className="svc-list font-mono">
            {svcItems.slice(0, 7).map((s) => {
              const z = s.z ?? 0;
              const hot = z >= (th.service_z ?? 2) && (s.reports ?? 0) >= (th.service_reports ?? 100);
              const w = Math.min(100, (z / 3) * 100);
              return (
                <li key={s.name} className={hot ? "svc-row hot" : "svc-row"}>
                  <span className="svc-name">{s.name}</span>
                  <span className="svc-bar">
                    <i style={{ width: `${Math.max(2, w)}%` }} />
                  </span>
                  <span className="svc-val">
                    {s.reports ?? "—"}
                    <em>{z.toFixed(1)}x</em>
                  </span>
                </li>
              );
            })}
            {svcItems.length === 0 && <li className="svc-row">no sweep data</li>}
          </ul>
        </article>

        <article className="panel">
          <h2 className="font-mono">alert log</h2>
          {data.alerts.length === 0 ? (
            <p className="panel-note quiet-note font-mono">no threshold events. silence is success.</p>
          ) : (
            <ul className="alert-list font-mono">
              {data.alerts.slice(0, 12).map((a, i) => (
                <li key={`${a.t}-${i}`} className={a.text.includes(ARTIFACT) ? "alert-row soft" : "alert-row"}>
                  <span className="alert-t">{amt(a.t)}</span>
                  <span className="alert-x">{a.text}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <div className="status-stamp font-mono">
        <span className={`dot dot-${err ? "alert" : "ok"}`} />
        snapshot {ago(data.generated_at)} · source {ago(data.source_updated)} · refresh 60s
      </div>
    </section>
  );
}
