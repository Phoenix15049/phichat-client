import {
  reactive,
  type ComputedRef,
  type Ref
} from 'vue'
import { deleteMessage } from '../services/api'
import type { UiMessage } from '../types/chat'

type UseMessageDeleteOptions = {
  messages: Ref<UiMessage[]>
  selectedMessages: ComputedRef<UiMessage[]>
  selectedCount: ComputedRef<number>
  allSelectedAreMine: ComputedRef<boolean>
  isMine: (
    message?: UiMessage | null
  ) => boolean
  clearSelection: () => void
  showToast: (text: string) => void
}

export function useMessageDelete({
  messages,
  selectedMessages,
  selectedCount,
  allSelectedAreMine,
  isMine,
  clearSelection,
  showToast
}: UseMessageDeleteOptions) {
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

  function openDeleteConfirmSingle(
    message: UiMessage,
    scopeDefault?: 'me' | 'all'
  ) {
    confirmDel.visible = true
    confirmDel.mode = 'single'
    confirmDel.msg = message
    confirmDel.count = 1
    confirmDel.canAll = isMine(message)

    confirmDel.forAll =
      scopeDefault === 'all' &&
      confirmDel.canAll
  }

  function openDeleteConfirmMulti() {
    confirmDel.visible = true
    confirmDel.mode = 'multi'
    confirmDel.msg = null
    confirmDel.count = selectedCount.value

    confirmDel.canAll =
      allSelectedAreMine.value

    confirmDel.forAll = false
  }

  function cancelDelete() {
    confirmDel.visible = false
  }

  async function confirmDelete() {
    try {
      const scope =
        confirmDel.forAll &&
        confirmDel.canAll
          ? 'all'
          : 'me'

      if (
        confirmDel.mode === 'single' &&
        confirmDel.msg?.id
      ) {
        const id = confirmDel.msg.id

        await deleteMessage(id, scope)

        const index =
          messages.value.findIndex(
            message => message.id === id
          )

        if (index >= 0) {
          messages.value.splice(index, 1)
        }
      } else if (
        confirmDel.mode === 'multi'
      ) {
        const ids = selectedMessages.value
          .map(message => message.id)
          .filter(
            (id): id is string => !!id
          )

        await Promise.all(
          ids.map(id =>
            deleteMessage(id, scope)
              .catch(() => {})
          )
        )

        const idSet = new Set(ids)

        messages.value =
          messages.value.filter(
            message =>
              !message.id ||
              !idSet.has(message.id)
          )

        clearSelection()
      }

      showToast('Deleted')
    } catch (error) {
      console.warn(
        'confirmDelete failed',
        error
      )
    } finally {
      confirmDel.visible = false
    }
  }

  return {
    confirmDel,
    openDeleteConfirmSingle,
    openDeleteConfirmMulti,
    cancelDelete,
    confirmDelete
  }
}