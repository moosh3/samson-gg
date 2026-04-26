"use client";

import { useEffect, useRef } from "react";
import "./globals.css";

import graphData from "../public/wiki-graph.json";

interface Node {
  id: string;
  slug: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  pulsePhase: number;
}

interface Edge {
  source: string;
  target: string;
}

interface GraphData {
  nodes: Array<{ id: string; slug: string; type: string }>;
  edges: Edge[];
}

const TYPE_COLORS: Record<string, string> = {
  entity: "#22d3ee",   // cyan
  concept: "#a78bfa",  // purple
  comparison: "#f472b6", // pink
  query: "#4ade80",    // green
  raw: "#4b4b5e",      // muted slate
};

const TYPE_GLOW: Record<string, string> = {
  entity: "rgba(34,211,238,",
  concept: "rgba(167,139,250,",
  comparison: "rgba(244,114,182,",
  query: "rgba(74,222,128,",
  raw: "rgba(75,75,94,",
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const nodes: Node[] = [];
    const edges: { source: Node; target: Node }[] = [];
    let time = 0;

    // Initialize from imported JSON
    const data = graphData as GraphData;
    const nodeMap = new Map<string, Node>();

    data.nodes.forEach((n) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * Math.min(width, height) * 0.45;
      const node: Node = {
        id: n.id,
        slug: n.slug,
        type: n.type,
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: n.type === "raw" ? 1.2 : 2.5,
        alpha: n.type === "raw" ? 0.4 + Math.random() * 0.3 : 0.8 + Math.random() * 0.2,
        pulsePhase: Math.random() * Math.PI * 2,
      };
      nodes.push(node);
      nodeMap.set(n.id, node);
    });

    data.edges.forEach((e) => {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (s && t) edges.push({ source: s, target: t });
    });

    // Settle forces
    for (let i = 0; i < 120; i++) {
      applyForces();
    }

    function applyForces() {
      const cx = width / 2;
      const cy = height / 2;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = a.type === "raw" && b.type === "raw" ? 6 : 18;
          if (dist < minDist) {
            const force = ((minDist - dist) / minDist) * 0.5;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }
        }
      }

      // Attraction along edges
      edges.forEach((e) => {
        const a = e.source;
        const b = e.target;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 70;
        const force = (dist - targetDist) * 0.003;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      });

      // Center gravity (weak)
      nodes.forEach((n) => {
        n.vx += (cx - n.x) * 0.00008;
        n.vy += (cy - n.y) * 0.00008;
      });

      // Damping & apply
      nodes.forEach((n) => {
        n.vx *= 0.92;
        n.vy *= 0.92;
        n.x += n.vx;
        n.y += n.vy;

        // Soft walls
        const margin = 20;
        if (n.x < margin) n.x += (margin - n.x) * 0.1;
        if (n.x > width - margin) n.x -= (n.x - (width - margin)) * 0.1;
        if (n.y < margin) n.y += (margin - n.y) * 0.1;
        if (n.y > height - margin) n.y -= (n.y - (height - margin)) * 0.1;
      });
    }

    function draw() {
      if (!ctx) return;
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      // Draw edges
      ctx.lineWidth = 0.5;
      edges.forEach((e) => {
        const a = e.source;
        const b = e.target;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const opacity = Math.max(0, 1 - dist / 300) * 0.2;

        if (opacity > 0.01) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(100,100,120,${opacity})`;
          ctx.stroke();
        }
      });

      // Mouse interaction
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      nodes.forEach((n) => {
        // Gentle drift
        n.x += Math.sin(time * 0.3 + n.pulsePhase) * 0.12;
        n.y += Math.cos(time * 0.2 + n.pulsePhase) * 0.12;

        const pulse = 0.5 + 0.5 * Math.sin(time * 1.5 + n.pulsePhase);
        const baseAlpha = n.alpha;
        const isHighlighted = mx > -100 && Math.hypot(n.x - mx, n.y - my) < 140;

        let r = n.radius;
        let alpha = baseAlpha;

        if (isHighlighted) {
          const d = Math.hypot(n.x - mx, n.y - my);
          const factor = 1 - d / 140;
          r += factor * 2.5;
          alpha = Math.min(1, alpha + factor * 0.5);
        }

        const color = TYPE_COLORS[n.type] || TYPE_COLORS.raw;
        const glowPrefix = TYPE_GLOW[n.type] || TYPE_GLOW.raw;

        // Glow
        if (n.type !== "raw" || isHighlighted) {
          const glowSize = r * (n.type === "raw" ? 4 : 6) * (0.8 + pulse * 0.2);
          const grad = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, glowSize);
          grad.addColorStop(0, `${glowPrefix}${alpha * 0.5})`);
          grad.addColorStop(1, `${glowPrefix}0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowSize, 0, Math.PI * 2);
          ctx.fill();
        }

        // Core
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha * (0.7 + pulse * 0.3);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      if (nodes.length > 0) {
        applyForces();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ display: "block" }}
      />

      {/* Subtle corner mark */}
      <div className="fixed bottom-6 left-6 z-10 font-mono text-xs" style={{ color: "var(--text-muted)", opacity: 0.4 }}>
        samson.gg
      </div>

      {/* Tiny type legend — very faint */}
      <div className="fixed bottom-6 right-6 z-10 flex gap-4 font-mono text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.3 }}>
        <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLORS.entity }} /> entity</span>
        <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLORS.concept }} /> concept</span>
        <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLORS.raw }} /> source</span>
      </div>

      {/* Scanlines */}
      <div
        className="fixed inset-0 pointer-events-none z-20"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
        }}
      />
    </div>
  );
}
