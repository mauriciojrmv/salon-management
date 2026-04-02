'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ES from '@/config/text.es';

export interface SearchableOption {
  value: string;
  label: string;
  secondary?: string; // e.g., phone number, category
  group?: string; // optional group header
}

interface SearchableSelectProps {
  label?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = ES.app.searchPlaceholder,
  required,
  error,
  disabled,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = search
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          (o.secondary && o.secondary.toLowerCase().includes(search.toLowerCase())) ||
          (o.group && o.group.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  // Group options by group field if any have groups
  const grouped = useMemo(() => {
    const hasGroups = filtered.some((o) => o.group);
    if (!hasGroups) return null;

    const groups = new Map<string, SearchableOption[]>();
    filtered.forEach((o) => {
      const key = o.group || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(o);
    });
    return groups;
  }, [filtered]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch('');
  };

  const computeDropdownStyle = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < 280 && spaceAbove > spaceBelow;
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    computeDropdownStyle();
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const renderOption = (option: SearchableOption) => (
    <button
      key={option.value}
      type="button"
      onClick={() => handleSelect(option.value)}
      className={`w-full text-left px-4 py-3.5 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between ${
        option.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'
      }`}
    >
      <span>{option.label}</span>
      {option.secondary && (
        <span className="text-xs text-gray-400 ml-2">{option.secondary}</span>
      )}
    </button>
  );

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Display selected value / trigger */}
      <div
        onClick={handleOpen}
        className={`w-full px-4 py-3.5 border rounded-lg cursor-pointer flex items-center justify-between ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-gray-400'}`}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Dropdown — fixed positioned to escape modal overflow */}
      {isOpen && (
        <div style={dropdownStyle} className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-[50vh] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
            {/* Search input */}
            <div className="p-2 border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Options list */}
            <div className="max-h-[50vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  {ES.app.noResults}
                </div>
              ) : grouped ? (
                Array.from(grouped.entries()).map(([groupName, groupOptions]) => (
                  <div key={groupName}>
                    {groupName && (
                      <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 uppercase tracking-wider sticky top-0">
                        {groupName}
                      </div>
                    )}
                    {groupOptions.map(renderOption)}
                  </div>
                ))
              ) : (
                filtered.map(renderOption)
              )}
            </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}
