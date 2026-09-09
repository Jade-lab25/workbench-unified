import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/* ── 秒级时钟（计时器用；active 期间每秒触发一次渲染） ── */
export function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/* ── 分段控件 ── */
export function Seg<T extends string>({ items, value, onChange }: {
  items: { key: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {items.map(it => (
        <button
          key={it.key}
          role="tab"
          aria-selected={value === it.key}
          className={`seg-item${value === it.key ? ' active' : ''}`}
          onClick={() => onChange(it.key)}
        >
          {it.label}
          {it.count !== undefined && it.count > 0 && <span className="badge badge-muted" style={{ height: 16, padding: '0 6px', fontSize: 10 }}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── 弹窗 ── */
export function Modal({ open, title, onClose, children, width }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={width ? { maxWidth: width } : undefined}>
        <div className="row-between mb8">
          <div className="modal-title" style={{ marginBottom: 0 }}>{title}</div>
          <button className="btn-icon" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── 空态 ── */
export function Empty({ icon, text, children }: { icon?: ReactNode; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <span className="ic">{icon}</span>}
      <div className="empty-text">{text}</div>
      {children}
    </div>
  );
}

/* ── 进度条 ── */
export function Progress({ value, tone }: { value: number; tone?: 'green' | 'amber' | 'red' }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`progress${tone ? ' ' + tone : ''}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${v}%` }} />
    </div>
  );
}

/* ── 开关 ── */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="row" style={{ cursor: 'pointer', gap: 8 }}>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <i />
      </span>
      {label && <span className="small muted">{label}</span>}
    </label>
  );
}

/* ── 轻量 useToast ── */
export interface ToastItem { id: number; text: string; type: 'info' | 'success' | 'error'; }

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  };
  const node = toasts.length > 0 && (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type === 'info' ? '' : t.type}`}>{t.text}</div>
      ))}
    </div>
  );
  return { toast: push, toastNode: node };
}

/* ── Markdown 轻渲染（安全：仅处理标题/列表/表格/粗体，不执行 HTML） ── */
export function Markdown({ text }: { text: string }) {
  const lines = (text || '').split('\n');
  const out: ReactNode[] = [];
  let table: string[][] = [];
  const flushTable = () => {
    if (!table.length) return;
    const head = table[0];
    const body = table.slice(1);
    out.push(
      <table key={`t${out.length}`}>
        <thead><tr>{head.map((c, i) => <th key={i}>{renderInline(c)}</th>)}</tr></thead>
        <tbody>{body.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{renderInline(c)}</td>)}</tr>)}</tbody>
      </table>,
    );
    table = [];
  };
  const renderInline = (s: string) => {
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
      if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
      return <span key={i}>{p}</span>;
    });
  };

  lines.forEach((raw) => {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.trim().replace(/^\||\|\s*$/g, '').split('|').map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) return; // 分隔行
      table.push(cells);
      return;
    }
    flushTable();
    if (!line) { out.push(<div key={`b${out.length}`} style={{ height: 6 }} />); return; }
    if (/^#{1,3}\s/.test(line)) {
      const m = line.match(/^(#{1,3})\s+(.*)$/)!;
      const lvl = m[1].length;
      const text = m[2];
      if (lvl === 1) out.push(<h1 key={`h${out.length}`}>{renderInline(text)}</h1>);
      else if (lvl === 2) out.push(<h2 key={`h${out.length}`}>{renderInline(text)}</h2>);
      else out.push(<h3 key={`h${out.length}`}>{renderInline(text)}</h3>);
      return;
    }
    if (/^[-*]\s+/.test(line)) {
      out.push(<li key={`l${out.length}`} style={{ margin: '3px 0' }}>{renderInline(line.replace(/^[-*]\s+/, ''))}</li>);
      return;
    }
    if (/^\d+\.\s+/.test(line)) {
      out.push(<li key={`l${out.length}`} style={{ margin: '3px 0' }}>{renderInline(line.replace(/^\d+\.\s+/, ''))}</li>);
      return;
    }
    if (/^(---|\*\*\*)\s*$/.test(line)) { out.push(<hr key={`r${out.length}`} />); return; }
    if (/^>\s?/.test(line)) {
      out.push(<blockquote key={`q${out.length}`}>{renderInline(line.replace(/^>\s?/, ''))}</blockquote>);
      return;
    }
    out.push(<p key={`p${out.length}`}>{renderInline(line)}</p>);
  });
  flushTable();
  return <div className="md-body">{out}</div>;
}
