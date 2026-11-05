import type { AudioMeta } from '../../services/e2ee/messageCodec'

const COVER_SIZE = 96
/** ID3 tags sit at the start of the file; covers rarely go past this. */
const MAX_TAG_BYTES = 3_000_000

type Id3 = { title?: string; performer?: string; cover?: Blob }

function decodeText(bytes: Uint8Array): string {
  const encoding = bytes[0]
  const body = bytes.subarray(1)
  const label = encoding === 1 ? 'utf-16' : encoding === 2 ? 'utf-16be' : encoding === 3 ? 'utf-8' : 'latin1'
  return new TextDecoder(label).decode(body).replace(/\0+$/, '').split('\0')[0].trim()
}

function syncSafe(view: DataView, offset: number) {
  return (view.getUint8(offset) << 21) | (view.getUint8(offset + 1) << 14) | (view.getUint8(offset + 2) << 7) | view.getUint8(offset + 3)
}

/** The picture of an APIC frame: encoding, MIME type, picture type, description, then the image. */
function parsePicture(frame: Uint8Array): Blob | undefined {
  const encoding = frame[0]
  let index = 1
  const mimeEnd = frame.indexOf(0, index)
  if (mimeEnd < 0) return undefined
  const mime = new TextDecoder('latin1').decode(frame.subarray(index, mimeEnd)) || 'image/jpeg'
  index = mimeEnd + 2

  // The description ends with a one or two byte zero, depending on its encoding.
  const wide = encoding === 1 || encoding === 2
  while (index < frame.length) {
    if (frame[index] === 0 && (!wide || frame[index + 1] === 0)) break
    index += wide ? 2 : 1
  }
  index += wide ? 2 : 1

  return index < frame.length ? new Blob([frame.slice(index)], { type: mime.includes('/') ? mime : 'image/jpeg' }) : undefined
}

/** Title, artist and cover from an ID3v2.3 / 2.4 tag (MP3 files). */
function parseId3(buffer: ArrayBuffer): Id3 {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const tags: Id3 = {}

  if (bytes.length < 10 || String.fromCharCode(bytes[0], bytes[1], bytes[2]) !== 'ID3') return tags

  const version = bytes[3]
  if (version !== 3 && version !== 4) return tags

  const end = Math.min(bytes.length, 10 + syncSafe(view, 6))
  let offset = 10

  while (offset + 10 <= end) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
    if (!/^[A-Z0-9]{4}$/.test(id)) break

    const size = version === 4 ? syncSafe(view, offset + 4) : view.getUint32(offset + 4)
    const start = offset + 10
    if (size <= 0 || start + size > end) break

    const frame = bytes.subarray(start, start + size)
    if (id === 'TIT2') tags.title = decodeText(frame)
    else if (id === 'TPE1') tags.performer = decodeText(frame)
    else if (id === 'APIC' && !tags.cover) tags.cover = parsePicture(frame)

    offset = start + size
  }

  return tags
}

async function shrinkCover(cover: Blob): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(cover)
    const scale = COVER_SIZE / Math.min(bitmap.width, bitmap.height)
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = COVER_SIZE
    canvas.height = COVER_SIZE
    canvas.getContext('2d')?.drawImage(bitmap, (COVER_SIZE - width) / 2, (COVER_SIZE - height) / 2, width, height)
    bitmap.close()

    return canvas.toDataURL('image/jpeg', 0.72)
  } catch {
    return undefined
  }
}

function readDuration(file: File): Promise<number | undefined> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const element = new Audio()
    const finish = (value?: number) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }
    element.preload = 'metadata'
    element.onloadedmetadata = () => finish(Number.isFinite(element.duration) ? element.duration : undefined)
    element.onerror = () => finish()
    element.src = url
  })
}

/** What the sender's device knows about a music file; everything here travels encrypted. */
export async function readAudioMeta(file: File): Promise<AudioMeta> {
  const [tags, duration] = await Promise.all([
    file.slice(0, MAX_TAG_BYTES).arrayBuffer().then(parseId3).catch((): Id3 => ({})),
    readDuration(file)
  ])

  return {
    title: tags.title || undefined,
    performer: tags.performer || undefined,
    duration,
    cover: tags.cover ? await shrinkCover(tags.cover) : undefined
  }
}
