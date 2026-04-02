'use client';

import React, { useState, useMemo } from 'react';
import ES from '@/config/text.es';

export interface ServiceOption {
  value: string;
  label: string;
  secondary?: string;
  category: string;
  categoryLabel: string;
}

interface CategoryServicePickerProps {
  label?: string;
  options: ServiceOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function CategoryServicePicker({
  label,
  options,
  value,
  onChange,
  required,
}: CategoryServicePickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Build category list with counts
  const categories = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    options.forEach((o) => {
      if (!map.has(o.category)) {
        map.set(o.category, { label: o.categoryLabel, count: 0 });
      }
      map.get(o.category)!.count++;
    });
    return Array.from(map.entries());
  }, [options]);

  // Filter services by selected category
  const filteredServices = selectedCategory
    ? options.filter((o) => o.category === selectedCategory)
    : [];

  const selectedOption = options.find((o) => o.value === value);

  const handleSelect = (serviceValue: string) => {
    onChange(serviceValue);
    setSelectedCategory(null);
  };

  const handleClear = () => {
    onChange('');
    setSelectedCategory(null);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Selected service display */}
      {selectedOption && !selectedCategory ? (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-blue-900">{selectedOption.label}</p>
            {selectedOption.secondary && (
              <p className="text-xs text-blue-600">{selectedOption.secondary}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="ml-3 text-blue-400 hover:text-blue-600 text-lg font-bold"
          >
            ✕
          </button>
        </div>
      ) : !selectedCategory ? (
        /* Step 1: Category chips */
        <div>
          <div className="grid grid-cols-2 gap-2">
            {categories.map(([key, { label: catLabel, count }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className="flex items-center justify-between px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-left hover:border-blue-400 hover:bg-blue-50 transition-colors active:bg-blue-100"
              >
                <span className="text-sm font-medium text-gray-800">{catLabel}</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Step 2: Services in selected category */
        <div>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-1 text-sm text-blue-600 font-medium mb-3 hover:text-blue-800"
          >
            ← {ES.actions.back || 'Volver'}
          </button>
          <div className="space-y-2">
            {filteredServices.map((svc) => (
              <button
                key={svc.value}
                type="button"
                onClick={() => handleSelect(svc.value)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors active:bg-blue-100 ${
                  svc.value === value
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <p className="text-sm font-medium">{svc.label}</p>
                {svc.secondary && (
                  <p className="text-xs text-gray-500 mt-0.5">{svc.secondary}</p>
                )}
              </button>
            ))}
            {filteredServices.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">{ES.app.noResults}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
