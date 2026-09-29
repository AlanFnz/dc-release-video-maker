interface TextFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}

export function TextField({ label, value, onChange, placeholder, disabled }: TextFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-30' : ''}`}>
      <label className="text-xs uppercase tracking-widest text-neutral-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
      />
    </div>
  )
}
