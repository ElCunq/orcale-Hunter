import React, { useEffect, useRef, useState } from 'react';
import { Terminal, RefreshCw, ArrowDown, Download, Copy, Check } from 'lucide-react';
import { fetchLogs } from '../api/client';

interface LogViewerProps {
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ autoRefresh, onToggleAutoRefresh }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchLogs(200);
      setLogs(data.logs || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadLogs();
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hunter-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="shadcn-card rounded-lg overflow-hidden flex flex-col h-[520px] bg-zinc-950 border-zinc-800">
      {/* Header Bar */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-medium text-zinc-200">Hunter Canlı Konsol Logları</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
            {logs.length} satır
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleAutoRefresh}
            className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1.5 transition ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'}`}></span>
            Otomatik Yenile (4s)
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition ${
              autoScroll
                ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
            }`}
          >
            <ArrowDown className="w-3 h-3" />
            Kaydır
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition border border-zinc-800"
            title="Logları Kopyala"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleDownloadLogs}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition border border-zinc-800"
            title="Log İndir"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition border border-zinc-800 disabled:opacity-50"
            title="Şimdi Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 p-4 bg-[#09090b] font-mono text-[11px] leading-relaxed overflow-y-auto selection:bg-zinc-800 selection:text-white">
        {logs.map((line, idx) => {
          let lineColor = 'text-zinc-300';
          if (line.includes('[SUCCESS]') || line.includes('✅')) lineColor = 'text-emerald-400 font-semibold';
          else if (line.includes('[ERROR]') || line.includes('❌')) lineColor = 'text-rose-400 font-semibold';
          else if (line.includes('[WARN]')) lineColor = 'text-amber-300';
          else if (line.includes('[INFO]')) lineColor = 'text-sky-300';

          return (
            <div key={idx} className={`py-0.5 whitespace-pre-wrap break-all ${lineColor}`}>
              <span className="text-zinc-600 select-none mr-3 text-[10px]">{(idx + 1).toString().padStart(3, ' ')}</span>
              {line}
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};
