import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Sticky footer rendered below the scrollable body — always visible */
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`${sizeStyles[size]} w-full bg-white rounded-t-xl sm:rounded-lg shadow-xl flex flex-col max-h-[90vh]`}
        style={{ maxHeight: '90dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex-shrink-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between rounded-t-xl sm:rounded-t-lg">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100"
            >
              ×
            </button>
          </div>
        )}
        <div className="p-6 pb-16 sm:pb-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4 bg-white rounded-b-none sm:rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
