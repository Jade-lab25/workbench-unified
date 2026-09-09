import { useEffect, useState } from 'react';
import { Target, Mail, Lock, LogIn, UserPlus, HardDrive } from 'lucide-react';
import { auth } from '../supabase/database';

interface AuthScreenProps {
  onLogin: () => void;
  onLocalMode: () => void;
}

export function AuthScreen({ onLogin, onLocalMode }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sub = auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') onLogin();
    });
    return () => sub.data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (isSignUp && password !== confirm) {
      setMsg({ text: '两次输入的密码不一致', type: 'error' });
      return;
    }
    setBusy(true);
    if (isSignUp) {
      const { error } = await auth.signUp(email, password);
      if (error) setMsg({ text: error.message, type: 'error' });
      else { setMsg({ text: '注册成功，请登录', type: 'success' }); setIsSignUp(false); setPassword(''); setConfirm(''); }
    } else {
      const { error } = await auth.signIn(email, password);
      if (error) setMsg({ text: error.message, type: 'error' });
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ width: '100%', maxWidth: 380, padding: '28px 26px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
        <div className="sidebar-logo" style={{ width: 44, height: 44, borderRadius: 13 }}>
          <Target size={22} strokeWidth={2.4} />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>工作台</h1>
        <p className="muted small" style={{ marginTop: 3 }}>目标追踪 · 工作状态 · 内容总结 三合一</p>
      </div>

      {msg && (
        <div style={{
          padding: '9px 12px', borderRadius: 10, fontSize: 12.5, marginBottom: 14,
          background: msg.type === 'success' ? 'var(--green-soft)' : 'var(--red-soft)',
          color: msg.type === 'success' ? 'var(--green)' : 'var(--red)',
        }}>{msg.text}</div>
      )}

      <form onSubmit={submit} className="col" style={{ gap: 12 }}>
        <div className="field">
          <label className="field-label">邮箱</label>
          <div style={{ position: 'relative' }}>
            <Mail size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input className="input" style={{ paddingLeft: 34 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
        </div>
        <div className="field">
          <label className="field-label">密码</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input className="input" style={{ paddingLeft: 34 }} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>
        </div>
        {isSignUp && (
          <div className="field">
            <label className="field-label">确认密码</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input className="input" style={{ paddingLeft: 34 }} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="再次输入密码" required />
            </div>
          </div>
        )}
        <button className="btn btn-primary btn-block" style={{ height: 38 }} disabled={busy}>
          {isSignUp ? <UserPlus size={16} /> : <LogIn size={16} />}
          {isSignUp ? '注册' : '登录'}
        </button>
      </form>

      <button className="btn btn-ghost btn-block mt12" onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? '已有账户？去登录' : '没有账户？注册一个'}
      </button>

      <div style={{ borderTop: '1px solid var(--border)', margin: '18px 0 0', paddingTop: 14 }}>
        <button className="btn btn-soft btn-block" onClick={onLocalMode}>
          <HardDrive size={15} /> 本地模式（跳过登录）
        </button>
        <p className="tiny muted-3" style={{ textAlign: 'center', marginTop: 8 }}>
          无需账号，数据仅保存在本机浏览器，不支持云同步
        </p>
      </div>
    </div>
  );
}
