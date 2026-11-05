import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export type PixelSize = { width: number; height: number }

/**
 * The size at which media fits inside `box` without cropping or distortion, whatever its shape:
 * tall, wide or tiny. `sideways` is a quarter turn, which swaps the sides that have to fit.
 */
export function useFitSize(
  box: Ref<HTMLElement | null>,
  natural: Ref<PixelSize | null>,
  options: { maxUpscale: number; sideways?: Ref<boolean> }
) {
  const area = ref<PixelSize>({ width: 0, height: 0 })

  const observer = new ResizeObserver(entries => {
    const rect = entries[entries.length - 1].contentRect
    area.value = { width: rect.width, height: rect.height }
  })

  watch(box, (element, previous) => {
    if (previous) observer.unobserve(previous)
    if (element) observer.observe(element)
  }, { immediate: true })

  onBeforeUnmount(() => observer.disconnect())

  return computed<PixelSize | null>(() => {
    const media = natural.value
    const { width, height } = area.value
    if (!media?.width || !media.height || !width || !height) return null

    const turned = !!options.sideways?.value
    const across = turned ? media.height : media.width
    const down = turned ? media.width : media.height
    const scale = Math.min(width / across, height / down, options.maxUpscale)

    return { width: media.width * scale, height: media.height * scale }
  })
}

/** Styles that center an element of `size` in its positioned parent. */
export function centeredStyle(size: PixelSize | null) {
  if (!size) return { left: '50%', top: '50%', opacity: 0 }
  return {
    left: '50%',
    top: '50%',
    width: `${size.width}px`,
    height: `${size.height}px`,
    marginLeft: `${-size.width / 2}px`,
    marginTop: `${-size.height / 2}px`
  }
}
