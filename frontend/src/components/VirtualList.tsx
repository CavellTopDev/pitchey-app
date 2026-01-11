import { useRef, useState, useEffect, useCallback, ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  height?: number | string
  estimateSize?: number
  overscan?: number
  onEndReached?: () => void
  endReachedThreshold?: number
  className?: string
  gap?: number
  horizontal?: boolean
  columns?: number
}

export function VirtualList<T>({
  items,
  renderItem,
  height = 600,
  estimateSize = 100,
  overscan = 5,
  onEndReached,
  endReachedThreshold = 0.9,
  className = '',
  gap = 0,
  horizontal = false,
  columns = 1
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [isEndReached, setIsEndReached] = useState(false)
  
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(items.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    horizontal,
    gap
  })
  
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  
  // Handle infinite scroll
  useEffect(() => {
    if (!onEndReached || !parentRef.current) return
    
    const handleScroll = () => {
      const scrollElement = parentRef.current
      if (!scrollElement) return
      
      const scrollPosition = horizontal
        ? scrollElement.scrollLeft + scrollElement.clientWidth
        : scrollElement.scrollTop + scrollElement.clientHeight
      
      const totalScrollSize = horizontal
        ? scrollElement.scrollWidth
        : scrollElement.scrollHeight
      
      const scrollPercentage = scrollPosition / totalScrollSize
      
      if (scrollPercentage > endReachedThreshold && !isEndReached) {
        setIsEndReached(true)
        onEndReached()
      } else if (scrollPercentage < endReachedThreshold) {
        setIsEndReached(false)
      }
    }
    
    const scrollElement = parentRef.current
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      scrollElement?.removeEventListener('scroll', handleScroll)
    }
  }, [horizontal, endReachedThreshold, isEndReached, onEndReached])
  
  const getItemsForRow = useCallback((rowIndex: number) => {
    const start = rowIndex * columns
    const end = Math.min(start + columns, items.length)
    return items.slice(start, end)
  }, [items, columns])
  
  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: '100%'
      }}
    >
      <div
        style={{
          [horizontal ? 'width' : 'height']: `${totalSize}px`,
          [horizontal ? 'height' : 'width']: '100%',
          position: 'relative'
        }}
      >
        {virtualItems.map((virtualRow) => {
          const rowItems = getItemsForRow(virtualRow.index)
          
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: horizontal ? 0 : virtualRow.start,
                left: horizontal ? virtualRow.start : 0,
                [horizontal ? 'width' : 'height']: `${virtualRow.size}px`,
                [horizontal ? 'height' : 'width']: '100%'
              }}
            >
              {columns > 1 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: `${gap}px`,
                    height: '100%'
                  }}
                >
                  {rowItems.map((item, colIndex) => {
                    const actualIndex = virtualRow.index * columns + colIndex
                    return (
                      <div key={actualIndex}>
                        {renderItem(item, actualIndex)}
                      </div>
                    )
                  })}
                </div>
              ) : (
                renderItem(rowItems[0], virtualRow.index)
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Window-based virtual scroller for full-page lists
interface VirtualWindowListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  estimateSize?: number
  overscan?: number
  onEndReached?: () => void
  endReachedThreshold?: number
  className?: string
  gap?: number
}

export function VirtualWindowList<T>({
  items,
  renderItem,
  estimateSize = 100,
  overscan = 5,
  onEndReached,
  endReachedThreshold = 0.9,
  className = '',
  gap = 0
}: VirtualWindowListProps<T>) {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)
  const [isEndReached, setIsEndReached] = useState(false)
  
  useEffect(() => {
    setScrollElement(document.documentElement)
  }, [])
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateSize,
    overscan,
    gap
  })
  
  // Handle infinite scroll
  useEffect(() => {
    if (!onEndReached) return
    
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight
      
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight
      
      if (scrollPercentage > endReachedThreshold && !isEndReached) {
        setIsEndReached(true)
        onEndReached()
      } else if (scrollPercentage < endReachedThreshold) {
        setIsEndReached(false)
      }
    }
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [endReachedThreshold, isEndReached, onEndReached])
  
  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()
  
  return (
    <div
      className={className}
      style={{
        height: `${totalSize}px`,
        width: '100%',
        position: 'relative'
      }}
    >
      {virtualItems.map((virtualItem) => (
        <div
          key={virtualItem.key}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItem.start}px)`,
            minHeight: `${virtualItem.size}px`
          }}
        >
          {renderItem(items[virtualItem.index], virtualItem.index)}
        </div>
      ))}
    </div>
  )
}

// Optimized pitch card list
interface PitchListProps {
  pitches: any[]
  onEndReached?: () => void
  renderPitch: (pitch: any, index: number) => ReactNode
  columns?: number
  gap?: number
}

export function OptimizedPitchList({
  pitches,
  onEndReached,
  renderPitch,
  columns = 1,
  gap = 16
}: PitchListProps) {
  const estimateSize = columns > 1 ? 350 : 150 // Adjust based on your card size
  
  return (
    <VirtualList
      items={pitches}
      renderItem={renderPitch}
      height="calc(100vh - 200px)"
      estimateSize={estimateSize}
      overscan={3}
      onEndReached={onEndReached}
      endReachedThreshold={0.8}
      gap={gap}
      columns={columns}
      className="px-4"
    />
  )
}

// Table virtualization
interface VirtualTableProps<T> {
  data: T[]
  columns: {
    key: string
    header: string
    width?: number
    render?: (value: any, item: T, index: number) => ReactNode
  }[]
  rowHeight?: number
  headerHeight?: number
  height?: number | string
  onRowClick?: (item: T, index: number) => void
  className?: string
}

export function VirtualTable<T extends Record<string, any>>({
  data,
  columns,
  rowHeight = 48,
  headerHeight = 48,
  height = 600,
  onRowClick,
  className = ''
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5
  })
  
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  
  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Fixed Header */}
      <div
        className="bg-gray-50 border-b border-gray-200 flex sticky top-0 z-10"
        style={{ height: `${headerHeight}px` }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-4 py-2 font-semibold text-sm text-gray-700 flex items-center"
            style={{ width: column.width || `${100 / columns.length}%` }}
          >
            {column.header}
          </div>
        ))}
      </div>
      
      {/* Virtual Scrollable Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{
          height: typeof height === 'number' ? `${height - headerHeight}px` : `calc(${height} - ${headerHeight}px)`
        }}
      >
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = data[virtualRow.index]
            
            return (
              <div
                key={virtualRow.key}
                className="flex border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
                onClick={() => onRowClick?.(item, virtualRow.index)}
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className="px-4 py-2 text-sm text-gray-600 flex items-center"
                    style={{ width: column.width || `${100 / columns.length}%` }}
                  >
                    {column.render
                      ? column.render(item[column.key], item, virtualRow.index)
                      : item[column.key]}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default VirtualList