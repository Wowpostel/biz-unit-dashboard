import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

type Post = { id: string; name: string };
type StaffKind = 'WORKER' | 'MASTER' | 'SHOP_CHIEF' | 'OFFICE';
type ScheduleKind = 'WEEKDAYS' | 'TWO_TWO' | 'CUSTOM';
type Employee = {
  id: string;
  fullName: string;
  personnelNo: string;
  jobTitle: string;
  staffKind: StaffKind;
  defaultPostId: string | null;
  defaultPost: Post | null;
  isActive: boolean;
  scheduleKind: ScheduleKind;
  weekDays: number[];
  shiftStart: string;
  shiftEnd: string;
  breakMinutes: number;
  cycleWorkDays: number;
  cycleOffDays: number;
  cycleAnchor: string | null;
  scheduleComment: string;
  loginEmail: string | null;
  scheduleLabel: string;
  onShiftToday: boolean | null;
};

type Draft = {
  fullName: string;
  personnelNo: string;
  jobTitle: string;
  staffKind: StaffKind;
  defaultPostId: string;
  isActive: boolean;
  scheduleKind: ScheduleKind;
  weekDays: number[];
  shiftStart: string;
  shiftEnd: string;
  breakMinutes: number;
  cycleWorkDays: number;
  cycleOffDays: number;
  cycleAnchor: string;
  scheduleComment: string;
};

const STAFF: { id: StaffKind; name: string }[] = [
  { id: 'WORKER', name: 'Рабочий' },
  { id: 'MASTER', name: 'Мастер' },
  { id: 'SHOP_CHIEF', name: 'Нач. цеха' },
  { id: 'OFFICE', name: 'ИТР / офис' },
];

const WEEK = [
  { d: 1, name: 'Пн' },
  { d: 2, name: 'Вт' },
  { d: 3, name: 'Ср' },
  { d: 4, name: 'Чт' },
  { d: 5, name: 'Пт' },
  { d: 6, name: 'Сб' },
  { d: 7, name: 'Вс' },
];

function toDraft(e: Employee): Draft {
  return {
    fullName: e.fullName,
    personnelNo: e.personnelNo,
    jobTitle: e.jobTitle ?? '',
    staffKind: e.staffKind || 'WORKER',
    defaultPostId: e.defaultPostId ?? '',
    isActive: e.isActive,
    scheduleKind: e.scheduleKind,
    weekDays: e.weekDays?.length ? e.weekDays : [1, 2, 3, 4, 5],
    shiftStart: e.shiftStart || '08:00',
    shiftEnd: e.shiftEnd || '17:00',
    breakMinutes: e.breakMinutes ?? 60,
    cycleWorkDays: e.cycleWorkDays || 2,
    cycleOffDays: e.cycleOffDays || 2,
    cycleAnchor: e.cycleAnchor ?? '',
    scheduleComment: e.scheduleComment ?? '',
  };
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const canWrite = !!user && ['SUPER', 'ADMIN', 'TECHNOLOGIST', 'DISPATCHER'].includes(user.role);
  const canDelete = !!user && ['SUPER', 'ADMIN'].includes(user.role);
  const [rows, setRows] = useState<Employee[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [fullName, setFullName] = useState('');
  const [personnelNo, setPersonnelNo] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [staffKind, setStaffKind] = useState<StaffKind>('WORKER');
  const [defaultPostId, setDefaultPostId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = async () => {
    const [e, p] = await Promise.all([
      api<Employee[]>('/api/employees'),
      api<Post[]>('/api/posts'),
    ]);
    setRows(e);
    setPosts(p);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    try {
      const created = await api<Employee>('/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          personnelNo,
          jobTitle,
          staffKind,
          defaultPostId: defaultPostId || null,
        }),
      });
      setFullName('');
      setPersonnelNo('');
      setJobTitle('');
      setStaffKind('WORKER');
      setDefaultPostId('');
      await load();
      setEditingId(created.id);
      setDraft(toDraft(created));
      setSaved('Сотрудник создан. Задайте график ниже.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  function openEdit(row: Employee) {
    setError('');
    setSaved('');
    setEditingId(row.id);
    setDraft(toDraft(row));
  }

  async function saveEdit() {
    if (!editingId || !draft) return;
    setError('');
    try {
      await api(`/api/employees/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: draft.fullName,
          personnelNo: draft.personnelNo,
          jobTitle: draft.jobTitle,
          staffKind: draft.staffKind,
          defaultPostId: draft.defaultPostId || null,
          isActive: draft.isActive,
          scheduleKind: draft.scheduleKind,
          weekDays: draft.weekDays,
          shiftStart: draft.shiftStart,
          shiftEnd: draft.shiftEnd,
          breakMinutes: Number(draft.breakMinutes) || 0,
          cycleWorkDays: Number(draft.cycleWorkDays) || 2,
          cycleOffDays: Number(draft.cycleOffDays) || 2,
          cycleAnchor: draft.cycleAnchor || null,
          scheduleComment: draft.scheduleComment,
        }),
      });
      setSaved('Карточка и график сохранены.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Удалить сотрудника? Учётка не удалится, связь снимется.')) return;
    setError('');
    try {
      await api(`/api/employees/${id}`, { method: 'DELETE' });
      if (editingId === id) {
        setEditingId(null);
        setDraft(null);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить');
    }
  }

  function toggleDay(d: number, on: boolean) {
    setDraft((cur) => {
      if (!cur) return cur;
      const set = new Set(cur.weekDays);
      if (on) set.add(d);
      else set.delete(d);
      return { ...cur, weekDays: [...set].sort((a, b) => a - b) };
    });
  }

  const showDays = draft && (draft.scheduleKind === 'WEEKDAYS' || draft.scheduleKind === 'CUSTOM');
  const showCycle = draft?.scheduleKind === 'TWO_TWO';

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Сотрудники</h1>
          <p>
            Рабочие, мастера, нач. цеха и ИТР — в одном списке: тип и должность, не отдельная учётка.
            График говорит, кто должен выйти. Кто вышел по факту — на экране «Смена».
          </p>
        </div>
      </div>
      {canWrite && (
        <form className="form-row" onSubmit={onSubmit}>
          <input placeholder="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <input placeholder="Должность" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          <select value={staffKind} onChange={(e) => setStaffKind(e.target.value as StaffKind)}>
            {STAFF.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input placeholder="Таб. №" value={personnelNo} onChange={(e) => setPersonnelNo(e.target.value)} />
          <select value={defaultPostId} onChange={(e) => setDefaultPostId(e.target.value)}>
            <option value="">Пост не задан</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn">Добавить</button>
        </form>
      )}
      {error && <p className="err">{error}</p>}
      {saved && <p className="muted">{saved}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Должность</th>
            <th>Таб. №</th>
            <th>Пост</th>
            <th>График</th>
            <th>Сегодня</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ outline: editingId === r.id ? '2px solid var(--amber)' : undefined }}>
              <td>
                {r.fullName}
                {!r.isActive && <span className="muted"> · неактивен</span>}
              </td>
              <td>
                {STAFF.find((s) => s.id === r.staffKind)?.name ?? 'Рабочий'}
                {r.jobTitle ? ` · ${r.jobTitle}` : ''}
              </td>
              <td>{r.personnelNo || '—'}</td>
              <td>{r.defaultPost?.name ?? '—'}</td>
              <td>{r.scheduleLabel}</td>
              <td>
                {r.onShiftToday === true ? 'В смене' : r.onShiftToday === false ? 'Выходной' : '—'}
              </td>
              <td>
                {canWrite && (
                  <button className="btn ghost" type="button" onClick={() => openEdit(r)}>
                    Изменить
                  </button>
                )}
                {canDelete && (
                  <button className="btn ghost" type="button" onClick={() => void remove(r.id)}>
                    Удалить
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {draft && editingId && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Карточка и график</h3>
          <div className="form-row">
            <input
              placeholder="ФИО"
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
            />
            <input
              placeholder="Должность"
              value={draft.jobTitle}
              onChange={(e) => setDraft({ ...draft, jobTitle: e.target.value })}
            />
            <select
              value={draft.staffKind}
              onChange={(e) => setDraft({ ...draft, staffKind: e.target.value as StaffKind })}
            >
              {STAFF.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Таб. №"
              value={draft.personnelNo}
              onChange={(e) => setDraft({ ...draft, personnelNo: e.target.value })}
            />
            <select
              value={draft.defaultPostId}
              onChange={(e) => setDraft({ ...draft, defaultPostId: e.target.value })}
            >
              <option value="">Пост не задан</option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="kit-check">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
              Активен
            </label>
          </div>
          <div className="form-row">
            <label>
              Тип графика
              <select
                value={draft.scheduleKind}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    scheduleKind: e.target.value as ScheduleKind,
                    weekDays:
                      e.target.value === 'WEEKDAYS' ? [1, 2, 3, 4, 5] : draft.weekDays,
                  })
                }
              >
                <option value="WEEKDAYS">Пятидневка (пн–пт)</option>
                <option value="TWO_TWO">Цикл (два через два и подобные)</option>
                <option value="CUSTOM">Свои дни недели</option>
              </select>
            </label>
            <label>
              Начало смены
              <input
                type="time"
                step={60}
                value={draft.shiftStart}
                onChange={(e) => setDraft({ ...draft, shiftStart: e.target.value })}
              />
            </label>
            <label>
              Конец смены
              <input
                type="time"
                step={60}
                value={draft.shiftEnd}
                onChange={(e) => setDraft({ ...draft, shiftEnd: e.target.value })}
              />
            </label>
            <label>
              Перерыв, мин
              <input
                type="number"
                min={0}
                step={1}
                value={draft.breakMinutes}
                onChange={(e) => setDraft({ ...draft, breakMinutes: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          {showDays && (
            <div className="kit-ops" style={{ marginBottom: 12 }}>
              {WEEK.map((w) => (
                <label key={w.d} className="kit-check">
                  <input
                    type="checkbox"
                    checked={draft.weekDays.includes(w.d)}
                    onChange={(e) => toggleDay(w.d, e.target.checked)}
                  />
                  {w.name}
                </label>
              ))}
            </div>
          )}
          {showCycle && (
            <div className="form-row">
              <label>
                Рабочих дней подряд
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.cycleWorkDays}
                  onChange={(e) => setDraft({ ...draft, cycleWorkDays: Number(e.target.value) || 1 })}
                />
              </label>
              <label>
                Выходных подряд
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.cycleOffDays}
                  onChange={(e) => setDraft({ ...draft, cycleOffDays: Number(e.target.value) || 1 })}
                />
              </label>
              <label>
                Дата отсчёта цикла
                <input
                  type="date"
                  value={draft.cycleAnchor}
                  onChange={(e) => setDraft({ ...draft, cycleAnchor: e.target.value })}
                />
              </label>
            </div>
          )}
          <textarea
            placeholder="Комментарий к графику (ночные, подмены…)"
            value={draft.scheduleComment}
            onChange={(e) => setDraft({ ...draft, scheduleComment: e.target.value })}
            rows={2}
            style={{ width: '100%', marginBottom: 10 }}
          />
          <button className="btn amber" type="button" onClick={() => void saveEdit()}>
            Сохранить карточку
          </button>
          <button
            className="btn ghost"
            type="button"
            style={{ marginLeft: 8 }}
            onClick={() => {
              setEditingId(null);
              setDraft(null);
            }}
          >
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
}
