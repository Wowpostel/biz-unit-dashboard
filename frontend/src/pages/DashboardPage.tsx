import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

type Overview = {
  generatedAt: string;
  orders: {
    id: string;
    number: string;
    dueDate: string;
    status: string;
    specs: string[];
    pct: number;
    expectedPct: number;
    lag: boolean;
    overdue: boolean;
    lagDays: number;
    inWork: number;
    doneItems: number;
  }[];
  onMachines: {
    postName: string;
    items: {
      qrCode: string;
      designation: string;
      name: string;
      operation: string;
      status: string;
      orderNumber: string;
      operatorName: string | null;
    }[];
  }[];
  overdue: {
    qrCode: string;
    designation: string;
    name: string;
    orderNumber: string;
    dueDate: string;
    currentOp: string | null;
    postName: string | null;
  }[];
};

const statusRu: Record<string, string> = {
  DRAFT: 'Черновик',
  IN_PROGRESS: 'В работе',
  DONE: 'Готов',
};

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Overview>('/api/dispatch/overview').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p>Загрузка дашборда…</p>;

  const lagCount = data.orders.filter((o) => o.lag).length;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Диспетчер</h1>
          <p>Своевременность заказов, что сейчас на станках, просрочка.</p>
        </div>
      </div>
      <div className="grid-3">
        <div className="stat">
          <span>Заказов</span>
          <b>{data.orders.length}</b>
        </div>
        <div className="stat">
          <span>С отставанием</span>
          <b>{lagCount}</b>
        </div>
        <div className="stat">
          <span>Просроченных деталей</span>
          <b>{data.overdue.length}</b>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Заказы</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Срок</th>
              <th>Состав</th>
              <th>Готовность</th>
              <th>В работе</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((o) => (
              <tr key={o.id} className={o.overdue ? 'overdue' : o.lag ? 'lag' : ''}>
                <td>
                  <Link to={`/office/orders/${o.id}`}>{o.number}</Link>
                </td>
                <td>{new Date(o.dueDate).toLocaleDateString('ru')}</td>
                <td>{o.specs.join(', ')}</td>
                <td>
                  {o.pct}% {o.lag && <span className="tag warn">отстаёт</span>}
                  {o.overdue && <span className="tag bad">просрочен {o.lagDays} дн.</span>}
                </td>
                <td>
                  {o.inWork} / {o.inWork + o.doneItems}
                </td>
                <td>{statusRu[o.status] ?? o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Сейчас на станках</h2>
          {data.onMachines.map((p) => (
            <div key={p.postName} style={{ marginBottom: 16 }}>
              <strong>{p.postName}</strong>
              <table className="data">
                <tbody>
                  {p.items.map((it) => (
                    <tr key={it.qrCode + it.operation}>
                      <td>
                        <code>{it.qrCode}</code>
                        <div className="muted">
                          {it.designation} {it.name}
                        </div>
                      </td>
                      <td>{it.operation}</td>
                      <td>{it.orderNumber}</td>
                      <td>{it.status === 'IN_WORK' ? it.operatorName ?? 'в работе' : 'ожидает'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {!data.onMachines.length && <p className="muted">На постах пусто.</p>}
        </div>
        <div className="card">
          <h2>Просроченные детали</h2>
          <table className="data">
            <thead>
              <tr>
                <th>QR</th>
                <th>Деталь</th>
                <th>Заказ</th>
                <th>Пост</th>
              </tr>
            </thead>
            <tbody>
              {data.overdue.map((d) => (
                <tr key={d.qrCode} className="overdue">
                  <td>
                    <code>{d.qrCode}</code>
                  </td>
                  <td>
                    {d.designation} {d.name}
                    <div className="muted">{d.currentOp}</div>
                  </td>
                  <td>{d.orderNumber}</td>
                  <td>{d.postName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.overdue.length && <p className="muted">Просрочки нет.</p>}
        </div>
      </div>
    </div>
  );
}
