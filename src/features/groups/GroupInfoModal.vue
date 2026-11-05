<template>
  <InfoSheet
    :open="open"
    :name="group?.title ?? ''"
    :status="status"
    :avatar-url="group?.avatarUrl"
    :icon="group?.avatarUrl ? null : Users"
    :page-key="page"
    :page-title="pageTitle"
    @close="emit('close')"
    @back="back"
  >
    <template #avatar>
      <label v-if="canEditInfo" class="avatar-edit" :title="$t('groups.changePhoto')">
        <input type="file" accept="image/*" class="hidden" @change="onPhoto" />
        <Camera class="w-4 h-4" />
      </label>
    </template>

    <div v-if="!group" class="py-8 flex justify-center text-muted"><Loader2 class="w-6 h-6 animate-spin" /></div>

    <template v-else>
      <div class="flex gap-2">
        <button type="button" class="info-tile" :aria-pressed="muted" @click="emit('toggle-mute')">
          <BellOff v-if="muted" class="w-5 h-5" /><Bell v-else class="w-5 h-5" />
          <span>{{ muted ? $t('chat.unmute') : $t('chat.mute') }}</span>
        </button>
        <button type="button" class="info-tile" @click="emit('search')">
          <Search class="w-5 h-5" /><span>{{ $t('info.search') }}</span>
        </button>
        <button v-if="canAdd" type="button" class="info-tile" @click="openAdd">
          <UserPlus class="w-5 h-5" /><span>{{ $t('groups.addShort') }}</span>
        </button>
        <button v-if="canManage" type="button" class="info-tile" @click="go('manage')">
          <Settings2 class="w-5 h-5" /><span>{{ $t('groups.manage') }}</span>
        </button>
      </div>

      <section v-if="group.description || inviteLink" class="info-card">
        <div v-if="group.description" class="px-4 py-2.5">
          <div class="text-[14.5px] text-ink whitespace-pre-wrap break-words" dir="auto">{{ group.description }}</div>
          <div class="text-[12.5px] text-muted">{{ $t('groups.description') }}</div>
        </div>
        <button v-if="inviteLink" type="button" class="info-row" @click="copyInvite">
          <span class="flex-1 min-w-0">
            <span class="block text-[14px] text-accent truncate"><bdi dir="ltr">{{ inviteLink }}</bdi></span>
            <span class="block text-[12.5px] text-muted">{{ linkCopied ? $t('chat.copied') : $t('groups.inviteLink') }}</span>
          </span>
          <Copy class="w-[18px] h-[18px] text-muted" />
        </button>
      </section>

      <SharedMediaSection :index="index" :actions="actions" @open="kind => { sharedKind = kind; go('shared') }" />

      <section class="info-card">
        <button type="button" class="info-heading w-full flex items-center justify-between hover:text-ink transition" @click="go('members')">
          <span>{{ $t('groups.membersCount', { n: group.members.length }) }}</span>
          <ChevronRight class="w-4 h-4 rtl:rotate-180" />
        </button>
        <ul class="pb-1">
          <GroupMemberRow
            v-for="member in group.members.slice(0, PREVIEW_MEMBERS)"
            :key="member.userId"
            :member="member"
            :my-id="myId"
            :online="onlineIds.has(member.userId)"
            :has-menu="memberActions(member).length > 0"
            @open="emit('open-user', member.username)"
            @menu="event => openMenu(event, member)"
          />
        </ul>
        <button v-if="group.members.length > PREVIEW_MEMBERS" type="button" class="info-row text-accent text-[14px] font-medium" @click="go('members')">
          {{ $t('groups.viewAllMembers') }}
        </button>
      </section>

      <p class="flex items-start gap-1.5 px-3 text-[12px] leading-5 text-muted">
        <Lock class="w-3.5 h-3.5 shrink-0 mt-[3px]" /><span>{{ $t('groups.e2eeNote') }}</span>
      </p>

      <section class="info-card">
        <button type="button" class="info-row" @click="confirm = 'leave'">
          <span class="info-chip bg-danger/15 text-danger"><LogOut class="w-[18px] h-[18px] rtl:-scale-x-100" /></span>
          <span class="text-[14.5px] text-danger">{{ $t('groups.leave') }}</span>
        </button>
        <button v-if="group.myRole === 'owner'" type="button" class="info-row" @click="confirm = 'delete'">
          <span class="info-chip bg-danger/15 text-danger"><Trash2 class="w-[18px] h-[18px]" /></span>
          <span class="text-[14.5px] text-danger">{{ $t('groups.delete') }}</span>
        </button>
      </section>
      <p v-if="error && !page" class="px-3 text-sm text-danger">{{ error }}</p>
    </template>

    <template #page>
      <SharedMediaPage v-if="page === 'shared'" v-model:kind="sharedKind" :index="index" :actions="actions" />

      <!-- Everyone, searchable -->
      <div v-else-if="page === 'members' && group" class="flex-1 min-h-0 flex flex-col">
        <div class="p-3 pb-2 relative">
          <Search class="w-4 h-4 text-muted absolute top-1/2 -translate-y-1/2 start-6 pointer-events-none" />
          <input v-model="memberQuery" type="search" class="input w-full !ps-9" dir="auto" :placeholder="$t('groups.searchMembers')" />
        </div>
        <ul class="flex-1 overflow-y-auto px-1 pb-2">
          <GroupMemberRow
            v-for="member in foundMembers"
            :key="member.userId"
            :member="member"
            :my-id="myId"
            :online="onlineIds.has(member.userId)"
            :has-menu="memberActions(member).length > 0"
            @open="emit('open-user', member.username)"
            @menu="event => openMenu(event, member)"
          />
          <li v-if="!foundMembers.length" class="py-8 text-center text-sm text-muted">{{ $t('groups.noPeople') }}</li>
        </ul>
        <div v-if="canAdd" class="p-3 pt-2 border-t border-line">
          <button type="button" class="btn-primary w-full gap-1.5" @click="openAdd"><UserPlus class="w-4 h-4" /><span>{{ $t('groups.addMembers') }}</span></button>
        </div>
      </div>

      <!-- Add members -->
      <div v-else-if="page === 'add'" class="flex-1 min-h-0 flex flex-col p-3">
        <MemberPicker v-model="toAdd" :people="addable" class="flex-1 min-h-0" />
        <div class="pt-3 mt-2 border-t border-line flex justify-end">
          <button type="button" class="btn-primary gap-1.5" :disabled="!toAdd.length || busy" @click="run(() => addGroupMembers(group!.id, toAdd), true)">
            <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
            <span>{{ $t('groups.addCount', { n: toAdd.length }) }}</span>
          </button>
        </div>
      </div>

      <!-- Settings -->
      <div v-else-if="page === 'manage' && group" class="flex-1 overflow-y-auto p-3 space-y-2.5">
        <section class="info-card">
          <button type="button" class="info-row" @click="startEdit">
            <span class="info-chip bg-accent/15 text-accent"><Pencil class="w-[18px] h-[18px]" /></span>
            <span class="flex-1 min-w-0">
              <span class="block text-[14.5px] text-ink">{{ $t('groups.editGroup') }}</span>
              <span class="block text-[12.5px] text-muted">{{ $t('groups.editGroupHint') }}</span>
            </span>
            <ChevronRight class="w-4 h-4 text-muted rtl:rotate-180" />
          </button>
        </section>

        <section class="info-card">
          <button type="button" class="info-row" @click="startPermissions">
            <span class="info-chip" style="background: #3b9eff26; color: #3b9eff"><KeyRound class="w-[18px] h-[18px]" /></span>
            <span class="flex-1 min-w-0">
              <span class="block text-[14.5px] text-ink">{{ $t('groups.permissions') }}</span>
              <span class="block text-[12.5px] text-muted">{{ $t('groups.permissionsSummary', { n: allowedCount, total: permissionKeys.length }) }}</span>
            </span>
            <ChevronRight class="w-4 h-4 text-muted rtl:rotate-180" />
          </button>
          <button type="button" class="info-row" @click="go('invite')">
            <span class="info-chip" style="background: #22b8e626; color: #22b8e6"><Link2 class="w-[18px] h-[18px]" /></span>
            <span class="flex-1 min-w-0">
              <span class="block text-[14.5px] text-ink">{{ $t('groups.inviteLink') }}</span>
              <span class="block text-[12.5px] text-muted">{{ group.inviteCode ? $t('groups.inviteOn') : $t('groups.inviteOff') }}</span>
            </span>
            <ChevronRight class="w-4 h-4 text-muted rtl:rotate-180" />
          </button>
        </section>

        <section class="info-card">
          <button type="button" class="info-row" @click="go('admins')">
            <span class="info-chip" style="background: #a56bff26; color: #a56bff"><ShieldCheck class="w-[18px] h-[18px]" /></span>
            <span class="flex-1 text-[14.5px] text-ink">{{ $t('groups.admins') }}</span>
            <span class="text-[13px] text-muted tabular-nums">{{ admins.length }}</span>
            <ChevronRight class="w-4 h-4 text-muted rtl:rotate-180" />
          </button>
          <button type="button" class="info-row" @click="go('members')">
            <span class="info-chip" style="background: #11bfae26; color: #11bfae"><Users class="w-[18px] h-[18px]" /></span>
            <span class="flex-1 text-[14.5px] text-ink">{{ $t('groups.members') }}</span>
            <span class="text-[13px] text-muted tabular-nums">{{ group.members.length }}</span>
            <ChevronRight class="w-4 h-4 text-muted rtl:rotate-180" />
          </button>
          <button type="button" class="info-row" @click="openRemoved">
            <span class="info-chip" style="background: #ff6b8a26; color: #ff6b8a"><UserX class="w-[18px] h-[18px]" /></span>
            <span class="flex-1 text-[14.5px] text-ink">{{ $t('groups.removedUsers') }}</span>
            <span class="text-[13px] text-muted tabular-nums">{{ group.bannedCount }}</span>
            <ChevronRight class="w-4 h-4 text-muted rtl:rotate-180" />
          </button>
        </section>

        <section v-if="group.myRole === 'owner' && group.members.length > 1" class="info-card">
          <button type="button" class="info-row" @click="go('transfer')">
            <span class="info-chip" style="background: #f5a52426; color: #f5a524"><Crown class="w-[18px] h-[18px]" /></span>
            <span class="flex-1 text-[14.5px] text-ink">{{ $t('groups.transfer') }}</span>
            <ChevronRight class="w-4 h-4 text-muted rtl:rotate-180" />
          </button>
        </section>
      </div>

      <!-- Name, description and photo -->
      <form v-else-if="page === 'edit' && group" class="flex-1 overflow-y-auto p-4 space-y-4" @submit.prevent="run(() => updateGroup(group!.id, { title: editTitle.trim(), description: editDescription.trim() || null }), true)">
        <div class="flex items-center gap-3">
          <label class="relative w-16 h-16 shrink-0 rounded-[35%] overflow-hidden grid place-items-center text-white cursor-pointer" :style="!group.avatarUrl ? { backgroundColor: colorFromString(group.title) } : {}">
            <input type="file" accept="image/*" class="hidden" @change="onPhoto" />
            <img v-if="group.avatarUrl" :src="group.avatarUrl" class="w-full h-full object-cover" alt="" />
            <Users v-else class="w-7 h-7" />
            <span class="absolute inset-0 grid place-items-center bg-black/35"><Camera class="w-5 h-5 text-white" /></span>
          </label>
          <div class="min-w-0">
            <div class="text-sm text-ink">{{ $t('groups.changePhoto') }}</div>
            <button v-if="group.avatarUrl" type="button" class="text-[13px] text-danger hover:underline" @click="run(() => removeGroupAvatar(group!.id))">{{ $t('groups.removePhoto') }}</button>
          </div>
        </div>
        <label class="block space-y-1.5">
          <span class="text-sm text-muted">{{ $t('groups.groupName') }}</span>
          <input v-model="editTitle" class="input w-full" dir="auto" maxlength="64" />
        </label>
        <label class="block space-y-1.5">
          <span class="text-sm text-muted">{{ $t('groups.description') }}</span>
          <textarea v-model="editDescription" class="input w-full min-h-[90px] resize-y" dir="auto" maxlength="255" :placeholder="$t('groups.descriptionPlaceholder')"></textarea>
        </label>
        <button type="submit" class="btn-primary w-full gap-1.5" :disabled="!editTitle.trim() || busy">
          <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
          <span>{{ $t('common.save') }}</span>
        </button>
      </form>

      <!-- What members may do -->
      <div v-else-if="page === 'permissions' && draft" class="flex-1 min-h-0 flex flex-col">
        <div class="flex-1 overflow-y-auto p-3 space-y-2.5">
          <p class="px-1 text-[12.5px] leading-5 text-muted">{{ $t('groups.permissionsHint') }}</p>
          <section class="info-card px-4 py-2 space-y-2">
            <SettingToggle
              v-for="key in permissionKeys"
              :key="key"
              :model-value="draft.permissions[key]"
              :label="$t(`groups.can.${key}`)"
              :description="key === 'sendMedia' && !draft.permissions.sendMessages ? $t('groups.can.sendMediaNeedsMessages') : ''"
              @update:model-value="value => setPermission(key, value)"
            />
          </section>

          <section class="info-card p-4">
            <div class="flex items-center gap-2 text-[14.5px] text-ink"><Timer class="w-[18px] h-[18px] text-accent" />{{ $t('groups.slowMode') }}</div>
            <p class="mt-1 text-[12.5px] leading-5 text-muted">{{ draft.slowModeSeconds ? $t('groups.slowModeOn', { delay: formatDelay(draft.slowModeSeconds) }) : $t('groups.slowModeHint') }}</p>
            <div class="mt-3 flex flex-wrap gap-1.5" role="radiogroup" :aria-label="$t('groups.slowMode')">
              <button
                v-for="seconds in SLOW_MODES"
                :key="seconds"
                type="button"
                role="radio"
                class="choice"
                :class="draft.slowModeSeconds === seconds ? 'choice-on' : ''"
                :aria-checked="draft.slowModeSeconds === seconds"
                @click="draft.slowModeSeconds = seconds"
              >{{ seconds ? formatDelay(seconds) : $t('groups.slowModeOff') }}</button>
            </div>
          </section>
        </div>
        <div class="p-3 border-t border-line">
          <button type="button" class="btn-primary w-full gap-1.5" :disabled="!draftChanged || busy" @click="run(() => updateGroupSettings(group!.id, draft!), true)">
            <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
            <span>{{ $t('common.save') }}</span>
          </button>
        </div>
      </div>

      <!-- The invite link -->
      <div v-else-if="page === 'invite' && group" class="flex-1 overflow-y-auto p-4 space-y-3">
        <div class="grid place-items-center pt-2">
          <span class="w-16 h-16 rounded-[35%] grid place-items-center" style="background: #22b8e626; color: #22b8e6"><Link2 class="w-8 h-8" /></span>
        </div>
        <p class="text-center text-[13px] leading-6 text-muted">{{ $t('groups.inviteHint') }}</p>

        <template v-if="inviteLink">
          <div class="rounded-2xl bg-surface-2/70 px-4 py-3 text-[14px] text-ink break-all select-all" dir="ltr">{{ inviteLink }}</div>
          <button type="button" class="btn-primary w-full gap-1.5" @click="copyInvite">
            <Check v-if="linkCopied" class="w-4 h-4" /><Copy v-else class="w-4 h-4" />
            <span>{{ linkCopied ? $t('chat.copied') : $t('groups.copyLink') }}</span>
          </button>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="btn-outline gap-1.5" :disabled="busy" @click="confirm = 'reset'"><RefreshCw class="w-4 h-4" /><span>{{ $t('groups.resetLink') }}</span></button>
            <button type="button" class="btn-outline gap-1.5 !text-danger" :disabled="busy" @click="run(() => revokeGroupInvite(group!.id))"><Link2Off class="w-4 h-4" /><span>{{ $t('groups.revokeLink') }}</span></button>
          </div>
        </template>
        <button v-else type="button" class="btn-primary w-full gap-1.5" :disabled="busy" @click="run(() => resetGroupInvite(group!.id))">
          <Loader2 v-if="busy" class="w-4 h-4 animate-spin" /><Link2 v-else class="w-4 h-4" />
          <span>{{ $t('groups.createLink') }}</span>
        </button>
      </div>

      <!-- Admins -->
      <ul v-else-if="page === 'admins'" class="flex-1 overflow-y-auto p-1.5">
        <GroupMemberRow
          v-for="member in admins"
          :key="member.userId"
          :member="member"
          :my-id="myId"
          :online="onlineIds.has(member.userId)"
          :has-menu="memberActions(member).length > 0"
          @open="emit('open-user', member.username)"
          @menu="event => openMenu(event, member)"
        />
        <li class="px-3 py-3 text-[12.5px] leading-5 text-muted">{{ $t('groups.adminsHint') }}</li>
      </ul>

      <!-- People who were removed -->
      <ul v-else-if="page === 'removed'" class="flex-1 overflow-y-auto p-2">
        <li v-if="loadingBans" class="py-8 flex justify-center text-muted"><Loader2 class="w-5 h-5 animate-spin" /></li>
        <li v-for="ban in bans" v-else :key="ban.userId" class="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <span class="w-10 h-10 shrink-0 rounded-[35%] overflow-hidden grid place-items-center text-white text-sm font-semibold" :style="!ban.avatarUrl ? { backgroundColor: colorFromString(ban.displayName || ban.username) } : {}">
            <img v-if="ban.avatarUrl" :src="ban.avatarUrl" class="w-full h-full object-cover" alt="" />
            <template v-else>{{ initialsOf(ban.displayName || ban.username) }}</template>
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-medium text-ink truncate"><bdi>{{ ban.displayName || '@' + ban.username }}</bdi></span>
            <span class="block text-xs text-muted truncate">{{ formatDayLabel(ban.bannedAtUtc) }}</span>
          </span>
          <button type="button" class="btn-outline text-[13px] px-3 py-1.5" :disabled="busy" @click="unban(ban.userId)">{{ $t('groups.unban') }}</button>
        </li>
        <li v-if="!loadingBans && !bans.length" class="py-10 text-center text-sm text-muted">{{ $t('groups.noRemoved') }}</li>
        <li v-if="!loadingBans" class="px-3 py-3 text-[12.5px] leading-5 text-muted">{{ $t('groups.removedHint') }}</li>
      </ul>

      <!-- Handing the group over -->
      <ul v-else-if="page === 'transfer' && group" class="flex-1 overflow-y-auto p-1.5">
        <li class="px-3 py-2 text-[12.5px] leading-5 text-muted">{{ $t('groups.transferHint') }}</li>
        <GroupMemberRow
          v-for="member in group.members.filter(m => m.userId !== myId)"
          :key="member.userId"
          :member="member"
          :my-id="myId"
          :online="onlineIds.has(member.userId)"
          :has-menu="false"
          @open="transferTarget = member; confirm = 'transfer'"
        />
      </ul>

      <p v-if="error" class="px-4 pb-3 text-sm text-danger">{{ error }}</p>
    </template>
  </InfoSheet>

  <!-- A member's options -->
  <Teleport to="body">
    <div v-if="menu" class="fixed inset-0 z-[70]" @click="menu = null" @contextmenu.prevent="menu = null">
      <div class="glass-panel absolute min-w-[190px] rounded-2xl overflow-hidden py-1" :style="{ top: `${menu.y}px`, left: `${menu.x}px` }" @click.stop>
        <button
          v-for="action in memberActions(menu.member)"
          :key="action.key"
          type="button"
          class="w-full px-4 py-2 text-[14px] text-start hover:bg-ink/5 transition"
          :class="action.danger ? 'text-danger' : 'text-ink'"
          @click="menu = null; action.run()"
        >{{ action.label }}</button>
      </div>
    </div>
  </Teleport>

  <ConfirmDialog
    :open="!!confirm"
    :title="confirmTitle"
    :message="confirmMessage"
    :confirm-label="confirmLabel"
    :danger="confirm !== 'reset'"
    :busy="busy"
    @cancel="confirm = null"
    @confirm="onConfirm"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Bell, BellOff, Camera, Check, ChevronRight, Copy, Crown, KeyRound, Link2, Link2Off, Loader2, Lock, LogOut, Pencil,
  RefreshCw, Search, Settings2, ShieldCheck, Timer, Trash2, UserPlus, Users, UserX
} from 'lucide-vue-next'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import type { ChatIndex, SharedKind } from '../chat/composables/useChatIndex'
import { normalizeForSearch } from '../chat/composables/useMessageSearch'
import InfoSheet from '../info/InfoSheet.vue'
import SharedMediaPage from '../info/SharedMediaPage.vue'
import SharedMediaSection from '../info/SharedMediaSection.vue'
import type { InfoActions } from '../info/types'
import SettingToggle from '../settings/SettingToggle.vue'
import GroupMemberRow from './GroupMemberRow.vue'
import MemberPicker, { type PickablePerson } from './MemberPicker.vue'
import {
  addGroupMembers,
  deleteGroup,
  getErrorMessage,
  getGroupBans,
  leaveGroup,
  removeGroupAvatar,
  removeGroupMember,
  resetGroupInvite,
  revokeGroupInvite,
  setGroupRole,
  transferGroup,
  unbanGroupMember,
  updateGroup,
  updateGroupSettings,
  uploadGroupAvatar,
  type GroupBanItem,
  type GroupMemberItem,
  type GroupPermissions
} from '../../services/api'
import { useGroupsStore } from '../../stores/groups'
import { colorFromString, initialsOf } from '../../utils/avatar'
import { formatDelay } from '../../utils/groupEvents'
import { formatDayLabel } from '../../utils/time'
import { t } from '../../i18n'

const PREVIEW_MEMBERS = 6
const SLOW_MODES = [0, 10, 30, 60, 300, 900, 3600]

const props = defineProps<{
  open: boolean
  groupId: string | null
  myId: string
  onlineIds: Set<string>
  /** People who can be added (contacts and chat partners). */
  people: PickablePerson[]
  muted: boolean
  index: ChatIndex
  actions: InfoActions
}>()

const emit = defineEmits<{
  (e: 'close' | 'toggle-mute' | 'search'): void
  (e: 'open-user', username: string): void
  (e: 'left', groupId: string): void
}>()

type Page = 'shared' | 'members' | 'add' | 'manage' | 'edit' | 'permissions' | 'invite' | 'admins' | 'removed' | 'transfer'

const groups = useGroupsStore()
const group = computed(() => (props.groupId ? groups.details[props.groupId] ?? null : null))
const canManage = computed(() => groups.canManage(props.groupId))
const canEditInfo = computed(() => groups.can(props.groupId, 'changeInfo'))
const canAdd = computed(() => groups.can(props.groupId, 'addMembers'))
const onlineCount = computed(() => group.value?.members.filter(m => m.userId !== props.myId && props.onlineIds.has(m.userId)).length ?? 0)
const admins = computed(() => group.value?.members.filter(m => m.role !== 'member') ?? [])
const addable = computed(() => {
  const inGroup = new Set(group.value?.members.map(m => m.userId) ?? [])
  return props.people.filter(p => !inGroup.has(p.id))
})

const status = computed(() => {
  const count = group.value?.members.length ?? 0
  return onlineCount.value ? t('groups.membersOnline', { n: count, online: onlineCount.value }) : t('groups.membersCount', { n: count })
})

// ---------- pages ----------

const stack = ref<Page[]>([])
const page = computed(() => stack.value[stack.value.length - 1] ?? null)

function go(next: Page) {
  error.value = null
  stack.value = [...stack.value, next]
}

function back() {
  error.value = null
  stack.value = stack.value.slice(0, -1)
}

const pageTitle = computed(() => {
  switch (page.value) {
    case 'shared': return t('info.sharedMedia')
    case 'members': return t('groups.members')
    case 'add': return t('groups.addMembers')
    case 'manage': return t('groups.manage')
    case 'edit': return t('groups.editGroup')
    case 'permissions': return t('groups.permissions')
    case 'invite': return t('groups.inviteLink')
    case 'admins': return t('groups.admins')
    case 'removed': return t('groups.removedUsers')
    case 'transfer': return t('groups.transfer')
    default: return ''
  }
})

const sharedKind = ref<SharedKind>('photos')
const toAdd = ref<string[]>([])
const memberQuery = ref('')
const editTitle = ref('')
const editDescription = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const menu = ref<{ member: GroupMemberItem; x: number; y: number } | null>(null)
const confirm = ref<'leave' | 'delete' | 'remove' | 'reset' | 'transfer' | null>(null)
const removeTarget = ref<GroupMemberItem | null>(null)
const transferTarget = ref<GroupMemberItem | null>(null)

watch(() => [props.open, props.groupId], () => {
  stack.value = []
  error.value = null
  menu.value = null
  memberQuery.value = ''
  if (props.open && props.groupId) void groups.load(props.groupId, true)
})

const foundMembers = computed(() => {
  const members = group.value?.members ?? []
  const query = normalizeForSearch(memberQuery.value.trim().replace(/^@/, ''))
  if (!query) return members
  return members.filter(m => normalizeForSearch(m.displayName ?? '').includes(query) || m.username.toLowerCase().includes(query))
})

function openAdd() {
  toAdd.value = []
  go('add')
}

function startEdit() {
  editTitle.value = group.value?.title ?? ''
  editDescription.value = group.value?.description ?? ''
  go('edit')
}

/** Runs a change; the member list refreshes from the server (also through the hub's GroupUpdated). */
async function run(action: () => Promise<unknown>, backAfter = false) {
  if (!group.value || busy.value) return
  busy.value = true
  error.value = null
  try {
    await action()
    await groups.load(group.value.id, true)
    if (backAfter) back()
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

// ---------- permissions ----------

const permissionKeys: Array<keyof GroupPermissions> = ['sendMessages', 'sendMedia', 'pinMessages', 'addMembers', 'changeInfo']

const allowedCount = computed(() => permissionKeys.filter(key => group.value?.permissions[key]).length)

const draft = ref<{ permissions: GroupPermissions; slowModeSeconds: number } | null>(null)

function startPermissions() {
  if (!group.value) return
  draft.value = { permissions: { ...group.value.permissions }, slowModeSeconds: group.value.slowModeSeconds }
  go('permissions')
}

function setPermission(key: keyof GroupPermissions, value: boolean) {
  if (!draft.value) return
  draft.value.permissions[key] = value
  // Media is a kind of message: the two go together.
  if (key === 'sendMessages' && !value) draft.value.permissions.sendMedia = false
  if (key === 'sendMedia' && value) draft.value.permissions.sendMessages = true
}

const draftChanged = computed(() => {
  const current = group.value
  if (!draft.value || !current) return false
  return draft.value.slowModeSeconds !== current.slowModeSeconds || permissionKeys.some(key => draft.value!.permissions[key] !== current.permissions[key])
})

// ---------- invite link ----------

const inviteLink = computed(() => (group.value?.inviteCode ? `${window.location.origin}/join/${group.value.inviteCode}` : ''))
const linkCopied = ref(false)
let copiedTimer: number | null = null

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    linkCopied.value = true
    if (copiedTimer !== null) window.clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => { linkCopied.value = false }, 1400)
  } catch {}
}

// ---------- removed people ----------

const bans = ref<GroupBanItem[]>([])
const loadingBans = ref(false)

async function openRemoved() {
  const id = group.value?.id
  if (!id) return
  go('removed')
  loadingBans.value = true
  try {
    bans.value = await getGroupBans(id)
  } catch (err) {
    error.value = getErrorMessage(err)
  } finally {
    loadingBans.value = false
  }
}

async function unban(userId: string) {
  await run(() => unbanGroupMember(group.value!.id, userId))
  if (!error.value) bans.value = bans.value.filter(ban => ban.userId !== userId)
}

// ---------- members ----------

function openMenu(event: MouseEvent, member: GroupMemberItem) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const width = 200
  const height = 44 * memberActions(member).length + 10
  menu.value = {
    member,
    x: Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8)),
    y: box.bottom + height + 8 > window.innerHeight ? Math.max(8, box.top - height) : box.bottom + 4
  }
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

// ---------- confirmations ----------

const nameOf = (member: GroupMemberItem | null) => (member ? member.displayName || '@' + member.username : '')

const confirmTitle = computed(() => {
  switch (confirm.value) {
    case 'delete': return t('groups.delete')
    case 'leave': return t('groups.leave')
    case 'reset': return t('groups.resetLink')
    case 'transfer': return t('groups.transfer')
    default: return t('groups.removeMember')
  }
})

const confirmMessage = computed(() => {
  const title = group.value?.title ?? ''
  switch (confirm.value) {
    case 'delete': return t('groups.deleteConfirm', { title })
    case 'leave': return t('groups.leaveConfirm', { title })
    case 'reset': return t('groups.resetConfirm')
    case 'transfer': return t('groups.transferConfirm', { name: nameOf(transferTarget.value), title })
    default: return t('groups.removeConfirm', { name: nameOf(removeTarget.value) })
  }
})

const confirmLabel = computed(() => {
  switch (confirm.value) {
    case 'delete': return t('common.delete')
    case 'leave': return t('groups.leaveAction')
    case 'reset': return t('groups.resetLink')
    case 'transfer': return t('groups.transferAction')
    default: return t('groups.removeAction')
  }
})

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
  if (kind === 'reset') {
    await run(() => resetGroupInvite(id))
    confirm.value = null
    return
  }
  if (kind === 'transfer') {
    const target = transferTarget.value
    if (target) await run(() => transferGroup(id, target.userId))
    confirm.value = null
    if (!error.value) stack.value = []
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

<style scoped>
@reference "../../assets/tailwind.css";

.avatar-edit {
  @apply absolute -bottom-1 -end-1 w-9 h-9 rounded-full bg-accent text-white grid place-items-center shadow cursor-pointer hover:brightness-110 transition;
}
.choice {
  @apply rounded-full px-3 py-1.5 text-[13px] text-ink bg-surface hover:bg-ink/10 transition ring-1 ring-line;
}
.choice-on {
  @apply bg-accent text-white ring-accent hover:bg-accent;
}
</style>
