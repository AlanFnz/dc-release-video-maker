import type { ExportState } from '../lib/useExport'

interface ExportPanelProps {
  state: ExportState
  canExport: boolean
  onExport: () => void
  onReset: () => void
}

export function ExportPanel({ state, canExport, onExport, onReset }: ExportPanelProps) {
  const busy = state.status === 'recording' || state.status === 'encoding'

  return (
    <div className="flex flex-col gap-3">
      {state.status === 'error' && (
        <p className="rounded bg-red-950 border border-red-800 px-3 py-2 text-xs text-red-300">
          {state.error}
        </p>
      )}

      {state.status === 'done' && (
        <p className="rounded bg-green-950 border border-green-800 px-3 py-2 text-xs text-green-300">
          exported successfully
        </p>
      )}

      {busy && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-neutral-500">
            <span>{state.status === 'recording' ? 'rendering…' : 'encoding…'}</span>
            <span>{Math.round(state.progress * 100)}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100"
              style={{ width: `${state.progress * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onExport}
          disabled={!canExport || busy}
          className="flex-1 rounded bg-white text-black text-sm font-medium py-2 px-4 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? '…' : 'export mp4'}
        </button>

        {(busy || state.status === 'done' || state.status === 'error') && (
          <button
            onClick={onReset}
            className="rounded border border-neutral-700 text-neutral-400 text-sm py-2 px-3 hover:border-neutral-500 transition-colors"
          >
            reset
          </button>
        )}
      </div>
    </div>
  )
}
