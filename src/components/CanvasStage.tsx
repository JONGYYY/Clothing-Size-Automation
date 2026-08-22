import { useEffect, useMemo, useRef } from 'react'
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useElementSize } from '@/hooks/useElementSize'
import type { DesignBox, DesignMeasurement, Rect as RectType, ShirtRef } from '@/lib/types'
import { SHIRT_OUTLINE_COLOR } from '@/lib/constants'
import { cropToCanvas } from '@/lib/color'
import { formatCm } from '@/lib/utils'

export type DrawMode = 'none' | 'ref' | 'design'
export const SHIRT_REF_ID = '__shirt_ref__'

interface CanvasStageProps {
  image: HTMLImageElement | null
  imageWidth: number
  imageHeight: number
  shirtRef: ShirtRef | null
  boxes: DesignBox[]
  measurements: DesignMeasurement[]
  scaleReady: boolean
  selectedId: string | null
  drawMode: DrawMode
  onSelect: (id: string | null) => void
  onCreateRect: (mode: Exclude<DrawMode, 'none'>, rect: RectType) => void
  onUpdateShirtRef: (rect: RectType) => void
  onUpdateBox: (id: string, rect: RectType) => void
}

const MIN_DRAW = 6

export default function CanvasStage(props: CanvasStageProps) {
  const {
    image,
    imageWidth,
    imageHeight,
    shirtRef,
    boxes,
    measurements,
    scaleReady,
    selectedId,
    drawMode,
    onSelect,
    onCreateRect,
    onUpdateShirtRef,
    onUpdateBox,
  } = props

  const { ref: wrapRef, width: cw, height: ch } = useElementSize<HTMLDivElement>()
  const trRef = useRef<Konva.Transformer>(null)
  const nodeRefs = useRef<Record<string, Konva.Rect | null>>({})

  // Live-draw scratch state (kept in refs; a dummy state bump forces re-render).
  const drawStart = useRef<{ x: number; y: number } | null>(null)
  const drawRectRef = useRef<Konva.Rect>(null)

  const { scale, offsetX, offsetY } = useMemo(() => {
    if (!imageWidth || !imageHeight || !cw || !ch) {
      return { scale: 1, offsetX: 0, offsetY: 0 }
    }
    const s = Math.min(cw / imageWidth, ch / imageHeight)
    return {
      scale: s,
      offsetX: (cw - imageWidth * s) / 2,
      offsetY: (ch - imageHeight * s) / 2,
    }
  }, [imageWidth, imageHeight, cw, ch])

  // Attach transformer to the selected node (never while drawing a new rect).
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const node = selectedId && drawMode === 'none' ? nodeRefs.current[selectedId] : null
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selectedId, boxes, shirtRef, scale, drawMode])

  const toLocal = (stage: Konva.Stage) => {
    const pos = stage.getPointerPosition()
    if (!pos) return null
    return {
      x: (pos.x - offsetX) / scale,
      y: (pos.y - offsetY) / scale,
    }
  }

  const clamp = (r: RectType): RectType => {
    const x = Math.max(0, Math.min(r.x, imageWidth))
    const y = Math.max(0, Math.min(r.y, imageHeight))
    return {
      x,
      y,
      width: Math.max(1, Math.min(r.width, imageWidth - x)),
      height: Math.max(1, Math.min(r.height, imageHeight - y)),
    }
  }

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return

    if (drawMode !== 'none') {
      const p = toLocal(stage)
      if (!p) return
      drawStart.current = p
      const node = drawRectRef.current
      if (node) {
        node.setAttrs({ x: p.x, y: p.y, width: 0, height: 0, visible: true })
        node.getLayer()?.batchDraw()
      }
      return
    }

    // Not drawing: click on empty area / background deselects.
    const name = e.target.name()
    if (e.target === stage || name === 'bg-image') {
      onSelect(null)
    }
  }

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (drawMode === 'none' || !drawStart.current) return
    const stage = e.target.getStage()
    if (!stage) return
    const p = toLocal(stage)
    if (!p) return
    const s = drawStart.current
    const node = drawRectRef.current
    if (node) {
      node.setAttrs({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        width: Math.abs(p.x - s.x),
        height: Math.abs(p.y - s.y),
      })
      node.getLayer()?.batchDraw()
    }
  }

  const handleStageMouseUp = () => {
    if (drawMode === 'none' || !drawStart.current) return
    const node = drawRectRef.current
    const start = drawStart.current
    drawStart.current = null
    if (!node) return
    const rect = clamp({
      x: node.x(),
      y: node.y(),
      width: node.width(),
      height: node.height(),
    })
    node.visible(false)
    node.getLayer()?.batchDraw()
    if (rect.width >= MIN_DRAW && rect.height >= MIN_DRAW && start) {
      onCreateRect(drawMode, rect)
    }
  }

  const bakeTransform = (node: Konva.Rect): RectType => {
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const rect = clamp({
      x: node.x(),
      y: node.y(),
      width: Math.max(1, node.width() * scaleX),
      height: Math.max(1, node.height() * scaleY),
    })
    node.scaleX(1)
    node.scaleY(1)
    node.setAttrs(rect)
    return rect
  }

  const showEmpty = !image

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-[#0e1116]"
      style={{ cursor: drawMode !== 'none' ? 'crosshair' : 'default' }}
    >
      {showEmpty && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-[var(--color-muted)]">
            <div className="text-sm">No image loaded</div>
            <div className="mt-1 text-xs">Upload a shirt image from the panel on the right</div>
          </div>
        </div>
      )}
      {!showEmpty && cw > 0 && ch > 0 && (
        <Stage
          width={cw}
          height={ch}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
        >
          <Layer>
            <Group x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
              {image && (
                <KonvaImage
                  image={image}
                  width={imageWidth}
                  height={imageHeight}
                  name="bg-image"
                />
              )}

              {shirtRef && (
                <Rect
                  ref={(n) => {
                    nodeRefs.current[SHIRT_REF_ID] = n
                  }}
                  {...shirtRef}
                  stroke={SHIRT_OUTLINE_COLOR}
                  strokeWidth={2 / scale}
                  dash={[10 / scale, 8 / scale]}
                  fill={`${SHIRT_OUTLINE_COLOR}12`}
                  draggable={drawMode === 'none'}
                  onMouseDown={(e) => {
                    if (drawMode !== 'none') return
                    e.cancelBubble = true
                    onSelect(SHIRT_REF_ID)
                  }}
                  onDragEnd={(e) => onUpdateShirtRef(clamp({
                    x: e.target.x(),
                    y: e.target.y(),
                    width: shirtRef.width,
                    height: shirtRef.height,
                  }))}
                  onTransformEnd={(e) => onUpdateShirtRef(bakeTransform(e.target as Konva.Rect))}
                />
              )}

              {/* Live golden-ratio / composed preview on the shirt itself. */}
              {image &&
                boxes.map((box) => {
                  if (!box.print) return null
                  const m = measurements.find((mm) => mm.id === box.id)
                  if (!m || !Number.isFinite(m.widthCm) || m.widthCm <= 0) return null
                  return (
                    <PrintPreview
                      key={`print-${box.id}`}
                      image={image}
                      box={box}
                      measuredWidthCm={m.widthCm}
                      measuredHeightCm={m.heightCm}
                      scale={scale}
                    />
                  )
                })}

              {boxes.map((box) => (
                <Rect
                  key={box.id}
                  ref={(n) => {
                    nodeRefs.current[box.id] = n
                  }}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  stroke={box.color}
                  strokeWidth={(selectedId === box.id ? 3 : 2) / scale}
                  fill={box.print ? 'transparent' : `${box.color}1f`}
                  draggable={drawMode === 'none'}
                  onMouseDown={(e) => {
                    if (drawMode !== 'none') return
                    e.cancelBubble = true
                    onSelect(box.id)
                  }}
                  onDragEnd={(e) =>
                    onUpdateBox(box.id, clamp({
                      x: e.target.x(),
                      y: e.target.y(),
                      width: box.width,
                      height: box.height,
                    }))
                  }
                  onTransformEnd={(e) => onUpdateBox(box.id, bakeTransform(e.target as Konva.Rect))}
                />
              ))}

              <Rect ref={drawRectRef} visible={false} stroke="#ffffff" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} fill="#ffffff22" listening={false} />
            </Group>

            <Transformer
              ref={trRef}
              rotateEnabled={false}
              keepRatio={false}
              ignoreStroke
              anchorSize={9}
              anchorStroke="#0b0d10"
              anchorFill="#e6e9ef"
              borderStroke="#e6e9ef"
              borderDash={[4, 4]}
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
            />

            {/* Labels drawn in stage coordinates so they stay readable at any zoom. */}
            {boxes.map((box) => {
              const m = measurements.find((mm) => mm.id === box.id)
              const label = box.print
                ? `${box.name}  ·  ${formatCm(box.print.widthCm)} × ${formatCm(box.print.heightCm)} cm  ·  golden`
                : m && scaleReady
                  ? `${box.name}  ·  ${formatCm(m.widthCm)} × ${formatCm(m.heightCm)} cm`
                  : box.name
              return (
                <BoxLabel
                  key={`lbl-${box.id}`}
                  text={label}
                  x={offsetX + box.x * scale}
                  y={offsetY + box.y * scale}
                  color={box.color}
                />
              )
            })}
            {shirtRef && (
              <BoxLabel
                text="Real shirt outline"
                x={offsetX + shirtRef.x * scale}
                y={offsetY + shirtRef.y * scale}
                color={SHIRT_OUTLINE_COLOR}
                above
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  )
}

/**
 * Renders the print/golden-ratio frame composited onto the shirt at the design's
 * location: a fill-colored rectangle (so shrinking the art shows no white space)
 * with the cropped artwork scaled and offset inside it — mirroring the composer.
 */
function PrintPreview({
  image,
  box,
  measuredWidthCm,
  measuredHeightCm,
  scale,
}: {
  image: HTMLImageElement
  box: DesignBox
  measuredWidthCm: number
  measuredHeightCm: number
  scale: number
}) {
  const art = useMemo(
    () => cropToCanvas(image, box),
    [image, box.x, box.y, box.width, box.height],
  )
  const print = box.print!
  const pxPerCm = box.width / measuredWidthCm
  const frameWpx = print.widthCm * pxPerCm
  const frameHpx = print.heightCm * pxPerCm
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const frameX = cx - frameWpx / 2
  const frameY = cy - frameHpx / 2

  // Artwork is contain-fit into the frame, then scaled by artScale (matches composer).
  const fit = Math.min(print.widthCm / measuredWidthCm, print.heightCm / measuredHeightCm)
  const artWpx = box.width * fit * print.artScale
  const artHpx = box.height * fit * print.artScale
  const artX = cx + print.offsetXCm * pxPerCm - artWpx / 2
  const artY = cy + print.offsetYCm * pxPerCm - artHpx / 2

  return (
    <Group listening={false}>
      <Rect x={frameX} y={frameY} width={frameWpx} height={frameHpx} fill={print.fillColor} />
      <Group clipX={frameX} clipY={frameY} clipWidth={frameWpx} clipHeight={frameHpx}>
        <KonvaImage image={art} x={artX} y={artY} width={artWpx} height={artHpx} />
      </Group>
      <Rect
        x={frameX}
        y={frameY}
        width={frameWpx}
        height={frameHpx}
        stroke={box.color}
        strokeWidth={2 / scale}
        dash={[9 / scale, 6 / scale]}
      />
    </Group>
  )
}

function BoxLabel({
  text,
  x,
  y,
  color,
  above,
}: {
  text: string
  x: number
  y: number
  color: string
  above?: boolean
}) {
  const padX = 6
  const height = 20
  const width = Math.max(40, text.length * 6.6 + padX * 2)
  const ty = above ? y - height - 4 : y + 4
  return (
    <Group listening={false}>
      <Rect x={x} y={ty} width={width} height={height} fill="#0b0d10cc" cornerRadius={4} stroke={color} strokeWidth={1} />
      <Text x={x + padX} y={ty + 4} text={text} fontSize={12} fill="#e6e9ef" />
    </Group>
  )
}
