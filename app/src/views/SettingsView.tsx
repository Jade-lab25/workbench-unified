import { useRef, useState } from 'react';
import { User, KeyRound, Database, Upload, Download, LogOut, HardDrive, Cloud, ShieldCheck, Info } from 'lucide-react';
import type { AppState } from '../types';
import { PROVIDERS, loadLLMConfig, saveLLMConfig } from '../utils/llm';

interface Props {
  state: AppState;
  store: any;
  userId: string | null;
  authMode: 'local' | 'cloud' | null;
  userEmail: string | null;
  syncState: any;
  onPerformSync: () => Promise<unknown>;
  onFetchFromCloud: () => Promise<unknown>;
  onLogout: () => void;
  onSwitchLocal: () => void;
  toast: (t: string, type?: 'info' | 'success' | 'error') => void;
}

export function SettingsView({ store, userId, authMode, userEmail, syncState, onPerformSync, onFetchFromCloud, onLogout, onSwitchLocal, toast }: Props) {
  const llmInit = loadLLMConfig();
  const [provider, setProvider] = useState(llmInit.provider || 'deepseek');
  const [model, setModel] = useState(llmInit.model || '');
  const [apiKey, setApiKey] = useState(llmInit.apiKey || '');
  const [customEndpoint, setCustomEndpoint] = useState(llmInit.customEndpoint || '');
  const fileRef = useRef<HTMLInputElement>(null);

  const saveSettings = () => {
    saveLLMConfig({ provider, apiKey: apiKey.trim(), model: model.trim(), customEndpoint: customEndpoint.trim() });
    toast('设置已保存到本机浏览器（不上传任何服务器）', 'success');
  };

  const doExport = () => {
    const json = store.exportData();
    if (!json) { toast('没有可导出的数据', 'error'); return; }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `workbench-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('已导出 JSON 备份');
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        store.importData(String(reader.result));
        toast('导入成功', 'success');
      } catch (e) {
        toast(`导入失败：${(e as Error).message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">设置</div>
          <div className="page-desc">账号 · 数据同步 · LLM 配置 · 备份</div>
        </div>
      </div>

      <div className="grid-2">
        {/* 账号与同步 */}
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-title mb12"><User size={16} /> 账号</div>
            <div className="row-between">
              <div>
                <div className="bold">{userEmail || '未登录'}</div>
                <div className="small muted mt8">
                  {authMode === 'cloud' ? <span className="row" style={{ gap: 5 }}><Cloud size={13} color="var(--green)" /> 云端模式 · 数据可跨设备同步</span>
                    : authMode === 'local' ? <span className="row" style={{ gap: 5 }}><HardDrive size={13} /> 本地模式 · 仅存本机</span>
                      : '未登录'}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onLogout}><LogOut size={13} /> 退出</button>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0 10px' }} />
            <button className="btn btn-soft btn-block btn-sm" onClick={onSwitchLocal}>
              <HardDrive size={13} /> 切换到本地模式（保留本机数据）
            </button>
          </div>

          <div className="card">
            <div className="card-title mb12"><Database size={16} /> 数据同步</div>
            <div className="row mb12 wrap" style={{ gap: 8 }}>
              <span className={`badge ${syncState.isOnline ? 'badge-green' : 'badge-red'}`}>{syncState.isOnline ? '在线' : '离线'}</span>
              {syncState.lastSync && <span className="badge badge-muted">上次同步 {new Date(syncState.lastSync).toLocaleString()}</span>}
            </div>
            <div className="row">
              <button className="btn btn-primary grow" disabled={!userId || syncState.isSyncing} onClick={() => onPerformSync().then(() => toast('同步完成', 'success'))}>
                <Upload size={14} /> {syncState.isSyncing ? '同步中…' : '上传到云端'}
              </button>
              <button className="btn btn-soft grow" disabled={!userId || syncState.isSyncing} onClick={() => onFetchFromCloud().then(() => toast('已拉取云端数据', 'success'))}>
                <Download size={14} /> 从云端下载
              </button>
            </div>
            {!userId && <div className="tiny muted-3 mt8">登录后启用云同步；本地模式下按钮不可用</div>}
            <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0 10px' }} />
            <div className="row">
              <button className="btn btn-ghost grow btn-sm" onClick={doExport}><Download size={13} /> 导出 JSON 备份</button>
              <button className="btn btn-ghost grow btn-sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> 导入备份</button>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
            </div>
            <div className="tiny muted-3 mt8">JSON 是全量备份（最完整）；导入会作为新数据上传，建议先导出</div>
          </div>
        </div>

        {/* LLM 与关于 */}
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-title mb12"><KeyRound size={16} /> LLM API 设置</div>
            <div className="col" style={{ gap: 12 }}>
              <div className="field"><label className="field-label">供应商</label>
                <select className="select" value={provider} onChange={e => { setProvider(e.target.value); setModel(PROVIDERS[e.target.value]?.model || ''); }}>
                  {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
              {provider === 'custom' && (
                <div className="field"><label className="field-label">自定义 API 端点</label>
                  <input className="input" placeholder="https://api.example.com/v1" value={customEndpoint} onChange={e => setCustomEndpoint(e.target.value)} /></div>
              )}
              <div className="field"><label className="field-label">模型</label>
                {PROVIDERS[provider]?.models?.length ? (
                  <select className="select" value={model || PROVIDERS[provider].model} onChange={e => setModel(e.target.value)}>
                    {PROVIDERS[provider].models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : <input className="input" placeholder="输入模型名" value={model} onChange={e => setModel(e.target.value)} />}
              </div>
              <div className="field"><label className="field-label">API Key</label>
                <input className="input mono" type="password" placeholder="sk-…" value={apiKey} onChange={e => setApiKey(e.target.value)} /></div>
              <button className="btn btn-primary" onClick={saveSettings}>保存设置</button>
              <div className="tiny muted-3">
                Key 仅保存在本机浏览器 localStorage，不上传任何服务器；换设备需重新填写。生成时由浏览器直连调用，60 秒超时。
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title mb12"><ShieldCheck size={16} /> 安全</div>
            <div className="col" style={{ gap: 8, fontSize: 12.5, color: 'var(--text-2)' }}>
              <div>· 全部 16 张数据表启用 RLS，仅本人可读写</div>
              <div>· Supabase 建议关闭「允许新用户注册」，锁死唯一账号</div>
              <div>· API Key 仅存本机浏览器 localStorage，不写入代码、不上传服务器</div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0 10px' }} />
            <div className="row" style={{ gap: 8, color: 'var(--text-3)', fontSize: 12 }}>
              <Info size={14} />
              <span>Workbench · 三合一工作台（目标追踪 / 工作状态 / 内容总结）</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
