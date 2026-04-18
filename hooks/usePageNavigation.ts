import { useState, useCallback, useRef, useEffect } from 'react';

interface UsePageNavigationOptions {
  totalPages: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

interface UsePageNavigationReturn {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  isFirstPage: boolean;
  isLastPage: boolean;
}

/**
 * 页面导航 Hook
 * 管理多页面导航状态
 * 提供便捷的导航方法
 */
export const usePageNavigation = (options: UsePageNavigationOptions): UsePageNavigationReturn => {
  const { totalPages, initialPage = 0, onPageChange } = options;

  const [currentPage, setCurrentPageState] = useState(initialPage);
  const onPageChangeRef = useRef(onPageChange);

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  const setCurrentPage = useCallback((page: number) => {
    const clampedPage = Math.max(0, Math.min(totalPages - 1, page));
    setCurrentPageState(clampedPage);
    onPageChangeRef.current?.(clampedPage);
  }, [totalPages]);

  const goToNextPage = useCallback(() => {
    setCurrentPage(currentPage + 1);
  }, [currentPage, setCurrentPage]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage(currentPage - 1);
  }, [currentPage, setCurrentPage]);

  const goToFirstPage = useCallback(() => {
    setCurrentPage(0);
  }, [setCurrentPage]);

  const goToLastPage = useCallback(() => {
    setCurrentPage(totalPages - 1);
  }, [totalPages, setCurrentPage]);

  return {
    currentPage,
    setCurrentPage,
    goToNextPage,
    goToPrevPage,
    goToFirstPage,
    goToLastPage,
    isFirstPage: currentPage === 0,
    isLastPage: currentPage === totalPages - 1,
  };
};
