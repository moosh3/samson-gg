"use client";

import { useEffect, useRef } from "react";
import "./globals.css";

import graphData from "../public/wiki-graph.json";

interface Node {
  id: string;
  hue: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  degree: number;
  alpha: number;
  pulsePhase: number;
}

interface Edge {
  source: string;
  target: string;
}

interface GraphData {
  // Deliberately anonymous public graph: no slugs, titles, paths, or types.
  nodes: Array<{ id: string; hue: number }>;
  edges: Edge[];
}

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
    const degreeById = new Map<string, number>();
    data.edges.forEach(({ source, target }) => {
      degreeById.set(source, (degreeById.get(source) ?? 0) + 1);
      degreeById.set(target, (degreeById.get(target) ?? 0) + 1);
    });

    data.nodes.forEach((n) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * Math.min(width, height) * 0.45;
      const degree = degreeById.get(n.id) ?? 0;
      const node: Node = {
        id: n.id,
        hue: n.hue,
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: 1.8 + Math.min(1.1, Math.log2(degree + 1) * 0.18),
        degree,
        alpha: 0.45 + Math.random() * 0.4,
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
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = 28;
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
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 145;
        // Archive/index nodes can have hundreds of mechanical links. Let those
        // edges suggest structure without pulling the whole field into a hub.
        const edgeWeight = 1 / Math.sqrt(Math.max(a.degree, b.degree, 1));
        const force = (dist - targetDist) * 0.0018 * edgeWeight;
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

      // Edges are the point of the constellation, not background lint.
      // Draw them bright enough to read at a glance while keeping dense clusters breathable.
      ctx.lineWidth = 0.9;
      edges.forEach((e) => {
        const a = e.source;
        const b = e.target;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const densityWeight = 1 / Math.sqrt(Math.max(a.degree, b.degree, 1));
        const opacity = Math.max(0, 1 - dist / 420) * (0.07 + densityWeight * 0.42);

        if (opacity > 0.015) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(119, 171, 200, ${opacity})`;
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

        const color = `hsl(${n.hue} 76% 65%)`;
        const glowColor = `hsla(${n.hue} 82% 70% / ${alpha * 0.52})`;

        // Glow
        if (isHighlighted || pulse > 0.65) {
          const glowSize = r * (isHighlighted ? 6 : 3.5) * (0.8 + pulse * 0.2);
          const grad = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, glowSize);
          grad.addColorStop(0, glowColor);
          grad.addColorStop(1, `hsla(${n.hue} 82% 70% / 0)`);
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
