import { Link } from 'react-router-dom';

export type GanttOrder = {
  id: string;
  number: string;
  createdAt: string;
  dueDate: string;
  status: string;
  pct: number;
  lag: boolean;
  overdue: boolean;
  specs?: string[];
};

const DAY = 86400000;

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function utcMs(raw: string) {
  return dayStart(new Date(raw));
}

function iso(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function weekday(ms: number) {
  const d = new Date(ms).getDay();
  return d === 0 ? 7 : d;
}

const statusRu: Record<string, string> = {
  DRAFT: 'Черновик',
  IN_PROGRESS: 'В работе',
  DONE: 'Готов',
};

export default function OrdersGantt({ orders }: { orders: GanttOrder[] }) {
  if (!orders.length) {
    return <p className="muted">Заказов нет — график появится, когда заведёте срок.</p>;
  }

  const rows = [...orders].sort((a, b) => utcMs(a.createdAt) - utcMs(b.createdAt) || utcMs(a.dueDate) - utcMs(b.dueDate));

  const today = dayStart(new Date());
  let min = today;
  let max = today;
  for (const o of rows) {
    const start = utcMs(o.createdAt);
    const due = utcMs(o.dueDate);
    if (start < min) min = start;
    if (due > max) max = due;
    if (o.overdue) max = Math.max(max, today);
  }
  min -= DAY;
  max += DAY * 2;

  const days: number[] = [];
  for (let cursor = new Date(min); cursor.getTime() <= max; cursor.setDate(cursor.getDate() + 1)) {
    days.push(dayStart(cursor));
  }
  const colW = days.length > 50 ? 22 : days.length > 28 ? 28 : 36;
  const dense = days.length > 28;
  const trackW = days.length * colW;

  function left(ms: number) {
    const idx = days.findIndex((d) => d === dayStart(new Date(ms)));
    return Math.max(0, idx) * colW;
  }
  function width(from: number, to: number) {
    const a = days.findIndex((d) => d === dayStart(new Date(from)));
    const b = days.findIndex((d) => d === dayStart(new Date(to)));
    const i = Math.max(0, a);
    const j = Math.max(i, b);
    return Math.max(colW, (j - i + 1) * colW);
  }

  return (
    <div>
      <div className="gantt-legend">
        <span>
          <i className="gantt-swatch plan" /> план (заведение → срок)
        </span>
        <span>
          <i className="gantt-swatch fill" /> готовность
        </span>
        <span>
          <i className="gantt-swatch slip" /> срыв срока
        </span>
        <span>
          <i className="gantt-swatch today" /> сегодня
        </span>
      </div>
      <div className="gantt-scroll">
        <div className="gantt" style={{ minWidth: 168 + trackW }}>
          <div className="gantt-label gantt-corner">Заказ</div>
          <div className="gantt-track gantt-axis" style={{ width: trackW }}>
            {days.map((ms) => {
              const d = new Date(ms);
              const isToday = ms === today;
              const weekend = weekday(ms) >= 6;
              const show = !dense || weekday(ms) === 1 || d.getDate() === 1 || isToday;
              const monthStart = d.getDate() === 1 || ms === min;
              return (
                <div
                  key={ms}
                  className={`gantt-tick${weekend ? ' weekend' : ''}${isToday ? ' today' : ''}`}
                  style={{ width: colW }}
                  title={d.toLocaleDateString('ru')}
                >
                  {monthStart && (
                    <div className="gantt-month">
                      {d.toLocaleDateString('ru', { month: 'short' })}
                    </div>
                  )}
                  {show ? d.getDate() : ''}
                </div>
              );
            })}
          </div>

          {rows.map((o) => {
            const start = utcMs(o.createdAt);
            const due = utcMs(o.dueDate);
            const cls = o.status === 'DONE' ? 'done' : o.overdue ? 'late' : o.lag ? 'lag' : 'ok';
            const afterDue = dayStart(
              new Date(new Date(due).getFullYear(), new Date(due).getMonth(), new Date(due).getDate() + 1),
            );
            const showSlip = o.overdue && today > due;
            return (
              <div key={o.id} className="gantt-row">
                <Link className="gantt-label" to={`/office/orders/${o.id}`}>
                  <strong>{o.number}</strong>
                  <div className="muted">
                    {o.pct}% · {statusRu[o.status] ?? o.status}
                    <br />
                    до {new Date(o.dueDate).toLocaleDateString('ru')}
                  </div>
                </Link>
                <div className="gantt-track" style={{ width: trackW }}>
                  {days.map((ms) => (
                    <div
                      key={ms}
                      className={`gantt-cell${ms === today ? ' today' : ''}${weekday(ms) >= 6 ? ' weekend' : ''}`}
                      style={{ width: colW }}
                    />
                  ))}
                  <Link
                    to={`/office/orders/${o.id}`}
                    className={`gantt-bar ${cls}`}
                    style={{ left: left(start), width: width(start, due) }}
                    title={`${o.number}: ${iso(start)} → ${iso(due)}, ${o.pct}%`}
                  >
                    <span className="gantt-fill" style={{ width: `${Math.min(100, o.pct)}%` }} />
                    <span className="gantt-bar-text">{o.number}</span>
                  </Link>
                  {showSlip && (
                    <div
                      className="gantt-slip"
                      style={{ left: left(afterDue), width: width(afterDue, today) }}
                      title="Дни после срока"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
