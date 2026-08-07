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
    const statusInterval = setInterval(async () => {
      try {
        const st = await fetchStatus();
        setStatusData(st);
      } catch (e) {
        // ignore
      }
    }, 5000);
    return () => clearInterval(statusInterval);
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
    <div className="min-h-screen bg-[#0b0f19] pb-24 text-gray-100 font-['Outfit',sans-serif]">
      <Header onRefresh={loadData} isRefreshing={isRefreshing} />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-xs font-semibold backdrop-blur-md ${
            toast.isError
              ? 'bg-red-950/90 text-red-200 border-red-800'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
          }`}>
            {toast.isError ? <AlertCircle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6">
        {/* Status Dashboard Banner */}
        <StatusCard statusData={statusData} onUpdate={loadData} onShowMessage={showToast} />

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-gray-800/80 pb-4">
          <div className="flex items-center gap-2 p-1.5 glass-card rounded-2xl">
            <button
              onClick={() => setActiveTab('oci')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'oci'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>OCI Key & Kimlik</span>
            </button>

            <button
              onClick={() => setActiveTab('telegram')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'telegram'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Telegram Bot</span>
            </button>

            <button
              onClick={() => setActiveTab('resource')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'resource'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Sunucu & Subnet</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'logs'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              <TerminalIcon className="w-4 h-4" />
              <span>Konsol Logları</span>
            </button>
          </div>

          {hasUnsavedChanges && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium animate-pulse">
              <span>Kaydedilmemiş değişiklikler var</span>
            </div>
          )}
        </div>

        {/* Tab Content Panels */}
        <div className="glass-card rounded-2xl p-6 border border-gray-800 mb-8">
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

        {/* Floating Save Action Bar (when editing settings) */}
        {activeTab !== 'logs' && (
          <div className="sticky bottom-6 glass-card rounded-2xl p-4 border border-gray-700/60 shadow-2xl flex items-center justify-between gap-4">
            <div className="text-xs text-gray-400 font-medium">
              Ayarları değiştirdikten sonra <span className="text-white font-semibold">"Ayarları Kaydet"</span> butonuna basarak kalıcı storage'a yazın.
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold text-xs shadow-lg shadow-pink-500/25 transition active:scale-95 disabled:opacity-50"
            >
              <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
