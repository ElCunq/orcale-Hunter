import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { StatusCard } from './components/StatusCard';
import { OciConfig } from './components/OciConfig';
import { TelegramConfig } from './components/TelegramConfig';
import { ResourceConfig } from './components/ResourceConfig';
import { LogViewer } from './components/LogViewer';
import { fetchConfig, fetchStatus, saveConfig, ConfigData, StatusData } from './api/client';
import { Save, Key, Bot, Server, Terminal as TerminalIcon, CheckCircle2, AlertCircle, X } from 'lucide-react';

export const App: React.FC = () => {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [activeTab, setActiveTab] = useState<'oci' | 'telegram' | 'resource' | 'logs'>('oci');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const showToast = (message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 5000);
  };

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [cfg, st] = await Promise.all([fetchConfig(), fetchStatus()]);
      setConfig(cfg);
      setStatusData(st);
    } catch (e: any) {
      showToast('Konfigürasyon veya durum verileri okunamadı: ' + e.message, true);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Zero-polling real-time WebSocket connection for status updates
    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/status`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATUS' && msg.data) {
            setStatusData(msg.data);
          }
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      // ignore
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleConfigChange = (key: keyof ConfigData, value: string) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const res = await saveConfig(config);
      showToast(res.message);
      setHasUnsavedChanges(false);
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Kaydetme hatası oluştu', true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-['Inter',sans-serif] bg-grid-pattern pb-24">
      <Header onRefresh={loadData} isRefreshing={isRefreshing} />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-xs font-medium backdrop-blur-md ${
            toast.isError
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : 'bg-zinc-900/95 text-emerald-400 border-zinc-700'
          }`}>
            {toast.isError ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6">
        {/* Status Dashboard Banner */}
        <StatusCard statusData={statusData} onUpdate={loadData} onShowMessage={showToast} />

        {/* Shadcn Segmented Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="inline-flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800/80 rounded-lg shadow-inner">
            <button
              onClick={() => setActiveTab('oci')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'oci'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>OCI Key & Kimlik</span>
            </button>

            <button
              onClick={() => setActiveTab('telegram')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'telegram'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Telegram Bot</span>
            </button>

            <button
              onClick={() => setActiveTab('resource')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'resource'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Sunucu & Subnet</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'logs'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>Konsol Logları</span>
            </button>
          </div>

          {hasUnsavedChanges && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium animate-pulse">
              <span>Kaydedilmemiş değişiklikler var</span>
            </div>
          )}
        </div>

        {/* Tab Content Card Panel */}
        <div className="shadcn-card p-6 mb-8 bg-zinc-900/60">
          {config && activeTab === 'oci' && (
            <OciConfig config={config} onChange={handleConfigChange} />
          )}

          {config && activeTab === 'telegram' && (
            <TelegramConfig config={config} onChange={handleConfigChange} onShowMessage={showToast} />
          )}

          {config && activeTab === 'resource' && (
            <ResourceConfig config={config} onChange={handleConfigChange} />
          )}

          {activeTab === 'logs' && (
            <LogViewer autoRefresh={autoRefreshLogs} onToggleAutoRefresh={() => setAutoRefreshLogs(!autoRefreshLogs)} />
          )}
        </div>

        {/* Floating Action Bar (Shadcn style footer bar when editing) */}
        {activeTab !== 'logs' && (
          <div className="sticky bottom-6 shadcn-card p-4 shadow-2xl flex items-center justify-between gap-4 bg-zinc-900/90 backdrop-blur-md border-zinc-800">
            <div className="text-xs text-zinc-400 font-normal">
              Değişiklikleri kaydetmek için <strong className="text-zinc-200 font-medium">"Ayarları Kaydet"</strong> butonuna basın.
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 font-medium text-xs shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <Save className={`w-3.5 h-3.5 text-zinc-900 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
