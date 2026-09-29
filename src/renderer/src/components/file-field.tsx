export interface FileFilter {
  name: string
  extensions: string[]
}

interface FileFieldProps {
  label: string
  accept: FileFilter[]
  value: string | null
  onChange: (path: string) => void
  // when provided, a clear button is shown while a file is selected
  onClear?: () => void
  clearLabel?: string
  placeholder?: string
  hint?: string
  previewSrc?: string | null
  previewShape?: 'circle' | 'square'
}

export function FileField({ label, accept, value, onChange, onClear, clearLabel, placeholder, hint, previewSrc, previewShape = 'square' }: FileFieldProps) {
  async function handleClick() {
    const path = await window.api.openFile(accept)
    if (path) onChange(path)
  }

  const displayName = value ? value.split(/[\\/]/).pop() ?? value : null

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-widest text-neutral-500">{label}</label>
      <div className="flex items-center gap-2">
        {previewSrc && (
          <img
            src={previewSrc}
            alt=""
            className="shrink-0 object-cover bg-neutral-800"
            style={{
              width: 36,
              height: 36,
              borderRadius: previewShape === 'circle' ? '50%' : 4,
            }}
          />
        )}
        <button
          onClick={handleClick}
          className="flex-1 flex items-center gap-3 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-left hover:border-neutral-500 transition-colors min-w-0"
        >
          <span className="text-neutral-400 shrink-0">↑</span>
          <span className={`truncate ${displayName ? 'text-neutral-200' : 'text-neutral-600'}`}>
            {displayName ?? placeholder ?? 'choose file…'}
          </span>
        </button>
        {onClear && value && (
          <button
            onClick={onClear}
            title={clearLabel}
            aria-label={clearLabel}
            className="shrink-0 w-8 self-stretch rounded border border-neutral-700 text-neutral-400 text-sm hover:border-neutral-500 hover:text-neutral-200 transition-colors"
          >
            ×
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-neutral-600">{hint}</p>}
    </div>
  )
}
