<template>
  <section class="space-y-4">
    <p class="text-sm text-muted">{{ $t('settings.sessionsHint') }}</p>

    <div v-if="loading" class="flex justify-center py-3 text-muted"><Loader2 class="w-5 h-5 animate-spin" /></div>
    <p v-else-if="loadError" class="text-sm text-danger">{{ loadError }}</p>

    <template v-else>
      <div v-if="current">
        <h3 class="text-xs font-medium text-muted mb-1">{{ $t('settings.thisDevice') }}</h3>
        <SessionRow :session="current" />
      </div>

      <div v-if="others.length">
        <h3 class="text-xs font-medium text-muted mb-1">{{ $t('settings.otherSessions') }}</h3>
        <ul class="divide-y divide-line">
          <li v-for="session in others" :key="session.id" class="flex items-center gap-2">
            <SessionRow :session="session" class="flex-1 min-w-0" />
            <button
              type="button"
              class="icon-btn text-danger"
              :aria-label="$t('settings.endSession')"
              :title="$t('settings.endSession')"
              :disabled="busy"
              @click="confirmTarget = session"
            >
              <LogOut class="w-4 h-4 rtl:-scale-x-100" />
            </button>
          </li>
        </ul>

        <button type="button" class="btn-danger w-full mt-3 gap-1.5 text-sm px-3 py-2" :disabled="busy" @click="confirmAll = true">
          <ShieldX class="w-4 h-4" />
          <span>{{ $t('settings.endOtherSessions') }}</span>
        </button>
      </div>
      <p v-else class="text-sm text-muted">{{ $t('settings.noOtherSessions') }}</p>

      <p v-if="actionError" class="text-sm text-danger">{{ actionError }}</p>
    </template>

    <ConfirmDialog
      :open="!!confirmTarget || confirmAll"
      :title="confirmAll ? $t('settings.endOtherSessions') : $t('settings.endSession')"
      :message="confirmAll ? $t('settings.endOtherSessionsConfirm') : $t('settings.endSessionConfirm', { device: confirmTarget?.deviceName || $t('settings.unknownDevice') })"
      :confirm-label="$t('settings.endSessionAction')"
      danger
      :busy="busy"
      @cancel="confirmTarget = null; confirmAll = false"
      @confirm="endConfirmed"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, type PropType } from 'vue'
import { Laptop, Loader2, LogOut, ShieldX, Smartphone } from 'lucide-vue-next'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { endOtherSessions, endSession, getErrorMessage, getSessions, type ActiveSession } from '../../services/api'
import { formatRelative } from '../../utils/time'
import { t } from '../../i18n'

const sessions = ref<ActiveSession[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const busy = ref(false)
const confirmTarget = ref<ActiveSession | null>(null)
const confirmAll = ref(false)

const current = computed(() => sessions.value.find(s => s.isCurrent) ?? null)
const others = computed(() => sessions.value.filter(s => !s.isCurrent))

async function load() {
  try {
    sessions.value = await getSessions()
    loadError.value = null
  } catch (err) {
    loadError.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function endConfirmed() {
  busy.value = true
  actionError.value = null
  try {
    if (confirmAll.value) await endOtherSessions()
    else if (confirmTarget.value) await endSession(confirmTarget.value.id)
    await load()
  } catch (err) {
    actionError.value = getErrorMessage(err)
  } finally {
    busy.value = false
    confirmTarget.value = null
    confirmAll.value = false
  }
}

const MOBILE = /Android|iPhone|iPad/

/** One device: name, address and when it was last active. */
const SessionRow = defineComponent({
  props: { session: { type: Object as PropType<ActiveSession>, required: true } },
  setup(props) {
    return () => {
      const s = props.session
      const name = s.deviceName || t('settings.unknownDevice')
      const icon = MOBILE.test(name) ? Smartphone : Laptop
      const activity = s.isCurrent ? t('settings.activeNow') : formatRelative(s.lastActiveAtUtc)
      return h('div', { class: 'flex items-center gap-3 py-2' }, [
        h('span', { class: 'w-10 h-10 shrink-0 rounded-full bg-accent-soft text-accent grid place-items-center' }, [h(icon, { class: 'w-5 h-5' })]),
        h('div', { class: 'min-w-0' }, [
          h('div', { class: 'text-sm font-medium text-ink truncate' }, [h('bdi', { dir: 'ltr' }, name)]),
          h('div', { class: 'text-xs text-muted truncate' }, [
            s.ipAddress ? h('bdi', { dir: 'ltr' }, s.ipAddress) : null,
            s.ipAddress ? ' · ' : null,
            activity
          ])
        ])
      ])
    }
  }
})
</script>
