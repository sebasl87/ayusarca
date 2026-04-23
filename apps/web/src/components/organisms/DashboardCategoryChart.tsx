"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Datum = {
  categoria: string;
  total: number;
  count: number;
};

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function DashboardCategoryChart({ data }: { data: Datum[] }) {
  if (data.length === 0) {
    return <div className="text-sm text-muted-foreground">Sin datos todavía.</div>;
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="categoria"
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => ars.format(v)}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => {
              if (name === "total" && typeof value === "number") return ars.format(value);
              return String(value);
            }}
            labelFormatter={(label: unknown) => String(label)}
          />
          <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

