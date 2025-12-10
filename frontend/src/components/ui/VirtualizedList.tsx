import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  className?: string;
  height?: number;
  overscan?: number;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isLoading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  'data-testid'?: string;
}

/**
 * Virtualized list component for rendering large datasets efficiently
 * Uses @tanstack/react-virtual for windowing
 */
function VirtualizedList<T>({
  items,
  renderItem,
  estimateSize = 100,
  className = '',
  height = 400,
  overscan = 5,
  onLoadMore,
  hasNextPage = false,
  isLoading = false,
  loadingComponent,
  emptyComponent,
  'data-testid': testId = 'virtualized-list',
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  // Handle infinite loading
  useEffect(() => {
    if (!onLoadMore || !hasNextPage || isLoading) return;

    const [lastItem] = [...virtualizer.getVirtualItems()].reverse();
    
    if (!lastItem) return;

    // Load more when we're near the end
    if (lastItem.index >= items.length - 1 - overscan) {
      onLoadMore();
    }
  }, [virtualizer.getVirtualItems(), onLoadMore, hasNextPage, isLoading, items.length, overscan]);

  // Default loading component
  const defaultLoadingComponent = (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span className="ml-2 text-sm text-gray-600">Loading more items...</span>
    </div>
  );

  // Default empty component
  const defaultEmptyComponent = (
    <div className="flex items-center justify-center p-8 text-gray-500">
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m8-8v2m0 6v2" />
        </svg>
        <p className="mt-2 text-sm">No items to display</p>
      </div>
    </div>
  );

  const virtualItems = virtualizer.getVirtualItems();

  if (items.length === 0 && !isLoading) {
    return (
      <div className={className} data-testid={`${testId}-empty`}>
        {emptyComponent || defaultEmptyComponent}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
      data-testid={testId}
      role="list"
      aria-label="Virtualized list"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
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
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
            role="listitem"
            data-testid={`${testId}-item-${virtualItem.index}`}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
        
        {/* Loading indicator for infinite scroll */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: `${virtualizer.getTotalSize()}px`,
              left: 0,
              width: '100%',
            }}
          >
            {loadingComponent || defaultLoadingComponent}
          </div>
        )}
      </div>
    </div>
  );
}

// Grid virtualization for card layouts
interface VirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  itemWidth?: number;
  gap?: number;
  minColumns?: number;
  maxColumns?: number;
  className?: string;
  height?: number;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isLoading?: boolean;
  'data-testid'?: string;
}

export function VirtualizedGrid<T>({
  items,
  renderItem,
  itemHeight = 300,
  itemWidth = 250,
  gap = 16,
  minColumns = 1,
  maxColumns = 6,
  className = '',
  height = 600,
  onLoadMore,
  hasNextPage = false,
  isLoading = false,
  'data-testid': testId = 'virtualized-grid',
}: VirtualizedGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate columns based on container width
  const columns = useMemo(() => {
    const maxPossibleColumns = Math.floor(containerWidth / (itemWidth + gap));
    return Math.min(Math.max(maxPossibleColumns, minColumns), maxColumns);
  }, [containerWidth, itemWidth, gap, minColumns, maxColumns]);

  // Calculate rows
  const rows = Math.ceil(items.length / columns);

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (parentRef.current) {
        setContainerWidth(parentRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight + gap,
    overscan: 2,
  });

  // Handle infinite loading
  useEffect(() => {
    if (!onLoadMore || !hasNextPage || isLoading) return;

    const [lastItem] = [...virtualizer.getVirtualItems()].reverse();
    
    if (!lastItem) return;

    // Load more when we're near the end
    if (lastItem.index >= rows - 2) {
      onLoadMore();
    }
  }, [virtualizer.getVirtualItems(), onLoadMore, hasNextPage, isLoading, rows]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
      data-testid={testId}
      role="grid"
      aria-label="Virtualized grid"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const rowStart = virtualRow.index * columns;
          const rowEnd = Math.min(rowStart + columns, items.length);
          const rowItems = items.slice(rowStart, rowEnd);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              role="row"
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: `${gap}px`,
                  height: '100%',
                  padding: `0 ${gap / 2}px`,
                }}
              >
                {rowItems.map((item, colIndex) => (
                  <div
                    key={rowStart + colIndex}
                    role="gridcell"
                    data-testid={`${testId}-item-${rowStart + colIndex}`}
                  >
                    {renderItem(item, rowStart + colIndex)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        
        {/* Loading indicator */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: `${virtualizer.getTotalSize()}px`,
              left: 0,
              width: '100%',
            }}
            className="flex items-center justify-center p-4"
          >
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Loading more items...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default VirtualizedList;