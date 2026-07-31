interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-brand-500' : 'bg-slate-400 dark:bg-slate-600'
      }`}
    >
      <span
        className={`inline-block size-6 shrink-0 rounded-full bg-white shadow-md transition-transform ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
