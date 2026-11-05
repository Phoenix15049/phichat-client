/** A tile's place in an album, as fractions of the album's width. */
export type AlbumTile = { x: number; y: number; w: number; h: number }

export type AlbumLayout = { tiles: AlbumTile[]; /** Album height as a fraction of its width. */ height: number }

const MIN_RATIO = 0.6
const MAX_RATIO = 1.9
const MAX_HEIGHT = 1.2

const clampRatio = (ratio: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio || 1))
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/** Items side by side, as tall as needed to fill the width without cropping. */
function row(ratios: number[], y: number): AlbumTile[] {
  const height = 1 / sum(ratios)
  let x = 0
  return ratios.map(ratio => {
    const tile = { x, y, w: ratio * height, h: height }
    x += tile.w
    return tile
  })
}

function stackRows(ratios: number[], sizes: number[]): AlbumLayout {
  const tiles: AlbumTile[] = []
  let start = 0
  let y = 0
  for (const size of sizes) {
    const line = row(ratios.slice(start, start + size), y)
    tiles.push(...line)
    y += line[0].h
    start += size
  }
  return { tiles, height: y }
}

/** A tall item beside a column of the others. */
function sideColumn(ratios: number[]): AlbumLayout {
  const [first, ...rest] = ratios
  const inverse = sum(rest.map(ratio => 1 / ratio))
  const columnWidth = Math.min(0.55, Math.max(0.3, 1 / (1 + first * inverse)))
  const height = columnWidth * inverse

  let y = 0
  const column = rest.map(ratio => {
    const tile = { x: 1 - columnWidth, y, w: columnWidth, h: columnWidth / ratio }
    y += tile.h
    return tile
  })

  return { tiles: [{ x: 0, y: 0, w: 1 - columnWidth, h: height }, ...column], height }
}

/** How many items go on each row for a longer album. */
function rowSizes(count: number): number[] {
  const sizes: number[] = []
  let left = count
  while (left > 0) {
    // Rows of three, with pairs where a single item would otherwise be left alone.
    const size = left === 4 || left === 2 ? 2 : 3
    sizes.push(Math.min(size, left))
    left -= size
  }
  return sizes
}

/** Fits the items (given as width / height ratios) into a mosaic with no gaps. */
export function albumLayout(rawRatios: number[]): AlbumLayout {
  const ratios = rawRatios.map(clampRatio)
  const count = ratios.length
  const average = sum(ratios) / Math.max(1, count)

  let layout: AlbumLayout
  if (count <= 1) layout = stackRows(ratios, [count])
  else if (count === 2) layout = average > 1.4 ? stackRows(ratios, [1, 1]) : stackRows(ratios, [2])
  else if (count <= 4 && ratios[0] < 0.9) layout = sideColumn(ratios)
  else if (count <= 4) layout = stackRows(ratios, [1, count - 1])
  else layout = stackRows(ratios, rowSizes(count))

  // Very tall mosaics are squeezed; the tiles crop their content instead of growing.
  if (layout.height > MAX_HEIGHT) {
    const scale = MAX_HEIGHT / layout.height
    layout = {
      height: MAX_HEIGHT,
      tiles: layout.tiles.map(tile => ({ ...tile, y: tile.y * scale, h: tile.h * scale }))
    }
  }

  return layout
}

/** Items of one album are sent together, up to this many (more become further albums). */
export const MAX_ALBUM_ITEMS = 10
