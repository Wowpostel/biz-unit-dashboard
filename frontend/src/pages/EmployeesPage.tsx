import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';

type Post = { id: string; name: string };
type Employee = {
  id: string;
  fullName: string;
  personnelNo: string;
  defaultPostId: string | null;
  defaultPost: Post | null;
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [fullName, setFullName] = useState('');
  const [personnelNo, setPersonnelNo] = useState('');
  const [defaultPostId, setDefaultPostId] = useState('');
  const [error, setError] = useState('');

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
    try {
      await api('/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          personnelNo,
          defaultPostId: defaultPostId || null,
        }),
      });
      setFullName('');
      setPersonnelNo('');
      setDefaultPostId('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Сотрудники</h1>
          <p>ФИО и пост по умолчанию. На терминале оператор всё равно выбирает пост смены.</p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
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
      {error && <p className="err">{error}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Таб. №</th>
            <th>Пост</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.fullName}</td>
              <td>{r.personnelNo}</td>
              <td>{r.defaultPost?.name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
