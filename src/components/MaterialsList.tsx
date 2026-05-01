'use client';

import React from 'react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { fmtBs } from '@/lib/utils/helpers';
import type { MaterialEntry } from '@/types/models';
import ES from '@/config/text.es';

interface ProductOption {
  value: string;
  label: string;
  secondary?: string;
  group?: string;
}

interface MaterialsListProps {
  materials: MaterialEntry[];
  productOptions: ProductOption[];
  recentProductIds: string[];
  onSelectProduct: (idx: number, productId: string) => void;
  onChangeQuantity: (idx: number, qty: number) => void;
  onRemove: (idx: number) => void;
  onMarkUsage: (idx: number) => void;
  onResetUsage: (idx: number) => void;
  onToggleManualOverride: (idx: number, manual: boolean) => void;
  onAddRow: () => void;
  // When set, shows a green banner indicating materials were loaded from memory
  prefillNotice?: string;
}

export function MaterialsList({
  materials,
  productOptions,
  recentProductIds,
  onSelectProduct,
  onChangeQuantity,
  onRemove,
  onMarkUsage,
  onResetUsage,
  onToggleManualOverride,
  onAddRow,
  prefillNotice,
}: MaterialsListProps) {
  return (
    <div className="space-y-4">
      {/* Prefill notice — shown when recipe was loaded from last visit memory */}
      {prefillNotice && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <span className="text-green-600 text-base shrink-0 mt-0.5">★</span>
          <p className="text-xs text-green-800 leading-snug">{prefillNotice}</p>
        </div>
      )}

      {materials.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">{ES.sessions.noMaterials}</p>
      ) : (
        <div className="space-y-3">
          {materials.map((mat, idx) => {
            const usedIds = materials.filter((_, i) => i !== idx).map((m) => m.productId).filter(Boolean);
            const filteredOptions = productOptions.filter((o) => !usedIds.includes(o.value));
            const isServiceCost = mat.unit === 'uso';

            return (
              <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      label=""
                      options={filteredOptions}
                      value={mat.productId}
                      onChange={(v) => onSelectProduct(idx, v)}
                      placeholder={ES.material.product}
                      pinnedValues={recentProductIds.filter((id) => !usedIds.includes(id))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="text-red-400 hover:text-red-600 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-50 shrink-0 mt-1"
                  >
                    ✕
                  </button>
                </div>

                {mat.productId && (
                  <>
                    {/* Stock indicator — hidden for service_cost (no real stock) */}
                    {!isServiceCost && (
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Stock: {mat.maxStock} {mat.unit}</span>
                        <span>{fmtBs(mat.pricePerUnit)}/{mat.unit}</span>
                      </div>
                    )}

                    {mat.imprecise && !mat.manualOverride && mat.defaultUsage > 0 ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => onMarkUsage(idx)}
                          disabled={mat.quantity + mat.defaultUsage > mat.maxStock}
                          className="w-full py-4 min-h-[56px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-lg flex flex-col items-center justify-center transition-colors"
                        >
                          <span>{ES.inventory.markUsage}</span>
                          <span className="text-xs font-normal opacity-90 mt-0.5">
                            {isServiceCost
                              ? ES.inventory.markUsageCost(fmtBs(mat.pricePerUnit))
                              : ES.inventory.markUsageDetail(mat.defaultUsage, mat.unit)}
                          </span>
                        </button>
                        {mat.quantity > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-700">
                              {isServiceCost
                                ? `${mat.quantity} ${mat.quantity === 1 ? 'uso' : 'usos'}`
                                : `${Math.round(mat.quantity / mat.defaultUsage)} ${Math.round(mat.quantity / mat.defaultUsage) === 1 ? 'uso' : 'usos'} · ${mat.quantity} ${mat.unit}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => onResetUsage(idx)}
                              className="text-red-500 hover:text-red-700 underline"
                            >
                              Reiniciar
                            </button>
                          </div>
                        )}
                        {/* Hide "Ajustar manualmente" for service_cost — quantity is meaningless for fixed-cost items */}
                        {!isServiceCost && (
                          <button
                            type="button"
                            onClick={() => onToggleManualOverride(idx, true)}
                            className="w-full text-xs text-gray-500 hover:text-gray-700 underline py-1"
                          >
                            {ES.inventory.adjustManually}
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => onChangeQuantity(idx, mat.quantity - (mat.unit === 'ml' || mat.unit === 'g' ? 10 : 0.25))}
                            disabled={mat.quantity <= 0}
                            className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-xl font-bold text-gray-700 flex items-center justify-center transition-colors"
                          >
                            −
                          </button>
                          <div className="text-center min-w-[80px]">
                            <input
                              type="number"
                              value={mat.quantity}
                              onChange={(e) => onChangeQuantity(idx, parseFloat(e.target.value) || 0)}
                              step="0.01"
                              min="0"
                              max={mat.maxStock}
                              className="w-20 text-center text-2xl font-bold text-gray-900 border-b-2 border-gray-300 focus:border-blue-500 outline-none bg-transparent"
                            />
                            <p className="text-xs text-gray-400 mt-0.5">{mat.unit}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onChangeQuantity(idx, mat.quantity + (mat.unit === 'ml' || mat.unit === 'g' ? 10 : 0.25))}
                            disabled={mat.quantity >= mat.maxStock}
                            className="w-12 h-12 rounded-xl bg-blue-100 hover:bg-blue-200 disabled:opacity-30 text-xl font-bold text-blue-700 flex items-center justify-center transition-colors"
                          >
                            +
                          </button>
                        </div>
                        {mat.imprecise && mat.defaultUsage > 0 && (
                          <button
                            type="button"
                            onClick={() => onToggleManualOverride(idx, false)}
                            className="w-full text-xs text-blue-600 hover:text-blue-800 underline py-1"
                          >
                            {ES.inventory.backToPreset}
                          </button>
                        )}
                      </>
                    )}

                    <p className="text-center text-sm font-semibold text-gray-700">{fmtBs(mat.totalPrice)}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onAddRow}
        className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-blue-600 font-medium hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        {ES.sessions.addMaterial}
      </button>
    </div>
  );
}
