import React, { useState } from 'react';
import { Send, MessageSquare, Bot } from 'lucide-react';
import { ConfigData, testTelegram } from '../api/client';

interface TelegramConfigProps {
  config: ConfigData;
  onChange: (key: keyof ConfigData, value: string) => void;
  onShowMessage: (msg: string, isError?: boolean) => void;
}

export const TelegramConfig: React.FC<TelegramConfigProps> = ({ config, onChange, onShowMessage }) => {
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!config.telegram_bot_token || !config.telegram_chat_id) {
      onShowMessage('Lütfen önce Telegram Bot Token ve Chat ID alanlarını doldurun.', true);
      return;
    }
    setTesting(true);
    try {
      const res = await testTelegram(config.telegram_bot_token, config.telegram_chat_id);
      onShowMessage(res.message);
    } catch (e: any) {
      onShowMessage(e.message || 'Telegram bildirimi gönderilemedi.', true);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-800 pb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan-400" /> Telegram Bot Bildirim Ayarları
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Instance bulunduğunda veya servis durum güncellemelerinde Telegram hesabınıza anlık mesaj gönderilir.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-cyan-400" /> TELEGRAM_BOT_TOKEN
          </label>
          <input
            type="password"
            value={config.telegram_bot_token || ''}
            onChange={(e) => onChange('telegram_bot_token', e.target.value)}
            placeholder="123456789:ABCdefGhIJKlmNo..."
            className="w-full glass-input rounded-xl px-4 py-2.5 text-xs font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" /> TELEGRAM_CHAT_ID
          </label>
          <input
            type="text"
            value={config.telegram_chat_id || ''}
            onChange={(e) => onChange('telegram_chat_id', e.target.value)}
            placeholder="987654321"
            className="w-full glass-input rounded-xl px-4 py-2.5 text-xs font-mono"
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
        >
          <Send className={`w-3.5 h-3.5 ${testing ? 'animate-pulse' : ''}`} />
          <span>{testing ? 'Mesaj Gönderiliyor...' : 'Test Mesajı Gönder'}</span>
        </button>
      </div>
    </div>
  );
};
