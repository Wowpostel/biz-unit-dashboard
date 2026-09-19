import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

type Post = { id: string; name: string; code: string };
type Eq = {
  id: string;
  code: string;
  name: string;
  inventoryNo: string;
  postId: string | null;
  post: Post | null;
  isActive: boolean;
};

export default function EquipmentPage() {
  const [rows, setRows] = useState<Eq[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [inventoryNo, setInventoryNo] = useState('');
  const [postId, setPostId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setRows(await api<Eq[]>('/api/equipment'));
    setPosts(await api<Post[]>('/api/posts'));
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/api/equipment', {
        method: 'POST',
        body: JSON.stringify({
          code,
          name,
          inventoryNo,
          postId: postId || null,
        }),
      });
      setCode('');
      setName('');
      setInventoryNo('');
      setPostId('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function assign(eq: Eq, nextPost: string) {
    await api(`/api/equipment/${eq.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ postId: nextPost || null }),
    });
    await load();
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Оборудование</h1>
          <p>
            Станки и единицы учёта. Пост — отдельный справочник: к{' '}
            <Link to="/office/posts">посту</Link> крепят несколько станков.
          </p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Название станка" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Инв. №" value={inventoryNo} onChange={(e) => setInventoryNo(e.target.value)} />
        <select value={postId} onChange={(e) => setPostId(e.target.value)}>
          <option value="">Пост не назначен</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="btn">Добавить станок</button>
      </form>
      {error && <p className="err">{error}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>Код</th>
            <th>Название</th>
            <th>Инв. №</th>
            <th>Пост</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.code}</td>
              <td>{r.name}</td>
              <td>{r.inventoryNo}</td>
              <td>
                <select value={r.postId ?? ''} onChange={(e) => assign(r, e.target.value)}>
                  <option value="">—</option>
                  {posts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
