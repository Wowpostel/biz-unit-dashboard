import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

type Spec = { id: string; code: string; name: string };
type Order = {
  id: string;
  number: string;
  dueDate: string;
  status: string;
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
  const [error, setError] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    api<Order[]>('/api/orders').then(setRows).catch((e) => setError(e.message));
    api<Spec[]>('/api/specs').then((s) => {
      setSpecs(s);
      if (s[0]) setSpecId(s[0].id);
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
          <p>Номенклатура, количество, срок. Запуск — из карточки заказа.</p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="Номер" value={number} onChange={(e) => setNumber(e.target.value)} required />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        <select value={specId} onChange={(e) => setSpecId(e.target.value)}>
          {specs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} {s.name}
            </option>
          ))}
        </select>
        <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        <button className="btn">Создать заказ</button>
      </form>
      {error && <p className="err">{error}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>Номер</th>
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
