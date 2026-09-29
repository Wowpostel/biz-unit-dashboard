import { useEffect, useState } from 'react';
import { api } from '../api';
import OrdersGantt, { GanttOrder } from './OrdersGantt';

type Overview = { orders: GanttOrder[] };

export default function PlanPage() {
  const [orders, setOrders] = useState<GanttOrder[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Overview>('/api/dispatch/overview')
      .then((d) => setOrders(d.orders))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="err">{error}</p>;
  if (!orders) return <p>Собираем график…</p>;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>График заказов</h1>
          <p>
            Календарный таймлайн по всем заказам: полоса — от заведения до срока, заливка — готовность,
            штрих после срока — срыв. Сверху — высокий приоритет (1–100). Это не оптимизатор расписания,
            а картина «кто когда должен быть готов».
          </p>
        </div>
      </div>
      <div className="card">
        <OrdersGantt orders={orders} />
      </div>
    </div>
  );
}
