import React from 'react';

/**
 * 移动端滑动工具
 * 提供更好的上下左右滑动支持，避免滑动互相干扰
 */

export type SwipeDirection = 'horizontal' | 'vertical' | null;

export interface SwipeState {
  direction: SwipeDirection;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
  isLocked: boolean;
}

export interface SwipeConfig {
  /** 方向锁定的最小移动距离阈值 */
  lockThreshold: number;
  /** 触发页面切换的最小滑动距离 */
  swipeThreshold: number;
  /** 最大页面索引 */
  maxPage: number;
  /** 最小页面索引 */
  minPage: number;
  /** 水平滑动开始回调 */
  onHorizontalSwipeStart?: () => void;
  /** 垂直滑动开始回调 */
  onVerticalSwipeStart?: () => void;
  /** 水平滑动更新回调 */
  onHorizontalSwipeMove?: (offset: number) => void;
  /** 垂直滑动更新回调 */
  onVerticalSwipeMove?: (offset: number) => void;
  /** 水平滑动结束回调 */
  onHorizontalSwipeEnd?: (direction: 'left' | 'right' | null, offset: number) => void;
  /** 垂直滑动结束回调 */
  onVerticalSwipeEnd?: (direction: 'up' | 'down' | null, offset: number) => void;
  /** 滑动取消回调 */
  onSwipeCancel?: () => void;
}

/**
 * 创建滑动状态管理器
 */
export function createSwipeManager(config: SwipeConfig) {
  let state: SwipeState = {
    direction: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    offsetX: 0,
    offsetY: 0,
    isLocked: false,
  };

  /**
   * 重置滑动状态
   */
  const resetState = () => {
    state = {
      direction: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      offsetX: 0,
      offsetY: 0,
      isLocked: false,
    };
  };

  /**
   * 获取当前滑动状态
   */
  const getState = (): SwipeState => ({ ...state });

  /**
   * 处理触摸开始事件
   */
  const handleTouchStart = (clientX: number, clientY: number) => {
    resetState();
    state.startX = clientX;
    state.startY = clientY;
    state.currentX = clientX;
    state.currentY = clientY;
  };

  /**
   * 处理触摸移动事件
   */
  const handleTouchMove = (clientX: number, clientY: number): SwipeDirection => {
    state.currentX = clientX;
    state.currentY = clientY;
    state.offsetX = clientX - state.startX;
    state.offsetY = clientY - state.startY;

    const absOffsetX = Math.abs(state.offsetX);
    const absOffsetY = Math.abs(state.offsetY);

    // 取绝对值比较哪个方向移动更多
    // 水平距离大 → 水平滑动；垂直距离大 → 垂直滑动
    if (!state.isLocked) {
      if (absOffsetX > config.lockThreshold || absOffsetY > config.lockThreshold) {
        if (absOffsetX > absOffsetY) {
          state.direction = 'horizontal';
          state.isLocked = true;
          config.onHorizontalSwipeStart?.();
        } else {
          state.direction = 'vertical';
          state.isLocked = true;
          config.onVerticalSwipeStart?.();
        }
      }
    } else {
      if (state.direction === 'horizontal') {
        config.onHorizontalSwipeMove?.(state.offsetX);
      } else if (state.direction === 'vertical') {
        config.onVerticalSwipeMove?.(state.offsetY);
      }
    }

    return state.direction;
  };

  /**
   * 处理触摸结束事件
   */
  const handleTouchEnd = () => {
    if (!state.isLocked) {
      config.onSwipeCancel?.();
      resetState();
      return;
    }

    if (state.direction === 'horizontal') {
      const threshold = config.swipeThreshold;
      let direction: 'left' | 'right' | null = null;

      if (state.offsetX > threshold) {
        direction = 'right';
      } else if (state.offsetX < -threshold) {
        direction = 'left';
      }

      config.onHorizontalSwipeEnd?.(direction, state.offsetX);
    } else if (state.direction === 'vertical') {
      const threshold = config.swipeThreshold;
      let direction: 'up' | 'down' | null = null;

      if (state.offsetY > threshold) {
        direction = 'down';
      } else if (state.offsetY < -threshold) {
        direction = 'up';
      }

      config.onVerticalSwipeEnd?.(direction, state.offsetY);
    }

    resetState();
  };

  return {
    getState,
    resetState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

/**
 * 防止滑动穿透的高阶组件包装器
 */
export function withSwipeStopPropagation<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return (props: P) => {
    return (
      <div
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <WrappedComponent {...props} />
      </div>
    );
  };
}

/**
 * 创建一个阻止事件冒泡的 props 对象
 */
export function createStopPropagationProps() {
  return {
    onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
    onTouchMove: (e: React.TouchEvent) => e.stopPropagation(),
    onTouchEnd: (e: React.TouchEvent) => e.stopPropagation(),
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onMouseMove: (e: React.MouseEvent) => e.stopPropagation(),
    onMouseUp: (e: React.MouseEvent) => e.stopPropagation(),
  };
}
