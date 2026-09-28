import { clampPriority, PRIORITY_DEFAULT } from '../priority';

export default function PriorityInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      className="prio-field"
      type="number"
      min={1}
      max={100}
      step={1}
      inputMode="numeric"
      disabled={disabled}
      value={value}
      placeholder="Приоритет"
      title="Приоритет 1–100, больше — раньше в очереди"
      aria-label="Приоритет"
      onChange={(e) => onChange(clampPriority(Number(e.target.value) || PRIORITY_DEFAULT))}
    />
  );
}
