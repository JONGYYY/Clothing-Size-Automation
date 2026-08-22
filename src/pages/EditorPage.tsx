import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CanvasStage, { SHIRT_REF_ID, type DrawMode } from '@/components/CanvasStage'
import Sidebar from '@/components/Sidebar/Sidebar'
import ComposerModal from '@/components/Composer/ComposerModal'
import { detectArtworkBounds, intersectRect } from '@/lib/autodetect'
import { measureAll, pxPerCm } from '@/lib/measure'
import { getDesign, saveDesign } from '@/lib/storage'
import type { DesignBox, DesignRecord, PrintSpec, Rect, ShirtRef } from '@/lib/types'
import { BOX_COLORS } from '@/lib/constants'
import { uid } from '@/lib/utils'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function expandRect(r: Rect, factor: number, maxW: number, maxH: number): Rect {
  const dx = r.width * factor
  const dy = r.height * factor
  const x = Math.max(0, r.x - dx)
  const y = Math.max(0, r.y - dy)
  return {
    x,
    y,
    width: Math.min(maxW - x, r.width + dx * 2),
    height: Math.min(maxH - y, r.height + dy * 2),
  }
}

export default function EditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [recordId, setRecordId] = useState<string>(() => uid('design'))
  const [name, setName] = useState('Untitled design')
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string>('')
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  const [realWidthCm, setRealWidthCm] = useState(50)
  const [realHeightCm, setRealHeightCm] = useState(70)

  const [shirtRef, setShirtRef] = useState<ShirtRef | null>(null)
  const [boxes, setBoxes] = useState<DesignBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const [sensitivity, setSensitivity] = useState(55)
  const [composerBoxId, setComposerBoxId] = useState<string | null>(null)

  const [createdAt, setCreatedAt] = useState<number>(() => Date.now())
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const loadedIdRef = useRef<string | null>(null)

  // Load an existing record when navigating to /editor/:id
  useEffect(() => {
    if (!id || loadedIdRef.current === id) return
    loadedIdRef.current = id
    ;(async () => {
      const rec = await getDesign(id)
      if (!rec) return
      const img = await loadImage(rec.imageDataUrl)
      setRecordId(rec.id)
      setName(rec.name)
      setImageDataUrl(rec.imageDataUrl)
      setImage(img)
      setImageSize({ width: rec.imageWidth, height: rec.imageHeight })
      setRealWidthCm(rec.realWidthCm)
      setRealHeightCm(rec.realHeightCm)
      setShirtRef(rec.shirtRef)
      setBoxes(rec.boxes)
      setCreatedAt(rec.createdAt)
      setSavedAt(rec.updatedAt)
      setSelectedId(null)
    })()
  }, [id])

  const scale = useMemo(() => pxPerCm(shirtRef, realWidthCm), [shirtRef, realWidthCm])
  const measurements = useMemo(
    () => measureAll(boxes, shirtRef, realWidthCm),
    [boxes, shirtRef, realWidthCm],
  )

  // The shirt reference IS the real-shirt outline: its height always reflects the
  // true real proportions (realHeight * scale), anchored at the collar-top edge.
  const commitShirtRef = useCallback(
    (rect: Rect) => {
      const s = rect.width > 0 && realWidthCm > 0 ? rect.width / realWidthCm : null
      const height = s && realHeightCm > 0 ? realHeightCm * s : rect.height
      setShirtRef({ x: rect.x, y: rect.y, width: rect.width, height })
    },
    [realWidthCm, realHeightCm],
  )

  // Keep the outline height in sync when the real dimensions change.
  useEffect(() => {
    setShirtRef((prev) => {
      if (!prev || !(prev.width > 0) || !(realWidthCm > 0) || !(realHeightCm > 0)) return prev
      const height = realHeightCm * (prev.width / realWidthCm)
      return height === prev.height ? prev : { ...prev, height }
    })
  }, [realWidthCm, realHeightCm])

  const handleUpload = useCallback(async (file: File) => {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(file)
    })
    const img = await loadImage(dataUrl)
    setImage(img)
    setImageDataUrl(dataUrl)
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
    setShirtRef(null)
    setBoxes([])
    setSelectedId(null)
    setDrawMode('none')
    setSavedAt(null)
    if (name === 'Untitled design') {
      setName(file.name.replace(/\.[^.]+$/, '') || 'Untitled design')
    }
  }, [name])

  const handleCreateRect = useCallback(
    (mode: Exclude<DrawMode, 'none'>, rect: Rect) => {
      if (mode === 'ref') {
        commitShirtRef(rect)
        setSelectedId(SHIRT_REF_ID)
        setDrawMode('none')
        return
      }
      // design: try to snap to the artwork inside the drawn region
      let final = rect
      if (image) {
        const roi = shirtRef ? intersectRect(rect, shirtRef) ?? rect : rect
        const detected = detectArtworkBounds(image, roi, { sensitivity })
        if (detected) final = detected
      }
      const newBox: DesignBox = {
        id: uid('box'),
        name: `Design ${boxes.length + 1}`,
        color: BOX_COLORS[boxes.length % BOX_COLORS.length],
        ...final,
      }
      setBoxes((prev) => [...prev, newBox])
      setSelectedId(newBox.id)
      setDrawMode('none')
    },
    [boxes.length, image, commitShirtRef, shirtRef, sensitivity],
  )

  const handleSnapBox = useCallback(
    (boxId: string) => {
      if (!image) return
      setBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== boxId) return b
          let roi = expandRect(b, 0.06, image.naturalWidth, image.naturalHeight)
          if (shirtRef) roi = intersectRect(roi, shirtRef) ?? roi
          const detected = detectArtworkBounds(image, roi, { sensitivity })
          return detected ? { ...b, ...detected } : b
        }),
      )
    },
    [image, shirtRef, sensitivity],
  )

  const handleReSnapAll = useCallback(() => {
    if (!image) return
    setBoxes((prev) =>
      prev.map((b) => {
        let roi = expandRect(b, 0.06, image.naturalWidth, image.naturalHeight)
        if (shirtRef) roi = intersectRect(roi, shirtRef) ?? roi
        const detected = detectArtworkBounds(image, roi, { sensitivity })
        return detected ? { ...b, ...detected } : b
      }),
    )
  }, [image, shirtRef, sensitivity])

  const handleSave = useCallback(async () => {
    if (!imageDataUrl) return
    setSaving(true)
    const record: DesignRecord = {
      id: recordId,
      name: name.trim() || 'Untitled design',
      imageDataUrl,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      realWidthCm,
      realHeightCm,
      shirtRef,
      boxes,
      createdAt,
      updatedAt: Date.now(),
    }
    const saved = await saveDesign(record)
    setSavedAt(saved.updatedAt)
    setSaving(false)
    if (!id) {
      // Mark as already-loaded so the route change below doesn't re-fetch/flash.
      loadedIdRef.current = recordId
      navigate(`/editor/${recordId}`, { replace: true })
    }
  }, [
    imageDataUrl,
    recordId,
    name,
    imageSize,
    realWidthCm,
    realHeightCm,
    shirtRef,
    boxes,
    createdAt,
    id,
    navigate,
  ])

  const handleNew = useCallback(() => {
    loadedIdRef.current = null
    setRecordId(uid('design'))
    setName('Untitled design')
    setImage(null)
    setImageDataUrl('')
    setImageSize({ width: 0, height: 0 })
    setShirtRef(null)
    setBoxes([])
    setSelectedId(null)
    setDrawMode('none')
    setCreatedAt(Date.now())
    setSavedAt(null)
    navigate('/', { replace: true })
  }, [navigate])

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1">
        <CanvasStage
          image={image}
          imageWidth={imageSize.width}
          imageHeight={imageSize.height}
          shirtRef={shirtRef}
          boxes={boxes}
          measurements={measurements}
          scaleReady={scale != null}
          selectedId={selectedId}
          drawMode={drawMode}
          onSelect={setSelectedId}
          onCreateRect={handleCreateRect}
          onUpdateShirtRef={commitShirtRef}
          onUpdateBox={(boxId, rect) =>
            setBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, ...rect } : b)))
          }
        />
      </div>
      <Sidebar
        name={name}
        onNameChange={setName}
        hasImage={!!image}
        onUpload={handleUpload}
        onSave={handleSave}
        onNew={handleNew}
        saving={saving}
        savedAt={savedAt}
        realWidthCm={realWidthCm}
        realHeightCm={realHeightCm}
        onRealWidth={setRealWidthCm}
        onRealHeight={setRealHeightCm}
        onPreset={(w, h) => {
          setRealWidthCm(w)
          setRealHeightCm(h)
        }}
        shirtRef={shirtRef}
        scale={scale}
        drawMode={drawMode}
        onStartRefDraw={() => setDrawMode((m) => (m === 'ref' ? 'none' : 'ref'))}
        boxes={boxes}
        measurements={measurements}
        selectedId={selectedId}
        onSelectBox={setSelectedId}
        onRenameBox={(boxId, newName) =>
          setBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, name: newName } : b)))
        }
        onSnapBox={handleSnapBox}
        onDeleteBox={(boxId) => {
          setBoxes((prev) => prev.filter((b) => b.id !== boxId))
          setSelectedId((cur) => (cur === boxId ? null : cur))
        }}
        onStartDesignDraw={() => setDrawMode((m) => (m === 'design' ? 'none' : 'design'))}
        onReSnapAll={handleReSnapAll}
        sensitivity={sensitivity}
        onSensitivity={setSensitivity}
        onOpenComposer={setComposerBoxId}
      />

      {composerBoxId &&
        image &&
        (() => {
          const b = boxes.find((x) => x.id === composerBoxId)
          const m = measurements.find((x) => x.id === composerBoxId)
          if (!b || !m || !Number.isFinite(m.widthCm)) return null
          const applyPrint = (print: PrintSpec) =>
            setBoxes((prev) => prev.map((x) => (x.id === composerBoxId ? { ...x, print } : x)))
          return (
            <ComposerModal
              image={image}
              box={b}
              measuredWidthCm={m.widthCm}
              measuredHeightCm={m.heightCm}
              shirtWidthCm={realWidthCm}
              shirtHeightCm={realHeightCm}
              onClose={() => setComposerBoxId(null)}
              onApply={applyPrint}
            />
          )
        })()}
    </div>
  )
}
