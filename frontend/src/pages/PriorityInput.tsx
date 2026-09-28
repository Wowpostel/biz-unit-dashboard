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
    <label>
      Приоритет
      <input
        type="number"
        min={1}
        max={100}
        step={1}
        inputMode="numeric"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(clampPriority(Number(e.target.value) || PRIORITY_DEFAULT))}
      />
      <span className="muted">1–100, больше — раньше в очереди</span>
    </label>
  );
}
