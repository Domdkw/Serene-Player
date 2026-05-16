import { useState, useRef, useEffect, useCallback } from 'react';
import { createSwipeManager, SwipeDirection } from '../utils/swipeUtils';

interface UseSwipeGestureOptions {
  maxPage: number;
  minPage?: number;
  swipeThreshold?: number;
  lockThreshold?: number;
  onPageChange: (page: number) => void;
}

interface UseSwipeGestureReturn {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  isDragging: boolean;
  dragOffset: number;
  swipeDirection: SwipeDirection;
  handleTouchStart: (e: React.TouchEvent | React.MouseEvent) => void;
  handleTouchMove: (e: React.TouchEvent | React.MouseEvent) => void;
  handleTouchEnd: () => void;
  handleWheel: (e: WheelEvent) => void;
}

/**
 * 滑动手势 Hook
 * 处理移动端页面切换的滑动手势
 * 支持触摸和鼠标事件
 */
export const useSwipeGesture = (options: UseSwipeGestureOptions): UseSwipeGestureReturn => {
  const {
    maxPage,
    minPage = 0,
    swipeThreshold,
    lockThreshold = 10,
    onPageChange,
  } = options;

  const [currentPage, setCurrentPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null);

  const swipeManagerRef = useRef<ReturnType<typeof createSwipeManager> | null>(null);
  const currentPageRef = useRef(currentPage);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    const threshold = swipeThreshold || window.innerWidth * 0.15;

    swipeManagerRef.current = createSwipeManager({
      lockThreshold,
      swipeThreshold: threshold,
      maxPage,
      minPage,
      onHorizontalSwipeStart: () => {
        setSwipeDirection('horizontal');
      },
      onVerticalSwipeStart: () => {
        setSwipeDirection('vertical');
      },
      onHorizontalSwipeMove: (offset) => {
        let adjustedOffset = offset;
        const page = currentPageRef.current;
        if (page === minPage && offset > 0) {
          adjustedOffset = 0;
        }
        if (page === maxPage && offset < 0) {
          adjustedOffset = 0;
        }
        setDragOffset(adjustedOffset);
      },
      onHorizontalSwipeEnd: (direction) => {
        const page = currentPageRef.current;
        let newPage = page;
        if (direction === 'right' && page > minPage) {
          newPage = page - 1;
        } else if (direction === 'left' && page < maxPage) {
          newPage = page + 1;
        }
        setCurrentPage(newPage);
        onPageChange(newPage);
        setDragOffset(0);
        setSwipeDirection(null);
      },
      onVerticalSwipeEnd: () => {
        setSwipeDirection(null);
      },
      onSwipeCancel: () => {
        setDragOffset(0);
        setSwipeDirection(null);
      },
    });
  }, [maxPage, minPage, swipeThreshold, lockThreshold, onPageChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    swipeManagerRef.current?.handleTouchStart(clientX, clientY);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    swipeManagerRef.current?.handleTouchMove(clientX, clientY);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    swipeManagerRef.current?.handleTouchEnd();
  }, [isDragging]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const threshold = 50;
    const page = currentPageRef.current;
    if (e.deltaY > threshold && page > minPage) {
      const newPage = page - 1;
      setCurrentPage(newPage);
      onPageChange(newPage);
    } else if (e.deltaY < -threshold && page < maxPage) {
      const newPage = page + 1;
      setCurrentPage(newPage);
      onPageChange(newPage);
    }
  }, [maxPage, minPage, onPageChange]);

  return {
    currentPage,
    setCurrentPage,
    isDragging,
    dragOffset,
    swipeDirection,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleWheel,
  };
};
