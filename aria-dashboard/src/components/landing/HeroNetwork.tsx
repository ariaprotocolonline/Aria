import { useEffect, useRef } from 'react';

const HUB_COUNT = 6;
const LEAF_COUNT = 14;
const MAX_EDGES_PER_NODE = 3;
const MAX_PARTICLES = 36;

interface Node {
  x: number; y: number; baseX: number; baseY: number;
  hub: boolean; r: number; phase: number;
  driftPhase: number; driftSpeed: number;
}
interface Edge { a: number; b: number; }
interface Particle { e: Edge; t: number; speed: number; }

export default function HeroNetwork({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctxRaw = canvasEl.getContext('2d');
    if (!ctxRaw) return;

    // capture as definitely non-null for all closures
    const el: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = ctxRaw;

    const css = getComputedStyle(document.documentElement);
    const accentStr = (css.getPropertyValue('--accent') || '#75e5b0').trim();

    function parseColor(str: string): [number, number, number] {
      if (str.startsWith('#')) {
        const v = str.length === 7 ? str.slice(1) : str[1]+str[1]+str[2]+str[2]+str[3]+str[3];
        return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)];
      }
      const m = str.match(/(\d+(\.\d+)?)/g);
      return m ? [+m[0], +m[1], +m[2]] : [117, 229, 176];
    }
    const [R, G, B] = parseColor(accentStr);
    const rgba = (a: number) => `rgba(${R},${G},${B},${a})`;

    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let particles: Particle[] = [];
    let running = true;
    let visible = true;
    let last = performance.now();
    let rafId = 0;

    function buildGraph() {
      nodes = []; edges = []; particles = [];
      const cx = W / 2, cy = H / 2;
      const radius = Math.min(W, H) * 0.42;

      for (let i = 0; i < HUB_COUNT; i++) {
        const angle = (i / HUB_COUNT) * Math.PI * 2 + Math.random() * 0.3;
        const r = radius * (0.55 + Math.random() * 0.35);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r * 0.7;
        nodes.push({ x, y, baseX: x, baseY: y, hub: true, r: 3 + Math.random() * 1.4, phase: Math.random() * Math.PI * 2, driftPhase: Math.random() * Math.PI * 2, driftSpeed: 0.3 + Math.random() * 0.4 });
      }
      for (let i = 0; i < LEAF_COUNT; i++) {
        const nx = Math.random() * W;
        const ny = Math.random() * H;
        nodes.push({ x: nx, y: ny, baseX: nx, baseY: ny, hub: false, r: 1.2 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2, driftPhase: Math.random() * Math.PI * 2, driftSpeed: 0.2 + Math.random() * 0.3 });
      }

      for (let i = 0; i < nodes.length; i++) {
        const na = nodes[i];
        const dists = nodes.map((nb, j) => {
          if (i === j) return { j, d: Infinity };
          const dx = na.x - nb.x, dy = na.y - nb.y;
          return { j, d: dx*dx + dy*dy };
        }).sort((p, q) => p.d - q.d);
        const wanted = na.hub ? MAX_EDGES_PER_NODE : 2;
        for (let k = 0; k < Math.min(wanted, dists.length); k++) {
          const { j } = dists[k];
          if (!edges.find(e => (e.a === i && e.b === j) || (e.a === j && e.b === i))) {
            edges.push({ a: i, b: j });
          }
        }
      }
    }

    function resize() {
      const rect = el.getBoundingClientRect();
      W = rect.width; H = rect.height;
      el.width = W * DPR; el.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildGraph();
    }

    function spawnParticle() {
      if (particles.length >= MAX_PARTICLES) return;
      const e = edges[Math.floor(Math.random() * edges.length)];
      if (!e) return;
      particles.push({ e, t: 0, speed: 0.18 + Math.random() * 0.22 });
    }

    function step(now: number) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, W, H);

      const t = now / 1000;
      for (const n of nodes) {
        const drift = n.hub ? 6 : 4;
        n.x = n.baseX + Math.sin(t * n.driftSpeed + n.driftPhase) * drift;
        n.y = n.baseY + Math.cos(t * n.driftSpeed * 0.85 + n.driftPhase) * drift;
      }

      ctx.lineWidth = 1;
      for (const e of edges) {
        const na = nodes[e.a], nb = nodes[e.b];
        const grad = ctx.createLinearGradient(na.x, na.y, nb.x, nb.y);
        grad.addColorStop(0, rgba(0.08)); grad.addColorStop(0.5, rgba(0.16)); grad.addColorStop(1, rgba(0.08));
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y); ctx.stroke();
      }

      if (Math.random() < 0.6) spawnParticle();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.t += p.speed * dt;
        if (p.t >= 1) { particles.splice(i, 1); continue; }
        const na = nodes[p.e.a], nb = nodes[p.e.b];
        const px = na.x + (nb.x - na.x) * p.t;
        const py = na.y + (nb.y - na.y) * p.t;
        const tx = na.x + (nb.x - na.x) * Math.max(0, p.t - 0.12);
        const ty = na.y + (nb.y - na.y) * Math.max(0, p.t - 0.12);
        const trail = ctx.createLinearGradient(tx, ty, px, py);
        trail.addColorStop(0, rgba(0)); trail.addColorStop(1, rgba(0.7));
        ctx.strokeStyle = trail; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
        const pr = 2.4;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, pr * 4);
        glow.addColorStop(0, rgba(0.9)); glow.addColorStop(0.4, rgba(0.35)); glow.addColorStop(1, rgba(0));
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, pr * 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(1); ctx.beginPath(); ctx.arc(px, py, pr * 0.6, 0, Math.PI * 2); ctx.fill();
      }

      for (const n of nodes) {
        const pulse = (Math.sin(t * 1.4 + n.phase) + 1) / 2;
        if (n.hub) {
          const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6);
          halo.addColorStop(0, rgba(0.35 * (0.6 + 0.4 * pulse)));
          halo.addColorStop(0.4, rgba(0.12 * (0.6 + 0.4 * pulse)));
          halo.addColorStop(1, rgba(0));
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = rgba(n.hub ? 0.95 : 0.55);
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }

      rafId = requestAnimationFrame(step);
    }

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
      } else if (visible) {
        running = true; last = performance.now(); rafId = requestAnimationFrame(step);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden && !running) {
        running = true; last = performance.now(); rafId = requestAnimationFrame(step);
      } else if (!visible) {
        running = false;
      }
    });
    io.observe(el);

    const onResize = () => { DPR = Math.min(window.devicePixelRatio || 1, 2); resize(); };
    window.addEventListener('resize', onResize);

    resize();
    last = performance.now();
    rafId = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`lp-hero-network ${className}`}
      aria-hidden="true"
    />
  );
}
