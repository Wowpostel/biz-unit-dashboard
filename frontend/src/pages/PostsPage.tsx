import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';

type Post = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
};

export default function PostsPage() {
  const [rows, setRows] = useState<Post[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const load = () => api<Post[]>('/api/posts').then(setRows);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ code, name, description }),
      });
      setCode('');
      setName('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function toggle(p: Post) {
    await api(`/api/posts/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    await load();
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Посты</h1>
          <p>Станки и рабочие места цеха.</p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Комментарий" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="btn">Добавить</button>
      </form>
      {error && <p className="err">{error}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>Код</th>
            <th>Название</th>
            <th>Комментарий</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.code}</td>
              <td>{p.name}</td>
              <td>{p.description}</td>
              <td>
                <button className="btn ghost" onClick={() => toggle(p)}>
                  {p.isActive ? 'Выключить' : 'Включить'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
