'use client';

import React from 'react';
import { useTooltip, Tooltip, TipRow, Legend } from '@/components/chart-kit';

export type FloorPlanStatus = 'good' | 'warning' | 'critical' | 'none';

export interface FloorPlanBlock {
  /** Block id, e.g. "A1" — must match BLOCKS in @/lib/data. */
  id: string;
  status: FloorPlanStatus;
  qualityCount: number;
  pages: number;
}

/**
 * Schematic (not to-scale) site diagram, not a real CAD floor plan — there's
 * no surveyed layout in the archive, only block ids. Blocks are arranged by
 * naming group (A1-A6 apartment blocks, G1-G4, C1) into a simple three-row
 * grid so relative position is legible; it does not represent true
 * geographic placement on the site.
 */
const ROWS: string[][] = [
  ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
  ['G1', 'G2', 'G3', 'G4'],
  ['C1'],
];

const CELL_W = 90;
const CELL_H = 64;
const GAP = 12;
const ROW_GAP = 28;

const STATUS_COLOR: Record<FloorPlanStatus, string> = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-critical)',
  none: 'var(--seq-zero)',
};

const STATUS_LABEL: Record<FloorPlanStatus, string> = {
  good: 'Баримтжуулалттай, зөрчилгүй',
  warning: 'Баримтжуулалт дутуу',
  critical: 'Чанарын зөрчилтэй',
  none: 'Мэдээлэл алга',
};

function rowWidth(row: string[]): number {
  return row.length * CELL_W + (row.length - 1) * GAP;
}

export function FloorPlan({ blocks }: { blocks: FloorPlanBlock[] }) {
  const { tip, ref, show, hide } = useTooltip();
  const byId = new Map(blocks.map((b) => [b.id, b]));

  const maxWidth = Math.max(...ROWS.map(rowWidth));
  const width = maxWidth;
  const height = ROWS.length * CELL_H + (ROWS.length - 1) * ROW_GAP;

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxWidth: 480 }}>
        {ROWS.map((row, ri) => {
          const y = ri * (CELL_H + ROW_GAP);
          const offsetX = (width - rowWidth(row)) / 2;
          return (
            <g key={ri}>
              {row.map((id, ci) => {
                const x = offsetX + ci * (CELL_W + GAP);
                const block = byId.get(id);
                const status = block?.status ?? 'none';
                return (
                  <g
                    key={id}
                    onMouseMove={(e) =>
                      show(
                        e,
                        <div className="space-y-1">
                          <div className="font-medium">{id}</div>
                          <TipRow label="Төлөв" value={STATUS_LABEL[status]} color={STATUS_COLOR[status]} />
                          <TipRow label="Чанарын зөрчил" value={String(block?.qualityCount ?? 0)} />
                          <TipRow label="Зургийн хуудас" value={String(block?.pages ?? 0)} />
                        </div>,
                      )
                    }
                    onMouseLeave={hide}
                  >
                    <rect
                      x={x} y={y} width={CELL_W} height={CELL_H} rx={8}
                      fill={STATUS_COLOR[status]} fillOpacity={0.22}
                      stroke={STATUS_COLOR[status]} strokeWidth={1.5}
                    />
                    <text
                      x={x + CELL_W / 2} y={y + CELL_H / 2 - 4}
                      textAnchor="middle" fontSize={15} fontWeight={600}
                      fill="var(--text-primary)"
                    >
                      {id}
                    </text>
                    <text
                      x={x + CELL_W / 2} y={y + CELL_H / 2 + 14}
                      textAnchor="middle" fontSize={10} className="tnum"
                      fill="var(--text-muted)"
                    >
                      {block?.qualityCount ? `${block.qualityCount} зөрчил` : `${block?.pages ?? 0} хуудас`}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <Legend
        className="mt-3"
        items={(['good', 'warning', 'critical'] as const).map((s) => ({
          label: STATUS_LABEL[s], color: STATUS_COLOR[s],
        }))}
      />
      <Tooltip tip={tip} width={480} />
    </div>
  );
}
