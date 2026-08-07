import React, { useState } from 'react';
import { Play, Square, CheckCircle2, Activity, Wifi, RotateCcw } from 'lucide-react';
import { StatusData, startHunter, stopHunter, resetMarker, testOciConnection } from '../api/client';

interface StatusCardProps {
  statusData: StatusData | null;
  onUpdate: () => void;
  onShowMessage: (msg: string, isError?: boolean) => void;
}

export const StatusCard: React.FC<StatusCardProps> = ({ statusData, onUpdate, onShowMessage }) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading('start');
    try {
      const res = await startHunter();
      onShowMessage(res.message);
      onUpdate();
    } catch (e: any) {
      onShowMessage(e.message || 'Hunter başlatılamadı', true);
    } finally {
      setLoading(null);
    }
  };

  const handleStop = async () => {
    setLoading('stop');
    try {
      const res = await stopHunter();
      onShowMessage(res.message);
      onUpdate();
    } catch (e: any) {
      onShowMessage(e.message || 'Hunter durdurulamadı', true);
    } finally {
      setLoading(null);
    }
  };

  const handleResetMarker = async () => {
    setLoading('reset');
    try {
      const res = await resetMarker();
      onShowMessage(res.message);
      onUpdate();
    } catch (e: any) {
      onShowMessage(e.message || 'Marker temizlenemedi', true);
    } finally {
      setLoading(null);
    }
  };

  const handleTestOci = async () => {
    setLoading('test-oci');
    try {
      const res = await testOciConnection();
      onShowMessage(res.message + (res.availability_domains ? ` AD'ler: ${res.availability_domains.join(', ')}` : ''));
    } catch (e: any) {
      onShowMessage(e.message || 'OCI Bağlantı testi başarısız oldu', true);
    } finally {
      setLoading(null);
    }
  };

  const isRunning = statusData?.status === 'RUNNING';
  const hasMarker = statusData?.success_marker;

  return (
    <div className="shadcn-card p-6 mb-8 relative overflow-hidden bg-zinc-900/60 border-zinc-800">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-mono font-medium">Servis Durumu</span>
            {hasMarker ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sunucu Bulundu & Oluşturuldu
              </span>
            ) : isRunning ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Kapasite Taranıyor (Aktif)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 text-xs font-medium border border-zinc-700/60">
                <Square className="w-3.5 h-3.5" /> Durduruldu / Pasif
              </span>
            )}
          </div>

          <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">
            {isRunning ? 'Kapasite Avcısı Çalışıyor' : hasMarker ? 'İşlem Tamamlandı' : 'Hunter Hazır'}
          </h2>

          <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
            {hasMarker
              ? 'Oracle Cloud A1 Instance başarıyla oluşturuldu. Tekrar tarama yapmak için Marker Temizle butonunu kullanabilirsiniz.'
              : isRunning
              ? 'Container arka planda periyodik olarak tüm Availability Domain\'leri tarıyor.'
              : 'Konfigürasyonlarınızı kaydettikten sonra Hunter Başlat butonuna basarak taramayı başlatın.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={loading === 'stop'}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              {loading === 'stop' ? 'Durduruluyor...' : 'Hunter Durdur'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={loading === 'start'}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current text-zinc-900" />
              {loading === 'start' ? 'Başlatılıyor...' : 'Hunter Başlat'}
            </button>
          )}

          {hasMarker && (
            <button
              onClick={handleResetMarker}
              disabled={loading === 'reset'}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-medium transition active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {loading === 'reset' ? 'Siliniyor...' : 'Marker Temizle'}
            </button>
          )}

          <button
            onClick={handleTestOci}
            disabled={loading === 'test-oci'}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-medium transition active:scale-95 disabled:opacity-50"
          >
            <Wifi className="w-3.5 h-3.5 text-zinc-400" />
            {loading === 'test-oci' ? 'Test Ediliyor...' : 'OCI Test Et'}
          </button>
        </div>
      </div>
    </div>
  );
};
