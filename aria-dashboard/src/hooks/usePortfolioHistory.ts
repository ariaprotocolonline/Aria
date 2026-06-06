import { useEffect, useState, useRef } from 'react';

const STORAGE_KEY    = 'aria-portfolio-history-v2';
const MAX_POINTS     = 360;          // 12 hours at 2-min resolution
const MIN_INTERVAL_MS = 2 * 60_000; // record at most once every 2 minutes

interface HistoryPoint {
  ts:       number;
  weth:     number;
  usdc:     number;
  xstocks:  number;
  totalUsd: number;
}

function loadHistory(): HistoryPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const pts = JSON.parse(raw) as HistoryPoint[];
    // Migrate old points that don't have xstocks field
    return pts.map(p => ({ ...p, xstocks: (p as HistoryPoint & { xstocks?: number }).xstocks ?? 0 }));
  } catch {
    return [];
  }
}

function saveHistory(pts: HistoryPoint[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pts.slice(-MAX_POINTS)));
  } catch { /* ignore quota */ }
}

const RANGE_MS: Record<string, number> = {
  '24H': 86_400_000,
  '7D':  7  * 86_400_000,
  '30D': 30 * 86_400_000,
  '90D': 90 * 86_400_000,
  'ALL': Infinity,
};

function filterByRange(pts: HistoryPoint[], range: string): HistoryPoint[] {
  const ms = RANGE_MS[range] ?? Infinity;
  const since = ms === Infinity ? 0 : Date.now() - ms;
  return pts.filter(p => p.ts >= since);
}

// When we have fewer than 2 real points for a range, synthesise a start point
// at the beginning of the range using the earliest known value.
// This produces an honest flat line — we don't invent movement we don't know about.
function padToTwo(pts: HistoryPoint[], range: string): HistoryPoint[] {
  if (pts.length >= 2) return pts;
  if (pts.length === 0) return [];

  const ms   = RANGE_MS[range] ?? Infinity;
  const startTs = ms === Infinity
    ? pts[0].ts - 86_400_000          // 24 h before only known point
    : Date.now() - ms;
  const synth: HistoryPoint = { ...pts[0], ts: Math.min(startTs, pts[0].ts - 1) };
  return [synth, ...pts];
}

function buildSvgPath(pts: HistoryPoint[], w = 700, h = 280, pad = 20): string {
  if (pts.length < 2) return '';
  const vals = pts.map(p => p.totalUsd);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const rng  = maxV - minV || 1;
  const xs   = pts.map((_, i) => pad + (i / (pts.length - 1)) * (w - pad * 2));
  const ys   = vals.map(v => h - pad - ((v - minV) / rng) * (h - pad * 2));
  // flat line: center vertically when all values are identical
  const flatY = h / 2;
  return pts
    .map((_, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${(maxV === minV ? flatY : ys[i]).toFixed(1)}`)
    .join(' ');
}

function buildFillPath(pts: HistoryPoint[], w = 700, h = 280, pad = 20): string {
  const line = buildSvgPath(pts, w, h, pad);
  if (!line) return '';
  const lastX = (pad + (w - pad * 2)).toFixed(1);
  return `${line} L${lastX},${h} L${pad},${h} Z`;
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

function getXLabels(pts: HistoryPoint[], range: string): string[] {
  if (pts.length < 2) return ['', '', '', '', 'now'];
  const first = pts[0].ts;
  const last  = pts[pts.length - 1].ts;
  return Array.from({ length: 5 }, (_, i) => {
    const ts = first + (i / 4) * (last - first);
    const d  = new Date(ts);
    if (range === '24H')
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
}

function getYLabels(pts: HistoryPoint[]) {
  if (pts.length === 0) return { high: '', midHigh: '', midLow: '', low: '' };
  const vals = pts.map(p => p.totalUsd);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  if (maxV === minV) return { high: fmtUsd(maxV), midHigh: '', midLow: '', low: '' };
  return {
    high:    fmtUsd(maxV),
    midHigh: fmtUsd(minV + (maxV - minV) * 0.66),
    midLow:  fmtUsd(minV + (maxV - minV) * 0.33),
    low:     fmtUsd(minV),
  };
}

// Last Y coordinate for the live dot
function lastYCoord(pts: HistoryPoint[], h = 280, pad = 20): number {
  if (pts.length < 2) return h / 2;
  const vals = pts.map(p => p.totalUsd);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const last = vals[vals.length - 1];
  if (maxV === minV) return h / 2;
  return h - pad - ((last - minV) / (maxV - minV)) * (h - pad * 2);
}

export function usePortfolioHistory(
  wethValue:    number,
  usdcValue:    number,
  ethPrice:     number,
  xstocksValue = 0,
) {
  const [history, setHistory] = useState<HistoryPoint[]>(() => loadHistory());
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    // Wait until we have a real ETH price — otherwise totalUsd is meaningless
    if (ethPrice === 0) return;

    const totalUsd = wethValue * ethPrice + usdcValue + xstocksValue;
    const prev     = historyRef.current;
    const last     = prev[prev.length - 1];
    const now      = Date.now();

    // Throttle: don't record more often than MIN_INTERVAL_MS unless value changed
    const tooSoon    = last && (now - last.ts) < MIN_INTERVAL_MS;
    const unchanged  = last && Math.abs(last.totalUsd - totalUsd) < 0.01;
    if (tooSoon && unchanged) return;

    const newPt: HistoryPoint = { ts: now, weth: wethValue, usdc: usdcValue, xstocks: xstocksValue, totalUsd };
    const updated = [...prev, newPt].slice(-MAX_POINTS);
    saveHistory(updated);
    setHistory(updated);
  }, [wethValue, usdcValue, ethPrice, xstocksValue]);

  function forRange(range: string) {
    const raw  = filterByRange(history, range);
    const pts  = padToTwo(raw, range);
    const dotY = lastYCoord(pts);

    return {
      pts,
      linePath:  buildSvgPath(pts),
      fillPath:  buildFillPath(pts),
      xLabels:   getXLabels(pts, range),
      yLabels:   getYLabels(pts),
      hasData:   pts.length >= 2,
      dotY,
    };
  }

  return { history, forRange };
}
