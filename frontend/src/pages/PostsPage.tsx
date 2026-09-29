import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

type Equipment = { id: string; code: string; name: string; inventoryNo: string; isActive: boolean };
type Post = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  equipment: Equipment[];
};

export default function PostsPage() {
  const [rows, setRows] = useState<Post[]>([]);
  const [allEq, setAllEq] = useState<Equipment[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [attach, setAttach] = useState<Record<string, string[]>>({});

  const load = async () => {
    const [p, e] = await Promise.all([
      api<Post[]>('/api/posts'),
      api<(Equipment & { post: { id: string } | null })[]>('/api/equipment'),
    ]);
    setRows(p);
    setAllEq(e);
    setAttach(Object.fromEntries(p.map((post) => [post.id, post.equipment.map((x) => x.id)])));
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
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

  async function saveAttach(postId: string) {
    await api(`/api/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify({ equipmentIds: attach[postId] ?? [] }),
    });
    await load();
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Посты</h1>
          <p>
            Участок цеха. Станки заводятся отдельно в{' '}
            <Link to="/office/equipment">оборудовании</Link> и крепятся к посту — у одного поста несколько единиц.
          </p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Комментарий" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="btn">Добавить пост</button>
      </form>
      {error && <p className="err">{error}</p>}
      {rows.map((p) => (
        <div className="card" key={p.id}>
          <strong>
            {p.code} · {p.name}
          </strong>
          <div className="muted">{p.description}</div>
          <div className="kit-ops" style={{ marginTop: 10 }}>
            {allEq.map((eq) => (
              <label key={eq.id} className="kit-check">
                <input
                  type="checkbox"
                  checked={(attach[p.id] ?? []).includes(eq.id)}
                  onChange={(e) => {
                    setAttach((cur) => {
                      const set = new Set(cur[p.id] ?? []);
                      if (e.target.checked) set.add(eq.id);
                      else set.delete(eq.id);
                      return { ...cur, [p.id]: [...set] };
                    });
                  }}
                />
                {eq.code} {eq.name}
              </label>
            ))}
            {!allEq.length && (
              <span className="muted">
                Сначала создайте станки в <Link to="/office/equipment">оборудовании</Link>.
              </span>
            )}
          </div>
          <button className="btn" type="button" onClick={() => saveAttach(p.id)} style={{ marginTop: 8 }}>
            Сохранить станки поста
          </button>
        </div>
      ))}
    </div>
  );
}
