import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { PRIORITY_DEFAULT } from '../priority';
import PriorityInput from './PriorityInput';

type Spec = { id: string; code: string; name: string; priority?: number };
type Order = {
  id: string;
  number: string;
  dueDate: string;
  status: string;
  priority?: number;
  lines: { spec: Spec; qty: number }[];
  progress: { pct: number };
};

const statusRu: Record<string, string> = {
  DRAFT: 'Черновик',
  IN_PROGRESS: 'В работе',
  DONE: 'Готов',
};

export default function OrdersPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [number, setNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [specId, setSpecId] = useState('');
  const [qty, setQty] = useState(1);
  const [priority, setPriority] = useState(PRIORITY_DEFAULT);
  const [error, setError] = useState('');
  const nav = useNavigate();

  function applySpec(id: string, list: Spec[]) {
    setSpecId(id);
    const spec = list.find((s) => s.id === id);
    if (spec) setPriority(spec.priority ?? PRIORITY_DEFAULT);
  }

  useEffect(() => {
    api<Order[]>('/api/orders').then(setRows).catch((e) => setError(e.message));
    api<Spec[]>('/api/specs').then((s) => {
      setSpecs(s);
      if (s[0]) applySpec(s[0].id, s);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const order = await api<Order>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          number,
          dueDate: new Date(dueDate).toISOString(),
          priority,
          lines: [{ specId, qty: Number(qty) }],
        }),
      });
      nav(`/office/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Заказы</h1>
          <p>
            Номенклатура, количество, срок и приоритет 1–100. При выборе спецификации подставляется её
            приоритет — диспетчер может поднять заказ выше в очереди цеха. Запуск — из карточки заказа.
          </p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="Номер" value={number} onChange={(e) => setNumber(e.target.value)} required />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        <select value={specId} onChange={(e) => applySpec(e.target.value, specs)}>
          {specs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} {s.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
        />
        <PriorityInput value={priority} onChange={setPriority} />
        <button className="btn">Создать заказ</button>
      </form>
      {error && <p className="err">{error}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>Номер</th>
            <th>Приоритет</th>
            <th>Срок</th>
            <th>Состав</th>
            <th>Готовность</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>
                <Link to={`/office/orders/${o.id}`}>{o.number}</Link>
              </td>
              <td>
                <span className={(o.priority ?? 50) >= 80 ? 'tag prio hot' : 'tag prio'}>
                  {o.priority ?? 50}
                </span>
              </td>
              <td>{new Date(o.dueDate).toLocaleDateString('ru')}</td>
              <td>{o.lines.map((l) => `${l.spec.code} × ${l.qty}`).join(', ')}</td>
              <td>{o.progress.pct}%</td>
              <td>{statusRu[o.status] ?? o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
