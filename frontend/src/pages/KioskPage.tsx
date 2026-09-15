import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

type Post = { id: string; code: string; name: string };
type OpenEntry = {
  id: string;
  startedAt: string;
  qrCode: string;
  designation: string;
  name: string;
  orderNumber: string;
  workOperationId: string;
};
type QueueRow = {
  id: string;
  qrCode: string;
  designation: string;
  partName: string;
  name: string;
  orderNumber: string;
  status: string;
  postedHours: number;
  operatorName: string | null;
};
type Scan = {
  qrCode: string;
  designation: string;
  name: string;
  specCode: string;
  specName: string;
  orderNumber: string;
  dueDate: string | null;
  atThisPost: boolean;
  otherPostName: string | null;
  currentOperation: {
    id: string;
    seq: number;
    name: string;
    status: string;
    timeNormHours: number;
    postedHours: number;
    instruction?: string;
    images?: { id: string; url: string; filename: string }[];
    post: { id: string; name: string } | null;
    operatorName: string | null;
    activeStartAt: string | null;
  } | null;
  operations: { seq: number; name: string; status: string; post: { name: string } | null }[];
};

const POST_KEY = 'erpevv_post';

export default function KioskPage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postId, setPostId] = useState(localStorage.getItem(POST_KEY) ?? '');
  const [qr, setQr] = useState('');
  const [scan, setScan] = useState<Scan | null>(null);
  const [open, setOpen] = useState<OpenEntry[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [hours, setHours] = useState('1');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [entryId, setEntryId] = useState<string | null>(null);

  async function refreshSide(pid: string) {
    if (!pid) return;
    setOpen(await api<OpenEntry[]>('/api/terminal/my-open'));
    setQueue(await api<QueueRow[]>(`/api/terminal/queue?postId=${pid}`));
  }

  useEffect(() => {
    api<Post[]>('/api/posts?active=1').then((p) => {
      setPosts(p);
      const def = user?.employee?.defaultPostId || postId || p[0]?.id || '';
      if (def) {
        setPostId(def);
        localStorage.setItem(POST_KEY, def);
        refreshSide(def).catch(() => undefined);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickPost(id: string) {
    setPostId(id);
    localStorage.setItem(POST_KEY, id);
    setScan(null);
    refreshSide(id).catch((e) => setError(e.message));
  }

  async function doScan(code: string) {
    setError('');
    setInfo('');
    const row = await api<Scan>(
      `/api/terminal/scan/${encodeURIComponent(code.trim().toUpperCase())}?postId=${postId}`,
    );
    setScan(row);
    const mine = await api<OpenEntry[]>('/api/terminal/my-open');
    setOpen(mine);
    const match = mine.find((e) => e.qrCode === row.qrCode);
    setEntryId(match?.id ?? null);
  }

  async function onScan(e: FormEvent) {
    e.preventDefault();
    if (!postId) {
      setError('Сначала выберите пост');
      return;
    }
    try {
      await doScan(qr);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function startTimer() {
    if (!scan?.currentOperation) return;
    try {
      const entry = await api<{ id: string }>('/api/terminal/start', {
        method: 'POST',
        body: JSON.stringify({ workOperationId: scan.currentOperation.id, postId }),
      });
      setEntryId(entry.id);
      setInfo('Таймер запущен. В конце смены откройте запись и нажмите «Стоп» — операцию закрывать не обязательно.');
      await doScan(scan.qrCode);
      await refreshSide(postId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function stopTimer(complete: boolean) {
    const id = entryId || open.find((e) => e.qrCode === scan?.qrCode)?.id;
    if (!id) {
      setError('Нет открытого таймера по этой записи');
      return;
    }
    try {
      const res = await api<{ hours: number; completed: boolean }>('/api/terminal/stop', {
        method: 'POST',
        body: JSON.stringify({ timeEntryId: id, complete }),
      });
      setEntryId(null);
      setInfo(
        complete
          ? `Стоп, операция закрыта. Списано ${res.hours} ч.`
          : `Стоп, время ${res.hours} ч записано, операция остаётся на посту.`,
      );
      if (scan) await doScan(scan.qrCode);
      await refreshSide(postId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function manual(complete: boolean) {
    if (!scan?.currentOperation) return;
    try {
      const res = await api<{ hours: number }>('/api/terminal/manual', {
        method: 'POST',
        body: JSON.stringify({
          workOperationId: scan.currentOperation.id,
          postId,
          hours: Number(hours),
          complete,
        }),
      });
      setInfo(
        complete
          ? `Записано ${res.hours} ч, операция закрыта.`
          : `Записано ${res.hours} ч, операция не закрыта — остаётся на посту.`,
      );
      await doScan(scan.qrCode);
      await refreshSide(postId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function leave() {
    await logout();
    nav('/login');
  }

  const currentPost = posts.find((p) => p.id === postId);

  return (
    <div className="kiosk">
      <header>
        <div>
          <h1>Терминал цеха</h1>
          <div className="meta">
            {user?.fullName} · {user?.tenantName}
            {currentPost ? ` · пост ${currentPost.name}` : ''}
          </div>
        </div>
        <button className="btn ghost" onClick={leave}>
          Выйти
        </button>
      </header>

      <div className="muted">Выберите пост смены</div>
      <div className="posts">
        {posts.map((p) => (
          <button key={p.id} className={p.id === postId ? 'on' : ''} onClick={() => pickPost(p.id)}>
            {p.name}
          </button>
        ))}
      </div>

      <form onSubmit={onScan}>
        <input
          className="qr"
          placeholder="Сканируйте QR детали в работе"
          value={qr}
          onChange={(e) => setQr(e.target.value)}
          autoFocus
        />
      </form>
      {error && <p className="err">{error}</p>}
      {info && <p>{info}</p>}

      {scan && (
        <div className={`panel ${scan.otherPostName ? 'warn' : ''}`}>
          <h2>
            {scan.designation} {scan.name}
          </h2>
          <p>
            Заказ {scan.orderNumber} · {scan.specCode} {scan.specName} · QR {scan.qrCode}
            {scan.dueDate ? ` · срок ${new Date(scan.dueDate).toLocaleDateString('ru')}` : ''}
          </p>
          {scan.otherPostName && (
            <p>Сейчас деталь на другом посту: {scan.otherPostName}. Здесь отмечать нельзя.</p>
          )}
          {scan.currentOperation ? (
            <>
              <p>
                Операция {scan.currentOperation.seq}. {scan.currentOperation.name} · норма{' '}
                {scan.currentOperation.timeNormHours} ч · факт {scan.currentOperation.postedHours} ч
              </p>
              <p>{scan.currentOperation.instruction}</p>
              <div>
                {scan.currentOperation.images?.map((img) => (
                  <img key={img.id} className="tech-img" src={img.url} alt={img.filename} />
                ))}
              </div>
              {!scan.otherPostName && (
                <>
                  <div className="big-actions">
                    <button className="start" type="button" onClick={startTimer}>
                      Старт
                    </button>
                    <button className="stop" type="button" onClick={() => stopTimer(false)}>
                      Стоп
                    </button>
                    <button className="done" type="button" onClick={() => stopTimer(true)}>
                      Стоп и закрыть
                    </button>
                  </div>
                  <div className="hours-row">
                    <span>Или часы вручную:</span>
                    <input value={hours} onChange={(e) => setHours(e.target.value)} />
                    <button className="btn" type="button" onClick={() => manual(false)}>
                      Записать, не закрывая
                    </button>
                    <button className="btn amber" type="button" onClick={() => manual(true)}>
                      Записать и закрыть
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <p>Все операции закрыты — деталь готова.</p>
          )}
        </div>
      )}

      <div className="grid-2">
        <div className="panel">
          <h3>Мои открытые таймеры</h3>
          <p className="muted">Смена: откройте запись и нажмите «Стоп».</p>
          {open.map((e) => (
            <div key={e.id} style={{ marginBottom: 8 }}>
              <button
                className="btn ghost"
                onClick={() => {
                  setQr(e.qrCode);
                  setEntryId(e.id);
                  doScan(e.qrCode);
                }}
              >
                {e.qrCode} {e.designation} · {e.name}
              </button>
            </div>
          ))}
          {!open.length && <p className="muted">Нет открытых записей</p>}
        </div>
        <div className="panel">
          <h3>На этом посту</h3>
          {queue.map((q) => (
            <div key={q.id} style={{ marginBottom: 8 }}>
              <button
                className="btn ghost"
                onClick={() => {
                  setQr(q.qrCode);
                  doScan(q.qrCode);
                }}
              >
                {q.qrCode} {q.designation} — {q.name} ({q.orderNumber})
              </button>
            </div>
          ))}
          {!queue.length && <p className="muted">Очередь пуста</p>}
        </div>
      </div>
    </div>
  );
}
