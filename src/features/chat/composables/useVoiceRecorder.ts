import { onBeforeUnmount, ref } from 'vue'
import type { VoiceMeta } from '../../../services/e2ee/messageCodec'

export type RecordedVoice = { blob: Blob; mime: string; voice: VoiceMeta }

const MAX_SECONDS = 15 * 60
const WAVEFORM_BARS = 48

/** Opus in WebM where supported (Chrome, Firefox), MP4/AAC on Safari. */
function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return candidates.find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) ?? ''
}

/** Peak level per bar, scaled to 0..31 (relative to the loudest bar). */
async function computeWaveform(blob: Blob): Promise<number[]> {
  try {
    const context = new AudioContext()
    const audio = await context.decodeAudioData(await blob.arrayBuffer())
    void context.close()

    const data = audio.getChannelData(0)
    const size = Math.max(1, Math.floor(data.length / WAVEFORM_BARS))
    const peaks: number[] = []
    for (let bar = 0; bar < WAVEFORM_BARS; bar++) {
      let peak = 0
      for (let i = bar * size; i < Math.min(data.length, (bar + 1) * size); i++) {
        const value = Math.abs(data[i])
        if (value > peak) peak = value
      }
      peaks.push(peak)
    }
    const max = Math.max(...peaks, 0.01)
    return peaks.map(peak => Math.round((peak / max) * 31))
  } catch {
    return Array(WAVEFORM_BARS).fill(8)
  }
}

/** Records a voice message with the microphone; the mic is released as soon as recording ends. */
export function useVoiceRecorder() {
  const recording = ref(false)
  const elapsed = ref(0)
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: Blob[] = []
  let startedAt = 0
  let ticker: number | null = null
  let finish: ((voice: RecordedVoice | null) => void) | null = null
  let cancelled = false

  function releaseMic() {
    stream?.getTracks().forEach(track => track.stop())
    stream = null
    if (ticker !== null) window.clearInterval(ticker)
    ticker = null
    recording.value = false
  }

  /** Throws if the microphone is unavailable or permission is denied. */
  async function start() {
    if (recording.value) return
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })

    const mime = pickMime()
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : undefined)
    chunks = []
    cancelled = false
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = async () => {
      const duration = (Date.now() - startedAt) / 1000
      releaseMic()
      const done = finish
      finish = null
      if (cancelled || !chunks.length || duration < 0.5) {
        done?.(null)
        return
      }
      const type = (recorder?.mimeType || mime || 'audio/webm').split(';')[0]
      const blob = new Blob(chunks, { type })
      done?.({ blob, mime: type, voice: { duration: Math.round(duration * 10) / 10, waveform: await computeWaveform(blob) } })
    }

    recorder.start(250)
    startedAt = Date.now()
    elapsed.value = 0
    recording.value = true
    ticker = window.setInterval(() => {
      elapsed.value = Math.floor((Date.now() - startedAt) / 1000)
      if (elapsed.value >= MAX_SECONDS) void stop()
    }, 250)
  }

  /** Stops and returns the recording (null if it was too short or cancelled). */
  function stop(): Promise<RecordedVoice | null> {
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null)
    return new Promise(resolve => {
      finish = resolve
      recorder!.stop()
    })
  }

  function cancel() {
    cancelled = true
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else releaseMic()
  }

  onBeforeUnmount(cancel)

  return { supported, recording, elapsed, start, stop, cancel }
}
