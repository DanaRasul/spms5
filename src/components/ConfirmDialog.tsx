'use client';
import React from 'react';
import { useLang } from '@/lib/LangContext';

interface ConfirmDialogProps {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared confirmation dialog. Render conditionally (`{condition && <ConfirmDialog .../>}`)
 * from the caller — this component has no visibility state of its own.
 */
export default function ConfirmDialog({
  title, message, confirmLabel, cancelLabel, danger = true, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const { t, dir } = useLang();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        dir={dir}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center"
      >
        <div className="text-4xl mb-3">⚠️</div>
        {title && <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>}
        <div className="text-gray-600 text-sm mb-5">{message}</div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            {cancelLabel || t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {confirmLabel || t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
