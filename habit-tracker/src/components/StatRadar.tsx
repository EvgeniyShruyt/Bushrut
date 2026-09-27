'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

export type RadarPoint = { stat: string; value: number };

/**
 * Радар статов — визуализация баланса (раздел 4.2 ТЗ). Осознанно без «штрафов»:
 * перекос показывается, но ни на что не влияет.
 */
export function StatRadar({ data }: { data: RadarPoint[] }) {
  const max = Math.max(10, ...data.map((d) => d.value));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#1E242C" />
          <PolarAngleAxis
            dataKey="stat"
            tick={{ fill: '#7C8794', fontSize: 12 }}
            tickLine={false}
          />
          {/* Шкалу радиуса не подписываем: числа по осям дублируются под чартом. */}
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} tickCount={4} />
          <Radar
            dataKey="value"
            stroke="#00D4FF"
            fill="#00D4FF"
            fillOpacity={0.22}
            strokeWidth={2}
            // Точки нужны, пока прокачан один-два стата: иначе фигура вырождается в линию.
            dot={{ r: 3, fill: '#00D4FF', strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
