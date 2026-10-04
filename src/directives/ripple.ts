import type { ObjectDirective } from 'vue'

const handlers = new WeakMap<HTMLElement, (event: MouseEvent) => void>()

/** Material-style ink ripple on click. Registered globally as `v-ripple` (see main.ts). */
export const ripple: ObjectDirective<HTMLElement> = {
  mounted(element) {
    element.style.position ||= 'relative'
    element.style.overflow ||= 'hidden'

    const handler = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 1.1
      const ink = document.createElement('span')

      ink.className = 'ripple-ink'
      ink.style.width = ink.style.height = `${size}px`
      ink.style.left = `${event.clientX - rect.left - size / 2}px`
      ink.style.top = `${event.clientY - rect.top - size / 2}px`

      element.appendChild(ink)
      ink.addEventListener('animationend', () => ink.remove(), { once: true })
    }

    handlers.set(element, handler)
    element.addEventListener('click', handler)
  },

  beforeUnmount(element) {
    const handler = handlers.get(element)
    if (handler) element.removeEventListener('click', handler)
    handlers.delete(element)
  }
}
