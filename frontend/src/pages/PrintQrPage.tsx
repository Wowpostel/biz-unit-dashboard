import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';

type WorkItem = {
  id: string;
  qrCode: string;
  designation: string;
  name: string;
  pieceIndex: number;
  orderNumber: string;
  specCode: string;
  specName: string;
  dueDate: string | null;
  currentOperation: { name: string; post: { name: string } | null; timeNormHours: number } | null;
};

type Launch = {
  id: string;
  qty: number;
  spec: { code: string; name: string };
  order: { id: string; number: string; dueDate: string };
  workItems: WorkItem[];
};

export default function PrintQrPage() {
  const { id } = useParams();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Launch>(`/api/launches/${id}`)
      .then(setLaunch)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="err">{error}</p>;
  if (!launch) return <p>Готовим карты…</p>;

  return (
    <div>
      <div className="page-h no-print">
        <div>
          <h1>QR деталей в работе</h1>
          <p>
            Заказ {launch.order.number}, спецификация {launch.spec.code}, запущено {launch.qty} компл.
            Поля подставляются из заказа и маршрута.
          </p>
        </div>
        <div>
          <Link className="btn ghost" to={`/office/orders/${launch.order.id}`}>
            К заказу
          </Link>
          <button className="btn amber" onClick={() => window.print()}>
            Печать
          </button>
        </div>
      </div>
      <div className="print-grid">
        {launch.workItems.map((w) => (
          <div className="print-card" key={w.id}>
            <h3>
              {w.designation} {w.name}
            </h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <QRCodeSVG value={w.qrCode} size={120} />
              <div className="print-meta">
                <div>
                  <strong>{w.qrCode}</strong>
                </div>
                <div>Заказ: {launch.order.number}</div>
                <div>
                  Спец.: {launch.spec.code} {launch.spec.name}
                </div>
                <div>Штука: {w.pieceIndex}</div>
                <div>Срок: {new Date(launch.order.dueDate).toLocaleDateString('ru')}</div>
                <div>Операция: {w.currentOperation?.name ?? '—'}</div>
                <div>Пост: {w.currentOperation?.post?.name ?? '—'}</div>
                <div>Норма, ч: {w.currentOperation?.timeNormHours ?? '—'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
