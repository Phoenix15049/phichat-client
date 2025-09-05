<template>
  <div class="flex h-screen" dir="ltr">
    <div class="w-80 md:w-96 flex flex-col border-r border-gray-200">
      <div class="px-3 py-2 font-semibold text-gray-800 border-b border-gray-200 flex items-center justify-between">
        <button class="px-2 py-1 rounded hover:bg-gray-100" @click="menuOpen = true">☰</button>
        <span>Chats</span>
        <span class="w-6"></span>
      </div>


      <div class="flex-1 overflow-y-auto">
        <button
          v-for="conv in conversations"
          :key="conv.peerId"
          @click="selectConversation(conv)"
          class="relative w-full px-3 py-3 border-b border-gray-100 hover:bg-gray-50 flex gap-3 items-center text-left"
          :class="{ 'bg-blue-50/70': selectedUser && selectedUser.id === conv.peerId }"
        >
        <span
          v-if="selectedUser && selectedUser.id === conv.peerId"
          class="absolute left-0 top-0 h-full w-[3px] bg-blue-600 rounded-r">
        </span>

          <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
            <span class="text-sm">


              <div class="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
                  :style="!avatarById[conv.peerId] ? { backgroundColor: colorFromString(displayById[conv.peerId] || conv.username) } : {}">
                <img v-if="avatarById[conv.peerId]" :src="avatarById[conv.peerId]!" class="w-full h-full object-cover" />
                <span v-else class="text-white text-sm">
                  {{ initialsOf(displayById[conv.peerId] || conv.displayName || conv.username) }}
                </span>

                <!-- online dot -->
                <span v-if="onlineIds.has(conv.peerId)"
                      class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-white"></span>
              </div>

              
            </span>
          </div>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <div class="font-medium truncate max-w-[10rem]"
                :class="(selectedUser && selectedUser.id === conv.peerId) ? 'text-blue-700' : 'text-gray-900'">
                {{ conv.displayName || '@' + conv.username }}
              </div>
              <div class="text-[11px] text-gray-500 whitespace-nowrap">
                {{ formatRelativeEn(conv.lastSentAt || null) }}
              </div>
            </div>
            <div class="text-xs text-gray-500 flex items-center gap-1">
              <span class="truncate max-w-[12rem]">
                <template v-if="conv.lastFileUrl">[مدیا]</template>
                <template v-else>{{ conv.lastPreview || '' }}</template>
              </span>
              <span
                v-if="conv.unreadCount > 0"
                class="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] min-w-[18px] px-1"
              >
                {{ conv.unreadCount }}
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <div class="flex-1 flex flex-col">


    <div
      class="bg-blue-600 text-white p-3 cursor-pointer select-none"
      @click="!selectionMode && selectedUser && openPeerProfile()"
      role="button"
      aria-label="نمایش پروفایل مخاطب"
    >
      <template v-if="selectionMode">
        
        <div class="flex items-center gap-3">
          <button
            class="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50 inline-flex items-center gap-1"
            :disabled="!selectedCount"
            @click="openForwardPickerMulti"
            title="Group Forward"
          >
            Forward
            <span class="inline-flex items-center justify-center text-[11px] min-w-[18px] h-[18px] px-1 rounded-full bg-white text-blue-700">
              {{ selectedCount }}
            </span>
          </button>
          <button class="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50" :disabled="!selectedCount" @click="openDeleteConfirmMulti">Delete</button>
          <button class="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50" :disabled="!selectedCount" @click="copySelectedText">Copy text</button>
          
          <div class="flex-1"></div>

          <button class="px-2 py-1 rounded hover:bg-white/10" @click="clearSelection">Cancel</button>
        </div>
      </template>

      <template v-else>
        <div class="flex items-left">
          <button
            v-if="chatNavStack.length"
            class="ml-2 px-2 py-1 rounded hover:bg-white/10"
            @click.stop="goBackChat"
            title="Back"
          >←</button>

          <div class="text-xs text-white/100 mt-0.5" v-if="selectedUser">
            <template v-if="isPeerTyping">
              <div class="text-lg font-semibold truncate">
                {{ selectedLabel }}
              </div>
              <div class="text-xs text-white/100 mt-0.5">
                is typing...
              </div>


            </template>
            <template v-else-if="onlineIds.has(selectedUser.id)">
              <div class="text-lg font-semibold truncate">
                {{ selectedLabel }}
              </div>
              <div class="text-xs text-white/100 mt-0.5" v-if="selectedUser">
                {{ peerStatus }}
              </div>
            </template>
            <template v-else>
              <div class="text-lg font-semibold truncate">
                {{ selectedLabel }}
              </div>
              <div class="text-xs text-white/80 mt-0.5" v-if="selectedUser">
                {{ peerStatus }}
              </div>
            </template>
          </div>

        </div>
      </template>
    </div>


      <div ref="scrollBox" class="flex-1 overflow-y-auto p-4 space-y-2" @scroll="onScrollLoadMore">
        <div v-if="loadingOlder" class="sticky top-2 z-10 flex justify-center">
          <div class="flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-1 shadow">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" class="opacity-25"/>
              <path fill="currentColor" class="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
            <span class="text-xs text-gray-600">Loading…</span>
          </div>
        </div>

        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="[
            'relative',
            msg.senderId === myId ? 'text-right' : 'text-left'
          ]"
          @click.stop="onRowClick($event, msg)"                              
          @contextmenu.prevent="!selectionMode && selectedUser ? openMenu($event, msg) : null"
          @mousedown.left="onRowMouseDown($event, msg)"
          @mouseenter="onRowMouseEnter(msg)"   
        >
          <div v-if="showDayHeader(index)" class="flex justify-center my-2">
            <span class="text-xs text-gray-500 bg-white/70 rounded-full px-3 py-1 shadow-sm">
              {{ dayLabel(messages[index].sentAt) }}
            </span>
          </div>

          <div
            :class="bubbleClasses(msg)"
            :title="tooltipForMessage(msg)"
            @dblclick="!selectionMode ? startReplyFrom(msg) : null"
            @contextmenu.stop.prevent="!selectionMode && selectedUser ? openMenu($event, msg) : null"
            :ref="bindMsgEl((msg.id || msg.clientId)!)"
            
          >

            <!-- بلوک ریپلای (قابل کلیک برای پرش) -->
            <div
              v-if="msg.replyToMessageId"
              class="mb-1 border-l-2 pl-2 text-xs opacity-80 cursor-pointer hover:underline"
              @click="jumpToReplied(msg.replyToMessageId)"
            >
              <div class="truncate">
                {{ resolveReplyPreview(msg.replyToMessageId) }}
              </div>
            </div>

            <!-- پیام حذف‌شده -->
            <div v-if="msg.isDeleted" class="text-xs text-gray-600 italic">
              Message deleted
            </div>

            <!-- برچسب فروارد -->
            <div v-if="msg.forwardedFromSenderId" class="mb-1 text-xs opacity-80 border-l-2 pl-2">
              Forwarded from
              <button
                type="button"
                class="font-medium underline hover:opacity-90 text-blue-600"
                @mouseenter="cacheForwardName(msg.forwardedFromSenderId)"
                @click.stop="openForwardUser(msg.forwardedFromSenderId)"
              >
                {{ resolveForwardLabel(msg.forwardedFromSenderId) }}
              </button>
            </div>

            


            <!-- متن -->
            <div v-if="!msg.fileUrl && msg.plainText" class="whitespace-pre-wrap break-words select-text" data-text-selectable>
              <template v-for="(p, i) in toParts(msg.plainText)" :key="i">
                <span v-if="p.t === 'text'">{{ p.s }}</span>
                <span
                  v-else
                  class="text-blue-600 underline cursor-pointer"
                  @click.stop="openMention(p.u)"
                  data-text-selectable
                >@{{ p.u }}</span>
              </template>
            </div>

            
            <div v-if="msg.fileUrl && isImageUrl(msg.fileUrl)" class="mt-1">
              <img
                :src="msg.fileUrl"
                class="rounded-xl cursor-zoom-in
                      max-h-[70vh]           <!-- قد: حداکثر 70% ارتفاع صفحه -->
                      max-w-[75vw] md:max-w-[60%] lg:max-w-[640px]  <!-- عرض: محدود به 60% یا 640px -->
                      sm:min-w-[180px] min-w-[140px]                <!-- مینیمم عرض تا ریز نشه -->
                      h-auto w-auto object-contain"
                @click="openImage(msg)"
              />
            </div>

            <div v-else-if="msg.fileUrl && isVideoUrl(msg.fileUrl)" class="mt-1">
              <video
                :src="msg.fileUrl" controls playsinline
                class="rounded-xl bg-black cursor-pointer
                      max-h-[70vh]
                      max-w-[75vw] md:max-w-[60%] lg:max-w-[640px]
                      sm:min-w-[220px] min-w-[160px]
                      h-auto w-auto"
                @dblclick.prevent="openVideo(msg)"
              ></video>
            </div>

            <!-- File bubble -->
            <div v-else-if="msg.fileUrl" class="mt-1">
              <div
                :class="[
                  'flex items-center gap-3 rounded px-3 py-2',
                  msg.senderId === myId ? 'bg-white/10' : 'bg-white'
                ]"
              >
                <!-- download button -->
                <button type="button"
                        class="w-8 h-8 rounded-full border flex items-center justify-center"
                        :class="msg.senderId === myId ? 'border-white/50 text-white' : 'border-gray-300 text-gray-600'"
                        @click="downloadFile(msg)">
                  <span v-if="downloading[fileKey(msg)]">⏬</span>
                  <span v-else-if="downloaded[fileKey(msg)]">✅</span>
                  <span v-else>⬇️</span>
                </button>

                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate max-w-[16rem] min-w-0">
                    {{ fileNameFromUrl(msg.fileUrl) }}
                  </div>
                  <div class="text-xs opacity-70">
                    {{ humanFileSize(fileSizeMap[fileKey(msg)] || 0) }}
                  </div>
                </div>
              </div>

              <!-- caption زیر فایل -->
              <div v-if="msg.fileUrl && msg.plainText" class="mt-1 whitespace-pre-wrap break-words">
                {{ msg.plainText }}
              </div>
            </div>


            <!-- زمان + وضعیت + برچسب ویرایش‌شده -->
            <div
              class="mt-1 flex items-center gap-1 text-[11px]"
              :class="timeColorClass(msg)">
            
              <span>{{ fmtHHmmLocal(msg.sentAt) }}</span>
              <span v-if="msg.updatedAtUtc" class="ml-1 opacity-80">(ویرایش‌شده)</span>
              <span v-if="msg.senderId === myId">
                <template v-if="msg.status === 'read'">✓✓</template>
                <template v-else-if="msg.status === 'delivered'">✓</template>
                <template v-else>…</template>
              </span>
            </div>
            
                        <!-- Reactions -->
            <div v-if="(msg.reactions && msg.reactions.length) || selectedUser" class="mt-1 flex flex-wrap gap-1">
              <button
                v-for="r in (msg.reactions || [])"
                :key="r.emoji"
                class="text-[11px] px-2 py-[2px] rounded-full border flex items-center gap-1"
                :class="r.mine ? (msg.senderId === myId ? 'bg-white/20 border-white/40' : 'bg-blue-50 border-blue-200') : 'bg-white/80 border-gray-200'"
                @click="toggleReaction(msg, r.emoji)"
                :title="r.count.toString()"
              >
                <span>{{ r.emoji }}</span>
                <span>{{ r.count }}</span>
              </button>

              <!-- Add (+) -->
              <button
                class="text-[11px] px-2 py-[2px] rounded-full border bg-white/80 border-gray-200"
                @click="openReactionPicker(msg)"
                title="واکنش"
              >➕</button>
            </div>

            <!-- Picker ساده‌ی inline -->
            <div v-if="reactionPickerFor && reactionPickerFor === (msg.id || msg.clientId)" class="mt-1 flex gap-1">
              <button v-for="e in quickEmojis" :key="e" class="px-2 py-[2px] text-[13px] rounded hover:bg-gray-100"
                      @click="applyReaction(msg, e)">{{ e }}</button>
              <button class="px-2 py-[2px] text-[11px] text-gray-500" @click="reactionPickerFor = null">بستن</button>
            </div>
            
            <!-- Check indicator (only in selection mode) -->
              <button
                v-if="selectionMode"
                class="absolute top-1"
                :class="msg.senderId === myId ? 'left-1' : 'right-1'"
                @click.stop="toggleSelect(msg)"
                :title="isSelected(msg) ? 'برداشتن از انتخاب' : 'انتخاب پیام'"
              >
                <span
                  :class="[
                    'w-5 h-5 inline-flex items-center justify-center rounded-full border text-[11px]',
                    isSelected(msg)
                      ? (msg.senderId === myId ? 'bg-white text-blue-600 border-white' : 'bg-blue-600 text-white border-blue-600')
                      : 'bg-white/80 text-gray-400 border-gray-300'
                  ]"
                >
                  {{ isSelected(msg) ? '✓' : '' }}
                </span>
              </button>

          </div>

        </div>
      </div>

      <!-- بنر ریپلای -->
      <div v-if="replyingTo" class="px-4 pt-2">
        <div class="px-3 py-2 bg-gray-100 border-l-4 border-blue-500 text-xs flex items-center justify-between rounded">
          <div class="truncate">
            Replying to: {{ resolveReplyPreview(replyingTo.id) }}
          </div>
          <button type="button" class="text-gray-500 hover:text-red-600" @click="replyingTo = null">✕</button>
        </div>
      </div>

      <!-- بنر ویرایش -->
      <div v-if="editingMessage" class="px-4 pt-2">
        <div class="px-3 py-2 bg-yellow-50 border-l-4 border-yellow-400 text-xs flex items-center justify-between rounded">
          <div class="truncate">Editing message</div>
          <button type="button" class="text-gray-500 hover:text-red-600" @click="cancelEdit">✕</button>
        </div>
      </div>

      <!-- فرم ارسال -->
      <form v-if="selectedUser" @submit.prevent="send" class="p-4 flex items-center gap-2 border-t relative">
        
        <!-- Attach (paperclip) -->
        <div class="relative"
            @mouseenter="clipHover = true"
            @mouseleave="clipHover = false">
          <button type="button" class="px-2 text-gray-500 hover:text-gray-700" @click="openFilePicker" title="پیوست">
            📎
          </button>

          <!-- منو دقیقا چسبیده به سنجاق -->
          <div v-if="clipHover || menuHover"
              class="absolute bottom-full right-0 mb-1 w-44 bg-white border rounded-xl shadow-lg z-50 overflow-hidden"
              @mouseenter="menuHover = true"
              @mouseleave="menuHover = false">
            <button type="button"
                    class="block w-full text-left px-3 py-2 hover:bg-gray-50"
                    @click="openFilePicker">
              File
            </button>
            <button class="px-3 py-2 hover:bg-gray-100 w-full text-left" @click="openMediaPicker">Photo & Video</button>
          </div>
        </div>


        <!-- input مخفی انتخاب فایل -->
        <input ref="fileInput" type="file" class="hidden" multiple @change="onFilesChosen" />
        <input ref="mediaInput" type="file" class="hidden" multiple accept="image/*,video/*" @change="onMediaChosen" />

        
        <input
          v-model="text"
          ref="msgInput"
          @input="onInputChanged"
          @blur="onBlurInput"
          placeholder="Write a message…"
          class="flex-1 border rounded px-3 py-2"
        />
        
        <button
          class="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canSend"
        >Send</button>
      </form>

        <!-- منوی راست‌کلیک -->
      <div v-if="contextMenu.visible" class="fixed inset-0 z-40" @click="closeMenu" @contextmenu.prevent="closeMenu">
          <div
            ref="menuEl"                                
            class="absolute z-50 bg-white rounded-lg shadow border min-w-[160px] text-left "
            :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
            @click.stop
          >
            <button class="w-full text-left px-3 py-2 hover:bg-gray-50" @click="startSelectionFrom(contextMenu.msg!)">Select</button>
            <button class="w-full text-left px-3 py-2 hover:bg-gray-50" @click="openForwardPicker">Forward…</button>
            <button class="w-full text-left px-3 py-2 hover:bg-gray-50" @click="doReply">Reply</button>
            <button v-if="canEdit(contextMenu.msg)" class="w-full text-left px-3 py-2 hover:bg-gray-50" @click="doEdit">Edit</button>
            <button
              class="w-full text-left px-3 py-2 hover:bg-gray-50"
              @click="() => { const m = contextMenu.msg; closeMenu(); if (m) openDeleteConfirmSingle(m) }">Delete</button>

              
          </div>
        </div>

        <!-- File Send Modal -->
        <div v-if="showFileModal" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div class="w-[420px] max-w-[90%] rounded-xl bg-white shadow p-4">
            <div class="text-lg font-semibold mb-2">ارسال به‌عنوان فایل</div>

            <!-- لیست فایل‌ها -->
            <div class="space-y-2 max-h-64 overflow-y-auto">
              <div v-for="(f, i) in pendingFiles" :key="i" class="flex items-center gap-3 p-3 rounded bg-gray-100">
                <div class="w-10 h-10 rounded bg-blue-500 flex items-center justify-center text-white">📄</div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{{ f.name }}</div>
                  <div class="text-xs text-gray-500">{{ humanFileSize(f.size) }}</div>
                </div>
                <button class="text-sm text-red-600 hover:underline" @click="removePendingFile(i)">حذف</button>
              </div>
            </div>

            <!-- کپشن یکسان برای همه (اختیاری) -->
            <label class="block text-sm text-gray-600 mt-3 mb-1">کپشن (اختیاری، برای همه فایل‌ها)</label>
            <textarea v-model="pendingCaption" rows="3" class="w-full border rounded px-3 py-2"></textarea>

            <div class="mt-4 flex items-center justify-between">
              <button class="text-gray-600 hover:text-gray-800" @click="cancelFileSend">Cancel</button>
              <div class="flex items-center gap-3">
                <button class="text-gray-600 hover:text-gray-800" @click="addAnotherFile">افزودن</button>
                <button class="bg-blue-600 text-white px-4 py-2 rounded"
                        :disabled="sendingFile || pendingFiles.length===0"
                        @click="confirmSendFile">
                  {{ sendingFile ? 'در حال ارسال…' : `ارسال (${pendingFiles.length})` }}
                </button>
              </div>
            </div>
          </div>

        </div>




      
      </div>


      <!-- Forward picker -->
      <div v-if="forwardPicker.visible" class="fixed inset-0 z-40 bg-black/20" @click.self="forwardPicker.visible=false">
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow p-3 w-[320px]">
          <div class="font-medium mb-2">
            {{ forwardPicker.mode === 'multi' ? `Forward ${forwardPicker.srcList.length} messages to` : 'Forward to...' }}
          </div>
          <div class="max-h-64 overflow-y-auto">
            <button
              v-for="c in conversations"
              :key="c.peerId"
              class="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
              @click="doForward(c.peerId)"
            >
              {{ c.displayName || '@' + c.username }}
            </button>
          </div>
          <div class="mt-2 text-left">
            <button class="text-xs text-gray-500 hover:text-gray-700" @click="forwardPicker.visible=false">Close</button>
          </div>
        </div>
      </div>


      <!-- Delete confirm dialog -->
      <div v-if="confirmDel.visible" class="fixed inset-0 z-50 bg-black/30" @click.self="cancelDelete">
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow p-4 w-[360px]">
          <div class="font-medium mb-2">Delete messages</div>
          <p class="text-sm text-gray-700 mb-3">
            Delete {{ confirmDel.count }} message(s)?
          </p>

          <label class="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              class="accent-red-600"
              v-model="confirmDel.forAll"
              :disabled="!confirmDel.canAll"
            />
            <span :class="confirmDel.canAll ? '' : 'text-gray-400'">
              Delete for everyone
            </span>
          </label>

          <div class="flex items-center justify-end gap-2">
            <button class="px-3 py-1.5 rounded border" @click="cancelDelete">Cancel</button>
            <button class="px-3 py-1.5 rounded bg-red-600 text-white" @click="confirmDelete">Delete</button>
          </div>
        </div>
      </div>
    </div>
  <!-- Toast -->
  <div
    v-if="toast.show"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white text-sm px-3 py-2 rounded-full shadow"
  >
    {{ toast.text }}
  </div>
  <!-- Side Menu -->
  <SideMenu :open="menuOpen" :me="meProfile"
            @close="menuOpen=false"
            @action="onMenuAction" />

  <!-- Profile Modal -->
  <ProfileModal :open="showProfile" :me="meProfile"
                @close="showProfile=false"
                @edit="openSettings()" />

  <!-- Settings Modal: reuse SettingsView inside ModalSheet -->
  <ModalSheet :open="showSettings" @close="showSettings=false">
    <div class="p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-lg font-semibold">تنظیمات</div>
        <button class="text-gray-500 hover:text-gray-700" @click="showSettings=false">✕</button>
      </div>
      <SettingsView/>
    </div>
  </ModalSheet>

    <!-- Contacts Modal -->
  <ModalSheet :open="showContacts" @close="showContacts=false">
    <div class="p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-lg font-semibold">مخاطبین</div>
        <button class="text-gray-500 hover:text-gray-700" @click="showContacts=false">✕</button>
      </div>
      <ContactsView :inModal="true" @open-chat="onOpenChatFromContacts" />
    </div>
  </ModalSheet>


  <!-- Media Send Modal -->
    <div v-if="showMediaModal" class="fixed inset-0 z-[999] bg-black/40 backdrop-blur grid place-items-center" @click.self="cancelMediaSend">
      <div class="w-[520px] max-w-[95%] rounded-xl bg-white shadow p-4">
        <div class="text-lg font-semibold mb-2">ارسال مدیا</div>

        <!-- پیش‌نمایش -->
        <div class="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          <div v-for="(f,i) in pendingMedia" :key="i" class="relative">
            <img v-if="isImageFile(f)" :src="objUrl(f)" class="w-full h-28 object-cover rounded"/>
            <video v-else :src="objUrl(f)" class="w-full h-28 object-cover rounded"></video>
            <button class="absolute top-1 right-1 bg-white/80 rounded px-2 text-sm" @click="removePendingMedia(i)">حذف</button>
          </div>
        </div>

        <!-- فشرده‌سازی فقط برای تصویر -->
        <div class="mt-3 flex items-center gap-2" v-if="allImagesSelected">
          <input id="cmp" type="checkbox" v-model="compressImages"/>
          <label for="cmp" class="text-sm select-none">فشرده‌سازی تصویر</label>
        </div>

        <!-- Group items -->
        <div class="mt-2 flex items-center gap-2">
          <input id="grpMedia" type="checkbox" v-model="mediaGroupItems"/>
          <label for="grpMedia" class="text-sm select-none">Group items</label>
        </div>

        <!-- کپشن -->
        <label class="block text-sm text-gray-600 mt-2 mb-1">کپشن</label>
        <textarea v-model="mediaCaption" rows="3" class="w-full border rounded px-3 py-2"></textarea>

        <div class="mt-4 flex items-center justify-between">
          <button class="text-gray-600 hover:text-gray-800" @click="cancelMediaSend">Cancel</button>
          <div class="flex items-center gap-3">
            <button class="text-gray-600 hover:text-gray-800" @click="addAnotherMedia">افزودن</button>
            <button class="bg-blue-600 text-white px-4 py-2 rounded"
                    :disabled="sendingMedia || pendingMedia.length===0"
                    @click="confirmSendMedia">
              {{ sendingMedia ? 'در حال ارسال…' : `ارسال (${pendingMedia.length})` }}
            </button>
          </div>
        </div>
      </div>
  </div>

  


  <MediaImageViewer v-if="showImageViewer"
                  :src="viewerImageSrc" :caption="viewerCaption"
                  @close="showImageViewer=false" />
  <MediaVideoPlayer v-if="showVideoPlayer"
                  :src="playerVideoSrc" :caption="playerCaption"
                  @close="showVideoPlayer=false" />


  <PeerProfileModal
  :open="showPeerProfile"
  :user="peerProfile"
  :isContact="isPeerInContacts"
  @close="showPeerProfile=false"
  @send-message="onPeerSendMessage"
  @add-contact="onPeerAddContact"
  @remove-contact="onPeerRemoveContact"
  @share-contact="onPeerShareContact"
/>

</template>



<script setup lang="ts">//----------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------


import SideMenu from '../components/SideMenu.vue'
import ModalSheet from '../components/ModalSheet.vue'
import ProfileModal from '../components/ProfileModal.vue'
import ContactsView from './ContactsView.vue'   // NEW
const showContacts = ref(false)                 // NEW

import PeerProfileModal from '../components/PeerProfileModal.vue'
import SettingsView from './SettingsView.vue'

import { ref, onMounted,nextTick,onBeforeUnmount,reactive,computed, watch  } from 'vue'
import { getMessageBrief,sendMessageWithFileFD } from '../services/api'
import {
  connectToChatHub,
  onMessageReceived,
  sendMessage,
  onDelivered,
  onMessageRead,
  markAsRead,
  startTyping,
  stopTyping,
  onTyping,
  onTypingStopped,
  onUserOnline,
  onUserOffline,
  onMessageEdited,
  onMessageDeleted,
  onReactionUpdated,
  fetchOnlineUsers,
  onOnlineSnapshot,
  onUserLastSeen
} from '../services/signalr'
import {
  encryptAES,
  decryptAES,
  importAESKey,
  generateAESKey,
  exportAESKey,


} from '../services/crypto'
import {
  getChatKey,
  uploadEncryptedFile,
  getUserByUsername,
  storeChatKey,
  getConversationPaged,
  getConversations,
  editMessage,
  deleteMessage,
  addReaction, removeReaction,getUserById,
  getMeProfile
} from '../services/api'
import {
  saveAESKey,
  loadAESKey
} from '../utils/aesKeyStore'
import { getToken, parseJwt } from '../utils/jwt'
import { useRoute ,useRouter} from 'vue-router'
import {toDateSafe, formatAbsoluteEn,formatRelativeEn} from "../utils/time";
import MediaImageViewer from '../components/MediaImageViewer.vue'
import MediaVideoPlayer from '../components/MediaVideoPlayer.vue'
import {getMyContacts, addContact, removeContact,getUsersList } from '../services/api'


type UiReaction = { emoji: string; count: number; mine?: boolean }

type UiMessage = {
  id?: string
  clientId?: string
  senderId: string
  plainText: string
  fileUrl: string | null
  status?: 'sending' | 'delivered' | 'read'
  sentAt?: string
  deliveredAtUtc?: string | null
  readAtUtc?: string | null
  replyToMessageId?: string | null
  isDeleted?: boolean
  updatedAtUtc?: string | null
  reactions?: UiReaction[]
  forwardedFromMessageId?: string | null
  forwardedFromSenderId?: string | null
}

type UiConversation = {
  peerId: string
  username: string
  displayName?: string | null
  avatarUrl?: string | null
  unreadCount: number
  lastSentAt?: string | null
  lastFileUrl?: string | null
  lastPreview?: string | null
}

function resolveReplyPreview(replyId?: string | null): string {
  if (!replyId) return ''

  const same = messages.value.find(m => m.id === replyId || m.clientId === replyId)
  if (same) return same.plainText || (same.fileUrl ? '[مدیا]' : '—')

  const cached = replyPreviewCache[replyId]
  if (cached) return cached

  if (!pendingReplyFetch.has(replyId)) {
    pendingReplyFetch.add(replyId)
    fetchReplyPreview(replyId)
  }
  return 'در حال بارگذاری…'
}

const route = useRoute()
const router = useRouter()
const EMPTY_MSG_MARKER = '\u200B' 

const myId = ref<string>('')
const selectedUser = ref<{ id: string; username: string } | null>(null)
const messages = ref<UiMessage[]>([])
const text = ref('')
const selectedFile = ref<File | null>(null)
const unread = ref<Record<string, number>>({})
const online = new Set<string>()
const typing = new Set<string>()

const isPeerTyping = ref(false)
let typingTimer: number | null = null
const TYPING_IDLE_MS = 4000
let prevSelectedUserId: string | null = null



const scrollBox = ref<HTMLElement | null>(null)
const loadingOlder = ref(false)
const hasMore = ref(true)
const oldestId = ref<string | null>(null)
const replyingTo = ref<UiMessage | null>(null)

const conversations = ref<UiConversation[]>([])


const msgElMap = new Map<string, HTMLElement>();

const ACTIVE_UID_KEY = 'phi.activeUserId';

const contextMenu = ref<{ visible:boolean, x:number, y:number, msg:UiMessage|null }>({ visible:false, x:0, y:0, msg:null })
const editingMessage = ref<UiMessage | null>(null)

const menuEl = ref<HTMLElement | null>(null)

const quickEmojis = ['👍','❤️','😂','😮','😢','🔥']
const reactionPickerFor = ref<string | null>(null)

const forwardPickerFor = ref<{ msg: UiMessage | null, visible: boolean }>({ msg: null, visible: false })

const forwardNames = reactive<Record<string, string>>({})
const forwardHandles = reactive<Record<string, string>>({}) 

const selectionMode = ref(false)
const selected = reactive(new Set<string>())


const toast = reactive({ show: false, text: '' })

const confirmDel = reactive<{
  visible: boolean
  mode: 'single' | 'multi'
  msg: UiMessage | null
  count: number
  canAll: boolean
  forAll: boolean
}>({
  visible: false,
  mode: 'single',
  msg: null,
  count: 0,
  canAll: false,
  forAll: false
})

const isDragSelecting = ref(false)     
const dragPending = ref(false)         
const dragMode = ref<'add' | 'remove'>('add')
const dragVisited = reactive(new Set<string>())
const startClientY = ref(0)
const startClientX = ref(0)
const lastMouseY = ref(0)
let autoScrollTimer: number | null = null
const DRAG_THRESHOLD = 16
const dragStartMsg = ref<UiMessage | null>(null)

const forwardPicker = reactive<{
  visible: boolean
  mode: 'single' | 'multi'
  src: UiMessage | null
  srcList: UiMessage[]
}>({
  visible: false,
  mode: 'single',
  src: null,
  srcList: []
})

const menuOpen = ref(false)
const showProfile = ref(false)
const showSettings = ref(false)
const meProfile = ref<{ id?: string; username?: string; displayName?: string; avatarUrl?: string } | null>(null)

const chatNavStack = ref<Array<{ id: string; username: string }>>([])
 // label (DisplayName یا @username)

const messageEls: Map<string, HTMLElement> = new Map()

const bindMsgEl = (key: string) => (el: Element | any | null) => {
  const dom = el && (el as any).$el ? (el as any).$el as HTMLElement : (el as HTMLElement | null)
  if (dom) messageEls.set(key, dom)
  else messageEls.delete(key)
}

const replyPreviewCache = reactive<Record<string, string>>({})
const pendingReplyFetch = new Set<string>()

const showPeerProfile = ref(false)
const peerProfile = ref<any|null>(null)
const myContacts = ref<Array<{ contactId: string; username: string }>>([])

const selectedLabel = computed(() => {
  const su = selectedUser.value
  if (!su) return ''
  const conv = conversations.value.find(c => c.peerId === su.id)
  return (conv?.displayName && conv.displayName.trim())
    || ('@' + su.username.replace(/^@/, ''))
})

const msgInput = ref<HTMLInputElement|null>(null)

const canSend = computed(() =>
  !!selectedUser.value && (
    (text.value && text.value.trim().length > 0) ||
    !!selectedFile.value ||
    !!editingMessage.value
  )
)

const onlineIds = reactive(new Set<string>())
const lastSeenMap = reactive<Record<string, string | null>>({})
const avatarById  = reactive<Record<string, string | null>>({})
const displayById = reactive<Record<string, string | null>>({})

const peerStatus = computed(() => {
  const su = selectedUser.value
  if (!su) return ''
  if (isPeerTyping.value) return 'is typing...'
  if (onlineIds.has(su.id)) return 'Online'
  const ls = lastSeenMap[su.id]
  return ls ? `Last seen ${formatRelativeEn(ls)}` : 'Last seen unknown'
})

const attachOpen = ref(false)
const fileInput = ref<HTMLInputElement|null>(null)

function openFilePicker() {
  fileInput.value?.click()
}

const pendingFiles = ref<File[]>([]) 
const pendingCaption = ref('')
const showFileModal = ref(false)
const sendingFile = ref(false)

const downloaded = reactive<Record<string, boolean>>({})
const downloading = reactive<Record<string, boolean>>({})
const fileSizeMap = reactive<Record<string, number>>({})

const clipHover = ref(false)
const menuHover = ref(false)

const prevDraftBeforeEdit = ref('')

const mediaInput = ref<HTMLInputElement|null>(null)
const pendingMedia = ref<File[]>([])
const showMediaModal = ref(false)
const sendingMedia = ref(false)
const mediaCaption = ref('')
const mediaGroupItems = ref(false)
const compressImages = ref(true) 
const showImageViewer = ref(false)
const viewerImageSrc = ref<string>(''); const viewerCaption = ref<string>('')
const showVideoPlayer = ref(false)
const playerVideoSrc = ref<string>(''); const playerCaption = ref<string>('')

const allImagesSelected = computed(() => pendingMedia.value.length>0 && pendingMedia.value.every(isImageFile))


//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------



//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------

function isMediaOnly(msg: UiMessage) {
  return !!msg.fileUrl && (isImageUrl(msg.fileUrl) || isVideoUrl(msg.fileUrl)) && !msg.plainText
}

function bubbleClasses(msg: UiMessage) {
  const base = ['inline-block', 'max-w-[80%]']
  if (isMediaOnly(msg)) {
    // مدیا بدون قاب
    base.push('rounded-xl', 'p-0', 'bg-transparent', 'text-current')
  } else {
    // متن معمولی با گوشه نرم‌تر
    base.push('rounded-2xl', 'px-3', 'py-2',
      msg.senderId === myId.value ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'
    )
  }
  return base
}


function timeColorClass(msg: UiMessage) {

  if (isMediaOnly(msg)) return 'text-gray-500'
  return msg.senderId === myId.value ? 'text-white/80' : 'text-gray-500'
}


function objUrl(f: File) {

  return (window.URL || globalThis.URL).createObjectURL(f)
}


function openImage(msg: UiMessage){
  viewerImageSrc.value = msg.fileUrl || ''
  viewerCaption.value = msg.plainText || ''
  showImageViewer.value = true
}
function openVideo(msg: UiMessage){
  playerVideoSrc.value = msg.fileUrl || ''
  playerCaption.value = msg.plainText || ''
  showVideoPlayer.value = true
}


function openMediaPicker(){ mediaInput.value?.click() }

function onMediaChosen(e: Event){
  const el = e.target as HTMLInputElement
  const list = el.files ? Array.from(el.files) : []
  if (list.length){
    pendingMedia.value.push(...list)
    showMediaModal.value = true
  }
  el.value = ''
}
function addAnotherMedia(){ mediaInput.value?.click() }
function removePendingMedia(i:number){
  pendingMedia.value.splice(i,1)
  if (!pendingMedia.value.length){ cancelMediaSend() }
}
function cancelMediaSend(){
  showMediaModal.value = false
  pendingMedia.value = []
  mediaCaption.value = ''
  mediaGroupItems.value = false
  compressImages.value = true
}

async function confirmSendMedia(){
  if (!selectedUser.value || !pendingMedia.value.length) return
  sendingMedia.value = true
  try{
    const partnerId = selectedUser.value.id
    const key = await getOrLoadKey(partnerId)
    const caption = (mediaCaption.value || '').trim()
    const hasCaption = !!caption
    const encCaption = hasCaption ? await encryptAES(key, caption) : await encryptAES(key, EMPTY_MSG_MARKER)

    // غیرگروهی: مثل تلگرام اول کپشن به صورت متن جدا
    if (!mediaGroupItems.value && hasCaption){
      const cidTxt = crypto.randomUUID()
      await sendMessage(partnerId, encCaption, undefined, cidTxt)
    }

    const gid = mediaGroupItems.value ? crypto.randomUUID() : null
    const nowIso = new Date().toISOString()

    for (let i=0;i<pendingMedia.value.length;i++){
      let f = pendingMedia.value[i]
      if (compressImages.value && isImageFile(f)){
        try { f = await compressImageFile(f) } catch {}
      }

      const clientId = crypto.randomUUID()

      // optimistic bubble
      messages.value.push({
        clientId,
        senderId: myId.value,
        plainText: mediaGroupItems.value ? (i===0 ? caption : '') : '',
        fileUrl: '(pending)',
        status: 'sending',
        sentAt: nowIso,
        replyToMessageId: replyingTo.value?.id || null,
        groupId: gid
      } as UiMessage)

      await nextTick()
      const el = scrollBox.value
      if (el) el.scrollTop = el.scrollHeight

      // ارسال
      const fd = new FormData()
      fd.append('receiverId', partnerId)
      const enc = mediaGroupItems.value
        ? (i===0 ? encCaption : await encryptAES(key, EMPTY_MSG_MARKER))
        : await encryptAES(key, EMPTY_MSG_MARKER)
      fd.append('encryptedText', enc)
      fd.append('file', f)
      if (replyingTo.value?.id) fd.append('replyToMessageId', replyingTo.value.id)
      if (gid) fd.append('groupId', gid)
      fd.append('clientId', clientId)

      await sendMessageWithFileFD(fd)
    }

    showMediaModal.value = false
    pendingMedia.value = []
    mediaCaption.value = ''
    mediaGroupItems.value = false
    replyingTo.value = null
  } finally {
    sendingMedia.value = false
  }
}



function isImageUrl(url?: string|null) {
  if (!url) return false
  return /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(url.split('?')[0] || '')
}
function isVideoUrl(url?: string|null) {
  if (!url) return false
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(url.split('?')[0] || '')
}
function isImageFile(f: File){ return f.type.startsWith('image/') }
function isVideoFile(f: File){ return f.type.startsWith('video/') }

async function compressImageFile(file: File, maxDim = 1280, quality = 0.82): Promise<File> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i); i.onerror = rej
    i.src = URL.createObjectURL(file)
  })
  const w = img.naturalWidth, h = img.naturalHeight
  let nw = w, nh = h
  if (w > h && w > maxDim) { nw = maxDim; nh = Math.round(h * maxDim / w) }
  else if (h >= w && h > maxDim) { nh = maxDim; nw = Math.round(w * maxDim / h) }

  const canvas = document.createElement('canvas')
  canvas.width = nw; canvas.height = nh
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, nw, nh)

  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', quality))
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
}


function onFilesChosen(e: Event) {
  const el = e.target as HTMLInputElement
  const list = el.files ? Array.from(el.files) : []
  if (list.length) {
    // به لیست موجود اضافه کن (بارهای بعدی هم قابل افزودن است)
    pendingFiles.value.push(...list)
    showFileModal.value = true
  }
  // اجازه انتخاب دوباره همان فایل‌ها
  el.value = ''
}



function removePendingFile(i: number) {
  pendingFiles.value.splice(i, 1)
  if (pendingFiles.value.length === 0) {
    // اگر همه حذف شد، مودال را ببند
    showFileModal.value = false
    pendingCaption.value = ''
  }
}




function isNearBottom(el: HTMLElement, threshold = 400) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

function fileKey(m: any) {
  return (m.id || m.clientId || '') as string
}

function fileNameFromUrl(url: string) {
  try {
    const p = url.split('/').pop() || ''
    const i = p.indexOf('_')
    return decodeURIComponent(i >= 0 ? p.slice(i + 1) : p)
  } catch { return 'file' }
}

function humanFileSize(n: number) {
  if (!n) return ''
  const units = ['B','KB','MB','GB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed( (i===0)?0:1 )} ${units[i]}`
}

async function ensureFileSize(url: string, k: string) {
  if (fileSizeMap[k]) return
  try {
    const res = await fetch(url, { method: 'HEAD' })
    const len = parseInt(res.headers.get('content-length') || '0', 10)
    if (len > 0) fileSizeMap[k] = len
  } catch {}
}

async function downloadFile(m: any) {
  const k = fileKey(m)
  if (!m.fileUrl) return
  downloading[k] = true
  try {
    // try get size once
    ensureFileSize(m.fileUrl, k)

    const a = document.createElement('a')
    a.href = m.fileUrl
    a.download = fileNameFromUrl(m.fileUrl)
    document.body.appendChild(a)
    a.click()
    a.remove()
    downloaded[k] = true
  } finally {
    downloading[k] = false
  }
}


function cancelFileSend() {
  showFileModal.value = false
  pendingFiles.value = []
  pendingCaption.value = ''
}

function addAnotherFile() {
  fileInput.value?.click()
}

async function confirmSendFile() {
  if (!selectedUser.value || pendingFiles.value.length === 0) return
  sendingFile.value = true
  try {
    const key = await getOrLoadKey(selectedUser.value.id)

    const caption = (pendingCaption.value || '').trim()
    const toEncrypt = caption ? caption : EMPTY_MSG_MARKER
    const captionEnc = await encryptAES(key, toEncrypt)

    // برای هر فایل یک پیام pending بساز و ارسال کن
    const sameChat = true  // چون در همین چت هستیم مودال را باز کرده‌ایم
    const nowIso = new Date().toISOString()

    for (const f of pendingFiles.value) {
      const clientId = crypto.randomUUID()

      // 1) پیام pending در UI
      messages.value.push({
        clientId,
        senderId: myId.value,
        plainText: caption || '',
        fileUrl: '(pending)',
        status: 'sending',
        sentAt: nowIso,
        replyToMessageId: replyingTo.value?.id || null
      } as UiMessage)

      await nextTick()
      const el = scrollBox.value
      if (el) el.scrollTop = el.scrollHeight

      // 2) ارسال به سرور
      const fd = new FormData()
      fd.append('receiverId', selectedUser.value.id)
      fd.append('encryptedText', captionEnc)
      fd.append('file', f)
      if (replyingTo.value?.id) fd.append('replyToMessageId', replyingTo.value.id)
      fd.append('clientId', clientId)

      await sendMessageWithFileFD(fd)
    }

    // آپدیت سایدبار (آخرین وضعیت گفتگو)
    const uid = selectedUser.value.id
    const convIdx = conversations.value.findIndex(c => c.peerId === uid)
    const lastFile = pendingFiles.value[pendingFiles.value.length - 1]
    if (convIdx >= 0) {
      const c = conversations.value[convIdx]
      c.lastSentAt = nowIso
      c.lastFileUrl = '(pending)'
      c.lastPreview = caption || null
      const [moved] = conversations.value.splice(convIdx, 1)
      conversations.value.unshift(moved)
    }

    showFileModal.value = false
    pendingFiles.value = []
    pendingCaption.value = ''
    replyingTo.value = null
  } catch (e) {
    console.error('send file failed', e)
  } finally {
    sendingFile.value = false
  }
}




function initialsOf(name: string) {
  const t = (name || '').trim()
  if (!t) return '؟'
  const p = t.split(/\s+/)
  return (p.length === 1 ? p[0].slice(0,2) : (p[0][0] + p[1][0])).toUpperCase()
}
function colorFromString(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return `hsl(${h % 360} 65% 55%)`
}

function startReplyFrom(m: UiMessage) {
  replyingTo.value = m
  nextTick(() => msgInput.value?.focus())
}

async function openPeerProfile() {
  if (!selectedUser.value) return
  const u = await getUserByUsername(selectedUser.value.username.replace(/^@/,''))
  peerProfile.value = u
  try { myContacts.value = await getMyContacts() } catch {}
  showPeerProfile.value = true
}

const isPeerInContacts = computed(() => {
  if (!peerProfile.value) return false
  return myContacts.value.some(c => c.username === peerProfile.value.username)
})

async function onPeerAddContact(id: string) {
  await addContact(id)
  myContacts.value = await getMyContacts()
}

async function onPeerRemoveContact(id: string) {
  await removeContact(id)
  myContacts.value = await getMyContacts()
}

function onPeerSendMessage(id: string) {

  handleUserSelect({ id, username: peerProfile.value.username })
  if (route.path !== '/chat') router.replace('/chat')
  showPeerProfile.value = false
}

async function onPeerShareContact(u: any) {
  const text = u.displayName ? `${u.displayName} (@${u.username})` : `@${u.username}`
  await navigator.clipboard.writeText(text)
  showToast('Contact copied')
}








async function fetchReplyPreview(id: string) {
  try {
    const dto = await getMessageBrief(id)
    const plain = await decryptMessageText(dto.encryptedContent)
    replyPreviewCache[id] = plain || (dto.fileUrl ? '[مدیا]' : '—')
  } catch {
    replyPreviewCache[id] = 'نامشخص'
  } finally {
    pendingReplyFetch.delete(id)
  }
}


async function decryptMessageText(base64?: string | null): Promise<string> {
  if (!base64 || !selectedUser.value) return ''
  try {
    const key = await getOrLoadKey(selectedUser.value.id)
    const plain = await decryptAES(key, base64)
    return plain && plain !== EMPTY_MSG_MARKER ? plain : ''
  } catch {
    return '[رمزگشایی نشد]'
  }
}

function currentChatRef() {
  if (!selectedUser.value) return null
  return { id: selectedUser.value.id, username: selectedUser.value.username.replace(/^@/, '') }
}

async function goBackChat() {
  if (!chatNavStack.value.length) return
  const prev = chatNavStack.value.pop()!
  await handleUserSelect({ id: prev.id, username: prev.username })
  if (route.path !== '/chat') router.replace('/chat')
}

type Part = { t: 'text'; s: string } | { t: 'mention'; u: string }
function toParts(txt?: string | null): Part[] {
  if (!txt) return []
  const re = /@([A-Za-z0-9_]{3,32})/g
  const out: Part[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(txt)) !== null) {
    const start = m.index
    if (start > last) out.push({ t: 'text', s: txt.slice(last, start) })
    out.push({ t: 'mention', u: m[1] })
    last = start + m[0].length
  }
  if (last < txt.length) out.push({ t: 'text', s: txt.slice(last) })
  return out
}

async function openMention(usernameOrAt: string) {
  const uname = usernameOrAt.replace(/^@/, '')
  try {
    const u = await getUserByUsername(uname)
    if (!u || !u.id) {
      showToast('Username not found')
      return
    }

    const cur = currentChatRef()
    if (cur && cur.id !== u.id) chatNavStack.value.push(cur)
    await handleUserSelect({ id: u.id, username: (u.username || '').replace(/^@/, '') })
    if (route.path !== '/chat') router.replace('/chat')
  } catch {
    showToast('Username not found')
  }
}

async function onOpenChatFromContacts(p: { id: string; username: string }) {
  showContacts.value = false
  await handleUserSelect({ id: p.id, username: p.username })
  if (route.path !== '/chat') router.replace('/chat')
}

function onMenuAction(a: 'profile'|'contacts'|'saved'|'settings') {
  menuOpen.value = false
  if (a === 'profile') {
    showProfile.value = true
  } else if (a === 'settings') {
    showSettings.value = true
  } else if (a === 'contacts') {
    showContacts.value = true
  } else if (a === 'saved') {
    goSavedMessages()
  }
}

function openSettings() {
  showProfile.value = false
  showSettings.value = true
}

async function goSavedMessages() {
  const uname = (meProfile.value?.username || '').replace(/^@/,'')
  if (!myId.value || !uname) return
  await handleUserSelect({ id: myId.value, username: uname })
}


function openForwardPickerMulti() { 
  if (!selectedCount.value) return
  forwardPicker.visible = true
  forwardPicker.mode = 'multi'
  forwardPicker.src = null
  forwardPicker.srcList = [...selectedMessages.value]
}


function applyDragOn(m: UiMessage) {
  const k = getMsgKey(m)
  if (dragVisited.has(k)) return
  dragVisited.add(k)
  if (dragMode.value === 'add') selected.add(k)
  else selected.delete(k)
}

function onRowMouseDown(ev: MouseEvent, m: UiMessage) {

  if (isInTextSelectable(ev.target)) return
  if (!selectedUser.value) return
  if (ev.button !== 0) return

  ev.preventDefault()
  ev.stopPropagation()

  const k = getMsgKey(m)
  const already = selected.has(k)
  dragMode.value = already ? 'remove' : 'add'

  dragStartMsg.value = m
  dragPending.value = true
  isDragSelecting.value = false
  dragVisited.clear()
  startClientY.value = ev.clientY
  startClientX.value = ev.clientX
  lastMouseY.value = ev.clientY

  window.addEventListener('mouseup', endDragSelect)
  window.addEventListener('mousemove', onDragMouseMove, { passive: true })
}


function onDragMouseMove(ev: MouseEvent) {
  lastMouseY.value = ev.clientY

  if (dragPending.value && !isDragSelecting.value) {
    const dy = Math.abs(ev.clientY - startClientY.value)
    const dx = Math.abs(ev.clientX - startClientX.value)
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      if (!selectionMode.value) selectionMode.value = true
      isDragSelecting.value = true
      dragPending.value = false
      startAutoScroll()

      if (dragStartMsg.value) applyDragOn(dragStartMsg.value)
    }
  }
}

function onRowMouseEnter(m: UiMessage) {
  if (!isDragSelecting.value) return
  applyDragOn(m)
}

function endDragSelect() {
  stopAutoScroll()
  dragPending.value = false
  isDragSelecting.value = false
  dragVisited.clear()
  window.removeEventListener('mouseup', endDragSelect)
  window.removeEventListener('mousemove', onDragMouseMove)
}

function startAutoScroll() {
  const el = scrollBox.value as HTMLElement | null
  if (!el) return
  stopAutoScroll()
  autoScrollTimer = window.setInterval(() => {
    if (!isDragSelecting.value) return
    const rect = el.getBoundingClientRect()
    const margin = 32
    const speed = 12
    if (lastMouseY.value < rect.top + margin) el.scrollTop -= speed
    else if (lastMouseY.value > rect.bottom - margin) el.scrollTop += speed
  }, 30)
}
function stopAutoScroll() {
  if (autoScrollTimer) { clearInterval(autoScrollTimer); autoScrollTimer = null }
}


function onRowClick(ev: MouseEvent, m: UiMessage) {
  if (isInTextSelectable(ev.target)) return

  if (selectionMode.value) {
    toggleSelect(m)
  }
}

function isInTextSelectable(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  return !!el.closest('[data-text-selectable]')
}


function openDeleteConfirmSingle(msg: UiMessage, scopeDefault?: 'me'|'all') {
  confirmDel.visible = true
  confirmDel.mode = 'single'
  confirmDel.msg = msg
  confirmDel.count = 1
  confirmDel.canAll = isMine(msg)
  confirmDel.forAll = scopeDefault === 'all' && confirmDel.canAll
}

function openDeleteConfirmMulti() {
  confirmDel.visible = true
  confirmDel.mode = 'multi'
  confirmDel.msg = null
  confirmDel.count = selectedCount.value
  confirmDel.canAll = allSelectedAreMine.value
  confirmDel.forAll = false
}

function cancelDelete() {
  confirmDel.visible = false
}

async function confirmDelete() {
  try {
    if (confirmDel.mode === 'single' && confirmDel.msg?.id) {
      const scope = (confirmDel.forAll && confirmDel.canAll) ? 'all' : 'me'
      await deleteMessage(confirmDel.msg.id, scope)
      const i = messages.value.findIndex(x => x.id === confirmDel.msg!.id)
      if (i >= 0) messages.value.splice(i, 1)
    } else if (confirmDel.mode === 'multi') {
      const scope = (confirmDel.forAll && confirmDel.canAll) ? 'all' : 'me'
      const ids = selectedMessages.value.map(m => m.id!).filter(Boolean)
      await Promise.all(ids.map(id => deleteMessage(id, scope).catch(()=>{})))
      for (const id of ids) {
        const i = messages.value.findIndex(x => x.id === id)
        if (i >= 0) messages.value.splice(i, 1)
      }
      clearSelection()
    }
    showToast('Deleted')
  } catch (e) {
    console.warn('confirmDelete failed', e)
  } finally {
    confirmDel.visible = false
  }
}

function showToast(t: string) {
  toast.text = t
  toast.show = true
  setTimeout(() => { toast.show = false }, 1400)
}


type UiMsgKey = string
function getMsgKey(m: UiMessage): UiMsgKey { return (m.id || m.clientId)! }
function isSelected(m: UiMessage) { return selected.has(getMsgKey(m)) }
function toggleSelect(m: UiMessage) {
  const k = getMsgKey(m)
  if (selected.has(k)) selected.delete(k); else selected.add(k)
}
function clearSelection() { selected.clear(); selectionMode.value = false }

const selectedMessages = computed(() => messages.value.filter(m => selected.has(getMsgKey(m))))
const selectedCount = computed(() => selected.size)
const allSelectedAreMine = computed(() => selectedMessages.value.length > 0 && selectedMessages.value.every(m => m.senderId === myId.value))

watch(selectedUser, () => clearSelection())

watch(selectedCount, (n) => {
  if (n === 0 && selectionMode.value) {
    selectionMode.value = false
  }
})

watch(messages, (list) => {
  const ids = new Set(
    list.map(m => m.forwardedFromSenderId).filter(Boolean) as string[]
  )
  ids.forEach(id => { if (!forwardNames[id]) cacheForwardName(id) })
}, { immediate: true, deep: true })



function onKeydownSelection(e: KeyboardEvent) {
  if (e.key === 'Escape' && selectionMode.value) clearSelection()
}
onMounted(() => window.addEventListener('keydown', onKeydownSelection))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydownSelection))

async function writeClipboard(text: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {}
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy') } catch {}
  document.body.removeChild(ta)
}

async function copySelectedText() {
  if (!selectedCount.value) return
  const ordered = [...selectedMessages.value].sort((a,b) => (a.sentAt||'').localeCompare(b.sentAt||''))
  const lines = ordered.map(m => (m.plainText || '').trim()).filter(Boolean)
  if (lines.length === 0) return
  await writeClipboard(lines.join('\n'))
  clearSelection()
  showToast('Copied')
}

async function deleteSelectedForMe() {
  if (!selectedCount.value) return
  openDeleteConfirmMulti()
}

function startSelectionFrom(m: UiMessage) {
  selectionMode.value = true
  selected.clear()
  toggleSelect(m)
  closeMenu()
}


async function cacheForwardName(userId: string) {
  if (forwardNames[userId] && forwardHandles[userId]) return

  const inConv = conversations.value.find(c => c.peerId === userId)
  if (inConv) {
    const handle = (inConv.username || '').replace(/^@/, '')
    const label  = inConv.displayName || (handle ? '@' + handle : '')
    if (label)  forwardNames[userId]   = label
    if (handle) forwardHandles[userId] = handle
  }

  try {
    const u = await getUserById(userId)
    console.log("DISPLAY")
    console.log(u?.DisplayName)
    console.log("ID")
    console.log(u?.id)
    const handleRaw = (u?.username ?? u?.Username ?? '')
    const handle    = handleRaw.replace(/^@/, '')

    const display =
      (u?.displayName ?? u?.DisplayName) ??
      ([u?.firstName ?? u?.FirstName, u?.lastName ?? u?.LastName]
        .filter(Boolean).join(' ').trim() || undefined) ??
      (u?.name ?? u?.Name)

    const label = (display && display.trim()) || (handle ? '@' + handle : '')
    if (label)  forwardNames[userId]   = label
    if (handle) forwardHandles[userId] = handle
  } catch {
  }
}


function resolveForwardLabel(userId: string) {
  return forwardNames[userId] || (forwardHandles[userId] ? '@' + forwardHandles[userId] : 'کاربر')
}

async function openForwardUser(userId: string) {
  try {
    const u = await getUserById(userId)
    if (!u?.id || !u?.username) {
      showToast('Username not found')
      return
    }
    const cur = currentChatRef?.()
    if (cur && cur.id !== u.id) chatNavStack.value.push(cur)

    await handleUserSelect({ id: u.id, username: (u.username || '').replace(/^@/, '') })
    if (route.path !== '/chat') router.replace('/chat')
  } catch {
    showToast('Username not found')
  }
}

function openForwardPicker() { // single from context menu
  if (!contextMenu.value.msg) return
  forwardPicker.visible = true
  forwardPicker.mode = 'single'
  forwardPicker.src = contextMenu.value.msg
  forwardPicker.srcList = []
  closeMenu()
}

async function doForward(toPeerId: string) {
  const mode = forwardPicker.mode
  const srcSingle = forwardPicker.src
  const srcList  = forwardPicker.srcList
  forwardPicker.visible = false

  try {
    const aesKey = await getOrLoadKey(toPeerId)
    const sameChat = selectedUser.value && selectedUser.value.id === toPeerId

    if (mode === 'single' && srcSingle) {
      const src = srcSingle
      const cipher = await encryptAES(aesKey, src.plainText || '')
      const clientId = sameChat ? crypto.randomUUID() : null

      if (sameChat) {
        const mine: UiMessage = {
          clientId: clientId || undefined,
          senderId: myId.value,
          plainText: src.plainText,
          fileUrl: src.fileUrl || null,
          status: 'sending',
          sentAt: new Date().toISOString(),
          forwardedFromMessageId: src.forwardedFromMessageId || src.id || null,
          forwardedFromSenderId:  src.forwardedFromSenderId  || src.senderId || null,
        }
        messages.value.push(mine)
        await nextTick()
        const el = scrollBox.value
        if (el) el.scrollTop = el.scrollHeight
        if (mine.forwardedFromSenderId) cacheForwardName(mine.forwardedFromSenderId)
      }

      await sendMessage(
        toPeerId,
        cipher,
        src.fileUrl || null,
        clientId,
        null,
        src.forwardedFromMessageId || src.id || null
      )

      if (!sameChat) {
        const nowIso = new Date().toISOString()
        const idx = conversations.value.findIndex(c => c.peerId === toPeerId)
        if (idx >= 0) {
          const c = conversations.value[idx]
          c.lastSentAt = nowIso
          c.lastFileUrl = src.fileUrl || null
          c.lastPreview = src.plainText || (src.fileUrl ? null : '')
          const [moved] = conversations.value.splice(idx, 1)
          conversations.value.unshift(moved)
        }
      }
    } else if (mode === 'multi' && srcList.length) {

      const list = [...srcList].sort((a,b) => (a.sentAt||'').localeCompare(b.sentAt||''))

      const clientMap = new Map<string, string>() // srcKey -> clientId
      if (sameChat) {
        for (const src of list) {
          const clientId = crypto.randomUUID()
          clientMap.set((src.id || src.clientId)!, clientId)
          const mine: UiMessage = {
            clientId,
            senderId: myId.value,
            plainText: src.plainText,
            fileUrl: src.fileUrl || null,
            status: 'sending',
            sentAt: new Date().toISOString(),
            forwardedFromMessageId: src.forwardedFromMessageId || src.id || null,
            forwardedFromSenderId:  src.forwardedFromSenderId  || src.senderId || null,
          }
          messages.value.push(mine)
          if (mine.forwardedFromSenderId) cacheForwardName(mine.forwardedFromSenderId)
        }
        await nextTick()
        const el = scrollBox.value
        if (el) el.scrollTop = el.scrollHeight
      }

      for (const src of list) {
        const cipher = await encryptAES(aesKey, src.plainText || '')
        const srcKey = (src.id || src.clientId)!
        const clientId = sameChat ? clientMap.get(srcKey) || null : null

        await sendMessage(
          toPeerId,
          cipher,
          src.fileUrl || null,
          clientId,
          null,
          src.forwardedFromMessageId || src.id || null
        )
      }

      clearSelection()
      showToast('ارسال شد')
      if (!sameChat) {
        const last = list[list.length - 1]
        const nowIso = new Date().toISOString()
        const idx = conversations.value.findIndex(c => c.peerId === toPeerId)
        if (idx >= 0) {
          const c = conversations.value[idx]
          c.lastSentAt = nowIso
          c.lastFileUrl = last.fileUrl || null
          c.lastPreview = last.plainText || (last.fileUrl ? null : '')
          const [moved] = conversations.value.splice(idx, 1)
          conversations.value.unshift(moved)
        }
      }
    }
  } catch (e) {
    console.warn('forward failed', e)
  }
}


function resolveUserName(userId?: string | null) {
  if (!userId) return 'کاربر'
  const conv = conversations.value.find(c => c.peerId === userId)
  if (conv) return conv.displayName || '@' + conv.username
  return 'کاربر'
}


function draftKey(peerId: string) {
  const uid = myId.value || 'me'
  return `phi.draft.${uid}.${peerId}`
}
function loadDraft(peerId: string): string {
  try { return localStorage.getItem(draftKey(peerId)) || '' } catch { return '' }
}
function saveDraft(peerId: string, text: string) {
  try { localStorage.setItem(draftKey(peerId), text) } catch {}
}
function clearDraft(peerId: string) {
  try { localStorage.removeItem(draftKey(peerId)) } catch {}
}

function openReactionPicker(m: UiMessage) {
  reactionPickerFor.value = m.id || m.clientId || null
}

async function applyReaction(m: UiMessage, emoji: string) {
  reactionPickerFor.value = null
  await toggleReaction(m, emoji)
}
async function toggleReaction(m: UiMessage, emoji: string) {
  if (!m.id) return;
  const list = m.reactions || (m.reactions = []);
  m.reactions = dedupeReactions(list);

  const cur = m.reactions.find(r => r.emoji === emoji);

  if (cur?.mine) {
    cur.mine = false;
    cur.count = Math.max(0, cur.count - 1);
    if (cur.count === 0) m.reactions = m.reactions.filter(r => r !== cur);
    try { await removeReaction(m.id, emoji); } catch { /* می‌تونی rollback کنی */ }
  } else {
    if (cur) { cur.mine = true; cur.count += 1; }
    else m.reactions.push({ emoji, count: 1, mine: true });
    m.reactions = dedupeReactions(m.reactions);
    try { await addReaction(m.id, emoji); } catch { /* rollback در صورت نیاز */ }
  }
}


function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}
function onWindowScroll() {
  closeMenu()
}
function onWindowResize() {
  if (contextMenu.value.visible) nextTick(() => clampMenuPosition())
}

function clampMenuPosition() {
  const el = menuEl.value
  if (!el) return
  const pad = 8
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const rect = el.getBoundingClientRect()

  let x = contextMenu.value.x
  let y = contextMenu.value.y

  if (x + rect.width + pad > vpW) x = Math.max(pad, vpW - rect.width - pad)
  else x = Math.max(pad, x)

  if (y + rect.height + pad > vpH) y = Math.max(pad, vpH - rect.height - pad)
  else y = Math.max(pad, y)

  contextMenu.value.x = x
  contextMenu.value.y = y
}





function openMenu(e: MouseEvent, m: UiMessage) {
  if (contextMenu.value.visible) {
    closeMenu()
    return
  }
  contextMenu.value.msg = m
  contextMenu.value.visible = true
  contextMenu.value.x = e.clientX
  contextMenu.value.y = e.clientY
  nextTick(() => clampMenuPosition())
}


function closeMenu() {
  contextMenu.value.visible = false
  contextMenu.value.msg = null
}
function doReply() {
  const m = contextMenu.value.msg
  closeMenu()
  if (m) startReplyFrom(m)
}
function doEdit() {
  const m = contextMenu.value.msg
  closeMenu()
  if (!m) return
  editingMessage.value = m
  prevDraftBeforeEdit.value = text.value
  text.value = m.plainText || ''
  replyingTo.value = null
  nextTick(() => {
    const el = msgInput.value as HTMLInputElement | null
    el?.focus()
    try { el?.setSelectionRange?.(el.value.length, el.value.length) } catch {}
  })
  if (selectedUser.value) startTyping(selectedUser.value.id).catch(()=>{})
}

function cancelEdit() {
  editingMessage.value = null
  text.value = prevDraftBeforeEdit.value
  if (!text.value.trim() && selectedUser.value) {
    stopTyping(selectedUser.value.id).catch(()=>{})
  }
}

function isMine(m?: UiMessage|null) { return !!m && m.senderId === myId.value }
function canEdit(m?: UiMessage|null) { return isMine(m) && !m?.fileUrl && !m?.isDeleted }


function loadAESKeyScoped(partnerId: string) {
  try {
    const uid = localStorage.getItem(ACTIVE_UID_KEY);
    if (!uid || uid !== myId.value) return null;
  } catch {}
  return loadAESKey(partnerId); 
}

async function saveAESKeyScoped(partnerId: string, key: CryptoKey) {
  try { localStorage.setItem(ACTIVE_UID_KEY, myId.value); } catch {}
  return await saveAESKey(partnerId, key);
}

function scrollToMessageEl(el: HTMLElement) {
  const sc = scrollBox.value as HTMLElement | null
  if (!sc) return
  const scRect = sc.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const offset = elRect.top - scRect.top
  const target = sc.scrollTop + offset - (sc.clientHeight / 2) + (el.clientHeight / 2)
  sc.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
}

async function jumpToReplied(replyId: string) {
  let el = messageEls.get(replyId)

  if (!el && typeof loadOlderOnce === 'function') {
    for (let i = 0; i < 5 && !el; i++) {
      const loaded = await loadOlderOnce()  
      await nextTick()
      el = messageEls.get(replyId)
      if (!loaded) break
    }
  }

  if (el) {
    scrollToMessageEl(el)
    el.classList.add('ring-2','ring-yellow-400')
    setTimeout(() => el && el.classList.remove('ring-2','ring-yellow-400'), 1000)
  } else {
    showToast('برای دیدن پیام قدیمی‌تر، کمی بالاتر بروید')
  }
}

async function jumpToMessage(targetId: string) {

  let el = msgElMap.get(targetId);
  if (!el) {

    let tries = 0;
    while (!el && hasMore.value && tries < 10) {
      const loaded = await loadOlderOnce();
      if (!loaded) break;
      await nextTick();
      el = msgElMap.get(targetId);
      tries++;
    }
  }
  if (el && scrollBox.value) {
    
    const container = scrollBox.value;
    const top = el.offsetTop - 100;
    container.scrollTo({ top, behavior: "smooth" });


    el.classList.add("ring-2", "ring-yellow-400", "ring-offset-2", "ring-offset-transparent");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-yellow-400", "ring-offset-2", "ring-offset-transparent");
    }, 1200);
  }
}


async function loadOlderOnce(): Promise<boolean> {
  if (!selectedUser.value || !hasMore.value || loadingOlder.value) return false;
  const el = scrollBox.value;
  const prevHeight = el?.scrollHeight ?? 0;
  
  loadingOlder.value = true;
  try {
    const page = await getConversationPaged(selectedUser.value.id, oldestId.value || undefined, 50);
    const items: any[] = (page.items ?? page.Items ?? []).filter(m => !m.isDeleted)
    hasMore.value = !!(page.hasMore ?? page.HasMore);
    oldestId.value = page.oldestId ?? page.OldestId ?? (items[0]?.messageId || null);

    if (!items.length) return false;
    
    const aesKey = await getOrLoadKey(selectedUser.value.id);
    const older = await Promise.all(items.map(async (msg: any) => {
      const raw = (msg.encryptedContent || "") as string;
      let decrypted = "";
      if (raw && raw.trim()) {
        try { decrypted = (await decryptAES(aesKey, raw)) || "[رمزگشایی نشد]"; }
        catch { decrypted = "[رمزگشایی نشد]"; }
      }
      
      
      const srvReacts = msg.reactions || msg.Reactions || []
      let reactions: UiReaction[] = srvReacts.map((r:any) => ({
        emoji: r.emoji || r.Emoji,
        count: r.count ?? r.Count ?? 0,
        mine: !!(r.mine ?? r.Mine)
      }))
      reactions = dedupeReactions(reactions);

      const isMine = msg.senderId === myId.value;
      const status: "delivered" | "read" | undefined = isMine
        ? (msg.isRead ? "read" : "delivered")
        : undefined;

      const fwdFrom = msg.forwardedFromSenderId || msg.ForwardedFromSenderId
      if (fwdFrom) cacheForwardName(fwdFrom)


      return {
        id: msg.messageId,
        senderId: msg.senderId,
        plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : "",
        fileUrl: toAbsoluteFileUrl(msg.fileUrl || null),
        status,
        sentAt: msg.sentAt,
        deliveredAtUtc: msg.deliveredAtUtc || null,
        readAtUtc: msg.readAtUtc || null,
        replyToMessageId: msg.replyToMessageId || null,
        isDeleted: !!msg.isDeleted,
        updatedAtUtc: msg.updatedAtUtc || null,
        reactions,
        forwardedFromMessageId: msg.forwardedFromMessageId || msg.ForwardedFromMessageId || null,
        forwardedFromSenderId:  msg.forwardedFromSenderId  || msg.ForwardedFromSenderId  || null,
      } as UiMessage;
    }));

    messages.value = [...older, ...messages.value];

    for (const msg of messages.value) {
      if (msg.fileUrl) {
        const key = fileKey(msg)
        if (!fileSizeMap[key]) ensureFileSize(msg.fileUrl, key)
      }
    }

    await nextTick();
    if (el) {
      const newHeight = el.scrollHeight;
      el.scrollTop = newHeight - prevHeight + el.scrollTop;
    }
    return true;
  } finally {
    loadingOlder.value = false;
  }
}



function dedupeReactions(list: {emoji:string; count:number; mine?:boolean}[]) {
  const map = new Map<string, {emoji:string; count:number; mine?:boolean}>();
  for (const r of list) {
    const key = r.emoji;
    const ex = map.get(key);
    if (!ex) map.set(key, { ...r });
    else {
      ex.count = r.count;                  
      ex.mine = ex.mine || r.mine || false;
    }
  }
  return Array.from(map.values()).filter(r => r.count > 0);
}




function setMessageEl(key: string, el: Element | null) {
  if (el) messageEls.set(key, el as HTMLElement)
  else messageEls.delete(key)
}

function fmtHHmmLocal(iso?: string | null): string {
  const d = toDateSafe(iso);
  if (!d) return "";
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}


function tooltipForMessage(msg: any): string {
  const sent = formatAbsoluteEn(msg.sentAt); 
  const delivered = msg.deliveredAtUtc ? formatAbsoluteEn(msg.deliveredAtUtc) : null;
  const read = msg.readAtUtc ? formatAbsoluteEn(msg.readAtUtc) : null;

  if (read) return `ارسال: ${sent}\nخوانده‌شدن: ${read}`;
  if (delivered) return `ارسال: ${sent}\nتحویل: ${delivered}`;
  return `ارسال: ${sent}`;
}



async function selectConversation(conv: any) {
  chatNavStack.value = []
  await handleUserSelect({ id: conv.peerId, username: conv.username })
  if (route.path !== '/chat') router.replace('/chat')

}



function dayKey(iso?: string | null): string {
  const d = toDateSafe(iso);
  if (!d) return '';
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function dayLabel(iso?: string | null): string {
  const d = toDateSafe(iso); if (!d) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const that = new Date(d); that.setHours(0,0,0,0);
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(d);
}


function showDayHeader(index: number): boolean {
  if (index === 0) return true;
  const a = messages.value[index];
  const b = messages.value[index - 1];
  return dayKey(a.sentAt) !== dayKey(b.sentAt);
}






async function onScrollLoadMore(e: Event) {
  if (!selectedUser.value || !hasMore.value || loadingOlder.value) return;
  const el = scrollBox.value;
  if (!el) return;
  if (el.scrollTop > 80) return;

  loadingOlder.value = true;
  const before = oldestId.value || undefined;

  const prevHeight = el.scrollHeight;

  try {
    const page = await getConversationPaged(selectedUser.value.id, before, 50);
    const items: any[] = (page.items ?? page.Items ?? []).filter(m => !m.isDeleted)
    hasMore.value = !!(page.hasMore ?? page.HasMore);
    oldestId.value = page.oldestId ?? page.OldestId ?? (items[0]?.messageId || null);

    if (items.length) {
      const aesKey = await getOrLoadKey(selectedUser.value.id);
      const older = await Promise.all(items.map(async (msg: any) => {
        const raw = (msg.encryptedContent || '') as string;
        let decrypted = '';
        if (raw && raw.trim()) {
          try { decrypted = (await decryptAES(aesKey, raw)) || '[رمزگشایی نشد]'; }
          catch { decrypted = '[رمزگشایی نشد]'; }
        }

        const srvReacts = msg.reactions || msg.Reactions || []
        let reactions: UiReaction[] = srvReacts.map((r:any) => ({
          emoji: r.emoji || r.Emoji,
          count: r.count ?? r.Count ?? 0,
          mine: !!(r.mine ?? r.Mine)
        }))
        reactions = dedupeReactions(reactions);
        const isMine = msg.senderId === myId.value;
        const status: 'delivered' | 'read' | undefined = isMine
          ? (msg.isRead ? 'read' : 'delivered')
          : undefined;

        
        const fwdFrom = msg.forwardedFromSenderId || msg.ForwardedFromSenderId
        if (fwdFrom) cacheForwardName(fwdFrom)


        return {
          id: msg.messageId,
          senderId: msg.senderId,
          plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : '',
          fileUrl: toAbsoluteFileUrl(msg.fileUrl || null),
          status,
          sentAt: msg.sentAt,
          deliveredAtUtc: msg.deliveredAtUtc || null,
          readAtUtc: msg.readAtUtc || null,
          replyToMessageId: msg.replyToMessageId || msg.ReplyToMessageId || null,
          isDeleted: !!msg.isDeleted,
          updatedAtUtc: msg.updatedAtUtc || null,
          reactions,
          forwardedFromMessageId: msg.forwardedFromMessageId || msg.ForwardedFromMessageId || null,
          forwardedFromSenderId:  msg.forwardedFromSenderId  || msg.ForwardedFromSenderId  || null,


        } as UiMessage;
      }));

      messages.value = [...older, ...messages.value];

      for (const msg of messages.value) {
        if (msg.fileUrl) {
          const key = fileKey(msg)
          if (!fileSizeMap[key]) ensureFileSize(msg.fileUrl, key)
        }
      }

      await nextTick();
      
      const newHeight = el.scrollHeight;
      el.scrollTop = newHeight - prevHeight;
    }
  } finally {
    loadingOlder.value = false;
  }
}


onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onWindowScroll, true)
  window.removeEventListener('resize', onWindowResize)
  stopAutoScroll()
  window.removeEventListener('mouseup', endDragSelect)
  window.removeEventListener('mousemove', onDragMouseMove)
})


onMounted(async () => {
  // myId from JWT
  const token = getToken()
  if (token) {
    const payload = parseJwt(token)
    myId.value = payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? ''
    try { localStorage.setItem(ACTIVE_UID_KEY, myId.value); } catch {}

    wireSignalR()
    await connectToChatHub(token)
    try {
      const ids = await fetchOnlineUsers()
      onlineIds.clear()
      ids.forEach(id => onlineIds.add(id))
    } catch {}
  }
  

  try {
      const data = await getConversations() 

      const me = await getMeProfile()
      meProfile.value = me

      conversations.value = (data || []).map((c: any) => ({
        peerId: c.peerId || c.PeerId,
        username: c.peerUsername || c.PeerUsername || '',
        displayName: c.peerDisplayName || c.PeerDisplayName || null,
        avatarUrl: c.peerAvatarUrl || c.PeerAvatarUrl || null,
        unreadCount: c.unreadCount ?? c.UnreadCount ?? 0,
        lastSentAt: c.lastSentAt || c.LastSentAt || null,
        lastFileUrl: c.lastFileUrl || c.LastFileUrl || null,
        lastPreview: null 
      }))

      try {
        const all = await getUsersList()
        const peerIds = new Set(conversations.value.map(c => c.peerId))
        for (const u of all) {
          if (!peerIds.has(u.id)) continue
          if (u.lastSeenUtc) lastSeenMap[u.id] = u.lastSeenUtc
          if (u.displayName) displayById[u.id] = u.displayName
          if (u.avatarUrl)   avatarById[u.id]  = u.avatarUrl
        }
      } catch {}

      for (const c of conversations.value) {
          if (c.displayName) displayById[c.peerId] = c.displayName
          if (c.avatarUrl)   avatarById[c.peerId]  = c.avatarUrl
        }


      conversations.value.sort((a, b) => {
        const ta = toDateSafe(a.lastSentAt)?.getTime() || 0
        const tb = toDateSafe(b.lastSentAt)?.getTime() || 0
        return tb - ta
      })
    } catch (e) {
      console.warn('load conversations failed', e)
    }





  const username = route.params.username as string | undefined
  if (username && !selectedUser.value) {
    try {
      const u = await getUserByUsername(username.replace(/^@/, ''))
      await handleUserSelect({ id: u.id, username: u.username })
    } catch (e) {
      console.error('username not found', e)
    }
  }

  const handleOnline  = (userId: string) => onlineIds.add(userId)
  const handleOffline = (userId: string, when?: string) => {
    onlineIds.delete(userId)
    if (when) lastSeenMap[userId] = when
  }

  const handleTyping = (p: { SenderId: string }) => typing.add(p.SenderId)
  const handleTypingStopped = (p: { SenderId: string }) => typing.delete(p.SenderId)

  

  onUserOnline(handleOnline)
  onUserOffline(handleOffline as any)
  onOnlineSnapshot((ids) => {
    onlineIds.clear()
    ids.forEach(id => onlineIds.add(id))
  })

  onUserLastSeen((uid, whenIso) => {
    lastSeenMap[uid] = whenIso
  })
  onTyping(handleTyping)
  onTypingStopped(handleTypingStopped)
  
  watch(selectedUser, async (su) => {
    if (!su) return
    if (!lastSeenMap[su.id]) {
      try {
        const u = await getUserById(su.id)
        if (u?.lastSeenUtc) lastSeenMap[su.id] = u.lastSeenUtc
        if (u?.displayName) displayById[su.id] = u.displayName
        if (u?.avatarUrl)   avatarById[su.id]  = u.avatarUrl
      } catch {}
    }
  }, { immediate: true })

  window.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onWindowScroll, true) 
  window.addEventListener('resize', onWindowResize)


})

function wireSignalR() {
  onMessageReceived(async (message: any) => {


    
    // unify fields
    const isFromOtherPeer = selectedUser.value && message.senderId !== selectedUser.value.id
    const isMyEcho = message.senderId === myId.value

    if (!selectedUser.value || isFromOtherPeer || isMyEcho) {
      if (!isMyEcho) {
        const sid = String(message.senderId)
        unread.value[sid] = (unread.value[sid] ?? 0) + 1

        // update sidebar conv
        const msgTime = message.sentAt || new Date().toISOString()
        const convIdx = conversations.value.findIndex(c => c.peerId === sid)
        if (convIdx >= 0) {
          const c = conversations.value[convIdx]
          c.unreadCount = (c.unreadCount || 0) + 1
          c.lastSentAt = msgTime
          c.lastFileUrl = message.fileUrl || null
          c.lastPreview = c.lastFileUrl ? null : 'پیام جدید'
          // move to top
          const [moved] = conversations.value.splice(convIdx, 1)
          conversations.value.unshift(moved)
        } else {

          conversations.value.unshift({
            peerId: sid,
            username: message.senderUsername || ('user_' + sid.substring(0,6)),
            unreadCount: 1,
            lastSentAt: msgTime,
            lastFileUrl: message.fileUrl || null,
            lastPreview: (message.fileUrl ? null : 'پیام جدید'),
          } as UiConversation)
        }
      }
      return
    }

    const raw = (message.encryptedText || message.encryptedContent || '') as string
    const hasCipher = raw.trim().length > 0

    // ensure AES key
    let aesKey = await getOrLoadKey(message.senderId)
    let decrypted = await decryptAES(aesKey, raw);

    if (!decrypted) {
      const retryKey = await getOrLoadKey(message.senderId);
      if (retryKey !== aesKey) {
        decrypted = await decryptAES(retryKey, raw);
      }
    }

    const ui: UiMessage = {
      id: message.messageId || message.id || message.MessageId || null,
      senderId: message.senderId,
      plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : '',
      fileUrl: toAbsoluteFileUrl(message.fileUrl || null),
      sentAt: message.sentAt || new Date().toISOString(),
      deliveredAtUtc: message.deliveredAtUtc || null,
      readAtUtc: message.readAtUtc || null,
      replyToMessageId: message.replyToMessageId || message.ReplyToMessageId || null,
      forwardedFromMessageId: message.forwardedFromMessageId || message.ForwardedFromMessageId || null,
      forwardedFromSenderId:  message.forwardedFromSenderId  || message.ForwardedFromSenderId  || null,
      
    }
    if (ui.forwardedFromSenderId) cacheForwardName(ui.forwardedFromSenderId)

    const el0 = scrollBox.value as HTMLElement | null
    const stick = !!el0 && isNearBottom(el0)

    messages.value.push(ui)

    if (ui.senderId === myId.value) {
      console.log("IF STATE")
      const idx = messages.value.findIndex(x => x.fileUrl === '(pending)')
      if (idx !== -1) messages.value.splice(idx, 1)
    }

    if (ui.fileUrl) {
      const key = fileKey(ui)
      if (!fileSizeMap[key]) ensureFileSize(ui.fileUrl, key)
    }

    await nextTick()
    const box = scrollBox.value as HTMLElement | null
    if (box && stick) box.scrollTop = box.scrollHeight
    await nextTick()
    const mid = message.messageId || message.id || message.MessageId
    if (mid) {
      try { await markAsRead(mid) } catch {}
    }
})


  onDelivered(async (info: any) => {
    const cid = info.clientId ?? info.ClientId
    let m = cid ? messages.value.find(x => x.clientId === cid) : undefined

    const el0 = scrollBox.value as HTMLElement | null
    const stick = !!el0 && isNearBottom(el0)

    if (!m && info.messageId) {
      m = [...messages.value].reverse().find(x =>
        x.senderId === myId.value && x.status === 'sending' && !x.id
      )
    }
    if (!m) return

    if (info.messageId) m.id = info.messageId
    if (info.sentAt)    m.sentAt = info.sentAt

    m.status = 'delivered'

    const fileUrl = info.fileUrl ?? info.FileUrl ?? null
    if (fileUrl) {
      m.fileUrl = toAbsoluteFileUrl(fileUrl)
      const k = fileKey(m)
      if (!fileSizeMap[k]) ensureFileSize(m.fileUrl!, k)
    }

    const raw: string = String(info.encryptedText ?? info.EncryptedText ?? '')
    if (raw && raw.trim()) {
      try {
        const partnerId = selectedUser.value?.id
        if (partnerId) {
          const key = await getOrLoadKey(partnerId)
          const txt = await decryptAES(key, raw)
          if (txt && txt !== EMPTY_MSG_MARKER) m.plainText = txt
          else m.plainText = ''
        }
      } catch { /* ignore */ }
    }

    await nextTick()
    const el = scrollBox.value as HTMLElement | null
    if (el && stick) el.scrollTop = el.scrollHeight
    await nextTick()
  })




  onMessageRead((info: any) => {
    const m = messages.value.find(x => x.id === info.messageId)
    if (m) {
      m.status = 'read'
      if (info.readAtUtc) m.readAtUtc = info.readAtUtc
    }
  })


  onTyping((p) => {
    const selId = selectedUser.value?.id
    console.log('onTyping payload=', p, 'selectedUser=', selId)
    if (!selId || String(p.SenderId) !== String(selId)) return
    isPeerTyping.value = true
    if (typingTimer) window.clearTimeout(typingTimer)
    typingTimer = window.setTimeout(() => { isPeerTyping.value = false }, TYPING_IDLE_MS)
  })

  onTypingStopped((p) => {
    const selId = selectedUser.value?.id
    console.log('onTypingStopped payload=', p, 'selectedUser=', selId)
    if (!selId || String(p.SenderId) !== String(selId)) return
    isPeerTyping.value = false
    if (typingTimer) { window.clearTimeout(typingTimer); typingTimer = null }
  })

  onMessageEdited(async (p) => {
    const m = messages.value.find(x => x.id === p.messageId)
    if (!m) return
    try {
      const partnerId = selectedUser.value?.id || m.senderId
      const aesKey = await getOrLoadKey(partnerId)
      const decrypted = await decryptAES(aesKey, p.encryptedContent)
      m.plainText = decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : ''
      m.updatedAtUtc = p.updatedAtUtc || new Date().toISOString()
    } catch (e) {
      console.warn('decrypt edited failed', e)
    }
  })

  onMessageDeleted((p) => {
    const i = messages.value.findIndex(x => x.id === p.messageId)
    if (i < 0) return
    // if (p.scope === 'all') {
    //   const m = messages.value[i]
    //   m.isDeleted = true
    //   m.plainText = ''
    //   m.fileUrl = null
    //   m.updatedAtUtc = new Date().toISOString()
    // } else {
    //   messages.value.splice(i, 1)
    // }
    messages.value.splice(i, 1)
})

onReactionUpdated((p) => {
  const m = messages.value.find(x => x.id === p.messageId);
  if (!m) return;

  const list = m.reactions || (m.reactions = []);

  const idxs = list.map((r, i) => r.emoji === p.emoji ? i : -1).filter(i => i >= 0);

  if (idxs.length === 0) {
    list.push({ emoji: p.emoji, count: p.count, mine: p.userId === myId.value && p.action === 'added' });
  } else {

    const first = list[idxs[0]];
    first.count = p.count;
    if (p.userId === myId.value) first.mine = (p.action === 'added');
    for (let k = idxs.length - 1; k >= 1; k--) list.splice(idxs[k], 1);
  }

  m.reactions = dedupeReactions(list);
});








}

async function handleUserSelect(user: { id: string; username: string }) {
  selectedUser.value = user
  messages.value = []
  text.value = loadDraft(user.id)
  const idx = conversations.value.findIndex(c => c.peerId === user.id)
  if (idx >= 0) conversations.value[idx].unreadCount = 0
  const page1 = await getConversationPaged(user.id, undefined, 50)
  const history = page1.items ?? page1.Items ?? []
  hasMore.value = !!(page1.hasMore ?? page1.HasMore)
  oldestId.value = page1.oldestId ?? page1.OldestId ?? (history[0]?.messageId || null)

  const aesKey = await getOrLoadKey(user.id)

  const prepared = await Promise.all(history.map(async (msg: any) => {
    const raw = (msg.encryptedContent || '') as string
    const hasCipher = raw.trim().length > 0

    let decrypted = ''
    if (hasCipher) {
      try {
        decrypted = (await decryptAES(aesKey, raw)) || '[رمزگشایی نشد]'
      } catch {
        decrypted = '[رمزگشایی نشد]'
      }
    }

    if (unread.value[user.id]) {
      unread.value[user.id] = 0
    }


    const srvReacts = msg.reactions || msg.Reactions || []
    let reactions: UiReaction[] = srvReacts.map((r:any) => ({
      emoji: r.emoji || r.Emoji,
      count: r.count ?? r.Count ?? 0,
      mine: !!(r.mine ?? r.Mine)
    }))
    reactions = dedupeReactions(reactions);

    const isMine = msg.senderId === myId.value
    const status: 'delivered' | 'read' | undefined = isMine
      ? (msg.isRead ? 'read' : 'delivered')
      : undefined


    if (prevSelectedUserId) {
    stopTyping(prevSelectedUserId).catch(() => {})
    }
    prevSelectedUserId = user.id

    selectedUser.value = user
    isPeerTyping.value = false
    const fwdFrom = msg.forwardedFromSenderId || msg.ForwardedFromSenderId
    if (fwdFrom) cacheForwardName(fwdFrom)

    return {
      id: msg.messageId,
      senderId: msg.senderId,
      plainText: decrypted && decrypted !== EMPTY_MSG_MARKER ? decrypted : '',
      fileUrl: toAbsoluteFileUrl(msg.fileUrl || null),
      status,
      sentAt: msg.sentAt,
      deliveredAtUtc: msg.deliveredAtUtc || null,
      readAtUtc: msg.readAtUtc || null,
      replyToMessageId: msg.replyToMessageId || null,
      isDeleted: !!msg.isDeleted,
      updatedAtUtc: msg.updatedAtUtc || null,
      reactions,
      forwardedFromMessageId: msg.forwardedFromMessageId || msg.ForwardedFromMessageId || null,
      forwardedFromSenderId:  msg.forwardedFromSenderId  || msg.ForwardedFromSenderId  || null,


    } as UiMessage
  }))


  messages.value = prepared
  await nextTick()
  const el = scrollBox.value
  if (el) el.scrollTop = el.scrollHeight

  for (const msg of messages.value) {
      if (msg.fileUrl) {
        const key = fileKey(msg)
        if (!fileSizeMap[key]) ensureFileSize(msg.fileUrl, key)
      }
    }


  const unreadIds: string[] = history
    .filter((m: any) => m.senderId === user.id && (m.isRead === false || m.isRead === undefined))
    .map((m: any) => m.messageId)
    .filter(Boolean)

  Promise.allSettled(unreadIds.map(id => markAsRead(id))).catch(() => {})
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files && input.files[0] ? input.files[0] : null
}

async function send() {
  if (!selectedUser.value) return

  if (!selectedFile.value && (!text.value || !text.value.trim())) {
    return
  }

  const aesKey = await getOrLoadKey(selectedUser.value.id)


  let fileUrl: string | null = null
  if (selectedFile.value) {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    const uploadedUrl = await uploadEncryptedFile(fd)
    fileUrl = toAbsoluteFileUrl(uploadedUrl)
  }



  // edit-mode
  if (editingMessage.value && editingMessage.value.id) {
    const aesKey = await getOrLoadKey(selectedUser.value.id)
    const encrypted = await encryptAES(aesKey, text.value.trim() || EMPTY_MSG_MARKER)
    const back = prevDraftBeforeEdit.value
    try {
      await editMessage(editingMessage.value.id, encrypted)
      editingMessage.value.plainText = text.value.trim()
      editingMessage.value.updatedAtUtc = new Date().toISOString()
      editingMessage.value = null
      text.value = back  
    } catch(e) {
      console.warn('edit failed', e)
    }
    return
  }




  const toEncrypt = (text.value && text.value.trim().length > 0) ? text.value : EMPTY_MSG_MARKER
  const encrypted = await encryptAES(aesKey, toEncrypt)

  const clientId = crypto.randomUUID()
  const mine: UiMessage = {
    clientId,
    senderId: myId.value,
    plainText: (toEncrypt === EMPTY_MSG_MARKER) ? '' : text.value,
    fileUrl: fileUrl,
    status: 'sending',
    sentAt: new Date().toISOString(),
    replyToMessageId: replyingTo.value?.id || null,

  }
  messages.value.push(mine)

  await nextTick();
  const el = scrollBox.value;
  if (el) el.scrollTop = el.scrollHeight;
  
  const uid = selectedUser.value.id
  const convIdx = conversations.value.findIndex(c => c.peerId === uid)
  const nowIso = new Date().toISOString()
  if (convIdx >= 0) {
    const c = conversations.value[convIdx]
    c.lastSentAt = nowIso
    c.lastFileUrl = mine.fileUrl
    c.lastPreview = mine.plainText || (mine.fileUrl ? null : '')
    const [moved] = conversations.value.splice(convIdx, 1)
    conversations.value.unshift(moved)
  } else {
    conversations.value.unshift({
      peerId: uid,
      username: selectedUser.value.username,
      unreadCount: 0,
      lastSentAt: nowIso,
      lastFileUrl: mine.fileUrl,
      lastPreview: mine.plainText || ''
    } as UiConversation)
  }





  await sendMessage(
    selectedUser.value.id,
    encrypted,
    fileUrl || null,
    clientId,
    replyingTo.value?.id ?? null 
  )
  replyingTo.value = null

  if (selectedUser.value) clearDraft(selectedUser.value.id)

  if (selectedUser.value) stopTyping(selectedUser.value.id).catch(()=>{})
  // reset inputs
  text.value = ''
  selectedFile.value = null


  
  stopTyping(selectedUser.value.id).catch(() => {})
  text.value = ''
  selectedFile.value = null
}


function onInputChanged() {
  if (!selectedUser.value) return
  const now = Date.now()
  const last = (onInputChanged as any)._last || 0
  if (now - last > 900) {
    console.log('➡️ startTyping()', selectedUser.value.id)
    startTyping(selectedUser.value.id).catch(()=>{})
    ;(onInputChanged as any)._last = now
  }
  if (!text.value.trim()) {
    console.log('➡️ stopTyping() (empty text)')
    stopTyping(selectedUser.value.id).catch((e)=>console.warn('stopTyping error', e))
  }
  if (selectedUser.value) saveDraft(selectedUser.value.id, text.value)
}

function onBlurInput() {
  console.log('➡️ stopTyping() (blur)')
  if (selectedUser.value) stopTyping(selectedUser.value.id).catch(()=>{})
}


function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }


async function getOrLoadKey(partnerId: string) {

  let key = await loadAESKeyScoped(partnerId);
  if (key) return key;

  let base64 = await getChatKey(partnerId);
  if (!base64) {
    await delay(250);
    base64 = await getChatKey(partnerId);
  }
  if (base64) {
    key = await importAESKey(base64);
    await saveAESKeyScoped(partnerId, key);
    return key;
  }

  const newKey = await generateAESKey();
  const raw = await exportAESKey(newKey);
  const base64Key = btoa(String.fromCharCode(...raw));
  await storeChatKey({ receiverId: partnerId, encryptedKey: base64Key });
  await saveAESKeyScoped(partnerId, newKey);
  return newKey;
}

function toAbsoluteFileUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://localhost:7146${url.startsWith('/') ? url : '/' + url}`
}
</script>

<style scoped>
</style>
