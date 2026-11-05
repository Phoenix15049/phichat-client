<template>
  <Transition name="player">
    <div v-if="track" class="player" dir="ltr">
      <div class="h-9 flex items-center gap-px px-1.5 sm:px-2.5">
        <button type="button" class="ctl" :aria-label="$t('player.previous')" :title="$t('player.previous')" @click="player.previous()">
          <SkipBack class="w-4 h-4" fill="currentColor" />
        </button>
        <button type="button" class="ctl ctl-main" :aria-label="state.playing ? $t('chat.pause') : $t('chat.play')" @click="player.toggle()">
          <Loader2 v-if="state.loading" class="w-4 h-4 animate-spin" />
          <Pause v-else-if="state.playing" class="w-4 h-4" fill="currentColor" />
          <Play v-else class="w-4 h-4" fill="currentColor" />
        </button>
        <button type="button" class="ctl" :aria-label="$t('player.next')" :title="$t('player.next')" @click="player.next()">
          <SkipForward class="w-4 h-4" fill="currentColor" />
        </button>

        <!-- Click goes to the message; hovering (or the arrow) shows the list -->
        <div class="relative flex-1 min-w-0 ms-1.5 flex items-center" @mouseenter="openList" @mouseleave="closeListSoon">
          <button type="button" class="min-w-0 text-start truncate text-[13px] leading-none hover:text-accent transition" :title="$t('player.goToMessage')" @click="emit('go', track)">
            <span class="font-semibold text-ink"><bdi>{{ track.title }}</bdi></span>
            <span v-if="track.subtitle" class="ms-1 text-muted">{{ track.kind === 'music' ? '– ' : '' }}<bdi>{{ track.subtitle }}</bdi></span>
          </button>
          <button
            v-if="hasList"
            type="button"
            class="ctl"
            :aria-label="$t('player.playlist')"
            :aria-expanded="listOpen"
            @click="listOpen = !listOpen"
          >
            <ChevronDown class="w-4 h-4 transition-transform" :class="listOpen ? 'rotate-180' : ''" />
          </button>

          <Transition name="drop">
            <div v-if="listOpen && hasList" class="glass-panel absolute top-full start-0 mt-1.5 w-[min(25rem,calc(100vw-1.5rem))] z-[45] rounded-2xl overflow-hidden">
              <ul class="max-h-80 overflow-y-auto p-1.5">
                <li v-for="item in state.queue" :key="item.key">
                  <button
                    type="button"
                    class="w-full flex items-center gap-3 rounded-xl px-2 py-1.5 text-start hover:bg-ink/5 transition"
                    :class="item.key === track.key ? 'bg-accent/10' : ''"
                    @click="player.play(item, state.queue)"
                    @contextmenu.prevent.stop="openItemMenu($event, item)"
                  >
                    <TrackCover :track="item" :active="item.key === track.key" />
                    <span class="flex-1 min-w-0">
                      <span class="block text-[13.5px] truncate text-ink"><bdi><b class="font-semibold">{{ item.title }}</b><template v-if="item.subtitle"> – {{ item.subtitle }}</template></bdi></span>
                      <span class="block text-[12px] text-muted tabular-nums"><bdi dir="ltr">{{ itemInfo(item) }}</bdi></span>
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </Transition>
        </div>

        <span class="hidden sm:block w-11 text-center text-[12px] text-muted tabular-nums shrink-0">{{ formatClock(state.time) }}</span>

        <!-- Volume: the slider unfolds on hover -->
        <div class="hidden sm:flex items-center group">
          <button type="button" class="ctl" :aria-label="$t('player.volume')" @click="player.toggleMuted()">
            <VolumeX v-if="state.muted || state.volume === 0" class="w-4 h-4" />
            <Volume1 v-else-if="state.volume < 0.5" class="w-4 h-4" />
            <Volume2 v-else class="w-4 h-4" />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            class="volume"
            :value="state.muted ? 0 : state.volume"
            :aria-label="$t('player.volume')"
            @input="player.setVolume(Number(($event.target as HTMLInputElement).value))"
          />
        </div>

        <template v-if="track.kind === 'music'">
          <button type="button" class="ctl" :class="state.shuffle ? 'ctl-on' : ''" :aria-pressed="state.shuffle" :aria-label="$t('player.shuffle')" :title="$t('player.shuffle')" @click="player.toggleShuffle()">
            <Shuffle class="w-4 h-4" />
          </button>
          <button type="button" class="ctl" :class="state.repeat !== 'off' ? 'ctl-on' : ''" :aria-label="$t('player.repeat')" :title="$t(`player.repeat_${state.repeat}`)" @click="player.cycleRepeat()">
            <Repeat1 v-if="state.repeat === 'one'" class="w-4 h-4" />
            <Repeat v-else class="w-4 h-4" />
          </button>
        </template>

        <button type="button" class="ctl text-[11px] font-bold tabular-nums" :class="state.speed !== 1 ? 'ctl-on' : ''" :aria-label="$t('player.speed')" :title="$t('player.speed')" @click="player.cycleSpeed()">
          {{ state.speed }}×
        </button>

        <button type="button" class="ctl" :aria-label="$t('common.close')" @click="player.close()">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Progress: click or drag to seek -->
      <div
        class="progress"
        role="slider"
        tabindex="0"
        :aria-label="$t('player.position')"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(progress * 100)"
        @pointerdown="startSeek"
        @keydown.left.prevent="player.seek(state.time - 5)"
        @keydown.right.prevent="player.seek(state.time + 5)"
      >
        <span class="progress-fill" :style="{ width: `${progress * 100}%` }"></span>
      </div>

      <!-- A song of the list -->
      <Teleport to="body">
        <div v-if="itemMenu" class="fixed inset-0 z-[70]" @click="itemMenu = null" @contextmenu.prevent="itemMenu = null">
          <div class="glass-panel absolute min-w-[190px] rounded-2xl py-1 overflow-hidden" :style="{ top: itemMenu.y + 'px', left: itemMenu.x + 'px' }" @click.stop>
            <button type="button" class="item" @click="act('go')"><Eye class="w-4 h-4" /> {{ $t('player.goToMessage') }}</button>
            <button type="button" class="item" @click="act('download')"><Download class="w-4 h-4" /> {{ $t('chat.download') }}</button>
            <button type="button" class="item" @click="act('forward')"><Forward class="w-4 h-4" /> {{ $t('chat.forwardMenu') }}</button>
            <button type="button" class="item" @click="act('select')"><CircleCheck class="w-4 h-4" /> {{ $t('chat.select') }}</button>
            <button type="button" class="item !text-danger" @click="act('delete')"><Trash2 class="w-4 h-4" /> {{ $t('common.delete') }}</button>
          </div>
        </div>
      </Teleport>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, type PropType } from 'vue'
import {
  ChevronDown, CircleCheck, Download, Eye, Forward, Loader2, Music, Pause, Play, Repeat, Repeat1,
  Shuffle, SkipBack, SkipForward, Trash2, Volume1, Volume2, VolumeX, X
} from 'lucide-vue-next'
import { useAudioPlayer, type AudioTrack } from './useAudioPlayer'
import { formatClock } from './format'

type TrackAction = 'go' | 'download' | 'forward' | 'select' | 'delete'

const props = defineProps<{ humanFileSize: (bytes: number) => string }>()
const emit = defineEmits<{ (e: TrackAction, track: AudioTrack): void }>()

const player = useAudioPlayer()
const { state } = player

const track = computed(() => state.current)
const hasList = computed(() => track.value?.kind === 'music' && state.queue.length > 1)
const progress = computed(() => (state.duration ? Math.min(1, state.time / state.duration) : 0))

function itemInfo(item: AudioTrack) {
  if (item.key === track.value?.key) return `${formatClock(state.time)} / ${formatClock(state.duration)}`
  return [item.duration ? formatClock(item.duration) : '', props.humanFileSize(item.size)].filter(Boolean).join(', ')
}

// ---------- list ----------

const listOpen = ref(false)
let closeTimer: number | null = null

function openList() {
  if (closeTimer !== null) window.clearTimeout(closeTimer)
  closeTimer = null
  if (window.matchMedia('(hover: hover)').matches) listOpen.value = true
}

function closeListSoon() {
  closeTimer = window.setTimeout(() => {
    if (!itemMenu.value) listOpen.value = false
  }, 250)
}

const itemMenu = ref<{ track: AudioTrack; x: number; y: number } | null>(null)

function openItemMenu(event: MouseEvent, item: AudioTrack) {
  const width = 200
  const height = 220
  itemMenu.value = {
    track: item,
    x: Math.min(event.clientX, window.innerWidth - width - 8),
    y: Math.min(event.clientY, window.innerHeight - height - 8)
  }
}

function act(action: TrackAction) {
  const target = itemMenu.value?.track
  itemMenu.value = null
  listOpen.value = false
  // The union of event names is spelled out so each stays type-checked.
  if (target) (emit as (e: TrackAction, track: AudioTrack) => void)(action, target)
}

// ---------- seeking ----------

function startSeek(event: PointerEvent) {
  const bar = event.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const toRatio = (e: PointerEvent) => Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))

  player.seekRatio(toRatio(event))

  const onMove = (e: PointerEvent) => player.seekRatio(toRatio(e))
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

const TrackCover = defineComponent({
  props: {
    track: { type: Object as PropType<AudioTrack>, required: true },
    active: { type: Boolean, default: false }
  },
  setup(p) {
    return () => h('span', { class: 'relative w-10 h-10 shrink-0 rounded-[35%] overflow-hidden grid place-items-center bg-accent/15 text-accent' }, [
      p.track.cover ? h('img', { src: p.track.cover, alt: '', class: 'absolute inset-0 w-full h-full object-cover' }) : h(Music, { class: 'w-4 h-4' }),
      h('span', { class: 'absolute inset-0 grid place-items-center bg-black/30 text-white' },
        [h(p.active && state.playing ? Pause : Play, { class: 'w-4 h-4', fill: 'currentColor' })])
    ])
  }
})
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.player {
  @apply relative shrink-0 z-30 bg-surface/90 backdrop-blur-xl border-b border-line select-none;
}
.ctl {
  @apply inline-grid place-items-center w-7 h-7 shrink-0 rounded-lg text-muted hover:text-ink hover:bg-surface-2 transition active:scale-90;
}
.ctl-main {
  @apply text-accent hover:text-accent;
}
.ctl-on {
  @apply text-accent hover:text-accent;
}
.volume {
  @apply w-0 opacity-0 group-hover:w-20 group-hover:opacity-100 focus:w-20 focus:opacity-100 h-1 cursor-pointer;
  accent-color: var(--color-accent);
  transition: width .18s ease, opacity .18s ease;
}
.progress {
  @apply relative h-0.5 bg-line cursor-pointer outline-none;
  touch-action: none;
}
/* A larger target than the line itself. */
.progress::before {
  content: '';
  position: absolute;
  inset: -6px 0;
}
.progress-fill {
  @apply absolute inset-y-0 start-0 bg-accent rounded-e-full;
}
.item {
  @apply w-full flex items-center gap-3 text-start px-4 py-2 text-[14px] text-ink hover:bg-ink/5 transition;
}
.item svg {
  @apply text-muted shrink-0;
}

.player-enter-from, .player-leave-to { opacity: 0; transform: translateY(-10px); }
.player-enter-active, .player-leave-active { transition: opacity .18s ease, transform .22s cubic-bezier(.2, .8, .2, 1); }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-6px) scale(.98); }
.drop-enter-active, .drop-leave-active { transition: opacity .13s ease, transform .15s ease; transform-origin: top; }
</style>
