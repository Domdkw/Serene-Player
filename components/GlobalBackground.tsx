import React, { memo } from 'react';
import { motion } from 'framer-motion';

interface GlobalBackgroundProps {
  coverUrl?: string | null;
  rotate?: boolean;
}

/**
 * 全局背景组件
 * @param coverUrl - 封面图片URL
 * @param rotate - 是否开启旋转动画
 */
const GlobalBackground = memo(({ coverUrl, rotate = false }: GlobalBackgroundProps) => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[rgb(5,7,18)]">
    {coverUrl && (
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 left-[-200vw] w-[400vw] h-[400vh]"
        style={{
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(50px) brightness(0.7)',
        }}
        animate={rotate ? { rotate: 360 } : { rotate: 0 }}
        transition={{
          duration: 120,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'loop',
        }}
      />
    )}
  </div>
));

export default GlobalBackground;
