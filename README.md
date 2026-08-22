# Sizer Studio

A local, browser-based tool for turning an AI-generated shirt mockup into exact **print dimensions in cm** for a manufacturer. Upload a shirt image, calibrate a real-world scale from the shirt's width, auto-detect the artwork, and read off the design size (with decimals). Save everything to a dashboard.

Everything runs client-side — images and measurements are stored in your browser (IndexedDB). No server, no uploads.

## How the measurement works

The scale is **uniform and anchored on width** (matching the "width is the starting point" workflow):

```
scale (px per cm) = shirtWidthPx / realWidthCm
```

- The **shirt-width reference** box you draw sets `shirtWidthPx`. Its width maps to the real shirt width in cm.
- The same scale is applied to **both** axes. So a 1000px-wide shirt at 50cm gives 20 px/cm, and a 70cm real height then spans 1400px. That 70cm span is drawn as the dashed teal **real-shirt outline**, anchored at the reference's top edge (collar top), so you can see the true proportions over the digital mockup.
- Each **design box** is measured from its outermost pixels and converted:

```
designWidthCm  = designWidthPx  / scale
designHeightCm = designHeightPx / scale
```

Results show 2 decimals, plus the nearest whole-cm value your manufacturer would actually print (they crop to the artwork's bounding box and print integers).

### Verified against the reference spreadsheet

With a shirt measured at 352px wide mapped to 50cm (`scale = 7.04 px/cm`):

- Back design 248px wide → `248 / 7.04 = 35.23 cm`
- Front design 89px wide → `89 / 7.04 = 12.64 cm`

These match the manual Excel values. (Height uses the same width-anchored scale, so a non-proportional mockup reads taller/narrower on purpose — that's the width-anchored choice.)

## Auto-detecting artwork

When you add a design, drag a rough box over the print area. Detection runs at the image's **native resolution** (no downscaling) and:

- Uses the max RGB channel so both white artwork and colored seals stand out from the dark fabric.
- Applies **hysteresis thresholding** (Otsu-derived): it seeds on clearly-bright artwork pixels and grows into connected faint edges, so faint cloud wisps are kept while isolated faint fabric seams are dropped.
- Labels connected components, discards specks/sparkle by area, and returns the union bounding box of the real artwork.

A **sensitivity** slider tunes how faint an edge to include, the wand re-snaps, and the transform handles let you fine-tune. Tip: draw the box around the artwork (not across the collar/sleeve seams) for the tightest automatic fit.

## Golden ratio composer & export

Each measured design has a golden-ratio composer (the crop icon on the design, or set it up before exporting):

- **Apply golden ratio (0.618)** sets one dimension to `0.618 x shirt dimension` and derives the other from the artwork's own aspect ratio (so it's never distorted). Toggle whether to anchor on the shirt's width or height. Example: a 50 x 70 shirt, width-anchored -> ~30.9 cm wide.
- **Resize / reposition** the artwork inside the print frame by dragging it or dragging a corner. Any empty margin is **filled with the shirt's main color** (auto-sampled from the fabric around the design, overridable with a color picker) so there's no white space and the manufacturer won't crop the frame away.
- **Download PNG** exports a print-ready image at native pixel density (frame cm x the design's px/cm), and **Apply to design** stores the golden/print size, which then shows in the results panel and dashboard.

## Using it

1. **Upload image** (right panel).
2. Set the **real shirt size** in cm (or pick a preset S/M/L/XL).
3. **Set shirt width**: click the button, then drag a box across the torso width with its top at the collar top.
4. **Add** a design, drag over each print area (front, back, sleeve…). Rename and snap as needed.
5. Read the cm dimensions per design. **Save** to keep it on the Dashboard with a preview.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build
npm run preview  # preview the production build
```

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4
- react-konva / Konva (interactive image canvas)
- localforage (IndexedDB persistence)
- react-router
