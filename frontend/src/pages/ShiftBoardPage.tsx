import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';

type StaffKind = 'WORKER' | 'MASTER' | 'SHOP_CHIEF' | 'OFFICE';
type Status = 'PLANNED' | 'SHOWED' | 'NO_SHOW' | 'SUBSTITUTE' | 'WALK_IN';

type Row = {
  id: string;
  employeeId: string;
  fullName: string;
  personnelNo: string;
  jobTitle: string;
  staffKind: StaffKind;
  postName: string;
  shiftStart: string;
  shiftEnd: string;
  scheduled: boolean;
  status: Status;
  actualEmployeeId: string | null;
  actualName: string | null;
  note: string;
};

type Board = {
  date: string;
  counts: { planned: number; here: number; covered: number; missing: number; unmarked: number };
  groups: { shift: string; items: Row[] }[];
  people: { id: string; fullName: string; staffKind: StaffKind; jobTitle: string }[];
};

const kindRu: Record<StaffKind, string> = {
  SHOP_CHIEF: 'Нач. цеха',
  MASTER: 'Мастер',
  WORKER: 'Рабочий',
  OFFICE: 'ИТР',
};

const statusRu: Record<Status, string> = {
  PLANNED: 'не отмечен',
  SHOWED: 'явка',
  NO_SHOW: 'нет',
  SUBSTITUTE: 'подмена',
  WALK_IN: 'вне графика',
};

function isoDay(offset = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dateRu(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function ShiftBoardPage() {
  const today = isoDay(0);
  const tomorrow = isoDay(1);
  const [date, setDate] = useState(today);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const [walkId, setWalkId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError('');
    api<Board>(`/api/dispatch/shift?date=${date}`)
      .then(setBoard)
      .catch((e) => setError(e.message));
  }, [date]);

  async function mark(employeeId: string, status: Status, actualEmployeeId?: string) {
    setError('');
    setBusy(true);
    try {
      const next = await api<Board>('/api/dispatch/shift/mark', {
        method: 'POST',
        body: JSON.stringify({ date, employeeId, status, actualEmployeeId }),
      });
      setBoard(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отметить');
    } finally {
      setBusy(false);
    }
  }

  async function walkIn(ev: FormEvent) {
    ev.preventDefault();
    if (!walkId) return;
    setError('');
    setBusy(true);
    try {
      const next = await api<Board>('/api/dispatch/shift/walk-in', {
        method: 'POST',
        body: JSON.stringify({ date, employeeId: walkId }),
      });
      setBoard(next);
      setWalkId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить');
    } finally {
      setBusy(false);
    }
  }

  if (error && !board) return <p className="err">{error}</p>;
  if (!board) return <p>Собираем смену…</p>;

  const lookingTomorrow = date === tomorrow;
  const lookingToday = date === today;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Смена и явка</h1>
          <p>
            {lookingTomorrow
              ? 'План на завтра: кто должен выйти и в какую смену. Явку отмечайте в день смены.'
              : 'Кто по графику должен выйти и кто вышел по факту. Подмена — выберите, кто пришёл вместо.'}
          </p>
        </div>
      </div>
      <div className="form-row">
        <button
          className={lookingToday ? 'btn amber' : 'btn'}
          type="button"
          onClick={() => setDate(today)}
        >
          Сегодня
        </button>
        <button
          className={lookingTomorrow ? 'btn amber' : 'btn'}
          type="button"
          onClick={() => setDate(tomorrow)}
        >
          Завтра
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <span className="muted" style={{ alignSelf: 'center' }}>
          {dateRu(date)}
        </span>
      </div>
      <div className="grid-3">
        <div className="stat">
          <span>По графику</span>
          <b>{board.counts.planned}</b>
        </div>
        <div className="stat">
          <span>Вышли / подмены</span>
          <b>
            {board.counts.here} / {board.counts.covered}
          </b>
        </div>
        <div className="stat">
          <span>Не отмечено / нет</span>
          <b>
            {board.counts.unmarked} / {board.counts.missing}
          </b>
        </div>
      </div>
      {error && <p className="err">{error}</p>}

      {board.groups.map((g) => (
        <div className="card" key={g.shift} style={{ marginTop: 16 }}>
          <h2>Смена {g.shift}</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Кто</th>
                <th>Роль</th>
                <th>Пост</th>
                <th>План</th>
                <th>Явка</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((r) => (
                <tr
                  key={r.id}
                  className={
                    r.status === 'NO_SHOW' ? 'overdue' : r.status === 'SHOWED' || r.status === 'WALK_IN' ? 'ok' : ''
                  }
                >
                  <td>
                    <strong>{r.fullName}</strong>
                    <div className="muted">
                      {r.jobTitle || r.personnelNo}
                      {r.actualName ? ` → вышел ${r.actualName}` : ''}
                    </div>
                  </td>
                  <td>{kindRu[r.staffKind] ?? r.staffKind}</td>
                  <td>{r.postName}</td>
                  <td>
                    {r.scheduled ? 'По графику' : 'Вне графика'}
                    <div>
                      <span
                        className={`tag ${
                          r.status === 'SHOWED' || r.status === 'WALK_IN'
                            ? 'good'
                            : r.status === 'NO_SHOW'
                              ? 'bad'
                              : r.status === 'SUBSTITUTE'
                                ? 'warn'
                                : ''
                        }`}
                      >
                        {statusRu[r.status]}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="att-row">
                      <button
                        className={`att-btn ${r.status === 'SHOWED' || r.status === 'WALK_IN' ? 'on' : ''}`}
                        type="button"
                        disabled={busy}
                        onClick={() => void mark(r.employeeId, 'SHOWED')}
                      >
                        Явка
                      </button>
                      <button
                        className={`att-btn ${r.status === 'NO_SHOW' ? 'off' : ''}`}
                        type="button"
                        disabled={busy}
                        onClick={() => void mark(r.employeeId, 'NO_SHOW')}
                      >
                        Нет
                      </button>
                      <select
                        value={r.actualEmployeeId ?? ''}
                        disabled={busy}
                        onChange={(e) => {
                          const id = e.target.value;
                          if (id) void mark(r.employeeId, 'SUBSTITUTE', id);
                        }}
                      >
                        <option value="">Кто вышел вместо…</option>
                        {board.people
                          .filter((p) => p.id !== r.employeeId)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.fullName}
                              {p.jobTitle ? ` · ${p.jobTitle}` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {!board.groups.length && <p className="muted">На эту дату по графикам никто не запланирован.</p>}

      <form className="card form-row" onSubmit={walkIn} style={{ marginTop: 16 }}>
        <span>Вышел вне графика:</span>
        <select value={walkId} onChange={(e) => setWalkId(e.target.value)} disabled={busy}>
          <option value="">Сотрудник…</option>
          {board.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
              {p.jobTitle ? ` · ${p.jobTitle}` : ''}
            </option>
          ))}
        </select>
        <button className="btn amber" disabled={busy || !walkId}>
          Добавить явку
        </button>
      </form>
    </div>
  );
}
