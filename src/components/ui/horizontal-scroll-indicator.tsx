import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { cn } from '@/lib/utils'

interface HorizontalScrollIndicatorProps {
    containerRef: RefObject<HTMLElement | null>
    className?: string
}

export function HorizontalScrollIndicator({ containerRef, className }: HorizontalScrollIndicatorProps) {
    const [thumbWidth, setThumbWidth] = useState(0)
    const [thumbLeft, setThumbLeft] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const trackRef = useRef<HTMLDivElement>(null)
    const dragStartX = useRef(0)
    const dragStartScrollLeft = useRef(0)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const update = () => {
            const { scrollWidth, clientWidth, scrollLeft } = el
            if (scrollWidth <= clientWidth) {
                setIsVisible(false)
                return
            }
            setIsVisible(true)
            const ratio = clientWidth / scrollWidth
            const thumbW = ratio * 100
            const maxScroll = scrollWidth - clientWidth
            setThumbWidth(thumbW)
            setThumbLeft(maxScroll > 0 ? (scrollLeft / maxScroll) * (100 - thumbW) : 0)
        }

        update()
        el.addEventListener('scroll', update)

        // Watch container size (viewport resize)
        const ro = new ResizeObserver(update)
        ro.observe(el)

        // Watch content size — fires when table columns/rows change scrollWidth
        const firstChild = el.firstElementChild
        if (firstChild) ro.observe(firstChild)

        return () => {
            el.removeEventListener('scroll', update)
            ro.disconnect()
        }
    }, [containerRef])

    useEffect(() => {
        if (!isDragging) return

        const handleMouseMove = (e: MouseEvent) => {
            const el = containerRef.current
            const track = trackRef.current
            if (!el || !track) return
            const thumbPx = (thumbWidth / 100) * track.clientWidth
            const trackAvailable = track.clientWidth - thumbPx
            const scrollAvailable = el.scrollWidth - el.clientWidth
            if (trackAvailable <= 0) return
            const dx = e.clientX - dragStartX.current
            el.scrollLeft = Math.max(0, Math.min(scrollAvailable, dragStartScrollLeft.current + dx * (scrollAvailable / trackAvailable)))
        }

        const handleMouseUp = () => setIsDragging(false)

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, containerRef, thumbWidth])

    const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = containerRef.current
        const track = trackRef.current
        if (!el || !track) return
        const rect = track.getBoundingClientRect()
        const ratio = (e.clientX - rect.left) / rect.width
        el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth)
    }

    const handleThumbMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (!containerRef.current) return
        setIsDragging(true)
        dragStartX.current = e.clientX
        dragStartScrollLeft.current = containerRef.current.scrollLeft
    }

    if (!isVisible) return null

    return (
        <div
            ref={trackRef}
            onClick={handleTrackClick}
            title="Drag to scroll horizontally"
            className={cn(
                'relative h-1.5 cursor-pointer rounded-full bg-black/10 dark:bg-white/10',
                className
            )}
        >
            <div
                className={cn(
                    'absolute top-0 h-full rounded-full bg-purple-400 transition-[opacity,background-color] duration-150',
                    isDragging
                        ? 'cursor-grabbing bg-purple-500 opacity-100'
                        : 'cursor-grab opacity-50 hover:bg-purple-500 hover:opacity-90'
                )}
                style={{ width: `${thumbWidth}%`, left: `${thumbLeft}%` }}
                onMouseDown={handleThumbMouseDown}
            />
        </div>
    )
}
