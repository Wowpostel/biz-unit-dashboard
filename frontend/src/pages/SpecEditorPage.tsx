import { ClipboardEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, isSuper } from '../api';
import { useAuth } from '../auth';

type Kind = 'ASSEMBLY' | 'PART' | 'MATERIAL';
type TechSource = 'catalog' | 'kit' | 'own' | 'empty';

type OpDraft = {
  id?: string;
  seq: number;
  name: string;
  operationTypeId: string | null;
  postId: string | null;
  timeNormHours: number;
  minText: string;
  instruction: string;
};

type Row = {
  clientId: string;
  id?: string;
  parentClientId: string | null;
  designation: string;
  name: string;
  qty: number;
  unit: string;
  kind: Kind;
  operations: OpDraft[];
  techSource: TechSource;
  picked: boolean;
  photoUrl: string | null;
};

type OpType = {
  id: string;
  code: string;
  name: string;
  defaultPostId: string | null;
};

const kindRu: Record<Kind, string> = {
  ASSEMBLY: 'Сборка',
  PART: 'Деталь',
  MATERIAL: 'Материал',
};

const sourceRu: Record<TechSource, string> = {
  catalog: 'из базы',
  kit: 'набор',
  own: 'своя',
  empty: 'пусто',
};

function minTextFromHours(hours: number) {
  if (!hours) return '';
  const m = hours * 60;
  const rounded = Math.round(m * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function hoursOf(minText: string) {
  const n = Number(minText);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round((n / 60) * 1000) / 1000;
}

function parsePaste(text: string): { designation: string; name: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\t|;/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) return { designation: parts[0], name: parts.slice(1).join(' ') };
      return { designation: parts[0], name: '' };
    });
}

function levelOf(rows: Row[], row: Row): number {
  let n = 0;
  let pid = row.parentClientId;
  const map = new Map(rows.map((r) => [r.clientId, r]));
  while (pid) {
    n += 1;
    pid = map.get(pid)?.parentClientId ?? null;
    if (n > 20) break;
  }
  return n;
}

function newId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function toRow(it: {
  id: string;
  parentId: string | null;
  designation: string;
  name: string;
  qty: number;
  unit: string;
  kind: Kind;
  photoUrl?: string | null;
  operations?: OpDraft[];
}): Row {
  const ops = (it.operations ?? []).map((o) => ({
    id: o.id,
    seq: o.seq,
    name: o.name,
    operationTypeId: o.operationTypeId,
    postId: o.postId,
    timeNormHours: o.timeNormHours,
    minText: minTextFromHours(o.timeNormHours),
    instruction: o.instruction ?? '',
  }));
  return {
    clientId: it.id,
    id: it.id,
    parentClientId: it.parentId,
    designation: it.designation,
    name: it.name,
    qty: it.qty,
    unit: it.unit,
    kind: it.kind,
    operations: ops,
    techSource: ops.length ? 'own' : 'empty',
    picked: false,
    photoUrl: it.photoUrl ?? null,
  };
}

type LookupHit = {
  designation: string;
  name: string;
  operations: OpDraft[];
};

export default function SpecEditorPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = isSuper(user?.role) || user?.role === 'ADMIN' || user?.role === 'TECHNOLOGIST';
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [types, setTypes] = useState<OpType[]>([]);
  const [kitQuery, setKitQuery] = useState('');
  const [kitChecked, setKitChecked] = useState<string[]>([]);
  const [kitOrder, setKitOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [inboxHint, setInboxHint] = useState('uploads/parts/inbox');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api<{
        code: string;
        name: string;
        items: Parameters<typeof toRow>[0][];
      }>(`/api/specs/${id}`),
      api<OpType[]>('/api/operation-types'),
      api<{ inbox: string; items: { designation: string; url: string }[] }>('/api/part-images').catch(() => ({
        inbox: 'uploads/parts/inbox',
        items: [],
      })),
    ])
      .then(([spec, opTypes, photos]) => {
        setCode(spec.code);
        setName(spec.name);
        setRows(spec.items.map(toRow));
        setTypes(opTypes);
        if (photos.inbox) setInboxHint(photos.inbox);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const display = useMemo(() => {
    const children = new Map<string | null, Row[]>();
    for (const r of rows) {
      const key = r.parentClientId;
      if (!children.has(key)) children.set(key, []);
      children.get(key)!.push(r);
    }
    const out: Row[] = [];
    const walk = (parent: string | null) => {
      for (const r of children.get(parent) ?? []) {
        out.push(r);
        walk(r.clientId);
      }
    };
    walk(null);
    return out;
  }, [rows]);

  const filteredTypes = types.filter((t) => {
    const q = kitQuery.trim().toLowerCase();
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
  });

  const orderedKit = kitOrder
    .map((tid) => types.find((t) => t.id === tid))
    .filter((t): t is OpType => Boolean(t));

  function patch(clientId: string, upd: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.clientId === clientId ? { ...r, ...upd } : r)));
  }

  function addRow(parentClientId: string | null, after?: string, preset?: Partial<Row>) {
    const row: Row = {
      clientId: newId(),
      parentClientId,
      designation: '',
      name: '',
      qty: 1,
      unit: 'шт',
      kind: 'PART',
      operations: [],
      techSource: 'empty',
      picked: true,
      photoUrl: null,
      ...preset,
    };
    setRows((rs) => {
      if (!after) return [...rs, row];
      const idx = rs.findIndex((r) => r.clientId === after);
      const copy = [...rs];
      copy.splice(idx + 1, 0, row);
      return copy;
    });
    setSel(row.clientId);
    return row;
  }

  async function applyLookup(keys: string[], targetIds: string[]) {
    const found = await api<Record<string, LookupHit | null>>('/api/parts/lookup', {
      method: 'POST',
      body: JSON.stringify({ keys }),
    });
    setRows((rs) =>
      rs.map((r) => {
        if (!targetIds.includes(r.clientId)) return r;
        const hit = found[r.designation] ?? null;
        if (!hit) {
          return { ...r, techSource: r.operations.length ? r.techSource : 'empty' };
        }
        const ops = (hit.operations ?? []).map((o, i) => ({
          seq: o.seq || (i + 1) * 10,
          name: o.name,
          operationTypeId: o.operationTypeId,
          postId: o.postId,
          timeNormHours: o.timeNormHours,
          minText: minTextFromHours(o.timeNormHours),
          instruction: o.instruction ?? '',
        }));
        return {
          ...r,
          name: r.name || hit.name,
          designation: r.designation,
          operations: ops,
          techSource: ops.length ? 'catalog' : 'empty',
        };
      }),
    );
  }

  async function insertFromPaste(text: string, afterRow?: Row) {
    const parsed = parsePaste(text);
    if (!parsed.length) return;
    const parent = afterRow?.parentClientId ?? null;
    const fillCurrent = Boolean(afterRow && !afterRow.designation && !afterRow.name);
    const forNew = fillCurrent ? parsed.slice(1) : parsed;
    const created: Row[] = forNew.map((p) => ({
      clientId: newId(),
      parentClientId: parent,
      designation: p.designation,
      name: p.name,
      qty: 1,
      unit: 'шт',
      kind: 'PART',
      operations: [],
      techSource: 'empty',
      picked: true,
      photoUrl: null,
    }));
    const lookupIds = created.map((c) => c.clientId);
    if (fillCurrent && afterRow) lookupIds.push(afterRow.clientId);
    setRows((rs) => {
      let next = rs;
      if (fillCurrent && afterRow && parsed[0]) {
        next = next.map((r) =>
          r.clientId === afterRow.clientId
            ? {
                ...r,
                designation: parsed[0].designation,
                name: parsed[0].name,
                picked: true,
              }
            : r,
        );
      }
      if (!created.length) return next;
      if (!afterRow) return [...next, ...created];
      const idx = next.findIndex((r) => r.clientId === afterRow.clientId);
      const copy = [...next];
      copy.splice(idx + 1, 0, ...created);
      return copy;
    });
    if (created[0]) setSel(created[0].clientId);
    const keys = [
      ...(fillCurrent && parsed[0] ? [parsed[0].designation] : []),
      ...created.map((c) => c.designation),
    ].filter(Boolean);
    if (keys.length) {
      try {
        await applyLookup(keys, lookupIds);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось подтянуть технологию');
      }
    }
  }

  function onCellPaste(e: ClipboardEvent, row: Row) {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n') && !text.includes('\t')) return;
    e.preventDefault();
    void insertFromPaste(text, row);
  }

  function onKey(e: KeyboardEvent, row: Row) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addRow(row.parentClientId, row.clientId);
    }
  }

  function toggleKit(typeId: string, on: boolean) {
    setKitChecked((ids) => (on ? [...ids, typeId] : ids.filter((x) => x !== typeId)));
    setKitOrder((ids) => {
      if (on) return ids.includes(typeId) ? ids : [...ids, typeId];
      return ids.filter((x) => x !== typeId);
    });
  }

  function dropKit(overId: string) {
    if (!dragId || dragId === overId) return;
    setKitOrder((ids) => {
      const next = ids.filter((x) => x !== dragId);
      const at = next.indexOf(overId);
      next.splice(at, 0, dragId);
      return next;
    });
    setDragId(null);
  }

  function applyKit() {
    if (!orderedKit.length) {
      setError('Отметьте операции в наборе и расставьте порядок');
      return;
    }
    const targets = rows.filter((r) => r.picked && r.kind !== 'MATERIAL');
    const applyTo = targets.length ? targets : rows.filter((r) => r.clientId === sel && r.kind !== 'MATERIAL');
    if (!applyTo.length) {
      setError('Выберите детали (галочка слева) или строку');
      return;
    }
    const ids = new Set(applyTo.map((r) => r.clientId));
    const ops: OpDraft[] = orderedKit.map((t, i) => ({
      seq: (i + 1) * 10,
      name: t.name,
      operationTypeId: t.id,
      postId: t.defaultPostId,
      timeNormHours: 0,
      minText: '',
      instruction: '',
    }));
    setRows((rs) =>
      rs.map((r) => (ids.has(r.clientId) ? { ...r, operations: ops.map((o) => ({ ...o })), techSource: 'kit' } : r)),
    );
    setSaved('Набор наложен. Заполните нормы в минутах справа.');
    setError('');
  }

  function copyTimes() {
    const source = rows.find((r) => r.clientId === sel);
    if (!source || !source.operations.length) {
      setError('Выделите строку-источник с нормами (клик по детали)');
      return;
    }
    const targets = rows.filter((r) => r.picked && r.clientId !== sel && r.kind !== 'MATERIAL');
    if (!targets.length) {
      setError('Отметьте галочками детали, на которые копировать нормы');
      return;
    }
    const ids = new Set(targets.map((r) => r.clientId));
    setRows((rs) =>
      rs.map((r) => {
        if (!ids.has(r.clientId) || !r.operations.length) return r;
        const used = new Set<number>();
        const operations = r.operations.map((op, idx) => {
          const byName = source.operations.findIndex(
            (s, si) => !used.has(si) && s.name.trim().toLowerCase() === op.name.trim().toLowerCase(),
          );
          const srcIdx = byName >= 0 ? byName : source.operations[idx] ? idx : -1;
          if (srcIdx < 0) return op;
          used.add(srcIdx);
          const src = source.operations[srcIdx];
          return { ...op, minText: src.minText, timeNormHours: hoursOf(src.minText) };
        });
        return { ...r, operations };
      }),
    );
    setSaved('Нормы минут наложены на выбранные детали.');
    setError('');
  }

  function setOpMinutes(row: Row, index: number, minText: string) {
    const ops = row.operations.map((o, i) =>
      i === index ? { ...o, minText, timeNormHours: hoursOf(minText) } : o,
    );
    patch(row.clientId, { operations: ops, techSource: row.techSource === 'catalog' ? 'own' : row.techSource });
  }

  async function save() {
    setError('');
    setSaved('');
    try {
      await api(`/api/specs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ code, name }),
      });
      const spec = await api<{ items: Parameters<typeof toRow>[0][] }>(`/api/specs/${id}/items`, {
        method: 'PUT',
        body: JSON.stringify({
          items: display.map((r, i) => ({
            id: r.id,
            clientId: r.clientId,
            parentClientId: r.parentClientId,
            sortOrder: i,
            designation: r.designation,
            name: r.name,
            qty: Number(r.qty) || 1,
            unit: r.unit || 'шт',
            kind: r.kind,
            operations:
              r.kind === 'MATERIAL'
                ? undefined
                : r.operations.map((o) => ({
                    id: o.id,
                    seq: Number(o.seq),
                    name: o.name,
                    operationTypeId: o.operationTypeId,
                    postId: o.postId,
                    timeNormHours: hoursOf(o.minText),
                    instruction: o.instruction,
                  })),
          })),
        }),
      });
      setRows(spec.items.map(toRow));
      setSaved('Сохранено');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function uploadPack(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const body = new FormData();
    for (const f of Array.from(files)) body.append('files', f);
    try {
      await api('/api/part-images/pack', { method: 'POST', body });
      const spec = await api<{ items: Parameters<typeof toRow>[0][] }>(`/api/specs/${id}`);
      setRows(spec.items.map(toRow));
      setSaved('Пачка фото разобрана по номерам файлов.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось разложить фото');
    }
  }

  async function ingestInbox() {
    setError('');
    try {
      const res = await api<{ inbox: string; organized: number }>(`/api/part-images/ingest`, { method: 'POST' });
      const spec = await api<{ items: Parameters<typeof toRow>[0][] }>(`/api/specs/${id}`);
      setRows(spec.items.map(toRow));
      setInboxHint(res.inbox);
      setSaved(`Из inbox разобрано файлов: ${res.organized}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inbox пуст или недоступен');
    }
  }

  const selected = rows.find((r) => r.clientId === sel);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Спецификация {code}</h1>
          <p>
            Вставьте столбец номеров из Excel — появятся строки. Номер и наименование — разные поля.
            Если номер уже в базе, технология подтянется. Нормы минут копируются так же, как набор операций.{' '}
            <Link to={`/office/specs/${id}/tech`}>Текст и фото операций →</Link>
          </p>
        </div>
        {canEdit && (
          <button className="btn amber" onClick={save}>
            Сохранить
          </button>
        )}
      </div>
      <div className="form-row">
        <input value={code} onChange={(e) => setCode(e.target.value)} readOnly={!canEdit} />
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 280 }} readOnly={!canEdit} />
      </div>

      {canEdit && (
        <div className="grid-2">
          <div className="card">
            <h3>Вставка столбца Excel</h3>
            <p className="muted">
              Первый столбец — номер (обозначение), второй — наименование. Один столбец = только номера, имя не
              подставляется.
            </p>
            <textarea
              className="paste-box"
              placeholder={'Д-01\nД-02\nД-88'}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text.includes('\n')) {
                  e.preventDefault();
                  setPasteText(text);
                }
              }}
            />
            <div className="form-row" style={{ marginTop: 8 }}>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  void insertFromPaste(pasteText, selected);
                  setPasteText('');
                }}
              >
                Вставить строками
              </button>
              <button className="btn ghost" type="button" onClick={() => addRow(null)}>
                + Строка
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={!selected}
                onClick={() => selected && addRow(selected.clientId)}
              >
                Вложить
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={!selected}
                onClick={() => setRows((rs) => rs.filter((r) => r.clientId !== sel && r.parentClientId !== sel))}
              >
                Удалить
              </button>
            </div>
          </div>
          <div className="card">
            <h3>Набор технологии</h3>
            <p className="muted">Галочки, затем перетащите порядок мышью. Наложите на отмеченные детали.</p>
            <input
              placeholder="Поиск операции"
              value={kitQuery}
              onChange={(e) => setKitQuery(e.target.value)}
            />
            <div className="kit-ops">
              {filteredTypes.map((t) => (
                <label key={t.id} className="kit-check">
                  <input
                    type="checkbox"
                    checked={kitChecked.includes(t.id)}
                    onChange={(e) => toggleKit(t.id, e.target.checked)}
                  />
                  {t.name}
                </label>
              ))}
            </div>
            <div className="kit-order">
              {orderedKit.map((t) => (
                <div
                  key={t.id}
                  className="kit-chip"
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropKit(t.id)}
                >
                  ☰ {t.name}
                </div>
              ))}
              {!orderedKit.length && <span className="muted">Отметьте операции — здесь появится порядок</span>}
            </div>
            <button className="btn amber" type="button" onClick={applyKit} style={{ marginTop: 10 }}>
              Наложить на выбранные детали
            </button>
            <button className="btn" type="button" onClick={copyTimes} style={{ marginTop: 10, marginLeft: 8 }}>
              Наложить нормы на выбранные
            </button>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="card">
          <h3>Фото деталей</h3>
          <p className="muted">
            Имя файла = номер детали (Д-01.jpg). Пачка раскладывается в uploads/parts/pilot/. Inbox:{' '}
            <code>{inboxHint}</code>
          </p>
          <div className="form-row">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => {
                void uploadPack(e.target.files);
                e.target.value = '';
              }}
            />
            <button className="btn ghost" type="button" onClick={() => void ingestInbox()}>
              Разложить inbox
            </button>
          </div>
        </div>
      )}

      {error && <p className="err">{error}</p>}
      {saved && <p className="muted">{saved}</p>}
      <table className="data spec-grid">
        <thead>
          <tr>
            <th style={{ width: 36 }}></th>
            <th style={{ width: 80 }}>Фото</th>
            <th style={{ width: 40 }}>Ур.</th>
            <th>Номер</th>
            <th>Наименование</th>
            <th style={{ width: 70 }}>Кол-во</th>
            <th style={{ width: 60 }}>Ед.</th>
            <th style={{ width: 110 }}>Вид</th>
            <th>Операции</th>
            <th>Норма, мин</th>
            <th style={{ width: 80 }}>Техн.</th>
          </tr>
        </thead>
        <tbody>
          {display.map((r) => {
            const lvl = levelOf(rows, r);
            return (
              <tr
                key={r.clientId}
                onClick={() => setSel(r.clientId)}
                style={{ outline: sel === r.clientId ? '2px solid var(--amber)' : undefined }}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={r.picked}
                    onChange={(e) => patch(r.clientId, { picked: e.target.checked })}
                    disabled={!canEdit || r.kind === 'MATERIAL'}
                  />
                </td>
                <td>
                  {r.photoUrl ? (
                    <img className="part-thumb" src={r.photoUrl} alt={r.designation} />
                  ) : (
                    <span className="part-thumb empty" title="Нет фото" />
                  )}
                </td>
                <td>{lvl + 1}</td>
                <td style={{ paddingLeft: 8 + lvl * 18 }}>
                  <input
                    value={r.designation}
                    onChange={(e) => patch(r.clientId, { designation: e.target.value })}
                    onKeyDown={(e) => onKey(e, r)}
                    onPaste={(e) => onCellPaste(e, r)}
                    readOnly={!canEdit}
                  />
                </td>
                <td>
                  <input
                    value={r.name}
                    onChange={(e) => patch(r.clientId, { name: e.target.value })}
                    onKeyDown={(e) => onKey(e, r)}
                    onPaste={(e) => onCellPaste(e, r)}
                    readOnly={!canEdit}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.001"
                    value={r.qty}
                    onChange={(e) => patch(r.clientId, { qty: Number(e.target.value) })}
                    readOnly={!canEdit}
                  />
                </td>
                <td>
                  <input value={r.unit} onChange={(e) => patch(r.clientId, { unit: e.target.value })} readOnly={!canEdit} />
                </td>
                <td>
                  <select
                    value={r.kind}
                    onChange={(e) => patch(r.clientId, { kind: e.target.value as Kind })}
                    disabled={!canEdit}
                  >
                    {(Object.keys(kindRu) as Kind[]).map((k) => (
                      <option key={k} value={k}>
                        {kindRu[k]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {r.kind === 'MATERIAL' ? (
                    <span className="muted">—</span>
                  ) : r.operations.length ? (
                    <div className="op-seq">
                      {r.operations.map((o) => (
                        <span key={o.seq + o.name} className="op-pill">
                          {o.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">нет — наложите набор</span>
                  )}
                </td>
                <td>
                  {r.kind !== 'MATERIAL' && r.operations.length > 0 && (
                    <div className="micro-cells">
                      {r.operations.map((o, i) => (
                        <input
                          key={o.seq + o.name + i}
                          title={`${o.name}, мин`}
                          value={o.minText}
                          onChange={(e) => setOpMinutes(r, i, e.target.value)}
                          readOnly={!canEdit}
                        />
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`tag ${r.techSource === 'empty' ? '' : r.techSource === 'catalog' ? 'good' : ''}`}>
                    {sourceRu[r.techSource]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
