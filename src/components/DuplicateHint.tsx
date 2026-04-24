'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import ES from '@/config/text.es';

interface DuplicateHintItem {
  id: string;
  name: string;
  secondary?: string;
}

interface DuplicateHintProps {
  matches: DuplicateHintItem[];
  onPick?: (id: string) => void;
  // What kind of thing these duplicates are — used only for the header copy
  kind: 'service' | 'product';
}

// Rendered below the "name" input in create/edit modals to warn the admin
// that an existing item with a similar name already exists. Tapping a match
// calls onPick(id) — parent is expected to close the create flow and open
// the existing item for edit instead, preventing duplicates.
export function DuplicateHint({ matches, onPick, kind }: DuplicateHintProps) {
  if (matches.length === 0) return null;
  const header = kind === 'service' ? ES.duplicateHint.serviceTitle : ES.duplicateHint.productTitle;
  return (
    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
      <div className="flex items-start gap-2 mb-1.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs font-medium text-amber-900">{header}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {matches.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={onPick ? () => onPick(m.id) : undefined}
            className="text-left px-2.5 py-1.5 min-h-[36px] bg-white border border-amber-200 hover:bg-amber-100 active:bg-amber-200 rounded-md transition-colors flex flex-col"
            title={ES.duplicateHint.tapToEdit}
          >
            <span className="text-xs font-medium text-gray-900 truncate max-w-[200px]">{m.name}</span>
            {m.secondary && (
              <span className="text-[10px] text-gray-500 truncate max-w-[200px]">{m.secondary}</span>
            )}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-amber-700 mt-1.5">{ES.duplicateHint.tapToEdit}</p>
    </div>
  );
}
