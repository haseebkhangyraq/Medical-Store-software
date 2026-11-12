"use client";

// Recharts wrappers loaded client-side only to keep SSR happy.
import dynamic from "next/dynamic";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export const CHART_COLORS = ["#385a8c", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const axisStyle = { fontSize: 11, fill: "#94a3b8" } as const;

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(16,24,40,.12)",
      fontSize: 12, padding: "8px 12px",
    },
    labelStyle: { fontWeight: 600, color: "#1e293b", marginBottom: 2 },
  };
}

export function SalesAreaChart({ data, height = 260 }: { data: Array<{ name: string; sales: number; profit?: number }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#385a8c" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#385a8c" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
        <Tooltip formatter={(v: number | string) => `Rs. ${Number(v).toLocaleString()}`} {...tooltipStyle()} />
        <Area type="monotone" dataKey="sales" stroke="#385a8c" strokeWidth={2.5} fill="url(#gradSales)" animationDuration={800} />
        {data.some((d) => d.profit != null) && (
          <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#gradProfit)" animationDuration={800} />
        )}
        {data.some((d) => d.profit != null) && (
          <Legend wrapperStyle={{ fontSize: 11 }} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CompareBarChart({ data, height = 260 }: { data: Array<{ name: string; purchases: number; sales: number }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
        <Tooltip formatter={(v: number | string) => `Rs. ${Number(v).toLocaleString()}`} {...tooltipStyle()} cursor={{ fill: "#f8fafc" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="purchases" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={26} animationDuration={800} />
        <Bar dataKey="sales" fill="#385a8c" radius={[6, 6, 0, 0]} maxBarSize={26} animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryPie({ data, height = 240 }: { data: Array<{ name: string; value: number }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} animationDuration={800}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#fff" strokeWidth={2} />)}
        </Pie>
        <Tooltip formatter={(v: number | string) => `Rs. ${Number(v).toLocaleString()}`} {...tooltipStyle()} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({ data, height = 220 }: { data: Array<{ name: string; value: number }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={46} />
        <Tooltip {...tooltipStyle()} />
        <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.5} dot={false} animationDuration={800} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export { AreaChart, BarChart, LineChart, PieChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend };
