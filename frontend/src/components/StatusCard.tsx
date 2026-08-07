import React, { useState } from 'react';
import { Play, Square, CheckCircle, AlertTriangle, Activity, Wifi, Trash2, Send } from 'lucide-react';
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
    <div className="glass-card rounded-2xl p-6 mb-8 relative overflow-hidden border border-gray-800">
      {/* Background ambient glow */}
      <div className={`absolute -right-16 -top-16 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
        hasMarker ? 'bg-emerald-500' : isRunning ? 'bg-pink-500 animate-pulse' : 'bg-gray-500'
      }`}></div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">Servis Durumu</span>
            {hasMarker ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/40">
                <CheckCircle className="w-3.5 h-3.5" /> Sunucu Bulundu & Oluşturuldu
              </span>
            ) : isRunning ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs font-semibold border border-pink-500/40 animate-pulse">
                <Activity className="w-3.5 h-3.5 animate-spin" /> Arıyor (Kapasite Taranıyor...)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-700/50 text-gray-300 text-xs font-semibold border border-gray-600/40">
                <Square className="w-3.5 h-3.5 text-gray-400" /> Durduruldu / Pasif
              </span>
            )}
          </div>

          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            {isRunning ? 'Hunter Aktif Çalışıyor' : hasMarker ? 'İşlem Başarıyla Tamamlandı' : 'Hunter Servisi Hazır'}
          </h2>

          <p className="text-xs text-gray-400 max-w-xl">
            {hasMarker
              ? 'Instance başarıyla açıldı. Tekrar tarama yapmak isterseniz aşağıdaki "Başarı Markerını Temizle" butonuna basın.'
              : isRunning
              ? 'Docker container arka planda 10 dakikalık periyotlarla Availability Domain\'leri tarıyor.'
              : 'Ayarlarınızı tamamladıktan sonra servisi başlatabilirsiniz.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={loading === 'stop'}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-semibold text-sm shadow-lg shadow-red-900/30 transition active:scale-95 disabled:opacity-50"
            >
              <Square className="w-4 h-4 fill-current" />
              {loading === 'stop' ? 'Durduruluyor...' : 'Durdur'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={loading === 'start'}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-pink-500/25 transition active:scale-95 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              {loading === 'start' ? 'Başlatılıyor...' : 'Hunter Başlat'}
            </button>
          )}

          {hasMarker && (
            <button
              onClick={handleResetMarker}
              disabled={loading === 'reset'}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-sm font-medium transition active:scale-95 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {loading === 'reset' ? 'Siliniyor...' : 'Marker Temizle'}
            </button>
          )}

          <button
            onClick={handleTestOci}
            disabled={loading === 'test-oci'}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-cyan-300 border border-cyan-500/30 text-sm font-medium transition active:scale-95 disabled:opacity-50"
          >
            <Wifi className="w-4 h-4" />
            {loading === 'test-oci' ? 'Test Ediliyor...' : 'OCI Test Et'}
          </button>
        </div>
      </div>
    </div>
  );
};
