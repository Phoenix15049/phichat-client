<template>
  <div :ref="bindScroll" class="flex-1 overflow-y-auto p-4 bg-[#F2F2F0]" @scroll="actions.onScroll">
    <div v-if="loadingOlder" class="sticky top-2 z-10 flex justify-center">
      <div class="flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-1 shadow">
        <Loader2 class="h-4 w-4 animate-spin"/>
        <span class="text-xs text-gray-600">Loading…</span>
      </div>
    </div>

    <TransitionGroup name="bubble" tag="div" class="space-y-2">
      <div
        v-for="(msg,index) in messages"
        :key="messageKey(msg,index)"
        :class="['relative',msg.senderId===myId?'text-right':'text-left']"
        @click.stop="actions.onRowClick($event,msg)"
        @contextmenu.prevent="!selectionMode&&chatActive?actions.openMenu($event,msg):undefined"
        @mousedown.left="actions.onRowMouseDown($event,msg)"
        @mouseenter="actions.onRowMouseEnter(msg)"
      >
        <div v-if="showDayHeader(index)" class="flex justify-center my-2">
          <span class="text-xs text-gray-500 bg-white/70 rounded-full px-3 py-1 shadow-sm">
            {{ dayLabel(msg.sentAt) }}
          </span>
        </div>

        <div
          :ref="bindMessageElement((msg.id||msg.clientId)!)"
          :class="bubbleClasses(msg)"
          @dblclick="actions.onBubbleDblClick($event,msg)"
          @contextmenu.stop.prevent="!selectionMode&&chatActive?actions.openMenu($event,msg):undefined"
          @mouseenter="actions.onBubbleHoverStart(msg)"
          @mouseleave="actions.onBubbleHoverEnd"
        >
          <div
            v-if="msg.replyToMessageId"
            class="mb-1 border-l-2 pl-2 text-xs opacity-80 cursor-pointer hover:underline"
            @click="actions.jumpToReply(msg.replyToMessageId)"
          >
            <div class="truncate">{{ actions.resolveReplyPreview(msg.replyToMessageId) }}</div>
          </div>

          <div v-if="msg.isDeleted" class="text-xs text-gray-600 italic">Message deleted</div>

          <div v-if="msg.forwardedFromSenderId" class="mb-1 text-xs opacity-80 border-l-2 pl-2">
            Forwarded from
            <button
              type="button"
              class="font-medium underline hover:opacity-90 text-[#c5ffff]"
              @mouseenter="actions.cacheForwardName(msg.forwardedFromSenderId)"
              @click.stop="actions.openForwardUser(msg.forwardedFromSenderId)"
            >
              {{ actions.resolveForwardLabel(msg.forwardedFromSenderId) }}
            </button>
          </div>

          <div
            v-if="!msg.fileUrl&&msg.plainText"
            dir="auto"
            class="whitespace-pre-wrap break-words select-text text-start auto-dir"
            data-text-selectable
          >
            <template v-for="(part,i) in toParts(msg.plainText)" :key="i">
              <span v-if="part.t==='text'">{{ part.s }}</span>
              <span
                v-else
                dir="ltr"
                class="text-[#c0fcff] underline cursor-pointer"
                data-text-selectable
                @click.stop="actions.openMention(part.u)"
              >@{{ part.u }}</span>
            </template>
          </div>

          <div v-if="msg.fileUrl&&isImageUrl(msg.fileUrl)" class="mt-1">
            <img
              :src="msg.fileUrl"
              class="rounded-xl cursor-zoom-in max-h-[70vh] max-w-[75vw] md:max-w-[60%] lg:max-w-[640px] sm:min-w-[180px] min-w-[140px] h-auto w-auto object-contain"
              @click="actions.openImage(msg)"
            />
          </div>

          <div v-else-if="msg.fileUrl&&isVideoUrl(msg.fileUrl)" class="mt-1">
            <video
              :src="msg.fileUrl"
              controls
              playsinline
              class="rounded-xl bg-black cursor-pointer max-h-[70vh] max-w-[75vw] md:max-w-[60%] lg:max-w-[640px] sm:min-w-[220px] min-w-[160px] h-auto w-auto"
              @dblclick.prevent="actions.openVideo(msg)"
            ></video>
          </div>

          <div v-else-if="msg.fileUrl" class="mt-1">
            <div
              class="flex items-center gap-3 rounded px-3 py-2"
              :class="msg.senderId===myId?'bg-white/10':'bg-[#536e7e]'"
            >
              <button
                type="button"
                class="w-8 h-8 rounded-full border flex items-center justify-center"
                :class="msg.senderId===myId?'border-white/50 text-white':'border-gray-300 text-gray-600'"
                aria-label="Download"
                @click="actions.downloadFile(msg)"
              >
                <Loader2 v-if="downloading[actions.fileKey(msg)]" class="w-4 h-4 animate-spin"/>
                <Check v-else-if="downloaded[actions.fileKey(msg)]" class="w-4 h-4"/>
                <Download v-else class="w-4 h-4"/>
              </button>

              <div class="flex-1 min-w-0">
                <div class="font-medium truncate max-w-[16rem] min-w-0">
                  {{ actions.fileNameFromUrl(msg.fileUrl) }}
                </div>
                <div class="text-xs opacity-70">
                  {{ actions.humanFileSize(fileSizeMap[actions.fileKey(msg)]||0) }}
                </div>
              </div>
            </div>

            <div
              v-if="msg.plainText"
              dir="auto"
              class="mt-1 whitespace-pre-wrap break-words text-start auto-dir"
            >{{ msg.plainText }}</div>
          </div>

          <div
            class="mt-1 flex items-center gap-1 text-[11px]"
            :class="timeColorClass(msg)"
            :title="tooltipForMessage(msg)"
          >
            <span>{{ fmtHHmmLocal(msg.sentAt) }}</span>
            <span v-if="msg.updatedAtUtc" class="ml-1 opacity-80">(edited)</span>

            <span v-if="msg.senderId===myId">
              <CheckCheck v-if="msg.status==='read'" class="w-3 h-3"/>
              <Check v-else-if="msg.status==='delivered'" class="w-3 h-3"/>
              <Loader2 v-else class="w-3 h-3 animate-spin"/>
            </span>
          </div>

          <Transition name="fade-scale">
            <div
              v-if="hoverReactFor===(msg.id||msg.clientId)&&!selectionMode&&!contextMenu.visible"
              class="absolute z-20 pointer-events-auto select-none"
              :class="msg.senderId===myId
                ?'bottom-0 left-0 -translate-x-full -translate-y-1/6 -ml-1'
                :'bottom-0 right-0 translate-x-full -translate-y-1/6 -mr-1'"
              @mouseenter="actions.keepHoverBar"
              @mouseleave="actions.hideHoverBarSoon"
            >
              <div class="reaction-pill">
                <button
                  v-for="emoji in quickEmojis"
                  :key="emoji"
                  class="reaction-btn"
                  @click.stop="actions.applyReaction(msg,emoji)"
                >{{ emoji }}</button>
              </div>
            </div>
          </Transition>

          <div
            v-if="msg.reactions?.length"
            class="mt-1 flex flex-wrap gap-1"
            :class="msg.senderId===myId?'justify-end':'justify-start'"
          >
            <button
              v-for="reaction in msg.reactions"
              :key="reaction.emoji"
              class="px-1.5 py-[2px] text-[12px] rounded-full bg-black/5 hover:bg-black/10 ring-1 ring-black/5 transition"
              :class="reaction.mine?'ring-2 ring-[#11BFAE]':''"
              @click.stop="actions.applyReaction(msg,reaction.emoji)"
            >
              <span>{{ reaction.emoji }}</span>
              <span class="ml-1 text-[11px] opacity-70">{{ reaction.count }}</span>
            </button>
          </div>

          <div v-if="reactionPickerFor===(msg.id||msg.clientId)" class="mt-1 flex gap-1">
            <button
              v-for="emoji in quickEmojis"
              :key="emoji"
              class="px-2 py-[2px] text-[13px] rounded hover:bg-gray-100"
              @click="actions.applyReaction(msg,emoji)"
            >{{ emoji }}</button>

            <button class="px-2 py-[2px] text-[11px] text-gray-500" @click="actions.closeReactionPicker">
              بستن
            </button>
          </div>

          <button
            v-if="selectionMode"
            class="absolute top-1"
            :class="msg.senderId===myId?'left-1':'right-1'"
            :title="actions.isSelected(msg)?'Remove from selection':'Select message'"
            @click.stop="actions.toggleSelect(msg)"
          >
            <span
              class="w-5 h-5 inline-flex items-center justify-center rounded-full border text-[11px]"
              :class="actions.isSelected(msg)
                ?(msg.senderId===myId?'bg-white text-blue-600 border-white':'bg-blue-600 text-white border-blue-600')
                :'bg-white/80 text-gray-400 border-gray-300'"
            >{{ actions.isSelected(msg)?'✓':'' }}</span>
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>

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
          class="absolute z-50 min-w-[168px] text-left rounded-2xl border border-[#456173]/10 bg-white/80 backdrop-blur-md ring-1 ring-black/5"
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
              ?'right-2'
              :contextMenu.pillAlign==='left'?'left-2':'left-1/2 -translate-x-1/2'"
          >
            <div class="reaction-pill bg-white/80 backdrop-blur-md">
              <button
                v-for="emoji in quickEmojis"
                :key="emoji"
                class="reaction-btn"
                @click.stop="contextMenu.msg&&actions.applyReaction(contextMenu.msg,emoji)"
              >{{ emoji }}</button>

              <button class="reaction-more" title="More" aria-label="More">
                <ChevronDown class="w-4 h-4"/>
              </button>
            </div>
          </div>

          <div class="max-w-[220px]">
            <button
              class="menu-item rounded-t-2xl"
              @click="contextMenu.msg&&actions.startSelection(contextMenu.msg)"
              v-ripple
            >Select</button>

            <button class="menu-item" @click="actions.openForwardPicker" v-ripple>Forward…</button>
            <button class="menu-item" @click="actions.reply" v-ripple>Reply</button>

            <button
              v-if="actions.canEdit(contextMenu.msg)"
              class="menu-item"
              @click="actions.edit"
              v-ripple
            >Edit</button>

            <button
              class="menu-item rounded-b-2xl"
              @click="contextMenu.msg&&actions.deleteMessage(contextMenu.msg)"
              v-ripple
            >Delete</button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance, ObjectDirective } from 'vue'
import { Check, CheckCheck, ChevronDown, Download, Loader2 } from 'lucide-vue-next'
import { formatAbsoluteEn, toDateSafe } from '../../../utils/time'
import type { UiMessage } from '../../../types/chat'

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
}

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
}>()

function bindScroll(element:Element|ComponentPublicInstance|null){
  props.setScrollElement(element instanceof HTMLElement?element:null)
}

function bindMenu(element:Element|ComponentPublicInstance|null){
  props.setMenuElement(element instanceof HTMLElement?element:null)
}

function messageKey(message:UiMessage,index:number){
  return message.clientId||message.id||index
}

function isImageUrl(url?:string|null){
  return !!url&&/\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(url.split('?')[0]||'')
}

function isVideoUrl(url?:string|null){
  return !!url&&/\.(mp4|webm|ogg|mov|m4v)$/i.test(url.split('?')[0]||'')
}

function isMediaOnly(message:UiMessage){
  return !!message.fileUrl&&(isImageUrl(message.fileUrl)||isVideoUrl(message.fileUrl))&&!message.plainText
}

function bubbleClasses(message:UiMessage){
  const classes=['relative','inline-block','max-w-[80%]','transition','duration-150','ease-out']
  const selected=props.selectionMode&&props.actions.isSelected(message)

  if(isMediaOnly(message)){
    classes.push('rounded-xl','p-0','bg-transparent','text-current')
    if(selected) classes.push('ring-2','ring-blue-300/60')
    return classes
  }

  classes.push(
    'rounded-2xl','px-3','py-2',
    message.senderId===props.myId?'bg-[#11BFAE] text-white':'bg-[#456173] text-white'
  )

  if(selected){
    classes.push(
      'ring-2',
      message.senderId===props.myId?'ring-white/80':'ring-[#11BFAE]/50',
      'shadow-md'
    )
  }

  return classes
}

function timeColorClass(message:UiMessage){
  return isMediaOnly(message)?'text-gray-500':'text-white/80'
}

type Part={t:'text';s:string}|{t:'mention';u:string}

function toParts(text?:string|null):Part[]{
  if(!text) return []

  const regex=/@([A-Za-z0-9_]{3,32})/g
  const parts:Part[]=[]
  let last=0
  let match:RegExpExecArray|null

  while((match=regex.exec(text))!==null){
    if(match.index>last) parts.push({t:'text',s:text.slice(last,match.index)})
    parts.push({t:'mention',u:match[1]})
    last=match.index+match[0].length
  }

  if(last<text.length) parts.push({t:'text',s:text.slice(last)})
  return parts
}

function fmtHHmmLocal(iso?:string|null){
  const date=toDateSafe(iso)
  return date?date.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):''
}

function tooltipForMessage(message:UiMessage){
  const sent=formatAbsoluteEn(message.sentAt)
  const delivered=message.deliveredAtUtc?formatAbsoluteEn(message.deliveredAtUtc):null
  const read=message.readAtUtc?formatAbsoluteEn(message.readAtUtc):null

  if(read) return `ارسال: ${sent}\nخوانده‌شدن: ${read}`
  if(delivered) return `ارسال: ${sent}\nتحویل: ${delivered}`
  return `ارسال: ${sent}`
}

function dayKey(iso?:string|null){
  const date=toDateSafe(iso)
  return date?`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`:''
}

function dayLabel(iso?:string|null){
  const date=toDateSafe(iso)
  if(!date) return ''

  const today=new Date()
  today.setHours(0,0,0,0)

  const target=new Date(date)
  target.setHours(0,0,0,0)

  const difference=Math.round((today.getTime()-target.getTime())/86400000)

  if(difference===0) return 'Today'
  if(difference===1) return 'Yesterday'
  return new Intl.DateTimeFormat('en-US',{dateStyle:'full'}).format(date)
}

function showDayHeader(index:number){
  if(index===0) return true
  return dayKey(props.messages[index].sentAt)!==dayKey(props.messages[index-1].sentAt)
}

const rippleHandlers=new WeakMap<HTMLElement,(event:MouseEvent)=>void>()

const vRipple:ObjectDirective<HTMLElement>={
  mounted(element){
    element.style.position||='relative'
    element.style.overflow||='hidden'

    const handler=(event:MouseEvent)=>{
      const rect=element.getBoundingClientRect()
      const size=Math.max(rect.width,rect.height)*1.1
      const ripple=document.createElement('span')

      ripple.className='ripple-ink'
      ripple.style.width=ripple.style.height=`${size}px`
      ripple.style.left=`${event.clientX-rect.left-size/2}px`
      ripple.style.top=`${event.clientY-rect.top-size/2}px`

      element.appendChild(ripple)
      ripple.addEventListener('animationend',()=>ripple.remove(),{once:true})
    }

    rippleHandlers.set(element,handler)
    element.addEventListener('click',handler)
  },

  beforeUnmount(element){
    const handler=rippleHandlers.get(element)
    if(handler) element.removeEventListener('click',handler)
    rippleHandlers.delete(element)
  }
}
</script>

<style scoped>
@reference "tailwindcss";

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
  @apply bg-white/95 backdrop-blur rounded-full px-2 py-1 border border-[#456173]/10 flex items-center gap-1;
}
.reaction-btn{
  @apply w-8 h-8 grid place-items-center rounded-full hover:bg-[#11BFAE]/10 active:scale-95 transition;
}
.reaction-more{
  @apply w-6 h-6 grid place-items-center rounded-full text-[#1B3C59] hover:bg-black/5 transition;
}
.menu-item{
  @apply w-full text-left px-3 py-2 text-[14px] text-[#1B3C59] hover:bg-[#11BFAE]/10 active:bg-[#11BFAE]/15 transition outline-none focus-visible:ring-2 focus-visible:ring-[#11BFAE]/40;
}
.menu-item:first-child{
  position:relative;
  z-index:0;
  overflow:hidden;
  border-top-left-radius:1rem;
  border-top-right-radius:1rem
}
.menu-item+.menu-item{border-top:1px solid rgba(69,97,115,.1)}
.auto-dir{unicode-bidi:plaintext}
.text-start{text-align:start}
</style>