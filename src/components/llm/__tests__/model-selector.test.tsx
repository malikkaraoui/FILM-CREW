// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ModelSelector } from '../model-selector'
import { EMPTY_LLM_CATALOG, type LlmCatalog } from '@/lib/llm/catalog'

afterEach(() => cleanup())

function makeCatalog(patch: Partial<LlmCatalog> = {}): LlmCatalog {
  return { ...EMPTY_LLM_CATALOG, ...patch }
}

describe('ModelSelector', () => {
  it('rend un <select> quand des options sont disponibles', () => {
    const catalog = makeCatalog({
      localModels: ['qwen2.5:7b', 'mistral:latest'],
      localModelDetails: [
        { id: 'qwen2.5:7b', label: 'qwen2.5:7b · 7B · 4.2 GB', description: 'qwen' },
        { id: 'mistral:latest', label: 'mistral:latest · 7B', description: 'mistral' },
      ],
    })

    render(
      <ModelSelector
        id="m"
        mode="local"
        value="qwen2.5:7b"
        onChange={() => {}}
        catalog={catalog}
        refreshingProvider={null}
        onRefresh={() => {}}
      />,
    )

    const select = screen.getByTestId('model-selector-select') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe('qwen2.5:7b')
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.queryByTestId('model-selector-input')).not.toBeInTheDocument()
  })

  it('rend un <input> fallback avec le placeholder de getModelPlaceholder(mode) quand la liste est vide', () => {
    render(
      <ModelSelector
        id="m"
        mode="openrouter"
        value=""
        onChange={() => {}}
        catalog={makeCatalog()}
        refreshingProvider={null}
        onRefresh={() => {}}
      />,
    )

    const input = screen.getByTestId('model-selector-input') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.placeholder).toBe('nvidia/nemotron-3-nano-30b-a3b:free')
    expect(screen.queryByTestId('model-selector-select')).not.toBeInTheDocument()
  })

  it('affiche l\'état de rafraîchissement quand refreshingProvider correspond au mode', () => {
    render(
      <ModelSelector
        id="m"
        mode="local"
        value=""
        onChange={() => {}}
        catalog={makeCatalog()}
        refreshingProvider="local"
        onRefresh={() => {}}
      />,
    )

    const refreshButton = screen.getByTestId('model-selector-refresh') as HTMLButtonElement
    expect(refreshButton).toBeDisabled()
    expect(refreshButton.textContent).toContain('Rafraîchissement')
  })

  it('affiche l\'erreur normalisée correspondant au mode actif', () => {
    const catalog = makeCatalog({
      localError: 'Ollama non joignable',
      openRouterError: 'OpenRouter timeout',
    })

    const { rerender } = render(
      <ModelSelector
        id="m"
        mode="local"
        value=""
        onChange={() => {}}
        catalog={catalog}
        refreshingProvider={null}
        onRefresh={() => {}}
      />,
    )

    expect(screen.getByTestId('model-selector-error')).toHaveTextContent('Ollama non joignable')

    rerender(
      <ModelSelector
        id="m"
        mode="cloud"
        value=""
        onChange={() => {}}
        catalog={catalog}
        refreshingProvider={null}
        onRefresh={() => {}}
      />,
    )

    expect(screen.queryByTestId('model-selector-error')).not.toBeInTheDocument()

    rerender(
      <ModelSelector
        id="m"
        mode="openrouter"
        value=""
        onChange={() => {}}
        catalog={catalog}
        refreshingProvider={null}
        onRefresh={() => {}}
      />,
    )

    expect(screen.getByTestId('model-selector-error')).toHaveTextContent('OpenRouter timeout')
  })

  it('affiche la description du modèle sélectionné', () => {
    const catalog = makeCatalog({
      localModels: ['qwen2.5:7b'],
      localModelDetails: [
        { id: 'qwen2.5:7b', label: 'qwen2.5:7b · 7B', description: 'famille qwen · maj 2026-04-28' },
      ],
    })

    render(
      <ModelSelector
        id="m"
        mode="local"
        value="qwen2.5:7b"
        onChange={() => {}}
        catalog={catalog}
        refreshingProvider={null}
        onRefresh={() => {}}
      />,
    )

    expect(screen.getByTestId('model-selector-description')).toHaveTextContent(
      'famille qwen · maj 2026-04-28',
    )
  })

  it('appelle onChange et onRefresh aux bons endroits', () => {
    const onChange = vi.fn()
    const onRefresh = vi.fn()
    const catalog = makeCatalog({
      localModels: ['qwen2.5:7b', 'mistral:latest'],
      localModelDetails: [
        { id: 'qwen2.5:7b', label: 'qwen2.5:7b' },
        { id: 'mistral:latest', label: 'mistral:latest' },
      ],
    })

    render(
      <ModelSelector
        id="m"
        mode="local"
        value="qwen2.5:7b"
        onChange={onChange}
        catalog={catalog}
        refreshingProvider={null}
        onRefresh={onRefresh}
      />,
    )

    fireEvent.change(screen.getByTestId('model-selector-select'), {
      target: { value: 'mistral:latest' },
    })
    expect(onChange).toHaveBeenCalledWith('mistral:latest')

    fireEvent.click(screen.getByTestId('model-selector-refresh'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
