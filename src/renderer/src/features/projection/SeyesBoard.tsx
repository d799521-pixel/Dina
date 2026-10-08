import { useMemo } from 'react'
import type { BoardFont, Ruling } from '@shared/types'
import { BOARD_FONTS, useGlyphRatio } from './boardFonts'

/** Largeur de référence : `unitPx` est exprimé pour un écran de 1280 px. */
export const REFERENCE_WIDTH = 1280

const COLORS = {
  thin: '#c9c1ea', // lignes fines (interlignes)
  thick: '#8a7cc8', // lignes d'écriture
  vertical: '#d6d0f0',
  margin: '#e2445c'
}

export interface BoardProps {
  text: string
  font: BoardFont
  ruling: Ruling
  unitPx: number
  xHeightUnits: 1 | 2
  ink: string
  showMargin: boolean
  width: number
  height: number
  fontRev?: number
  /** Réduit la taille si nécessaire pour que le texte tienne sur ce nombre de lignes. */
  fitLines?: number
}

let measureCtx: CanvasRenderingContext2D | null = null
function textWidth(text: string, font: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  measureCtx!.font = font
  return measureCtx!.measureText(text).width
}

/** Découpe le texte en lignes tenant dans `maxWidth` (les retours à la ligne sont conservés). */
export function wrapText(text: string, font: string, maxWidth: number, measure = textWidth): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (line && measure(candidate, font) > maxWidth) {
        lines.push(line)
        line = word
      } else line = candidate
    }
    lines.push(line)
  }
  return lines
}

/**
 * Tableau ligné rendu en SVG : lignage Seyès (grands carreaux de 8 mm divisés
 * en 4 interlignes) ou double ligne de CP. Le texte est posé exactement sur la
 * ligne d'écriture (`y` = ligne de base) et la taille de police est calculée
 * pour que la hauteur d'x corresponde à 1 ou 2 interlignes.
 */
export function SeyesBoard({ text, font, ruling, unitPx, xHeightUnits, ink, showMargin, width, height, fontRev = 0, fitLines }: BoardProps): React.JSX.Element | null {
  const { family, uppercase } = BOARD_FONTS[font]
  const ratio = useGlyphRatio(family, Boolean(uppercase), fontRev)
  const content = uppercase ? text.toUpperCase() : text

  const layout = useMemo(() => {
    const compute = (unit: number) => {
      const u = (unit * width) / REFERENCE_WIDTH // un interligne, en px
      const square = 4 * u // un grand carreau
      // Hauteur d'x visée ; les capitales script occupent deux fois cette hauteur.
      const glyph = xHeightUnits * u * (uppercase ? 2 : 1)
      const cssFont = `${glyph / ratio}px "${family}"`
      const marginX = showMargin && ruling === 'seyes' ? square * 2 : 0
      const textX = marginX + (ruling === 'seyes' ? u * 1.5 : square)
      const lines = width > 0 ? wrapText(content, cssFont, width - textX - square) : []
      return { u, square, glyph, cssFont, marginX, textX, lines }
    }
    let result = compute(unitPx)
    // Réduction par paliers d'un demi-pixel (référence 1280 px) jusqu'à tenir.
    for (let unit = unitPx - 0.5; fitLines && result.lines.length > fitLines && unit >= 6; unit -= 0.5) {
      result = compute(unit)
    }
    return result
  }, [content, family, ratio, width, unitPx, xHeightUnits, uppercase, showMargin, ruling, fitLines])

  const { u, square, glyph, cssFont, marginX, textX, lines } = layout
  const lineStep = square * xHeightUnits * (ruling === 'double' ? 1.5 : 1)
  const firstBaseline = square * (xHeightUnits === 2 ? 2 : 1) + (ruling === 'double' ? square : 0)

  if (width <= 0 || height <= 0) return null
  const contentHeight = firstBaseline + lines.length * lineStep + square
  const h = Math.max(height, contentHeight)

  const horizontal: React.ReactNode[] = []
  const vertical: React.ReactNode[] = []
  if (ruling === 'seyes') {
    for (let i = 1, y = u; y < h; i++, y = i * u) {
      const thick = i % 4 === 0
      horizontal.push(<line key={`h${i}`} x1={0} x2={width} y1={y} y2={y} stroke={thick ? COLORS.thick : COLORS.thin} strokeWidth={thick ? Math.max(1, u / 12) : Math.max(0.6, u / 22)} />)
    }
    for (let x = marginX + square, i = 0; x < width; x += square, i++) {
      vertical.push(<line key={`v${i}`} x1={x} x2={x} y1={0} y2={h} stroke={COLORS.vertical} strokeWidth={Math.max(0.6, u / 22)} />)
    }
  } else if (ruling === 'double') {
    lines.forEach((_, i) => {
      const base = firstBaseline + i * lineStep
      horizontal.push(
        <g key={`d${i}`}>
          <line x1={square / 2} x2={width - square / 2} y1={base} y2={base} stroke={COLORS.thick} strokeWidth={Math.max(1, u / 10)} />
          <line x1={square / 2} x2={width - square / 2} y1={base - glyph} y2={base - glyph} stroke={COLORS.thin} strokeWidth={Math.max(0.8, u / 16)} />
        </g>
      )
    })
  }

  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} className="block" role="img" aria-label={text}>
      <rect width={width} height={h} fill="#fffef9" />
      {vertical}
      {horizontal}
      {marginX > 0 && <line x1={marginX} x2={marginX} y1={0} y2={h} stroke={COLORS.margin} strokeWidth={Math.max(1.2, u / 8)} />}
      <g fill={ink} style={{ font: cssFont }}>
        {lines.map((line, i) => (
          <text key={i} x={textX} y={firstBaseline + i * lineStep} dominantBaseline="alphabetic" xmlSpace="preserve">
            {line}
          </text>
        ))}
      </g>
    </svg>
  )
}
