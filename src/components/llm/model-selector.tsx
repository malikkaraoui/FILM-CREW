'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  buildModelOptions,
  findModelDetail,
  getModelDetailsForMode,
  getModelPlaceholder,
  type LlmCatalog,
  type LlmCatalogProvider,
} from '@/lib/llm/catalog'
import type { LlmMode } from '@/types/run'

export type ModelSelectorProps = {
  id: string
  mode: LlmMode
  value: string
  onChange: (modelId: string) => void
  catalog: LlmCatalog
  refreshingProvider: LlmCatalogProvider | null
  onRefresh: () => void
  label?: string
  disabled?: boolean
  helperText?: ReactNode
  className?: string
}

export function ModelSelector({
  id,
  mode,
  value,
  onChange,
  catalog,
  refreshingProvider,
  onRefresh,
  label = 'Modèle',
  disabled = false,
  helperText,
  className,
}: ModelSelectorProps) {
  const options = buildModelOptions(getModelDetailsForMode(catalog, mode), value)
  const selectedDetail = findModelDetail(catalog, mode, value)
  const isRefreshing = refreshingProvider === mode
  const error =
    mode === 'local'
      ? catalog.localError
      : mode === 'openrouter'
        ? catalog.openRouterError
        : null

  return (
    <div className={className} data-slot="model-selector">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={disabled || isRefreshing}
          data-testid="model-selector-refresh"
        >
          {isRefreshing ? 'Rafraîchissement...' : 'Rafraîchir'}
        </Button>
      </div>

      {options.length > 0 ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="model-selector-select"
        >
          {options.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={getModelPlaceholder(mode)}
          disabled={disabled}
          className="mt-1"
          data-testid="model-selector-input"
        />
      )}

      {selectedDetail?.description && (
        <p
          className="mt-1 text-xs text-muted-foreground"
          data-testid="model-selector-description"
        >
          {selectedDetail.description}
        </p>
      )}

      {error && (
        <div
          className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          data-testid="model-selector-error"
        >
          {error}
        </div>
      )}

      {helperText && (
        <p
          className="mt-1 text-xs text-muted-foreground"
          data-testid="model-selector-helper"
        >
          {helperText}
        </p>
      )}
    </div>
  )
}
