<template>
  <ModalSheet :open="open" @close="emit('close')">
    <div class="flex flex-col max-h-[88dvh]">
      <div class="flex items-center gap-1 p-3 border-b border-line">
        <button v-if="mode !== 'info'" type="button" class="icon-btn" :aria-label="$t('common.back')" @click="mode = 'info'">
          <ArrowLeft class="w-5 h-5 rtl:rotate-180" />
        </button>
        <h2 class="flex-1 px-1 text-lg font-semibold text-ink">
          {{ mode === 'add' ? $t('groups.addMembers') : mode === 'edit' ? $t('groups.editGroup') : $t('groups.groupInfo') }}
        </h2>
        <button type="button" class="icon-btn" :aria-label="$t('common.close')" @click="emit('close')">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div v-if="!group" class="p-8 flex justify-center text-muted"><Loader2 class="w-6 h-6 animate-spin" /></div>

      <!-- Add members -->
      <div v-else-if="mode === 'add'" class="flex flex-col p-4 h-[min(560px,75dvh)]">
        <MemberPicker v-model="toAdd" :people="addable" class="flex-1 min-h-0" />
        <div class="pt-3 mt-2 border-t border-line flex justify-end">
          <button type="button" class="btn-primary gap-1.5" :disabled="!toAdd.length || busy" @click="run(() => addGroupMembers(group!.id, toAdd), true)">
            <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
            <span>{{ $t('groups.addCount', { n: toAdd.length }) }}</span>
          </button>
        </div>
      </div>

      <!-- Edit name and description -->
      <form v-else-if="mode === 'edit'" class="p-4 space-y-4" @submit.prevent="run(() => updateGroup(group!.id, { title: editTitle.trim(), description: editDescription.trim() || null }), true)">
        <label class="block space-y-1.5">
          <span class="text-sm text-muted">{{ $t('groups.groupName') }}</span>
          <input v-model="editTitle" class="input w-full" dir="auto" maxlength="64" />
        </label>
        <label class="block space-y-1.5">
          <span class="text-sm text-muted">{{ $t('groups.description') }}</span>
          <textarea v-model="editDescription" class="input w-full min-h-[80px] resize-y" dir="auto" maxlength="255" :placeholder="$t('groups.descriptionPlaceholder')"></textarea>
        </label>
        <div class="flex justify-end">
          <button type="submit" class="btn-primary gap-1.5" :disabled="!editTitle.trim() || busy">
            <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
            <span>{{ $t('common.save') }}</span>
          </button>
        </div>
      </form>

      <!-- Info -->
      <div v-else class="overflow-y-auto">
        <div class="flex flex-col items-center gap-2 px-4 pt-5 pb-4 text-center">
          <div class="relative">
            <div
              class="w-24 h-24 rounded-full overflow-hidden grid place-items-center text-white shadow-sm"
              :style="!group.avatarUrl ? { backgroundColor: colorFromString(group.title) } : {}"
            >
              <img v-if="group.avatarUrl" :src="group.avatarUrl" class="w-full h-full object-cover" alt="" />
              <Users v-else class="w-10 h-10" />
            </div>
            <label
              v-if="canManage"
              class="absolute -bottom-1 -end-1 w-9 h-9 rounded-full bg-accent text-white grid place-items-center shadow cursor-pointer hover:brightness-110"
              :title="$t('groups.changePhoto')"
            >
              <input type="file" accept="image/*" class="hidden" @change="onPhoto" />
              <Camera class="w-4 h-4" />
            </label>
          </div>
          <div class="text-lg font-bold text-ink"><bdi>{{ group.title }}</bdi></div>
          <div class="text-sm text-muted">
            {{ onlineCount ? $t('groups.membersOnline', { n: group.members.length, online: onlineCount }) : $t('groups.membersCount', { n: group.members.length }) }}
          </div>
          <p v-if="group.description" class="text-sm text-ink whitespace-pre-wrap" dir="auto">{{ group.description }}</p>
          <div class="flex flex-wrap justify-center gap-2 pt-1">
            <button type="button" class="btn-outline gap-1.5 text-sm px-3 py-1.5" @click="emit('toggle-mute')">
              <BellOff v-if="muted" class="w-4 h-4" /><Bell v-else class="w-4 h-4" />
              <span>{{ muted ? $t('chat.unmute') : $t('chat.mute') }}</span>
            </button>
            <button v-if="canManage" type="button" class="btn-outline gap-1.5 text-sm px-3 py-1.5" @click="startEdit">
              <Pencil class="w-4 h-4" /><span>{{ $t('groups.edit') }}</span>
            </button>
            <button v-if="canManage && group.avatarUrl" type="button" class="btn-outline gap-1.5 text-sm px-3 py-1.5" @click="run(() => removeGroupAvatar(group!.id))">
              <ImageOff class="w-4 h-4" /><span>{{ $t('groups.removePhoto') }}</span>
            </button>
          </div>
          <p class="flex items-start gap-1.5 text-xs text-muted pt-1">
            <Lock class="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{{ $t('groups.e2eeNote') }}</span>
          </p>
        </div>

        <div class="border-t border-line px-2 py-2">
          <div class="flex items-center justify-between px-2 py-1">
            <h3 class="text-sm font-semibold text-ink">{{ $t('groups.members') }}</h3>
            <button v-if="canManage" type="button" class="text-sm text-accent inline-flex items-center gap-1 hover:underline" @click="toAdd = []; mode = 'add'">
              <UserPlus class="w-4 h-4" /><span>{{ $t('groups.addMembers') }}</span>
            </button>
          </div>

          <ul>
            <li v-for="member in group.members" :key="member.userId" class="relative">
              <div class="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2 transition">
                <button type="button" class="flex-1 min-w-0 flex items-center gap-3 text-start" :disabled="member.userId === myId" @click="emit('open-user', member.username)">
                  <span class="relative shrink-0">
                    <span
                      class="w-10 h-10 rounded-full overflow-hidden grid place-items-center text-white text-sm font-semibold"
                      :style="!member.avatarUrl ? { backgroundColor: colorFromString(member.displayName || member.username) } : {}"
                    >
                      <img v-if="member.avatarUrl" :src="member.avatarUrl" class="w-full h-full object-cover" alt="" />
                      <template v-else>{{ initialsOf(member.displayName || member.username) }}</template>
                    </span>
                    <span v-if="onlineIds.has(member.userId)" class="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-accent ring-2 ring-surface"></span>
                  </span>
                  <span class="min-w-0">
                    <span class="block text-sm font-medium text-ink truncate">
                      <bdi>{{ member.userId === myId ? $t('groups.you') : (member.displayName || '@' + member.username) }}</bdi>
                    </span>
                    <span class="block text-xs truncate" :class="onlineIds.has(member.userId) ? 'text-accent' : 'text-muted'">
                      {{ onlineIds.has(member.userId) ? $t('chat.online') : '@' + member.username }}
                    </span>
                  </span>
                </button>
                <span v-if="member.role !== 'member'" class="text-xs text-accent shrink-0">{{ $t(`groups.role.${member.role}`) }}</span>
                <button
                  v-if="memberActions(member).length"
                  type="button"
                  class="icon-btn w-8 h-8 shrink-0"
                  :aria-label="$t('groups.memberOptions')"
                  @click.stop="menuFor = menuFor === member.userId ? null : member.userId"
                >
                  <EllipsisVertical class="w-4 h-4" />
                </button>
              </div>

              <div
                v-if="menuFor === member.userId"
                class="absolute end-3 top-11 z-10 min-w-[190px] rounded-xl bg-surface shadow-lg ring-1 ring-line py-1"
              >
                <button
                  v-for="action in memberActions(member)"
                  :key="action.key"
                  type="button"
                  class="w-full px-3 py-2 text-sm text-start hover:bg-surface-2"
                  :class="action.danger ? 'text-danger' : 'text-ink'"
                  @click="menuFor = null; action.run()"
                >{{ action.label }}</button>
              </div>
            </li>
          </ul>
        </div>

        <div class="border-t border-line p-2">
          <button type="button" class="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-danger hover:bg-surface-2" @click="confirm = 'leave'">
            <LogOut class="w-5 h-5 rtl:-scale-x-100" /><span class="text-sm font-medium">{{ $t('groups.leave') }}</span>
          </button>
          <button v-if="group.myRole === 'owner'" type="button" class="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-danger hover:bg-surface-2" @click="confirm = 'delete'">
            <Trash2 class="w-5 h-5" /><span class="text-sm font-medium">{{ $t('groups.delete') }}</span>
          </button>
        </div>
      </div>

      <p v-if="error" class="px-4 pb-3 text-sm text-danger">{{ error }}</p>
    </div>

    <ConfirmDialog
      :open="!!confirm"
      :title="confirm === 'delete' ? $t('groups.delete') : confirm === 'leave' ? $t('groups.leave') : $t('groups.removeMember')"
      :message="confirmMessage"
      :confirm-label="confirm === 'delete' ? $t('common.delete') : confirm === 'leave' ? $t('groups.leaveAction') : $t('groups.removeAction')"
      danger
      :busy="busy"
      @cancel="confirm = null"
      @confirm="onConfirm"
    />
  </ModalSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowLeft, Bell, BellOff, Camera, EllipsisVertical, ImageOff, Loader2, Lock, LogOut, Pencil, Trash2, UserPlus, Users, X
} from 'lucide-vue-next'
import ModalSheet from '../../components/ModalSheet.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import MemberPicker, { type PickablePerson } from './MemberPicker.vue'
import {
  addGroupMembers,
  deleteGroup,
  getErrorMessage,
  leaveGroup,
  removeGroupAvatar,
  removeGroupMember,
  setGroupRole,
  updateGroup,
  uploadGroupAvatar,
  type GroupMemberItem
} from '../../services/api'
import { useGroupsStore } from '../../stores/groups'
import { colorFromString, initialsOf } from '../../utils/avatar'
import { t } from '../../i18n'

const props = defineProps<{
  open: boolean
  groupId: string | null
  myId: string
  onlineIds: Set<string>
  /** People who can be added (contacts and chat partners). */
  people: PickablePerson[]
  muted: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-user', username: string): void
  (e: 'toggle-mute'): void
  (e: 'left', groupId: string): void
}>()

const groups = useGroupsStore()
const group = computed(() => (props.groupId ? groups.details[props.groupId] ?? null : null))
const canManage = computed(() => groups.canManage(props.groupId))
const onlineCount = computed(() => group.value?.members.filter(m => m.userId !== props.myId && props.onlineIds.has(m.userId)).length ?? 0)
const addable = computed(() => {
  const inGroup = new Set(group.value?.members.map(m => m.userId) ?? [])
  return props.people.filter(p => !inGroup.has(p.id))
})

const mode = ref<'info' | 'add' | 'edit'>('info')
const toAdd = ref<string[]>([])
const editTitle = ref('')
const editDescription = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const menuFor = ref<string | null>(null)
const confirm = ref<'leave' | 'delete' | 'remove' | null>(null)
const removeTarget = ref<GroupMemberItem | null>(null)

watch(() => [props.open, props.groupId], () => {
  mode.value = 'info'
  error.value = null
  menuFor.value = null
  if (props.open && props.groupId) void groups.load(props.groupId, true)
})

const confirmMessage = computed(() => {
  const title = group.value?.title ?? ''
  if (confirm.value === 'delete') return t('groups.deleteConfirm', { title })
  if (confirm.value === 'leave') return t('groups.leaveConfirm', { title })
  const m = removeTarget.value
  return t('groups.removeConfirm', { name: m ? m.displayName || '@' + m.username : '' })
})

function startEdit() {
  editTitle.value = group.value?.title ?? ''
  editDescription.value = group.value?.description ?? ''
  mode.value = 'edit'
}

/** Runs a change; the member list refreshes from the server (also through the hub's GroupUpdated). */
async function run(action: () => Promise<unknown>, backToInfo = false) {
  if (!group.value || busy.value) return
  busy.value = true
  error.value = null
  try {
    await action()
    await groups.load(group.value.id, true)
    if (backToInfo) mode.value = 'info'
  } catch (err) {
    error.value = getErrorMessage(err)
  } finally {
    busy.value = false
  }
}

function onPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file && group.value) void run(() => uploadGroupAvatar(group.value!.id, file))
}

type MemberAction = { key: string; label: string; danger?: boolean; run: () => void }

function memberActions(member: GroupMemberItem): MemberAction[] {
  const role = group.value?.myRole
  if (!group.value || member.userId === props.myId || member.role === 'owner' || role === 'member') return []

  const actions: MemberAction[] = []
  if (role === 'owner') {
    actions.push(member.role === 'admin'
      ? { key: 'demote', label: t('groups.removeAdmin'), run: () => void run(() => setGroupRole(group.value!.id, member.userId, 'member')) }
      : { key: 'promote', label: t('groups.makeAdmin'), run: () => void run(() => setGroupRole(group.value!.id, member.userId, 'admin')) })
  }
  if (role === 'owner' || member.role === 'member') {
    actions.push({ key: 'remove', label: t('groups.removeMember'), danger: true, run: () => { removeTarget.value = member; confirm.value = 'remove' } })
  }
  return actions
}

async function onConfirm() {
  const id = group.value?.id
  if (!id) return
  const kind = confirm.value
  if (kind === 'remove') {
    const target = removeTarget.value
    if (target) await run(() => removeGroupMember(id, target.userId))
    confirm.value = null
    return
  }

  busy.value = true
  error.value = null
  try {
    if (kind === 'delete') await deleteGroup(id)
    else await leaveGroup(id)
    confirm.value = null
    emit('left', id)
  } catch (err) {
    error.value = getErrorMessage(err)
    confirm.value = null
  } finally {
    busy.value = false
  }
}
</script>
