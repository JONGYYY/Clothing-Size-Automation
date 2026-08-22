import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { deleteDesign, duplicateDesign, listDesigns, saveDesign } from '@/lib/storage'
import { measureAll } from '@/lib/measure'
import type { DesignRecord } from '@/lib/types'
import { formatCm } from '@/lib/utils'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<DesignRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)

  const refresh = async () => {
    setRecords(await listDesigns())
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleRename = async (rec: DesignRecord, value: string) => {
    await saveDesign({ ...rec, name: value.trim() || rec.name })
    setEditing(null)
    refresh()
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Saved designs</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {records.length} {records.length === 1 ? 'design' : 'designs'} stored on this device
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate('/')}>
            <Plus size={16} /> New design
          </Button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-[var(--color-muted)]">Loading…</div>
        ) : records.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-20 text-center">
            <div className="text-sm text-[var(--color-text)]">No designs saved yet</div>
            <div className="mt-1 text-xs text-[var(--color-muted)]">
              Create one in the editor and hit Save.
            </div>
            <Button variant="secondary" className="mt-4" onClick={() => navigate('/')}>
              <Plus size={16} /> Create a design
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((rec) => {
              const ms = measureAll(rec.boxes, rec.shirtRef, rec.realWidthCm)
              return (
                <div
                  key={rec.id}
                  className="group overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-panel)] transition-colors hover:border-[var(--color-accent)]"
                >
                  <button
                    onClick={() => navigate(`/editor/${rec.id}`)}
                    className="block aspect-[4/3] w-full overflow-hidden bg-[#0e1116]"
                  >
                    <img
                      src={rec.imageDataUrl}
                      alt={rec.name}
                      className="h-full w-full object-contain transition-transform group-hover:scale-[1.02]"
                    />
                  </button>
                  <div className="p-3">
                    {editing?.id === rec.id ? (
                      <div className="flex gap-1.5">
                        <Input
                          autoFocus
                          value={editing.value}
                          className="h-8 text-sm"
                          onChange={(e) => setEditing({ id: rec.id, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(rec, editing.value)
                            if (e.key === 'Escape') setEditing(null)
                          }}
                        />
                        <Button size="icon" variant="secondary" onClick={() => handleRename(rec, editing.value)}>
                          <Check size={15} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => navigate(`/editor/${rec.id}`)}
                          className="truncate text-left text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]"
                        >
                          {rec.name}
                        </button>
                        <span className="shrink-0 rounded-md bg-[var(--color-panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                          {rec.realWidthCm}×{rec.realHeightCm} cm
                        </span>
                      </div>
                    )}

                    <div className="mt-2 space-y-1">
                      {ms.length === 0 && (
                        <div className="text-xs text-[var(--color-muted)]">No design regions</div>
                      )}
                      {ms.map((m) => {
                        const b = rec.boxes.find((x) => x.id === m.id)
                        const w = b?.print ? b.print.widthCm : m.widthCm
                        const h = b?.print ? b.print.heightCm : m.heightCm
                        return (
                          <div key={m.id} className="flex items-center justify-between text-xs">
                            <span className="truncate text-[var(--color-muted)]">{m.name}</span>
                            <span className="font-mono text-[var(--color-text)]">
                              {Number.isFinite(w) ? `${formatCm(w)} × ${formatCm(h)} cm` : '—'}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-3 flex items-center gap-1 border-t border-[var(--color-border)] pt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing({ id: rec.id, value: rec.name })}
                      >
                        <Pencil size={14} /> Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await duplicateDesign(rec.id)
                          refresh()
                        }}
                      >
                        <Copy size={14} /> Duplicate
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto"
                        title="Delete"
                        onClick={async () => {
                          await deleteDesign(rec.id)
                          refresh()
                        }}
                      >
                        <Trash2 size={15} className="text-[var(--color-danger)]" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
