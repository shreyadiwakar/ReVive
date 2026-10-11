import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function ActivityChart({ data, dataKey = 'kg', xKey = 'day', title, unit = 'kg' }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
      {title && <h3 className="mb-4 text-sm font-semibold text-charcoal">{title}</h3>}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e6efe9" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: '#2d3436' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#2d3436' }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            formatter={(value) => [`${value} ${unit}`, '']}
            contentStyle={{ borderRadius: 10, border: '1px solid #c8e6d6', fontSize: 13 }}
          />
          <Bar dataKey={dataKey} fill="#1b5e3a" radius={[6, 6, 2, 2]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
