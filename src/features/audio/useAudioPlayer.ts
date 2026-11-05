import { reactive } from 'vue'
import type { UiMessage } from '../../types/chat'

export type TrackKind = 'voice' | 'music'
export type RepeatMode = 'off' | 'all' | 'one'

export type AudioTrack = {
  /** Message id (or client id while sending). */
  key: string
  message: UiMessage
  /** The chat the message is in, to go back to it from the player. */
  chat: { id: string; username: string; isGroup?: boolean }
  kind: TrackKind
  /** The artist of a song (or its title when there is none); who sent a voice message. */
  title: string
  /** The title of a song; when a voice message was sent. */
  subtitle: string
  cover: string | null
  duration: number
  size: number
}

const SETTINGS_KEY = 'phi.player'
const SPEEDS = [1, 1.5, 2]

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return {
      volume: Number.isFinite(stored.volume) ? Math.min(1, Math.max(0, stored.volume)) : 1,
      speed: SPEEDS.includes(stored.speed) ? stored.speed as number : 1,
      shuffle: stored.shuffle === true,
      repeat: (['off', 'all', 'one'].includes(stored.repeat) ? stored.repeat : 'off') as RepeatMode
    }
  } catch {
    return { volume: 1, speed: 1, shuffle: false, repeat: 'off' as RepeatMode }
  }
}

const state = reactive({
  ...loadSettings(),
  muted: false,
  current: null as AudioTrack | null,
  queue: [] as AudioTrack[],
  playing: false,
  loading: false,
  failed: false,
  time: 0,
  duration: 0
})

let element: HTMLAudioElement | null = null
let urlFor: ((message: UiMessage) => Promise<string>) | null = null
/** Bumped for every track change: a slow decryption of an older choice is ignored. */
let loadToken = 0

function saveSettings() {
  const { volume, speed, shuffle, repeat } = state
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ volume, speed, shuffle, repeat })) } catch {}
}

function audio(): HTMLAudioElement {
  if (element) return element

  const created = new Audio()
  created.preload = 'auto'
  created.volume = state.volume
  created.addEventListener('timeupdate', () => { state.time = created.currentTime })
  created.addEventListener('durationchange', () => {
    // Recorded voice messages report no duration; theirs comes with the message.
    if (Number.isFinite(created.duration)) state.duration = created.duration
  })
  created.addEventListener('play', () => { state.playing = true })
  created.addEventListener('pause', () => { state.playing = false })
  created.addEventListener('ended', () => void next(true))
  created.addEventListener('error', () => {
    if (!created.getAttribute('src')) return
    state.loading = false
    state.failed = true
    state.playing = false
  })

  element = created
  return created
}

function publishToSystem(track: AudioTrack) {
  const session = navigator.mediaSession
  if (!session || typeof MediaMetadata === 'undefined') return

  session.metadata = new MediaMetadata({
    title: track.title,
    artist: track.subtitle,
    artwork: track.cover ? [{ src: track.cover, sizes: '96x96', type: 'image/jpeg' }] : []
  })
  session.setActionHandler('play', () => void toggle())
  session.setActionHandler('pause', () => void toggle())
  session.setActionHandler('previoustrack', () => void previous())
  session.setActionHandler('nexttrack', () => void next())
}

async function start(track: AudioTrack) {
  const player = audio()
  const token = ++loadToken

  player.pause()
  state.current = track
  state.time = 0
  state.duration = track.duration
  state.failed = false
  state.loading = true

  try {
    const url = await urlFor!(track.message)
    if (token !== loadToken) return

    player.src = url
    player.defaultPlaybackRate = state.speed
    player.playbackRate = state.speed
    await player.play()
    publishToSystem(track)
  } catch (error) {
    if (token !== loadToken) return
    console.warn('audio playback failed', error)
    state.failed = true
  } finally {
    if (token === loadToken) state.loading = false
  }
}

/** Plays `track` (with `queue` as what comes next), or pauses it when it is the one playing. */
function play(track: AudioTrack, queue: AudioTrack[]) {
  state.queue = queue
  if (state.current?.key === track.key && !state.failed) return toggle()
  return start(track)
}

async function toggle() {
  const player = audio()
  if (!state.current) return
  if (player.paused) {
    try { await player.play() } catch {}
  } else {
    player.pause()
  }
}

function pickRandom(current: number) {
  const count = state.queue.length
  if (count < 2) return current
  const offset = 1 + Math.floor(Math.random() * (count - 1))
  return (current + offset) % count
}

async function next(ended = false) {
  const current = state.current
  if (!current) return

  if (ended && state.repeat === 'one') {
    seek(0)
    return toggle()
  }

  const index = state.queue.findIndex(track => track.key === current.key)
  const music = current.kind === 'music'
  const target = music && state.shuffle ? pickRandom(index) : index + 1

  if (target < state.queue.length && target !== index) return start(state.queue[target])
  if (music && state.repeat === 'all' && state.queue.length) return start(state.queue[0])

  // The end of the list: a finished track closes the player, the "next" button does nothing.
  if (ended) close()
}

async function previous() {
  const current = state.current
  if (!current) return

  if (state.time > 3) return seek(0)

  const index = state.queue.findIndex(track => track.key === current.key)
  if (index > 0) return start(state.queue[index - 1])
  seek(0)
}

function seek(seconds: number) {
  const player = audio()
  const limit = state.duration || player.duration || 0
  player.currentTime = Math.min(Math.max(0, seconds), limit || seconds)
  state.time = player.currentTime
}

function seekRatio(ratio: number) {
  seek(ratio * (state.duration || 0))
}

function cycleSpeed() {
  state.speed = SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]
  if (element) {
    element.defaultPlaybackRate = state.speed
    element.playbackRate = state.speed
  }
  saveSettings()
}

function setVolume(volume: number) {
  state.volume = Math.min(1, Math.max(0, volume))
  state.muted = state.volume === 0
  if (element) {
    element.volume = state.volume
    element.muted = state.muted
  }
  saveSettings()
}

function toggleMuted() {
  state.muted = !state.muted
  if (element) element.muted = state.muted
}

function toggleShuffle() {
  state.shuffle = !state.shuffle
  saveSettings()
}

function cycleRepeat() {
  state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off'
  saveSettings()
}

function close() {
  loadToken++
  if (element) {
    element.pause()
    element.removeAttribute('src')
    element.load()
  }
  state.current = null
  state.queue = []
  state.playing = false
  state.loading = false
  state.failed = false
  state.time = 0
  state.duration = 0
  if (navigator.mediaSession) navigator.mediaSession.metadata = null
}

/** The chat's audio changed (older messages loaded, new ones arrived): keeps the list up to date. */
function syncQueue(chatId: string, tracks: AudioTrack[]) {
  const current = state.current
  if (!current || current.chat.id !== chatId) return

  const sameKind = tracks.filter(track => track.kind === current.kind)
  state.queue = sameKind.some(track => track.key === current.key) ? sameKind : [current, ...sameKind]
}

/** A message was deleted: it cannot stay in the player. */
function forget(key: string) {
  state.queue = state.queue.filter(track => track.key !== key)
  if (state.current?.key === key) void next(true)
}

export function useAudioPlayer() {
  return {
    state,
    speeds: SPEEDS,
    /** Where the decrypted audio comes from. */
    configure(resolveUrl: (message: UiMessage) => Promise<string>) { urlFor = resolveUrl },
    play,
    toggle,
    next: () => next(),
    previous,
    seek,
    seekRatio,
    cycleSpeed,
    setVolume,
    toggleMuted,
    toggleShuffle,
    cycleRepeat,
    close,
    syncQueue,
    forget
  }
}
