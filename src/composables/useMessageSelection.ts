import {
  computed,
  reactive,
  ref,
  type Ref
} from 'vue'
import type { UiMessage } from '../types/chat'

type UseMessageSelectionOptions = {
  messages: Ref<UiMessage[]>
  myId: Ref<string>
  scrollBox: Ref<HTMLElement | null>
  canSelect: () => boolean
  closeMenu: () => void
  showToast: (text: string) => void
}

export function useMessageSelection({
  messages,
  myId,
  scrollBox,
  canSelect,
  closeMenu,
  showToast
}: UseMessageSelectionOptions) {
  const selectionMode = ref(false)
  const selected = reactive(new Set<string>())

  const isDragSelecting = ref(false)
  const dragPending = ref(false)
  const dragMode = ref<'add' | 'remove'>('add')
  const dragVisited = new Set<string>()
  const dragStartMessage = ref<UiMessage | null>(null)

  let startClientX = 0
  let startClientY = 0
  let lastMouseY = 0
  let autoScrollTimer: number | null = null

  const DRAG_THRESHOLD = 16

  function getMsgKey(message: UiMessage): string {
    return (message.id || message.clientId)!
  }

  function isSelected(message: UiMessage) {
    return selected.has(getMsgKey(message))
  }

  function toggleSelect(message: UiMessage) {
    const key = getMsgKey(message)

    if (selected.has(key)) {
      selected.delete(key)
    } else {
      selected.add(key)
    }
  }

  function clearSelection() {
    selected.clear()
    selectionMode.value = false
  }

  const selectedMessages = computed(() =>
    messages.value.filter(message =>
      selected.has(getMsgKey(message))
    )
  )

  const selectedCount = computed(
    () => selected.size
  )

  const allSelectedAreMine = computed(() =>
    selectedMessages.value.length > 0 &&
    selectedMessages.value.every(
      message => message.senderId === myId.value
    )
  )

  function isInTextSelectable(
    target: EventTarget | null
  ) {
    const element =
      target as HTMLElement | null

    return !!element?.closest(
      '[data-text-selectable]'
    )
  }

  function applyDragOn(message: UiMessage) {
    const key = getMsgKey(message)

    if (dragVisited.has(key)) return

    dragVisited.add(key)

    if (dragMode.value === 'add') {
      selected.add(key)
    } else {
      selected.delete(key)
    }
  }

  function stopAutoScroll() {
    if (!autoScrollTimer) return

    window.clearInterval(autoScrollTimer)
    autoScrollTimer = null
  }

  function startAutoScroll() {
    const element = scrollBox.value

    if (!element) return

    stopAutoScroll()

    autoScrollTimer = window.setInterval(() => {
      if (!isDragSelecting.value) return

      const rect =
        element.getBoundingClientRect()

      const margin = 32
      const speed = 12

      if (lastMouseY < rect.top + margin) {
        element.scrollTop -= speed
      } else if (
        lastMouseY > rect.bottom - margin
      ) {
        element.scrollTop += speed
      }
    }, 30)
  }

  function onDragMouseMove(event: MouseEvent) {
    lastMouseY = event.clientY

    if (
      !dragPending.value ||
      isDragSelecting.value
    ) {
      return
    }

    const deltaX = Math.abs(
      event.clientX - startClientX
    )

    const deltaY = Math.abs(
      event.clientY - startClientY
    )

    if (
      deltaX <= DRAG_THRESHOLD &&
      deltaY <= DRAG_THRESHOLD
    ) {
      return
    }

    selectionMode.value = true
    isDragSelecting.value = true
    dragPending.value = false

    startAutoScroll()

    if (dragStartMessage.value) {
      applyDragOn(dragStartMessage.value)
    }
  }

  function endDragSelect() {
    stopAutoScroll()

    dragPending.value = false
    isDragSelecting.value = false
    dragStartMessage.value = null
    dragVisited.clear()

    window.removeEventListener(
      'mouseup',
      endDragSelect
    )

    window.removeEventListener(
      'mousemove',
      onDragMouseMove
    )
  }

  function onRowMouseDown(
    event: MouseEvent,
    message: UiMessage
  ) {
    if (
      !canSelect() ||
      event.button !== 0 ||
      isInTextSelectable(event.target)
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const key = getMsgKey(message)

    dragMode.value = selected.has(key)
      ? 'remove'
      : 'add'

    dragStartMessage.value = message
    dragPending.value = true
    isDragSelecting.value = false

    dragVisited.clear()

    startClientX = event.clientX
    startClientY = event.clientY
    lastMouseY = event.clientY

    window.addEventListener(
      'mouseup',
      endDragSelect
    )

    window.addEventListener(
      'mousemove',
      onDragMouseMove,
      { passive: true }
    )
  }

  function onRowMouseEnter(
    message: UiMessage
  ) {
    if (isDragSelecting.value) {
      applyDragOn(message)
    }
  }

  function onRowClick(
    event: MouseEvent,
    message: UiMessage
  ) {
    if (
      selectionMode.value &&
      !isInTextSelectable(event.target)
    ) {
      toggleSelect(message)
    }
  }

  function startSelectionFrom(
    message: UiMessage
  ) {
    selectionMode.value = true

    selected.clear()
    toggleSelect(message)
    closeMenu()
  }

  function onKeydownSelection(
    event: KeyboardEvent
  ) {
    if (
      event.key === 'Escape' &&
      selectionMode.value
    ) {
      clearSelection()
    }
  }

  async function writeClipboard(
    value: string
  ) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(
          value
        )

        return
      }
    } catch {}

    const textarea =
      document.createElement('textarea')

    textarea.value = value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'

    document.body.appendChild(textarea)
    textarea.select()

    try {
      document.execCommand('copy')
    } catch {}

    document.body.removeChild(textarea)
  }

  async function copySelectedText() {
    if (!selectedCount.value) return

    const lines = [
      ...selectedMessages.value
    ]
      .sort((a, b) =>
        (a.sentAt || '').localeCompare(
          b.sentAt || ''
        )
      )
      .map(message =>
        message.plainText.trim()
      )
      .filter(Boolean)

    if (!lines.length) return

    await writeClipboard(
      lines.join('\n')
    )

    clearSelection()
    showToast('Copied')
  }

  function disposeSelection() {
    endDragSelect()
  }

  return {
    selectionMode,
    selectedMessages,
    selectedCount,
    allSelectedAreMine,
    getMsgKey,
    isSelected,
    toggleSelect,
    clearSelection,
    isInTextSelectable,
    onRowMouseDown,
    onRowMouseEnter,
    onRowClick,
    startSelectionFrom,
    onKeydownSelection,
    copySelectedText,
    disposeSelection
  }
}