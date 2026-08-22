import { useEffect, useMemo, useRef, useState } from 'react'
import { Group, Image as KonvaImage, Layer, Rect, Stage, Transformer } from 'react-konva'
import type Konva from 'konva'
import { Crop, Download, RotateCcw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { NumberField } from '@/components/ui/NumberField'
import { cropToCanvas, sampleMainColor } from '@/lib/color'
import { GOLDEN, goldenTarget, toPrintInteger } from '@/lib/measure'
import { cn, formatCm } from '@/lib/utils'
import type { DesignBox, PrintSpec } from '@/lib/types'

interface ComposerModalProps {
  image: HTMLImageElement
  box: DesignBox
  measuredWidthCm: number
  measuredHeightCm: number
  shirtWidthCm: number
  shirtHeightCm: number
  onClose: () => void
  onApply: (print: PrintSpec) => void
}

const STAGE_MAX = 520

export default function ComposerModal(props: ComposerModalProps) {
  const {
    image,
    box,
    measuredWidthCm,
    measuredHeightCm,
    shirtWidthCm,
    shirtHeightCm,
    onClose,
    onApply,
  } = props

  const artCanvas = useMemo(() => cropToCanvas(image, box), [image, box])
  const exportScale = measuredWidthCm > 0 ? box.width / measuredWidthCm : 1 // px per cm

  const [widthCm, setWidthCm] = useState(box.print?.widthCm ?? measuredWidthCm)
  const [heightCm, setHeightCm] = useState(box.print?.heightCm ?? measuredHeightCm)
  const [artScale, setArtScale] = useState(box.print?.artScale ?? 1)
  const [offsetXCm, setOffsetXCm] = useState(box.print?.offsetXCm ?? 0)
  const [offsetYCm, setOffsetYCm] = useState(box.print?.offsetYCm ?? 0)
  const [anchor, setAnchor] = useState<'width' | 'height'>(box.print?.goldenAnchor ?? 'width')
  const [fillColor, setFillColor] = useState(
    box.print?.fillColor ?? sampleMainColor(image, box),
  )

  const trRef = useRef<Konva.Transformer>(null)
  const artRef = useRef<Konva.Image>(null)

  // Guarded frame dims so clearing an input mid-edit can't break geometry.
  const fw = Number.isFinite(widthCm) && widthCm > 0 ? widthCm : measuredWidthCm
  const fh = Number.isFinite(heightCm) && heightCm > 0 ? heightCm : measuredHeightCm

  // Display geometry (all in screen px).
  const dispScale = Math.min(STAGE_MAX / fw, STAGE_MAX / fh)
  const stageW = fw * dispScale
  const stageH = fh * dispScale
  const fitScale = Math.min(fw / measuredWidthCm, fh / measuredHeightCm)
  const artBaseW = measuredWidthCm * fitScale // cm, contain-fit
  const artBaseH = measuredHeightCm * fitScale
  const artDispW = artBaseW * artScale * dispScale
  const artDispH = artBaseH * artScale * dispScale
  const artX = stageW / 2 + offsetXCm * dispScale - artDispW / 2
  const artY = stageH / 2 + offsetYCm * dispScale - artDispH / 2

  useEffect(() => {
    const tr = trRef.current
    const node = artRef.current
    if (tr && node) {
      tr.nodes([node])
      tr.getLayer()?.batchDraw()
    }
  }, [widthCm, heightCm, artScale, offsetXCm, offsetYCm])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const applyGolden = () => {
    const t = goldenTarget(anchor, shirtWidthCm, shirtHeightCm, measuredWidthCm, measuredHeightCm)
    setWidthCm(Number(t.widthCm.toFixed(2)))
    setHeightCm(Number(t.heightCm.toFixed(2)))
    setArtScale(1)
    setOffsetXCm(0)
    setOffsetYCm(0)
  }

  const reset = () => {
    setWidthCm(Number(measuredWidthCm.toFixed(2)))
    setHeightCm(Number(measuredHeightCm.toFixed(2)))
    setArtScale(1)
    setOffsetXCm(0)
    setOffsetYCm(0)
  }

  const handleDragEnd = () => {
    const node = artRef.current
    if (!node) return
    const cx = node.x() + (artBaseW * artScale * dispScale) / 2
    const cy = node.y() + (artBaseH * artScale * dispScale) / 2
    setOffsetXCm((cx - stageW / 2) / dispScale)
    setOffsetYCm((cy - stageH / 2) / dispScale)
  }

  const handleTransformEnd = () => {
    const node = artRef.current
    if (!node) return
    const newDispW = node.width() * node.scaleX()
    const nextScale = newDispW / (artBaseW * dispScale)
    const newDispH = artBaseH * nextScale * dispScale
    const cx = node.x() + newDispW / 2
    const cy = node.y() + newDispH / 2
    node.scaleX(1)
    node.scaleY(1)
    setArtScale(Math.max(0.05, nextScale))
    setOffsetXCm((cx - stageW / 2) / dispScale)
    setOffsetYCm((cy - stageH / 2) / dispScale)
  }

  const buildSpec = (): PrintSpec => ({
    widthCm: fw,
    heightCm: fh,
    artScale,
    offsetXCm,
    offsetYCm,
    fillColor,
    goldenAnchor: anchor,
  })

  const renderExportCanvas = (): HTMLCanvasElement => {
    const expW = Math.max(1, Math.round(fw * exportScale))
    const expH = Math.max(1, Math.round(fh * exportScale))
    const canvas = document.createElement('canvas')
    canvas.width = expW
    canvas.height = expH
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = fillColor
    ctx.fillRect(0, 0, expW, expH)
    const aw = Math.max(1, Math.round(artBaseW * artScale * exportScale))
    const ah = Math.max(1, Math.round(artBaseH * artScale * exportScale))
    const ax = Math.round(expW / 2 + offsetXCm * exportScale - aw / 2)
    const ay = Math.round(expH / 2 + offsetYCm * exportScale - ah / 2)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(artCanvas, 0, 0, artCanvas.width, artCanvas.height, ax, ay, aw, ah)
    return canvas
  }

  const download = () => {
    const canvas = renderExportCanvas()
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${box.name.replace(/\s+/g, '_') || 'design'}_${Math.round(fw)}x${Math.round(
      fh,
    )}cm.png`
    a.click()
  }

  const goldenPreview = goldenTarget(
    anchor,
    shirtWidthCm,
    shirtHeightCm,
    measuredWidthCm,
    measuredHeightCm,
  )
  const artDisplayedCmW = artBaseW * artScale
  const artDisplayedCmH = artBaseH * artScale

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[980px] overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-panel)]">
        {/* Canvas */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Crop size={16} /> Golden ratio composer — {box.name}
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              Frame {formatCm(fw)} × {formatCm(fh)} cm
            </div>
          </div>
          <div
            className="flex flex-1 items-center justify-center overflow-auto p-6"
            style={{ background: '#0e1116' }}
          >
            <div
              className="shadow-2xl"
              style={{ outline: '1px dashed #ffffff33', outlineOffset: 2 }}
            >
              <Stage width={stageW} height={stageH}>
                <Layer>
                  <Rect x={0} y={0} width={stageW} height={stageH} fill={fillColor} />
                  <Group clipX={0} clipY={0} clipWidth={stageW} clipHeight={stageH}>
                    <KonvaImage
                      ref={artRef}
                      image={artCanvas}
                      x={artX}
                      y={artY}
                      width={artDispW}
                      height={artDispH}
                      draggable
                      onDragEnd={handleDragEnd}
                      onTransformEnd={handleTransformEnd}
                    />
                  </Group>
                  <Transformer
                    ref={trRef}
                    rotateEnabled={false}
                    keepRatio
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    anchorSize={9}
                    anchorStroke="#0b0d10"
                    anchorFill="#e6e9ef"
                    borderStroke="#6ea8fe"
                    boundBoxFunc={(oldB, newB) => (newB.width < 12 ? oldB : newB)}
                  />
                </Layer>
              </Stage>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] px-4 py-2 text-center text-[11px] text-[var(--color-muted)]">
            Drag the artwork to move · drag a corner to resize · empty margin fills with the shirt color
          </div>
        </div>

        {/* Controls */}
        <div className="flex w-[320px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Adjust</div>
            <Button size="icon" variant="ghost" onClick={onClose} title="Close">
              <X size={16} />
            </Button>
          </div>

          {/* Golden ratio */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--color-accent-2)]">
              Golden ratio ({GOLDEN})
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              {(['width', 'height'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAnchor(a)}
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-xs capitalize transition-colors',
                    anchor === a
                      ? 'border-[var(--color-accent)] bg-[var(--color-panel-2)] text-[var(--color-text)]'
                      : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]',
                  )}
                >
                  Anchor {a}
                </button>
              ))}
            </div>
            <div className="mb-2 text-[11px] text-[var(--color-muted)]">
              → {formatCm(goldenPreview.widthCm)} × {formatCm(goldenPreview.heightCm)} cm
            </div>
            <Button variant="primary" size="sm" className="w-full" onClick={applyGolden}>
              <Sparkles size={14} /> Apply golden ratio
            </Button>
          </div>

          {/* Frame size */}
          <div className="space-y-2">
            <div className="text-xs text-[var(--color-muted)]">Frame size (print rectangle)</div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField value={widthCm} onChange={(v) => setWidthCm(v)} suffix="cm" />
              <NumberField value={heightCm} onChange={(v) => setHeightCm(v)} suffix="cm" />
            </div>
          </div>

          {/* Artwork scale */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-muted)]">Artwork size</span>
              <span className="font-mono">{Math.round(artScale * 100)}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={140}
              value={Math.round(artScale * 100)}
              onChange={(e) => setArtScale(Number(e.target.value) / 100)}
              className="w-full"
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <div className="text-[11px] text-[var(--color-muted)]">
              Artwork ≈ {formatCm(artDisplayedCmW)} × {formatCm(artDisplayedCmH)} cm
            </div>
          </div>

          {/* Fill color */}
          <div className="space-y-1.5">
            <div className="text-xs text-[var(--color-muted)]">Background fill (shirt color)</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-[var(--color-border)] bg-transparent"
              />
              <div className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-panel-2)] px-2 py-1.5 font-mono text-xs uppercase">
                {fillColor}
              </div>
              <Button
                size="sm"
                variant="ghost"
                title="Resample from shirt"
                onClick={() => setFillColor(sampleMainColor(image, box))}
              >
                <RotateCcw size={14} />
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-[var(--color-panel-2)] p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Print size</span>
              <span className="font-mono text-sm text-[var(--color-text)]">
                {formatCm(fw)} × {formatCm(fh)} cm
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Whole cm</span>
              <span className="font-mono text-[var(--color-accent-2)]">
                {toPrintInteger(fw)} × {toPrintInteger(fh)} cm
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Export px</span>
              <span className="font-mono text-[var(--color-muted)]">
                {Math.round(fw * exportScale)} × {Math.round(fh * exportScale)}
              </span>
            </div>
          </div>

          <div className="mt-auto space-y-2">
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={reset}>
                <RotateCcw size={15} /> Reset
              </Button>
              <Button variant="secondary" className="flex-1" onClick={download}>
                <Download size={15} /> PNG
              </Button>
            </div>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                onApply(buildSpec())
                onClose()
              }}
            >
              Apply to design
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
