import { useRef, useState, type ReactNode } from 'react'
import {
  Check,
  Copy,
  ImagePlus,
  Plus,
  Ruler,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { NumberField } from '@/components/ui/NumberField'
import type { DesignBox, DesignMeasurement, ShirtRef } from '@/lib/types'
import { SHIRT_PRESETS } from '@/lib/constants'
import { cn, formatCm } from '@/lib/utils'
import { toPrintInteger } from '@/lib/measure'
import type { DrawMode } from '@/components/CanvasStage'

interface SidebarProps {
  name: string
  onNameChange: (v: string) => void
  hasImage: boolean
  onUpload: (file: File) => void
  onSave: () => void
  onNew: () => void
  saving: boolean
  savedAt: number | null

  realWidthCm: number
  realHeightCm: number
  onRealWidth: (v: number) => void
  onRealHeight: (v: number) => void
  onPreset: (w: number, h: number) => void

  shirtRef: ShirtRef | null
  scale: number | null
  drawMode: DrawMode
  onStartRefDraw: () => void

  boxes: DesignBox[]
  measurements: DesignMeasurement[]
  selectedId: string | null
  onSelectBox: (id: string) => void
  onRenameBox: (id: string, name: string) => void
  onSnapBox: (id: string) => void
  onDeleteBox: (id: string) => void
  onStartDesignDraw: () => void
  onReSnapAll: () => void
  onOpenComposer: (id: string) => void

  sensitivity: number
  onSensitivity: (v: number) => void
}

function Step({
  index,
  title,
  hint,
  done,
  children,
}: {
  index: number
  title: string
  hint?: string
  done?: boolean
  children: ReactNode
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-3.5 py-2.5">
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            done
              ? 'bg-[var(--color-accent-2)] text-[#0b0d10]'
              : 'bg-[var(--color-panel-2)] text-[var(--color-muted)] ring-1 ring-[var(--color-border)]',
          )}
        >
          {done ? <Check size={14} /> : index}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">{title}</div>
          {hint && <div className="truncate text-[11px] text-[var(--color-muted)]">{hint}</div>}
        </div>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  )
}

export default function Sidebar(props: SidebarProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)

  const step1Done = props.hasImage
  const step2Done = props.realWidthCm > 0 && props.realHeightCm > 0
  const step3Done = !!props.shirtRef && props.scale != null
  const step4Done = props.boxes.length > 0
  const readyMeasurements = props.measurements.filter((m) => Number.isFinite(m.widthCm))
  const canCalculate = props.scale != null && readyMeasurements.length > 0

  const handleCalculate = () => {
    setRevealed(true)
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  const effOf = (m: DesignMeasurement) => {
    const b = props.boxes.find((x) => x.id === m.id)
    if (b?.print) return { widthCm: b.print.widthCm, heightCm: b.print.heightCm, custom: true }
    return { widthCm: m.widthCm, heightCm: m.heightCm, custom: false }
  }

  const copyLine = (m: DesignMeasurement) => {
    const e = effOf(m)
    return `${m.name}: ${formatCm(e.widthCm)} x ${formatCm(e.heightCm)} cm (print ${toPrintInteger(
      e.widthCm,
    )} x ${toPrintInteger(e.heightCm)} cm)`
  }

  const copyAll = () => {
    const text = readyMeasurements.map(copyLine).join('\n')
    navigator.clipboard?.writeText(text)
  }

  return (
    <aside className="flex h-full w-[400px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-sm font-semibold">Measurement steps</div>
          <div className="text-[11px] text-[var(--color-muted)]">Follow 1 → 5 to get cm sizes</div>
        </div>
        <Button variant="ghost" size="sm" onClick={props.onNew}>
          <Plus size={14} /> New
        </Button>
      </div>

      {/* Step 1 — image */}
      <Step index={1} title="Upload shirt image" hint="Your AI mockup" done={step1Done}>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) props.onUpload(f)
            e.target.value = ''
          }}
        />
        <Button variant="secondary" className="w-full" onClick={() => fileInput.current?.click()}>
          <ImagePlus size={16} /> {props.hasImage ? 'Replace image' : 'Upload image'}
        </Button>
        <div className="mt-3 space-y-1.5">
          <label className="text-xs text-[var(--color-muted)]">Design name</label>
          <Input
            value={props.name}
            placeholder="e.g. Yunjian Cloud Tee"
            onChange={(e) => props.onNameChange(e.target.value)}
          />
        </div>
      </Step>

      {/* Step 2 — real size */}
      <Step
        index={2}
        title="Enter real shirt size"
        hint="The physical garment, in cm"
        done={step2Done}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--color-muted)]">Width (torso L↔R)</label>
            <NumberField value={props.realWidthCm} onChange={props.onRealWidth} suffix="cm" placeholder="50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--color-muted)]">Height (collar↕hem)</label>
            <NumberField value={props.realHeightCm} onChange={props.onRealHeight} suffix="cm" placeholder="70" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SHIRT_PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant="outline"
              onClick={() => props.onPreset(p.widthCm, p.heightCm)}
            >
              {p.label} · {p.widthCm}×{p.heightCm}
            </Button>
          ))}
        </div>
      </Step>

      {/* Step 3 — reference */}
      <Step
        index={3}
        title="Set shirt width reference"
        hint={props.scale ? `${props.scale.toFixed(3)} px/cm` : 'Anchors the scale'}
        done={step3Done}
      >
        <p className="mb-3 text-xs leading-relaxed text-[var(--color-muted)]">
          Click below, then drag a box across the shirt's torso width with its top edge at the
          collar top. The dashed teal box shows the real shirt outline.
        </p>
        <Button
          variant={props.drawMode === 'ref' ? 'primary' : 'secondary'}
          className="w-full"
          disabled={!props.hasImage}
          onClick={props.onStartRefDraw}
        >
          <Ruler size={16} />
          {props.drawMode === 'ref'
            ? 'Drawing… drag across the shirt'
            : props.shirtRef
              ? 'Redraw width reference'
              : 'Set shirt width'}
        </Button>
      </Step>

      {/* Step 4 — designs */}
      <Step
        index={4}
        title="Mark design regions"
        hint="Front, back, sleeve — one box each"
        done={step4Done}
      >
        <Button
          variant={props.drawMode === 'design' ? 'primary' : 'secondary'}
          className="w-full"
          disabled={!props.hasImage}
          onClick={props.onStartDesignDraw}
        >
          <Plus size={16} />
          {props.drawMode === 'design' ? 'Drawing… drag around the artwork' : 'Add design region'}
        </Button>

        {props.drawMode === 'design' && (
          <div className="mt-2 rounded-lg border border-dashed border-[var(--color-accent)] bg-[var(--color-panel-2)] px-3 py-2 text-xs text-[var(--color-accent)]">
            Drag a box around one design — it snaps to the exact edges. Keep the
            box inside the torso (avoid the collar and sleeve seams) for the
            tightest fit; you can always drag the handles to fine-tune.
          </div>
        )}

        {/* Sensitivity */}
        <div className="mt-3 rounded-lg bg-[var(--color-panel-2)] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-muted)]">Snap sensitivity</span>
            <span className="font-mono text-[var(--color-text)]">{props.sensitivity}</span>
          </div>
          <input
            type="range"
            min={5}
            max={95}
            value={props.sensitivity}
            onChange={(e) => props.onSensitivity(Number(e.target.value))}
            className="mt-2 w-full"
            style={{ accentColor: 'var(--color-accent)' }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>Only bright</span>
            <span>Include faint</span>
          </div>
          {props.boxes.length > 0 && (
            <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={props.onReSnapAll}>
              <Wand2 size={14} /> Re-snap all with this sensitivity
            </Button>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {props.boxes.length === 0 && props.drawMode !== 'design' && (
            <div className="py-4 text-center text-xs text-[var(--color-muted)]">
              No design regions yet.
            </div>
          )}
          {props.boxes.map((box) => {
            const m = props.measurements.find((mm) => mm.id === box.id)
            const active = props.selectedId === box.id
            return (
              <div
                key={box.id}
                onClick={() => props.onSelectBox(box.id)}
                className={cn(
                  'cursor-pointer rounded-lg border p-2.5 transition-colors',
                  active
                    ? 'border-[var(--color-accent)] bg-[var(--color-panel-2)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-panel-2)]',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: box.color }} />
                  <Input
                    value={box.name}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => props.onRenameBox(box.id, e.target.value)}
                    className="h-8 flex-1 text-xs"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Snap to artwork"
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onSnapBox(box.id)
                    }}
                  >
                    <Wand2 size={15} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onDeleteBox(box.id)
                    }}
                  >
                    <Trash2 size={15} className="text-[var(--color-danger)]" />
                  </Button>
                </div>
                {m && (
                  <div className="mt-1.5 flex items-center gap-2 px-0.5 font-mono text-[11px] text-[var(--color-muted)]">
                    <span>
                      {Math.round(m.widthPx)} × {Math.round(m.heightPx)} px
                    </span>
                    {box.print && (
                      <span className="flex items-center gap-1 text-[var(--color-accent-2)]">
                        <Sparkles size={10} /> {formatCm(box.print.widthCm)}×
                        {formatCm(box.print.heightCm)}cm
                      </span>
                    )}
                  </div>
                )}
                {m && Number.isFinite(m.widthCm) ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onOpenComposer(box.id)
                    }}
                  >
                    <Sparkles size={14} /> Golden ratio & compose
                  </Button>
                ) : (
                  <p className="mt-2 px-0.5 text-[11px] text-[var(--color-muted)]">
                    Set the width reference (step 3) to unlock the golden-ratio editor.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </Step>

      {/* Step 5 — calculate */}
      <Step index={5} title="Calculate measurements" hint="Final print sizes in cm" done={revealed && canCalculate}>
        <Button
          variant="primary"
          className="w-full"
          disabled={!canCalculate}
          onClick={handleCalculate}
        >
          <Ruler size={16} /> Calculate measurements (cm)
        </Button>
        {!canCalculate && (
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">
            {props.scale == null
              ? 'Set the shirt width reference (step 3) and a real width first.'
              : 'Add at least one design region (step 4).'}
          </p>
        )}
      </Step>

      {/* Results */}
      {revealed && canCalculate && (
        <div
          ref={resultsRef}
          className="rounded-[var(--radius)] border border-[var(--color-accent-2)] bg-[var(--color-panel)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3.5 py-2.5">
            <div className="text-sm font-semibold text-[var(--color-accent-2)]">Print measurements</div>
            <Button size="sm" variant="ghost" onClick={copyAll}>
              <Copy size={14} /> Copy all
            </Button>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {readyMeasurements.map((m) => {
              const e = effOf(m)
              return (
                <div key={m.id} className="px-3.5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {m.name}
                      {e.custom && (
                        <span className="flex items-center gap-0.5 rounded bg-[var(--color-panel-2)] px-1 py-0.5 text-[9px] uppercase text-[var(--color-accent-2)]">
                          <Sparkles size={9} /> golden
                        </span>
                      )}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Copy"
                      onClick={() => navigator.clipboard?.writeText(copyLine(m))}
                    >
                      <Copy size={14} />
                    </Button>
                  </div>
                  <div className="mt-1 font-mono text-2xl leading-tight">
                    {formatCm(e.widthCm)} <span className="text-[var(--color-muted)]">×</span>{' '}
                    {formatCm(e.heightCm)}
                    <span className="ml-1.5 text-sm text-[var(--color-muted)]">cm</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[var(--color-muted)]">
                    <span>
                      Print whole cm:{' '}
                      <span className="text-[var(--color-accent-2)]">
                        {toPrintInteger(e.widthCm)} × {toPrintInteger(e.heightCm)}
                      </span>
                    </span>
                    {e.custom && (
                      <span>
                        Measured: {formatCm(m.widthCm)} × {formatCm(m.heightCm)} cm
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Save */}
      <Button
        variant="secondary"
        className="w-full"
        disabled={!props.hasImage || props.saving}
        onClick={props.onSave}
      >
        <Save size={16} /> {props.saving ? 'Saving…' : props.savedAt ? 'Update saved design' : 'Save design'}
      </Button>
      {props.savedAt && (
        <div className="pb-2 text-center text-[10px] text-[var(--color-muted)]">
          Saved {new Date(props.savedAt).toLocaleString()}
        </div>
      )}
    </aside>
  )
}
