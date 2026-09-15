import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

type WorkItem = {
  id: string;
  qrCode: string;
  designation: string;
  name: string;
  pieceIndex: number;
  status: string;
  currentOperation: { name: string; post: { name: string } | null } | null;
};

type Launch = {
  id: string;
  qty: number;
  launchedAt: string;
  spec: { code: string };
  _count?: { workItems: number };
  workItems?: WorkItem[];
};

type Order = {
  id: string;
  number: string;
  dueDate: string;
  status: string;
  comment: string;
  lines: { specId: string; spec: { id: string; code: string; name: string }; qty: number }[];
  launches: Launch[];
  workItems: WorkItem[];
};

type SpecDetail = {
  items: { id: string; designation: string; name: string; kind: string; operations: unknown[] }[];
};

const statusRu: Record<string, string> = {
  DRAFT: 'Черновик',
  IN_PROGRESS: 'В работе',
  DONE: 'Готов',
  QUEUED: 'В очереди',
};

export default function OrderPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canLaunch = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const [order, setOrder] = useState<Order | null>(null);
  const [specId, setSpecId] = useState('');
  const [qty, setQty] = useState(1);
  const [extraItem, setExtraItem] = useState('');
  const [extraCount, setExtraCount] = useState(1);
  const [items, setItems] = useState<SpecDetail['items']>([]);
  const [error, setError] = useState('');

  async function load() {
    const o = await api<Order>(`/api/orders/${id}`);
    setOrder(o);
    const first = o.lines[0]?.specId ?? '';
    setSpecId(first);
    if (first) {
      const spec = await api<SpecDetail>(`/api/specs/${first}`);
      setItems(spec.items.filter((i) => i.kind !== 'MATERIAL' && i.operations.length));
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function launch(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const extraPieces =
        extraItem && extraCount > 0 ? [{ specItemId: extraItem, count: extraCount }] : [];
      const launchRow = await api<Launch>(`/api/orders/${id}/launches`, {
        method: 'POST',
        body: JSON.stringify({ specId, qty: Number(qty), extraPieces }),
      });
      window.location.href = `/office/launches/${launchRow.id}/print`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  if (!order) return <p>Загрузка…</p>;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Заказ {order.number}</h1>
          <p>
            Срок {new Date(order.dueDate).toLocaleDateString('ru')} · {statusRu[order.status]}
          </p>
        </div>
        <Link to="/office/orders" className="btn ghost">
          К списку
        </Link>
      </div>

      <div className="card">
        <h3>Состав заказа</h3>
        <ul>
          {order.lines.map((l) => (
            <li key={l.specId}>
              {l.spec.code} {l.spec.name} — {l.qty} шт.
            </li>
          ))}
        </ul>
      </div>

      {canLaunch && (
      <div className="card">
        <h3>Запуск в работу</h3>
        <p className="muted">
          В работу уходит количество N спецификации (разузлование BOM). Дополнительно можно добавить
          поштучные детали.
        </p>
        <form className="form-row" onSubmit={launch}>
          <select value={specId} onChange={(e) => setSpecId(e.target.value)}>
            {order.lines.map((l) => (
              <option key={l.specId} value={l.specId}>
                {l.spec.code}
              </option>
            ))}
          </select>
          <label>
            N комплектов
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </label>
          <select value={extraItem} onChange={(e) => setExtraItem(e.target.value)}>
            <option value="">Без доп. штук</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.designation} {i.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={extraCount}
            onChange={(e) => setExtraCount(Number(e.target.value))}
            title="Поштучно дополнительно"
          />
          <button className="btn amber">Запустить и печатать QR</button>
        </form>
        {error && <p className="err">{error}</p>}
      </div>
      )}

      <div className="card">
        <h3>Запуски</h3>
        {order.launches.map((l) => (
          <div key={l.id}>
            {new Date(l.launchedAt).toLocaleString('ru')} — {l.spec.code} × {l.qty}{' '}
            <Link to={`/office/launches/${l.id}/print`}>Печать QR</Link>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Детали в работе</h3>
        <table className="data">
          <thead>
            <tr>
              <th>QR</th>
              <th>Деталь</th>
              <th>Шт.</th>
              <th>Текущая операция</th>
              <th>Пост</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {order.workItems.map((w) => (
              <tr key={w.id}>
                <td>
                  <code>{w.qrCode}</code>
                </td>
                <td>
                  {w.designation} {w.name}
                </td>
                <td>{w.pieceIndex}</td>
                <td>{w.currentOperation?.name ?? 'готово'}</td>
                <td>{w.currentOperation?.post?.name ?? '—'}</td>
                <td>{statusRu[w.status] ?? w.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
