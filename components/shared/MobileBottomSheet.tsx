import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createStopPropagationProps } from '../../utils/swipeUtils';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  showCloseButton?: boolean;
  maxHeight?: string;
  zIndex?: number;
  header?: ReactNode;
}

const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  showCloseButton = true,
  maxHeight = '85vh',
  zIndex = 101,
  header,
}) => {
  const hasHeader = header !== undefined;
  const headerHeight = hasHeader ? 'auto' : (showCloseButton ? 80 : 40);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 bg-[#1a1a1a] rounded-t-3xl shadow-2xl"
            style={{
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
              maxHeight,
              zIndex,
            }}
            {...createStopPropagationProps()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {hasHeader ? (
              header
            ) : (
              showCloseButton && (
                <div className="flex items-center justify-end px-5 py-3 border-b border-white/10">
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95"
                  >
                    <X size={18} className="text-white/60" />
                  </button>
                </div>
              )
            )}

            <div 
              className="p-5 overflow-y-auto" 
              style={{ maxHeight: hasHeader ? undefined : `calc(${maxHeight} - ${headerHeight}px)` }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileBottomSheet;
