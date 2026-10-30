"use client";

import { useState } from "react";

type Point = { label: string; value: number };

const W = 640;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 8 };
const COLOR = "#1f57d6";

/**
 * Gráfico de uma série (área para tendência, barras para contagens por dia).
 * Uma série só: o título do cartão a nomeia, sem legenda. Passar o mouse (ou o
 * dedo) mostra o valor; a tabela abaixo é a alternativa acessível.
 */
export function SeriesChart({
  data,
  kind,
  format,
  title,
}: {
  data: Point[];
  kind: "area" | "bar";
  format: "brl" | "int";
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const fmt = (v: number) =>
    format === "brl"
      ? (v / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        })
      : v.toLocaleString("pt-BR");
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = innerW / data.length;
  const x = (i: number) => PAD.left + step * i + step / 2;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const base = PAD.top + innerH;
  const line = data
    .map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`)
    .join(" ");
  const area = `${line} L${x(data.length - 1)},${base} L${x(0)},${base} Z`;
  const active = hover === null ? null : data[hover];
  const labelEvery = Math.ceil(data.length / 6);

  return (
    <figure>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${title}: de ${fmt(data[0]?.value ?? 0)} a ${fmt(data.at(-1)?.value ?? 0)}`}
          onMouseLeave={() => setHover(null)}
        >
          {/* Grade recessiva: só a linha de base e a do máximo. */}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={base}
            y2={base}
            stroke="#e2e8f0"
          />
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top}
            y2={PAD.top}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          {kind === "area" ? (
            <>
              <path d={area} fill={COLOR} fillOpacity={0.12} />
              <path
                d={line}
                fill="none"
                stroke={COLOR}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {active && hover !== null && (
                <>
                  <line
                    x1={x(hover)}
                    x2={x(hover)}
                    y1={PAD.top}
                    y2={base}
                    stroke="#94a3b8"
                  />
                  <circle
                    cx={x(hover)}
                    cy={y(active.value)}
                    r={5}
                    fill={COLOR}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                </>
              )}
            </>
          ) : (
            data.map((d, i) => {
              const barW = Math.max(2, step - 2);
              const h = Math.max(d.value ? 2 : 0, base - y(d.value));
              return (
                <rect
                  key={d.label}
                  x={x(i) - barW / 2}
                  y={base - h}
                  width={barW}
                  height={h}
                  rx={Math.min(4, barW / 2)}
                  fill={COLOR}
                  fillOpacity={hover === null || hover === i ? 1 : 0.45}
                />
              );
            })
          )}
          {data.map((d, i) =>
            // Rótulos contados a partir do fim: o ponto mais recente sempre aparece e nunca colide.
            (data.length - 1 - i) % labelEvery === 0 ? (
              <text
                key={d.label}
                x={x(i)}
                y={H - 6}
                textAnchor="middle"
                fontSize={11}
                fill="#64748b"
              >
                {d.label}
              </text>
            ) : null,
          )}
          {/* Alvos de toque maiores que as marcas. */}
          {data.map((d, i) => (
            <rect
              key={`hit-${d.label}`}
              x={PAD.left + step * i}
              y={0}
              width={step}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
        </svg>
        {active && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: `translateX(${hover > data.length / 2 ? "-105%" : "5%"})`,
            }}
          >
            <span className="block text-slate-300">{active.label}</span>
            <strong>{fmt(active.value)}</strong>
          </div>
        )}
      </div>
      <details className="mt-2 text-xs text-slate-500">
        <summary className="cursor-pointer">Ver em tabela</summary>
        <table className="mt-2 w-full">
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b border-slate-100">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right text-slate-700">
                  {fmt(d.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
