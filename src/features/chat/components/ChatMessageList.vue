<template>
  <div :ref="bindScroll" class="chat-scroll flex-1 overflow-y-auto bg-canvas" @scroll="actions.onScroll">
    <div class="w-full px-3 sm:px-5 py-3">
      <div v-if="loadingOlder" class="sticky top-2 z-10 flex justify-center">
        <div class="flex items-center gap-2 rounded-full bg-surface/90 backdrop-blur px-3 py-1 shadow-sm ring-1 ring-line">
          <Loader2 class="h-4 w-4 animate-spin text-accent"/>
          <span class="text-xs text-muted">{{ $t('common.loading') }}</span>
        </div>
      </div>

      <TransitionGroup name="bubble" tag="div">
        <div
          v-for="(msg,index) in messages"
          :key="messageKey(msg,index)"
          class="relative"
          :class="[mine(msg)?'text-end':'text-start',isGroupStart(index)?'mt-2.5':'mt-0.5',selectionMode?'cursor-pointer ps-7':'',hoverReactFor===(msg.id||msg.clientId)?'':'msg-row-lazy']"
          @click.stop="!msg.systemEvent&&actions.onRowClick($event,msg)"
          @contextmenu.prevent="!selectionMode&&chatActive&&!msg.systemEvent?actions.openMenu($event,msg):undefined"
          @mousedown.left="!msg.systemEvent&&actions.onRowMouseDown($event,msg)"
          @mouseenter="actions.onRowMouseEnter(msg)"
        >
          <div v-if="showDayHeader(index)" class="flex justify-center my-3">
            <span class="text-[12px] font-medium text-muted bg-surface/85 backdrop-blur rounded-full px-3 py-1 shadow-sm">
              {{ formatDayLabel(msg.sentAt) }}
            </span>
          </div>

          <!-- Group service message: "Ali added Sara" -->
          <div v-if="msg.systemEvent" class="flex justify-center my-1.5 px-6">
            <span class="system-chip"><bdi>{{ group?.systemText(msg) }}</bdi></span>
          </div>

          <template v-else>
          <div
            v-if="selectionMode"
            class="absolute bottom-2 start-0 z-10"
            @click.stop="actions.toggleSelect(msg)"
          >
            <span
              class="w-5 h-5 grid place-items-center rounded-full border-2 transition"
              :class="actions.isSelected(msg)?'bg-accent border-accent text-white':'border-muted/50 bg-surface/70'"
              :title="actions.isSelected(msg)?$t('chat.unselectMessage'):$t('chat.selectMessage')"
            ><Check v-if="actions.isSelected(msg)" class="w-3 h-3" :stroke-width="3"/></span>
          </div>

          <div
            :ref="bindMessageElement((msg.id||msg.clientId)!)"
            :class="bubbleClasses(msg,index)"
            @dblclick="actions.onBubbleDblClick($event,msg)"
            @contextmenu.stop.prevent="!selectionMode&&chatActive?actions.openMenu($event,msg):undefined"
            @mouseenter="actions.onBubbleHoverStart(msg)"
            @mouseleave="actions.onBubbleHoverEnd"
          >
            <div
              v-if="group&&!mine(msg)&&isGroupStart(index)"
              class="mb-0.5 text-[13px] font-semibold truncate"
              :class="isMediaOnly(msg)?'px-1 pb-1':''"
              :style="{ color: group.senderColor(msg.senderId) }"
            ><bdi>{{ group.senderName(msg.senderId) }}</bdi></div>

            <div v-if="msg.forwardedFromSenderId" class="mb-0.5 text-[12.5px] font-medium text-accent" :class="isMediaOnly(msg)?'px-1 pb-1':''">
              {{ $t('chat.forwardedFrom') }}
              <button
                type="button"
                class="font-semibold hover:underline"
                @mouseenter="actions.cacheForwardName(msg.forwardedFromSenderId)"
                @click.stop="actions.openForwardUser(msg.forwardedFromSenderId)"
              >
                <bdi>{{ actions.resolveForwardLabel(msg.forwardedFromSenderId) }}</bdi>
              </button>
            </div>

            <button
              v-if="msg.replyToMessageId"
              type="button"
              class="reply-quote"
              @click.stop="actions.jumpToReply(msg.replyToMessageId)"
            >
              <span class="block truncate"><bdi>{{ actions.resolveReplyPreview(msg.replyToMessageId) }}</bdi></span>
            </button>

            <div v-if="msg.isDeleted" class="text-[13px] text-meta italic">{{ $t('chat.messageDeleted') }}</div>

            <div
              v-if="!msg.fileUrl&&msg.plainText"
              dir="auto"
              class="msg-text whitespace-pre-wrap break-words select-text text-start auto-dir"
              :class="{ 'emoji-only': isEmojiOnly(msg.plainText) }"
              data-text-selectable
            >
              <template v-for="(part,i) in toParts(msg.plainText)" :key="i">
                <span v-if="part.t==='text'">{{ part.s }}</span>
                <a
                  v-else-if="part.t==='link'"
                  :href="part.href"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  dir="ltr"
                  class="text-accent hover:underline break-all"
                  @click.stop
                >{{ part.s }}</a>
                <span
                  v-else
                  dir="ltr"
                  class="text-accent font-medium hover:underline cursor-pointer"
                  data-text-selectable
                  @click.stop="actions.openMention(part.u)"
                >@{{ part.u }}</span>
              </template>
            </div>

            <a
              v-if="msg.preview&&!msg.fileUrl"
              :href="msg.preview.url"
              target="_blank"
              rel="noopener noreferrer nofollow"
              class="link-preview"
              @click.stop
            >
              <span class="min-w-0 flex-1">
                <span v-if="msg.preview.siteName" class="block text-[12.5px] font-semibold text-accent truncate">{{ msg.preview.siteName }}</span>
                <span v-if="msg.preview.title" class="block text-[13.5px] font-semibold line-clamp-2" dir="auto">{{ msg.preview.title }}</span>
                <span v-if="msg.preview.description" class="block text-[12.5px] opacity-80 line-clamp-3" dir="auto">{{ msg.preview.description }}</span>
              </span>
              <img v-if="msg.preview.image" :src="msg.preview.image" alt="" class="w-16 h-16 shrink-0 rounded-lg object-cover"/>
            </a>

            <div v-if="unreadableNotice(msg)" class="flex items-center gap-1.5 text-[13px] italic text-meta">
              <Lock class="w-3.5 h-3.5 shrink-0"/>
              <span>{{ unreadableNotice(msg) }}</span>
            </div>

            <div v-if="hasViewableFile(msg)&&actions.fileKind(msg)==='image'" :class="isMediaOnly(msg)?'':'mt-1 -mx-1.5'">
              <img
                v-if="actions.mediaSrc(msg)"
                :src="actions.mediaSrc(msg)!"
                :alt="msg.file?.name||''"
                class="block rounded-xl cursor-zoom-in max-h-[60vh] max-w-full sm:min-w-[180px] min-w-[140px] h-auto w-auto object-contain"
                @click="actions.openImage(msg)"
              />
              <div v-else class="media-placeholder">
                <ImageOff v-if="actions.mediaState(msg)==='error'" class="w-6 h-6"/>
                <Loader2 v-else class="w-6 h-6 animate-spin"/>
              </div>
            </div>

            <div v-else-if="hasViewableFile(msg)&&actions.fileKind(msg)==='video'" :class="isMediaOnly(msg)?'':'mt-1 -mx-1.5'">
              <video
                v-if="actions.mediaSrc(msg)"
                :src="actions.mediaSrc(msg)!"
                controls
                playsinline
                class="block rounded-xl bg-black cursor-pointer max-h-[60vh] max-w-full sm:min-w-[220px] min-w-[160px] h-auto w-auto"
                @dblclick.prevent="actions.openVideo(msg)"
              ></video>
              <div v-else class="media-placeholder bg-black/80 text-white/80">
                <VideoOff v-if="actions.mediaState(msg)==='error'" class="w-6 h-6"/>
                <Loader2 v-else class="w-6 h-6 animate-spin"/>
              </div>
            </div>

            <div v-else-if="hasViewableFile(msg)&&actions.fileKind(msg)==='voice'" class="mt-0.5">
              <VoiceMessage :src="actions.mediaSrc(msg)" :voice="msg.file!.voice!" :state="actions.mediaState(msg)"/>
            </div>

            <div v-else-if="hasViewableFile(msg)" class="mt-0.5">
              <div class="flex items-center gap-3 py-1 pe-2 min-w-[200px]">
                <button
                  type="button"
                  class="w-11 h-11 shrink-0 rounded-full grid place-items-center bg-accent text-white hover:bg-accent-strong transition"
                  :aria-label="$t('chat.download')"
                  @click.stop="actions.downloadFile(msg)"
                >
                  <Loader2 v-if="downloading[actions.fileKey(msg)]" class="w-5 h-5 animate-spin"/>
                  <Check v-else-if="downloaded[actions.fileKey(msg)]" class="w-5 h-5"/>
                  <FileDown v-else class="w-5 h-5"/>
                </button>

                <div class="flex-1 min-w-0 text-start">
                  <div class="font-medium truncate max-w-[16rem]" dir="auto">
                    {{ msg.file?.name||actions.fileNameFromUrl(msg.fileUrl!) }}
                  </div>
                  <div class="text-[12px] text-meta">
                    {{ actions.humanFileSize(msg.file?msg.file.size:(fileSizeMap[actions.fileKey(msg)]||0)) }}
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="msg.fileUrl&&msg.plainText"
              dir="auto"
              class="msg-text mt-1 whitespace-pre-wrap break-words select-text text-start auto-dir"
              data-text-selectable
            >{{ msg.plainText }}</div>

            <div
              v-if="msg.reactions?.length"
              class="mt-1 flex flex-wrap gap-1"
              :class="isMediaOnly(msg)?'px-1 pb-1':''"
            >
              <button
                v-for="reaction in msg.reactions"
                :key="reaction.emoji"
                type="button"
                class="h-7 inline-flex items-center gap-1 rounded-full px-2 text-[13px] font-medium transition active:scale-95"
                :class="reaction.mine?'bg-accent text-white':'bg-accent/15 text-accent-strong hover:bg-accent/25'"
                @click.stop="actions.applyReaction(msg,reaction.emoji)"
              >
                <span class="emoji-font text-[15px] leading-none">{{ reaction.emoji }}</span>
                <span>{{ reaction.count }}</span>
              </button>
            </div>

            <div
              class="meta"
              :class="isMediaOnly(msg)?'meta-overlay':'meta-inline'"
              :title="tooltipForMessage(msg)"
            >
              <span v-if="msg.updatedAtUtc">{{ $t('chat.edited') }}</span>
              <span>{{ formatTime(msg.sentAt) }}</span>

              <span v-if="mine(msg)" class="inline-flex">
                <CheckCheck v-if="!hideReadState&&msg.status==='read'" class="w-4 h-4" :class="isMediaOnly(msg)?'':'text-accent'"/>
                <Check v-else-if="!hideReadState&&msg.status==='delivered'" class="w-4 h-4"/>
                <AlertCircle v-else-if="msg.status==='failed'" class="w-4 h-4 text-danger" :aria-label="$t('chat.notSent')"/>
                <Clock3 v-else-if="msg.status!=='read'&&msg.status!=='delivered'" class="w-3.5 h-3.5"/>
              </span>
            </div>

            <div
              v-if="mine(msg)&&msg.status==='failed'"
              class="mt-1 flex items-center justify-end gap-2 text-[12px]"
              :class="isMediaOnly(msg)?'px-1 pb-1':''"
            >
              <span class="text-danger">{{ $t('chat.notSent') }}</span>
              <button
                v-if="actions.canRetry(msg)"
                type="button"
                class="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-ink ring-1 ring-line hover:bg-surface-2"
                @click.stop="actions.retrySend(msg)"
              >
                <RotateCw class="w-3 h-3"/> {{ $t('chat.retry') }}
              </button>
              <button
                type="button"
                class="rounded-full px-2 py-0.5 text-meta hover:bg-black/5"
                @click.stop="actions.discardFailed(msg)"
              >{{ $t('common.remove') }}</button>
            </div>

            <Transition name="fade-scale">
              <div
                v-if="hoverReactFor===(msg.id||msg.clientId)&&!selectionMode&&!contextMenu.visible&&!picker"
                :ref="element=>bindHoverBar(element,mine(msg))"
                class="absolute z-20 pointer-events-auto select-none"
                :class="hoverBarAbove
                  ?(mine(msg)?'bottom-full end-0 mb-1':'bottom-full start-0 mb-1')
                  :mine(msg)
                    ?'bottom-0 start-0 -translate-x-full rtl:translate-x-full -translate-y-1/6 -ms-1'
                    :'bottom-0 end-0 translate-x-full rtl:-translate-x-full -translate-y-1/6 -me-1'"
                @mouseenter="actions.keepHoverBar"
                @mouseleave="actions.hideHoverBarSoon"
              >
                <div class="reaction-pill">
                  <button
                    v-for="emoji in quickEmojis"
                    :key="emoji"
                    type="button"
                    class="reaction-btn emoji-font"
                    @click.stop="actions.applyReaction(msg,emoji)"
                  >{{ emoji }}</button>
                  <button
                    type="button"
                    class="reaction-more"
                    :title="$t('emoji.more')"
                    :aria-label="$t('emoji.more')"
                    @click.stop="openPicker($event,msg)"
                  ><ChevronDown class="w-4 h-4"/></button>
                </div>
              </div>
            </Transition>
          </div>
          </template>
        </div>
      </TransitionGroup>
    </div>
  </div>

  <!-- The user's reaction list -->
  <Teleport to="body">
    <div v-if="picker" class="fixed inset-0 z-[60]" @click="picker=null" @contextmenu.prevent="picker=null">
      <div class="absolute" :style="{ top: picker.y + 'px', left: picker.x + 'px' }" @click.stop>
        <ReactionPicker @select="onPickReaction"/>
      </div>
    </div>
  </Teleport>

  <Transition name="fade">
    <div
      v-if="contextMenu.visible"
      class="fixed inset-0 z-40"
      @click="actions.closeMenu"
      @contextmenu.prevent="actions.closeMenu"
    >
      <Transition name="ctx-pop">
        <div
          :ref="bindMenu"
          role="menu"
          class="absolute z-50 min-w-[190px] text-start rounded-2xl bg-surface/95 backdrop-blur-md shadow-xl ring-1 ring-line"
          :style="{
            top:`${contextMenu.y}px`,
            left:`${contextMenu.x}px`,
            '--origin':contextMenu.pillAlign==='right'
              ?'top right'
              :contextMenu.pillAlign==='left'?'top left':'top center'
          }"
          @click.stop
        >
          <div
            class="absolute -top-11"
            :class="contextMenu.pillAlign==='right'
              ?'right-0'
              :contextMenu.pillAlign==='left'?'left-0':'left-1/2 -translate-x-1/2'"
          >
            <div class="reaction-pill">
              <button
                v-for="emoji in quickEmojis"
                :key="emoji"
                type="button"
                class="reaction-btn emoji-font"
                @click.stop="contextMenu.msg&&actions.applyReaction(contextMenu.msg,emoji)"
              >{{ emoji }}</button>

              <button
                type="button"
                class="reaction-more"
                :title="$t('emoji.more')"
                :aria-label="$t('emoji.more')"
                @click.stop="contextMenu.msg&&openPicker($event,contextMenu.msg)"
              >
                <ChevronDown class="w-4 h-4"/>
              </button>
            </div>
          </div>

          <!-- Clips the hover background of the first/last item to the rounded corners. -->
          <div class="rounded-2xl overflow-hidden py-1">
          <button class="menu-item" type="button" @click="actions.reply">
            <Reply class="w-4 h-4 rtl:-scale-x-100"/> {{ $t('chat.reply') }}
          </button>
          <button v-if="contextMenu.msg?.plainText" class="menu-item" type="button" @click="copyText(contextMenu.msg)">
            <Copy class="w-4 h-4"/> {{ $t('chat.copyText') }}
          </button>
          <button
            v-if="actions.canEdit(contextMenu.msg)"
            class="menu-item"
            type="button"
            @click="actions.edit"
          ><Pencil class="w-4 h-4"/> {{ $t('chat.edit') }}</button>
          <button
            v-if="contextMenu.msg?.id"
            class="menu-item"
            type="button"
            @click="contextMenu.msg&&actions.togglePin(contextMenu.msg)"
          >
            <PinOff v-if="actions.isPinned(contextMenu.msg)" class="w-4 h-4"/>
            <Pin v-else class="w-4 h-4"/>
            {{ actions.isPinned(contextMenu.msg) ? $t('chat.unpin') : $t('chat.pin') }}
          </button>
          <button class="menu-item" type="button" @click="actions.openForwardPicker">
            <Forward class="w-4 h-4 rtl:-scale-x-100"/> {{ $t('chat.forwardMenu') }}
          </button>
          <button
            class="menu-item"
            type="button"
            @click="contextMenu.msg&&actions.startSelection(contextMenu.msg)"
          ><CircleCheck class="w-4 h-4"/> {{ $t('chat.select') }}</button>
          <div class="my-1 border-t border-line"></div>
          <button
            class="menu-item !text-danger"
            type="button"
            @click="contextMenu.msg&&actions.deleteMessage(contextMenu.msg)"
          ><Trash2 class="w-4 h-4"/> {{ $t('common.delete') }}</button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import {
  AlertCircle, Check, CheckCheck, ChevronDown, CircleCheck, Clock3, Copy, FileDown, Forward,
  ImageOff, Loader2, Lock, Pencil, Pin, PinOff, Reply, RotateCw, Trash2, VideoOff
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { formatAbsolute, formatDayLabel, formatTime, toDateSafe } from '../../../utils/time'
import type { UiMessage } from '../../../types/chat'
import ReactionPicker from '../../emoji/ReactionPicker.vue'
import VoiceMessage from './VoiceMessage.vue'

type MaybePromise=void|Promise<void>
type ContextMenuState={
  visible:boolean
  x:number
  y:number
  msg:UiMessage|null
  pillAlign?:string
}

type MessageActions={
  onScroll:()=>MaybePromise
  onRowClick:(event:MouseEvent,message:UiMessage)=>void
  onRowMouseDown:(event:MouseEvent,message:UiMessage)=>void
  onRowMouseEnter:(message:UiMessage)=>void
  onBubbleDblClick:(event:MouseEvent,message:UiMessage)=>void
  onBubbleHoverStart:(message:UiMessage)=>void
  onBubbleHoverEnd:()=>void
  openMenu:(event:MouseEvent,message:UiMessage)=>void
  jumpToReply:(id:string)=>MaybePromise
  resolveReplyPreview:(id?:string|null)=>string
  cacheForwardName:(id:string)=>MaybePromise
  resolveForwardLabel:(id:string)=>string
  openForwardUser:(id:string)=>MaybePromise
  openMention:(username:string)=>MaybePromise
  openImage:(message:UiMessage)=>void
  openVideo:(message:UiMessage)=>void
  fileKey:(message:UiMessage)=>string
  fileNameFromUrl:(url:string)=>string
  humanFileSize:(bytes:number)=>string
  downloadFile:(message:UiMessage)=>MaybePromise
  fileKind:(message:UiMessage)=>'image'|'video'|'voice'|'file'
  mediaSrc:(message:UiMessage)=>string|null
  mediaState:(message:UiMessage)=>'idle'|'loading'|'ready'|'error'
  applyReaction:(message:UiMessage,emoji:string)=>MaybePromise
  keepHoverBar:()=>void
  hideHoverBarSoon:()=>void
  closeReactionPicker:()=>void
  isSelected:(message:UiMessage)=>boolean
  toggleSelect:(message:UiMessage)=>void
  closeMenu:()=>void
  startSelection:(message:UiMessage)=>void
  openForwardPicker:()=>void
  reply:()=>void
  edit:()=>void
  canEdit:(message:UiMessage|null)=>boolean
  deleteMessage:(message:UiMessage)=>void
  retrySend:(message:UiMessage)=>void
  discardFailed:(message:UiMessage)=>void
  canRetry:(message:UiMessage)=>boolean
  copied:()=>void
  togglePin:(message:UiMessage)=>MaybePromise
  isPinned:(message:UiMessage|null)=>boolean
}

const { t }=useI18n()

const props=defineProps<{
  messages:UiMessage[]
  myId:string
  loadingOlder:boolean
  selectionMode:boolean
  chatActive:boolean
  contextMenu:ContextMenuState
  quickEmojis:string[]
  hoverReactFor:string|null
  reactionPickerFor:string|null
  downloaded:Record<string,boolean>
  downloading:Record<string,boolean>
  fileSizeMap:Record<string,number>
  actions:MessageActions
  bindMessageElement:(key:string)=>(element:Element|ComponentPublicInstance|null)=>void
  setScrollElement:(element:HTMLElement|null)=>void
  setMenuElement:(element:HTMLElement|null)=>void
  /** Saved Messages: nobody else reads them, so no delivered/read ticks. */
  hideReadState?:boolean
  /** Set in group chats: sender names on incoming messages and service message texts. */
  group?:{
    senderName:(userId:string)=>string
    senderColor:(userId:string)=>string
    systemText:(message:UiMessage)=>string
  }|null
}>()

let scrollElement:HTMLElement|null=null

function bindScroll(element:Element|ComponentPublicInstance|null){
  scrollElement=element instanceof HTMLElement?element:null
  props.setScrollElement(scrollElement)
}

/** The quick-reaction bar sits beside its bubble, or above it when the side has no room. */
const hoverBarAbove=ref(false)

function bindHoverBar(element:Element|ComponentPublicInstance|null,isMine:boolean){
  if(!(element instanceof HTMLElement)||!scrollElement)return
  const bubble=element.parentElement
  if(!bubble)return

  const bubbleRect=bubble.getBoundingClientRect()
  const listRect=scrollElement.getBoundingClientRect()
  const scrollbar=scrollElement.offsetWidth-scrollElement.clientWidth
  const rtl=getComputedStyle(scrollElement).direction==='rtl'
  const onLeft=isMine!==rtl
  const room=onLeft
    ?bubbleRect.left-listRect.left-(rtl?scrollbar:0)
    :listRect.right-bubbleRect.right-(rtl?0:scrollbar)

  hoverBarAbove.value=room<element.offsetWidth+8
}

function bindMenu(element:Element|ComponentPublicInstance|null){
  props.setMenuElement(element instanceof HTMLElement?element:null)
}

// ---------- reaction list ----------

// 8 columns of 32px cells; at most 4 rows (32 reactions).
const PICKER_WIDTH=8*34+16
const PICKER_HEIGHT=4*34+16
const picker=ref<{ msg:UiMessage; x:number; y:number }|null>(null)

function openPicker(event:MouseEvent,message:UiMessage){
  const anchor=(event.currentTarget as HTMLElement).getBoundingClientRect()
  const margin=8
  const width=Math.min(PICKER_WIDTH,window.innerWidth-2*margin)
  const height=Math.min(PICKER_HEIGHT,window.innerHeight*0.6)
  const x=Math.min(Math.max(margin,anchor.right-width),window.innerWidth-width-margin)
  const below=anchor.bottom+6
  const y=below+height+margin<=window.innerHeight?below:Math.max(margin,anchor.top-height-6)

  props.actions.closeMenu()
  picker.value={ msg:message, x, y }
}

function onPickReaction(emoji:string){
  const target=picker.value?.msg
  picker.value=null
  if(target) void props.actions.applyReaction(target,emoji)
}

async function copyText(message:UiMessage|null){
  props.actions.closeMenu()
  if(!message?.plainText) return
  try{
    await navigator.clipboard.writeText(message.plainText)
    props.actions.copied()
  }catch{}
}

// ---------- layout helpers ----------

function messageKey(message:UiMessage,index:number){
  return message.clientId||message.id||index
}

function mine(message:UiMessage){
  return message.senderId===props.myId
}

/** Consecutive messages of one sender on one day form a group (tighter spacing, one tail). */
function sameGroup(a?:UiMessage,b?:UiMessage){
  return !!a&&!!b&&!a.systemEvent&&!b.systemEvent&&a.senderId===b.senderId&&dayKey(a.sentAt)===dayKey(b.sentAt)
}

function isGroupStart(index:number){
  return !sameGroup(props.messages[index-1],props.messages[index])
}

function isGroupEnd(index:number){
  return !sameGroup(props.messages[index],props.messages[index+1])
}

/** An attachment that can be shown: not one of an undecryptable message (its key is lost with it). */
function hasViewableFile(message:UiMessage){
  return !!message.fileUrl&&message.cipher!=='old-key'&&message.cipher!=='failed'
}

function isMediaOnly(message:UiMessage){
  if(!hasViewableFile(message)||message.plainText) return false
  const kind=props.actions.fileKind(message)
  return kind==='image'||kind==='video'
}

const EMOJI_ONLY=/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,24}$/u

/** Up to three emoji and nothing else are shown large, like Telegram. */
function isEmojiOnly(text:string){
  if(!EMOJI_ONLY.test(text)||/^[\d#*\s]+$/.test(text)) return false
  const Segmenter=(Intl as any).Segmenter
  const count=Segmenter
    ?[...new Segmenter(undefined,{ granularity:'grapheme' }).segment(text.trim())].length
    :(text.match(/\p{Extended_Pictographic}/gu)||[]).length
  return count<=3
}

/** Why a message's text cannot be shown, or '' when it can. */
function unreadableNotice(message:UiMessage){
  switch(message.cipher){
    case 'legacy': return message.fileUrl?'':t('e2ee.legacyMessage')
    case 'old-key': return t('e2ee.oldKeyMessage')
    case 'failed': return t('chat.decryptFailed')
    default: return ''
  }
}

function bubbleClasses(message:UiMessage,index:number){
  const isMine=mine(message)
  const classes=['bubble','relative','inline-block','text-start','align-top','max-w-[min(85%,560px)]','transition-[box-shadow]']
  const selected=props.selectionMode&&props.actions.isSelected(message)

  if(isMediaOnly(message)){
    classes.push('rounded-[var(--bubble-radius)]','overflow-hidden','bg-transparent')
  }else{
    classes.push(
      'rounded-[var(--bubble-radius)]','px-3','pt-1.5','pb-1','shadow-[0_1px_1.5px_rgb(0_0_0/0.08)]',
      'border-solid','border-[length:var(--bubble-border)]',
      isMine?'bg-bubble-out text-bubble-out-ink border-accent/35':'bg-bubble-in text-bubble-in-ink border-line'
    )
    // The last bubble of a group gets the "tail" corner on the sender's side.
    if(isGroupEnd(index)) classes.push(isMine?'rounded-ee-[var(--bubble-tail-radius)]':'rounded-es-[var(--bubble-tail-radius)]')
  }

  if(selected) classes.push('ring-2','ring-accent')
  return classes
}

type Part={t:'text';s:string}|{t:'mention';u:string}|{t:'link';s:string;href:string}

/** http(s) links (other schemes such as javascript: are never linked) and @mentions. */
const TOKENS=/(https?:\/\/[^\s<>"'`]+)|(?<![\w/@])@([A-Za-z0-9_]{3,32})/g

function toParts(text?:string|null):Part[]{
  if(!text) return []

  const parts:Part[]=[]
  let last=0
  let match:RegExpExecArray|null
  TOKENS.lastIndex=0

  while((match=TOKENS.exec(text))!==null){
    if(match.index>last) parts.push({t:'text',s:text.slice(last,match.index)})
    if(match[1]){
      // Sentence punctuation right after a link is not part of it.
      const url=match[1].replace(/[.,;:!?)\]}»"']+$/,'')
      parts.push({t:'link',s:url,href:url})
      last=match.index+url.length
      TOKENS.lastIndex=last
      continue
    }
    parts.push({t:'mention',u:match[2]})
    last=match.index+match[0].length
  }

  if(last<text.length) parts.push({t:'text',s:text.slice(last)})
  return parts
}

function tooltipForMessage(message:UiMessage){
  const lines=[t('chat.tooltipSent',{time:formatAbsolute(message.sentAt)})]

  if(message.readAtUtc) lines.push(t('chat.tooltipRead',{time:formatAbsolute(message.readAtUtc)}))
  else if(message.deliveredAtUtc) lines.push(t('chat.tooltipDelivered',{time:formatAbsolute(message.deliveredAtUtc)}))

  return lines.join('\n')
}

function dayKey(iso?:string|null){
  const date=toDateSafe(iso)
  return date?`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`:''
}

function showDayHeader(index:number){
  if(index===0) return true
  return dayKey(props.messages[index].sentAt)!==dayKey(props.messages[index-1].sentAt)
}
</script>

<style scoped>
@reference "../../../assets/tailwind.css";

.system-chip {
  @apply inline-block max-w-full rounded-full bg-surface/85 backdrop-blur px-3 py-1 text-[12.5px] text-muted shadow-sm text-center;
}

.msg-text{
  font-size:var(--chat-font-size);
  line-height:1.45;
}
.msg-text.emoji-only{
  font-family:var(--font-emoji);
  font-size:calc(var(--chat-font-size) * 2.6);
  line-height:1.15;
}

.meta{
  @apply flex items-center justify-end gap-1 text-[11.5px] leading-none whitespace-nowrap select-none;
}
.meta-inline{
  @apply mt-0.5 -me-1 text-meta;
}
.meta-overlay{
  @apply absolute bottom-1.5 end-1.5 rounded-full bg-black/45 px-2 py-1 text-white;
}

.reply-quote{
  @apply block w-full max-w-[320px] mb-1 rounded-lg bg-accent/10 border-s-[3px] border-accent px-2 py-1 text-[13px] text-start text-current hover:bg-accent/15 transition;
}

/* Long chats: the browser skips layout and paint of rows far off screen. Off for the
   hovered row, whose reaction bar may sit outside the row box (paint containment clips it). */
.msg-row-lazy{
  content-visibility:auto;
  contain-intrinsic-size:auto 64px;
}

.link-preview{
  @apply mt-1.5 flex gap-2.5 rounded-lg bg-accent/10 border-s-[3px] border-accent px-2.5 py-1.5 text-start text-current max-w-[400px] hover:bg-accent/15 transition;
}

.media-placeholder{
  @apply grid place-items-center rounded-xl bg-black/5 text-muted w-[240px] h-[180px] max-w-[75vw];
}

.bubble-enter-from{opacity:0;transform:translateY(6px) scale(.98)}
.bubble-enter-active{transition:opacity .15s ease,transform .15s ease}
.bubble-leave-active{transition:opacity .12s ease,transform .12s ease}
.bubble-leave-to{opacity:0;transform:translateY(-4px) scale(.98)}

.fade-enter-from,.fade-scale-enter-from{opacity:0;transform:translateY(4px) scale(.98)}
.fade-enter-active,.fade-scale-enter-active{transition:opacity .12s ease,transform .12s ease}
.fade-leave-active,.fade-scale-leave-active{transition:opacity .1s ease,transform .1s ease}
.fade-leave-to,.fade-scale-leave-to{opacity:0;transform:translateY(6px) scale(.98)}

.ctx-pop-enter-active,.ctx-pop-leave-active{
  transition:transform 160ms cubic-bezier(.22,.61,.36,1),opacity 140ms ease;
  transform-origin:var(--origin,top left)
}
.ctx-pop-enter-from{opacity:0;transform:translateY(8px) scale(.98)}
.ctx-pop-leave-to{opacity:0;transform:translateY(2px) scale(.98)}

.reaction-pill{
  @apply bg-surface/95 backdrop-blur rounded-full px-1 py-0.5 shadow-lg ring-1 ring-line flex items-center gap-0.5;
}
.reaction-btn{
  @apply w-8 h-8 grid place-items-center rounded-full text-[19px] leading-none hover:bg-surface-2 hover:scale-110 active:scale-95 transition;
}
.reaction-more{
  @apply w-7 h-7 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface-2 transition;
}
.menu-item{
  @apply w-full flex items-center gap-3 text-start px-4 py-2 text-[14px] text-ink hover:bg-surface-2 transition outline-none focus-visible:bg-surface-2;
}
.menu-item svg{
  @apply text-muted shrink-0;
}
</style>
