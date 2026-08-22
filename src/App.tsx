import { NavLink, Route, Routes } from 'react-router-dom'
import { LayoutDashboard, Ruler, Shirt } from 'lucide-react'
import { cn } from '@/lib/utils'
import EditorPage from '@/pages/EditorPage'
import DashboardPage from '@/pages/DashboardPage'

function TopBar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-2 rounded-[calc(var(--radius)-2px)] px-3 py-1.5 text-sm transition-colors',
      isActive
        ? 'bg-[var(--color-panel-2)] text-[var(--color-text)]'
        : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
    )

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] text-[#0b0d10]">
          <Shirt size={18} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Sizer Studio</div>
          <div className="text-[11px] text-[var(--color-muted)]">Design print measurements</div>
        </div>
      </div>
      <nav className="flex items-center gap-1">
        <NavLink to="/" end className={linkClass}>
          <Ruler size={16} /> Editor
        </NavLink>
        <NavLink to="/dashboard" className={linkClass}>
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>
      </nav>
    </header>
  )
}

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<EditorPage />} />
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </main>
    </div>
  )
}
