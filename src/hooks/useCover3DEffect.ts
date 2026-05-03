import { useState, useCallback, useRef, useEffect } from 'react';

interface UseCover3DEffectOptions {
  enabled?: boolean;
}

interface UseCover3DEffectReturn {
  coverRef: React.RefObject<HTMLDivElement>;
  coverMousePos: { x: number; y: number };
  isCoverHovered: boolean;
  handleMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  transform3D: string;
}

/**
 * 3D封面效果 Hook
 * 处理封面图片的3D悬停效果
 * 支持节流优化性能
 */
export const useCover3DEffect = (options: UseCover3DEffectOptions = {}): UseCover3DEffectReturn => {
  const { enabled = true } = options;

  const coverRef = useRef<HTMLDivElement>(null);
  const [coverMousePos, setCoverMousePos] = useState({ x: 0, y: 0 });
  const [isCoverHovered, setIsCoverHovered] = useState(false);
  const lastUpdateTimeRef = useRef(0);

  /**
   * 处理鼠标移动事件
   * 使用节流优化性能（约60fps）
   */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!enabled || !coverRef.current) return;

    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 16) return;
    lastUpdateTimeRef.current = now;

    const rect = coverRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setCoverMousePos({ x, y });
  }, [enabled]);

  const handleMouseEnter = useCallback(() => {
    if (enabled) {
      setIsCoverHovered(true);
    }
  }, [enabled]);

  const handleMouseLeave = useCallback(() => {
    if (enabled) {
      setIsCoverHovered(false);
      setCoverMousePos({ x: 0, y: 0 });
    }
  }, [enabled]);

  const transform3D = enabled && isCoverHovered
    ? `perspective(1000px) rotateX(${-coverMousePos.y * 25}deg) rotateY(${coverMousePos.x * 25}deg) scale3d(1.05, 1.05, 1.05)`
    : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';

  return {
    coverRef,
    coverMousePos,
    isCoverHovered,
    handleMouseMove,
    handleMouseEnter,
    handleMouseLeave,
    transform3D,
  };
};
