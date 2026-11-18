import { useState } from 'react';
import type {
  CellAtlasItem,
  TissueExpressionPoint,
  PathwayEnrichmentPoint,
  LigandReceptorEdge,
  ShapFeatureContribution,
} from '../../types/dossier';

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1)}…`;
}

/* ============================================================================
 * 1A. Cell Atlas 2D UMAP Cluster Map (Single-Cell Disease Activity Map)
 * ========================================================================== */
export function CellAtlasUmapPlot({
  populations,
  geneSymbol,
}: {
  populations: CellAtlasItem[];
  geneSymbol: string;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const items = populations.slice(0, 7);
  if (items.length === 0) return null;

  const width = 560;
  const height = 250;
  const padX = 48;
  const padY = 28;

  const xs = items.map((p, idx) => (Number.isFinite(p.umapX) ? p.umapX : (idx - 3) * 2.2));
  const ys = items.map((p, idx) => (Number.isFinite(p.umapY) ? p.umapY : ((idx % 2) - 0.5) * 4));
  const minX = Math.min(-8, ...xs);
  const maxX = Math.max(8, ...xs);
  const minY = Math.min(-8, ...ys);
  const maxY = Math.max(8, ...ys);

  const toSvgX = (x: number) =>
    padX + ((x - minX) / Math.max(1, maxX - minX)) * (width - padX * 2);
  const toSvgY = (y: number) =>
    height - padY - ((y - minY) / Math.max(1, maxY - minY)) * (height - padY * 2);

  const active = items[selectedIdx] ?? items[0];

  const getStatusColor = (status: CellAtlasItem['status']) => {
    if (status === 'Hyperactive' || status === 'Altered') return '#EC4899'; // Vivid Rose-Pink
    if (status === 'Suppressed') return '#F9A8D4'; // Soft Blush Pink
    return '#9D7B91'; // Muted Mauve
  };

  return (
    <div className="rounded-md border border-[#311C33] bg-[#110A11] p-4 space-y-3" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#311C33] pb-2.5">
        <div className="text-xs font-medium text-[#A98CA0]">
          Single-Cell UMAP Niche Map — <span className="font-mono text-[#F472B6]">{geneSymbol}</span> Activity
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-[#A98CA0]">
          <span><span className="text-[#EC4899]">●</span> Altered / Hyperactive</span>
          <span><span className="text-[#F9A8D4]">●</span> Suppressed</span>
          <span><span className="text-[#9D7B91]">●</span> Homeostatic</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[400px] h-auto select-none cursor-crosshair"
          role="img"
          aria-label="Single-cell UMAP microenvironment cluster projection"
        >
          <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#311C33" />
          <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="#311C33" />
          <text
            x={width / 2}
            y={height - 6}
            textAnchor="middle"
            fill="#7E6174"
            fontSize="9.5"
            fontFamily="JetBrains Mono, monospace"
          >
            UMAP_1
          </text>
          <text
            x={16}
            y={height / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${height / 2})`}
            fill="#7E6174"
            fontSize="9.5"
            fontFamily="JetBrains Mono, monospace"
          >
            UMAP_2
          </text>

          {items.map((item, idx) => {
            const cx = toSvgX(xs[idx]);
            const cy = toSvgY(ys[idx]);
            const expr = Number.isFinite(item.geneExpression) ? item.geneExpression : 5;
            const r = 10 + Math.min(14, Math.max(0, expr) * 1.3);
            const color = getStatusColor(item.status);
            const isSelected = idx === selectedIdx;

            return (
              <g
                key={item.cellType}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => setSelectedIdx(idx)}
                className="cursor-pointer"
              >
                <circle cx={cx} cy={cy} r={r + 12} fill={color} fillOpacity={isSelected ? 0.16 : 0.05} />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={color}
                  fillOpacity={isSelected ? 0.38 : 0.2}
                  stroke={color}
                  strokeWidth={isSelected ? 2 : 1.2}
                />
                <circle cx={cx} cy={cy} r={3} fill={color} />
                <text
                  x={cx}
                  y={cy - r - 6}
                  textAnchor="middle"
                  fill={isSelected ? '#FAF2F7' : '#A98CA0'}
                  fontSize="10"
                  fontFamily="IBM Plex Sans, sans-serif"
                >
                  {truncateLabel(item.cellType, 18)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {active && (
        <div className="rounded border border-[#311C33] bg-[#0B070B] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] mb-1">
            <span className="text-[#FAF2F7] font-semibold">
              {active.cellType} · {active.lineage}
            </span>
            <span style={{ color: getStatusColor(active.status) }}>
              {active.status} · Perturbation {active.perturbationScore.toFixed(1)} · Expr {(active.geneExpression ?? 0).toFixed(1)}
            </span>
          </div>
          <p className="text-[#A98CA0] leading-relaxed">{active.dysregulationSummary}</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 1B. Cell Atlas Perturbation & Abundance Shift Plot
 * ========================================================================== */
export function CellAtlasPerturbationPlot({ populations }: { populations: CellAtlasItem[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const items = populations.slice(0, 7);
  if (items.length === 0) return null;

  const active = hoveredIdx !== null ? items[hoveredIdx] : items[0];

  return (
    <div className="rounded-md border border-[#311C33] bg-[#110A11] p-4 space-y-3" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#311C33] pb-2.5">
        <div className="text-xs font-medium text-[#A98CA0]">
          Transcriptional Perturbation Index &amp; Lesion Abundance Shift
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-[#A98CA0]">
          <span>
            <span className="text-[#EC4899]">■</span> Perturbation (0–100)
          </span>
          <span>
            <span className="text-[#FDA4AF]">◆</span> Abundance Δ%
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {items.map((item, idx) => {
          const isHovered = hoveredIdx === idx;
          const clampedPerturb = Math.max(0, Math.min(100, item.perturbationScore));
          const deltaText = `${item.abundanceDeltaPct >= 0 ? '+' : ''}${item.abundanceDeltaPct.toFixed(1)}%`;
          return (
            <button
              key={item.cellType}
              type="button"
              onMouseEnter={() => setHoveredIdx(idx)}
              onFocus={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`block w-full rounded px-2 py-1.5 text-left transition-colors cursor-crosshair ${
                isHovered ? 'bg-[#1F1221]' : 'hover:bg-[#190E1B]'
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-xs mb-1">
                <span className="font-medium text-[#FAF2F7] truncate">{item.cellType}</span>
                <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] tabular-nums">
                  <span className="text-[#F472B6]">{clampedPerturb.toFixed(1)} idx</span>
                  <span className={item.abundanceDeltaPct >= 0 ? 'text-[#FDA4AF]' : 'text-[#A98CA0]'}>
                    {deltaText}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-sm bg-[#1D0F1E] overflow-hidden">
                <div
                  className="h-full bg-[#EC4899] transition-all duration-200"
                  style={{ width: `${clampedPerturb}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="rounded border border-[#311C33] bg-[#0B070B] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[#F472B6] mb-1">
            <span>{active.cellType} · {active.lineage}</span>
            <span>Perturbation: {active.perturbationScore.toFixed(1)} · Shift: {active.abundanceDeltaPct >= 0 ? '+' : ''}{active.abundanceDeltaPct.toFixed(1)}%</span>
          </div>
          <p className="text-[#A98CA0] leading-relaxed">{active.dysregulationSummary}</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 2. Tissue-State & Cell-Lineage Expression Plot (Healthy vs Eutopic vs Ectopic)
 * ========================================================================== */
export function TissueExpressionPlot({ profiles }: { profiles: TissueExpressionPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const items = profiles.slice(0, 6);
  if (items.length === 0) return null;

  const maxVal = Math.max(
    10,
    ...items.flatMap((p) => [p.healthyCpm, p.eutopicCpm, p.ectopicCpm])
  );
  const width = 680;
  const rowHeight = 44;
  const padLeft = 185;
  const padRight = 84;
  const padTop = 26;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const height = padTop + items.length * rowHeight + padBottom;
  const scaleX = (val: number) => padLeft + (Math.max(0, val) / maxVal) * plotW;

  const active = hoveredIdx !== null ? items[hoveredIdx] : items[0];

  return (
    <div className="rounded-md border border-[#311C33] bg-[#110A11] p-4 space-y-3" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#311C33] pb-2.5">
        <div className="text-xs font-medium text-[#A98CA0]">
          Cell-Resolved Expression Profile — log2(CPM + 1)
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-[#A98CA0]">
          <span><span className="text-[#FBCFE8]">●</span> Healthy</span>
          <span><span className="text-[#A98CA0]">●</span> Eutopic</span>
          <span><span className="text-[#EC4899]">●</span> Ectopic Lesion</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[480px] h-auto select-none cursor-crosshair"
          role="img"
          aria-label="Healthy versus Eutopic versus Ectopic cell expression chart"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const val = t * maxVal;
            const x = scaleX(val);
            return (
              <g key={t}>
                <line
                  x1={x}
                  y1={padTop - 6}
                  x2={x}
                  y2={height - padBottom}
                  stroke="#311C33"
                  strokeDasharray="2 3"
                />
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fill="#7E6174"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {items.map((row, idx) => {
            const y = padTop + idx * rowHeight + rowHeight / 2;
            const xH = scaleX(row.healthyCpm);
            const xEu = scaleX(row.eutopicCpm);
            const xEc = scaleX(row.ectopicCpm);
            const minX = Math.min(xH, xEu, xEc);
            const maxX = Math.max(xH, xEu, xEc);
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={row.cellType}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <rect
                  x={0}
                  y={y - rowHeight / 2}
                  width={width}
                  height={rowHeight}
                  fill={isHovered ? '#1F1221' : 'transparent'}
                />
                <text
                  x={padLeft - 12}
                  y={y + 4}
                  textAnchor="end"
                  fill={isHovered ? '#FAF2F7' : '#DFCBD8'}
                  fontSize="11"
                  fontFamily="IBM Plex Sans, sans-serif"
                >
                  {truncateLabel(row.cellType, 25)}
                </text>

                <line x1={minX} y1={y} x2={maxX} y2={y} stroke="#4D2C50" strokeWidth={2} />

                <circle cx={xH} cy={y} r={5} fill="#FBCFE8" />
                <circle cx={xEu} cy={y} r={4.5} fill="#A98CA0" />
                <circle cx={xEc} cy={y} r={5.5} fill="#EC4899" />

                <text
                  x={width - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill={row.log2FoldChange >= 0 ? '#EC4899' : '#F9A8D4'}
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {row.log2FoldChange >= 0 ? '+' : ''}
                  {row.log2FoldChange.toFixed(2)} FC
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {active && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#311C33] bg-[#0B070B] px-3 py-2 font-mono text-[11px] tabular-nums">
          <span className="text-[#FAF2F7] font-semibold">{active.cellType}</span>
          <div className="flex flex-wrap items-center gap-4 text-[#A98CA0]">
            <span>Healthy: <strong className="text-[#FBCFE8]">{active.healthyCpm.toFixed(2)}</strong></span>
            <span>Eutopic: <strong className="text-[#DFCBD8]">{active.eutopicCpm.toFixed(2)}</strong></span>
            <span>Ectopic: <strong className="text-[#EC4899]">{active.ectopicCpm.toFixed(2)}</strong></span>
            <span>adj.P: <strong className="text-[#FAF2F7]">{active.adjustedPValue}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 3. Pathway Functional Enrichment Lollipop Plot (NES & -log10 FDR)
 * ========================================================================== */
export function PathwayEnrichmentPlot({ results }: { results: PathwayEnrichmentPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const items = results.slice(0, 6);
  if (items.length === 0) return null;

  const maxAbsNes = Math.max(2.5, ...items.map((r) => Math.abs(r.nesScore)));
  const active = hoveredIdx !== null ? items[hoveredIdx] : items[0];

  return (
    <div className="rounded-md border border-[#311C33] bg-[#110A11] p-4 space-y-3" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#311C33] pb-2.5">
        <div className="text-xs font-medium text-[#A98CA0]">
          Normalized Enrichment Score (NES) &amp; Statistical Significance (-log10 FDR)
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-[#A98CA0]">
          <span><span className="text-[#EC4899]">●</span> Activated</span>
          <span><span className="text-[#F9A8D4]">●</span> Suppressed</span>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          const isHovered = hoveredIdx === idx;
          const isPositive = item.nesScore >= 0;
          const pct = Math.min(48, (Math.abs(item.nesScore) / maxAbsNes) * 48);
          const barColor = isPositive ? 'bg-[#EC4899]' : 'bg-[#F9A8D4]';

          return (
            <button
              key={item.pathwayName}
              type="button"
              onMouseEnter={() => setHoveredIdx(idx)}
              onFocus={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`block w-full rounded px-2 py-1.5 text-left transition-colors cursor-crosshair ${
                isHovered ? 'bg-[#1F1221]' : 'hover:bg-[#190E1B]'
              }`}
            >
              <div className="grid grid-cols-12 items-center gap-3 text-xs">
                <div className="col-span-5 truncate text-[#FAF2F7] font-medium">
                  {item.pathwayName}
                </div>
                <div className="col-span-5 relative h-4 flex items-center">
                  <div className="w-full h-[1px] bg-[#311C33]" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[#4D2C50]" />
                  <div
                    className={`absolute h-2 rounded-sm ${barColor}`}
                    style={
                      isPositive
                        ? { left: '50%', width: `${pct}%` }
                        : { right: '50%', width: `${pct}%` }
                    }
                  />
                </div>
                <div className="col-span-2 text-right font-mono text-[11px] tabular-nums text-[#A98CA0]">
                  <span className={isPositive ? 'text-[#EC4899]' : 'text-[#F9A8D4]'}>
                    {item.nesScore >= 0 ? '+' : ''}
                    {item.nesScore.toFixed(2)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="rounded border border-[#311C33] bg-[#0B070B] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] mb-1">
            <span className="text-[#FAF2F7] font-semibold">
              {active.pathwayName} · {active.category}
            </span>
            <span className="text-[#F472B6]">
              NES: {active.nesScore >= 0 ? '+' : ''}{active.nesScore.toFixed(2)} · -log10(FDR): {active.negLog10Fdr.toFixed(2)}
            </span>
          </div>
          <p className="text-[#A98CA0] leading-relaxed">{active.mechanisticRole}</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 4. Bipartite Ligand-Receptor Cell Communication Diagram
 * ========================================================================== */
export function LigandReceptorNetworkPlot({ edges }: { edges: LigandReceptorEdge[] }) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const items = edges.slice(0, 6);
  if (items.length === 0) return null;

  const senders = Array.from(new Set(items.map((e) => e.senderCell)));
  const receivers = Array.from(new Set(items.map((e) => e.receiverCell)));
  const maxNodes = Math.max(senders.length, receivers.length, 2);
  const width = 680;
  const height = Math.max(210, maxNodes * 44 + 40);

  const senderY = (cell: string) => {
    const i = senders.indexOf(cell);
    return 32 + ((i + 0.5) / senders.length) * (height - 52);
  };
  const receiverY = (cell: string) => {
    const i = receivers.indexOf(cell);
    return 32 + ((i + 0.5) / receivers.length) * (height - 52);
  };

  const active = items[selectedIdx] ?? items[0];

  return (
    <div className="rounded-md border border-[#311C33] bg-[#110A11] p-4 space-y-3" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#311C33] pb-2.5">
        <div className="text-xs font-medium text-[#A98CA0]">
          Directional Paracrine &amp; Autocrine Crosstalk Map (Hover or click edge to inspect)
        </div>
        <div className="font-mono text-[11px] text-[#F472B6]">
          Sender → Ligand / Receptor → Receiver
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[480px] h-auto select-none"
          role="img"
          aria-label="Ligand-Receptor cell-cell communication network"
        >
          <text x={18} y={18} fill="#7E6174" fontSize="10" fontFamily="JetBrains Mono, monospace">
            SENDER POPULATION
          </text>
          <text
            x={width - 18}
            y={18}
            textAnchor="end"
            fill="#7E6174"
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
          >
            RECEIVER POPULATION
          </text>

          {items.map((edge, idx) => {
            const y1 = senderY(edge.senderCell);
            const y2 = receiverY(edge.receiverCell);
            const x1 = 195;
            const x2 = width - 195;
            const isSelected = idx === selectedIdx;
            const strokeW = 1.5 + edge.interactionWeight * 3.5;

            return (
              <g
                key={`${edge.senderCell}-${edge.ligand}-${edge.receptor}-${edge.receiverCell}-${idx}`}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => setSelectedIdx(idx)}
                className="cursor-pointer"
              >
                <path
                  d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isSelected ? '#EC4899' : '#F472B6'}
                  strokeOpacity={isSelected ? 0.95 : 0.32}
                  strokeWidth={strokeW}
                />
                {isSelected && (
                  <g>
                    <rect
                      x={(x1 + x2) / 2 - 74}
                      y={(y1 + y2) / 2 - 11}
                      width={148}
                      height={22}
                      rx={4}
                      fill="#0B070B"
                      stroke="#EC4899"
                      strokeWidth={1}
                    />
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 + 3.5}
                      textAnchor="middle"
                      fill="#FAF2F7"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {truncateLabel(`${edge.ligand} → ${edge.receptor}`, 20)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {senders.map((cell) => {
            const y = senderY(cell);
            const isActive = active.senderCell === cell;
            return (
              <g key={`s-${cell}`}>
                <rect
                  x={16}
                  y={y - 14}
                  width={175}
                  height={28}
                  rx={4}
                  fill="#160D17"
                  stroke={isActive ? '#EC4899' : '#311C33'}
                />
                <text
                  x={26}
                  y={y + 4}
                  fill="#FAF2F7"
                  fontSize="11"
                  fontFamily="IBM Plex Sans, sans-serif"
                >
                  {truncateLabel(cell, 22)}
                </text>
                <circle cx={195} cy={y} r={4} fill={isActive ? '#EC4899' : '#F9A8D4'} />
              </g>
            );
          })}

          {receivers.map((cell) => {
            const y = receiverY(cell);
            const isActive = active.receiverCell === cell;
            return (
              <g key={`r-${cell}`}>
                <rect
                  x={width - 191}
                  y={y - 14}
                  width={175}
                  height={28}
                  rx={4}
                  fill="#160D17"
                  stroke={isActive ? '#EC4899' : '#311C33'}
                />
                <text
                  x={width - 26}
                  y={y + 4}
                  textAnchor="end"
                  fill="#FAF2F7"
                  fontSize="11"
                  fontFamily="IBM Plex Sans, sans-serif"
                >
                  {truncateLabel(cell, 22)}
                </text>
                <circle cx={width - 195} cy={y} r={4} fill={isActive ? '#EC4899' : '#F9A8D4'} />
              </g>
            );
          })}
        </svg>
      </div>

      {active && (
        <div className="rounded border border-[#311C33] bg-[#0B070B] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] mb-1">
            <span className="text-[#F472B6] font-semibold">
              {active.senderCell} [{active.ligand}] → [{active.receptor}] {active.receiverCell}
            </span>
            <span className="text-[#FBCFE8]">
              Weight: {active.interactionWeight.toFixed(2)} · {active.signalingAxis}
            </span>
          </div>
          <p className="text-[#A98CA0] leading-relaxed">{active.pathologicalEffect}</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 5. SHAP Feature Attribution Waterfall Plot
 * ========================================================================== */
export function ShapWaterfallPlot({ contributions }: { contributions: ShapFeatureContribution[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const items = contributions.slice(0, 6);
  if (items.length === 0) return null;

  const maxAbs = Math.max(0.4, ...items.map((c) => Math.abs(c.shapImpact)));
  const active = hoveredIdx !== null ? items[hoveredIdx] : items[0];

  return (
    <div className="rounded-md border border-[#311C33] bg-[#110A11] p-4 space-y-3" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#311C33] pb-2.5">
        <div className="text-xs font-medium text-[#A98CA0]">
          SHAP Feature Attribution (Log-Odds Contribution Toward Ectopic Disease State)
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-[#A98CA0]">
          <span><span className="text-[#EC4899]">■</span> Pro-Lesion (+SHAP)</span>
          <span><span className="text-[#F9A8D4]">■</span> Protective (-SHAP)</span>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          const isHovered = hoveredIdx === idx;
          const isPositive = item.shapImpact >= 0;
          const pct = Math.min(48, (Math.abs(item.shapImpact) / maxAbs) * 48);

          return (
            <button
              key={item.featureName}
              type="button"
              onMouseEnter={() => setHoveredIdx(idx)}
              onFocus={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`block w-full rounded px-2 py-1.5 text-left transition-colors cursor-crosshair ${
                isHovered ? 'bg-[#1F1221]' : 'hover:bg-[#190E1B]'
              }`}
            >
              <div className="grid grid-cols-12 items-center gap-3 text-xs">
                <div className="col-span-5 truncate font-mono text-[#FAF2F7]">
                  {item.featureName}
                </div>
                <div className="col-span-5 relative h-4 flex items-center">
                  <div className="w-full h-[1px] bg-[#311C33]" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[#4D2C50]" />
                  <div
                    className={`absolute h-2.5 rounded-sm ${
                      isPositive ? 'bg-[#EC4899]' : 'bg-[#F9A8D4]'
                    }`}
                    style={
                      isPositive
                        ? { left: '50%', width: `${pct}%` }
                        : { right: '50%', width: `${pct}%` }
                    }
                  />
                </div>
                <div className="col-span-2 text-right font-mono text-[11px] tabular-nums">
                  <span className={isPositive ? 'text-[#EC4899]' : 'text-[#F9A8D4]'}>
                    {item.shapImpact >= 0 ? '+' : ''}
                    {item.shapImpact.toFixed(3)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="rounded border border-[#311C33] bg-[#0B070B] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] mb-1">
            <span className="text-[#FAF2F7] font-semibold">{active.featureName}</span>
            <span className={active.shapImpact >= 0 ? 'text-[#EC4899]' : 'text-[#F9A8D4]'}>
              {active.direction} · SHAP: {active.shapImpact >= 0 ? '+' : ''}{active.shapImpact.toFixed(3)}
            </span>
          </div>
          <p className="text-[#A98CA0] leading-relaxed">{active.biologicalInterpretation}</p>
        </div>
      )}
    </div>
  );
}
