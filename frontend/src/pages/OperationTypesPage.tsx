import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';

type Post = { id: string; name: string };
type Row = { id: string; code: string; name: string; defaultPostId: string | null; defaultPost: Post | null };

export default function OperationTypesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [defaultPostId, setDefaultPostId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setRows(await api<Row[]>('/api/operation-types'));
    setPosts(await api<Post[]>('/api/posts'));
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/api/operation-types', {
        method: 'POST',
        body: JSON.stringify({ code, name, defaultPostId: defaultPostId || null }),
      });
      setCode('');
      setName('');
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
          <h1>Виды операций</h1>
          <p>Справочник для набора технологии. Пост по умолчанию подставляется, когда набор копируют на деталь.</p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={defaultPostId} onChange={(e) => setDefaultPostId(e.target.value)}>
          <option value="">Пост по умолчанию…</option>
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
            <th>Код</th>
            <th>Название</th>
            <th>Пост по умолчанию</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.code}</td>
              <td>{r.name}</td>
              <td>{r.defaultPost?.name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
