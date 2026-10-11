import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = ['#1b5e3a', '#3dd68c', '#89c9a8', '#2563eb', '#f59e0b', '#8b5cf6', '#ef4444']

export default function CategoryPieChart({ data, title }) {
  const hasData = data && data.length > 0 && data.some((d) => d.kg > 0)

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
      {title && <h3 className="mb-4 text-sm font-semibold text-charcoal">{title}</h3>}
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="kg" nameKey="category" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((entry, i) => (
                <Cell key={entry.category} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value} kg`, '']} />
            <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center text-sm text-charcoal/40">
          No verified waste data yet
        </div>
      )}
    </div>
  )
}
