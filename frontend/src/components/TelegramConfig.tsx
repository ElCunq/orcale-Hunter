import React, { useState } from 'react';
import { Send, MessageSquare, Bot, HelpCircle } from 'lucide-react';
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
      <div className="border-b border-zinc-800 pb-3">
        <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-400" /> Telegram Bot Bildirim Ayarları
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Sunucu oluşturulduğunda veya hata durumlarında anlık Telegram mesajı gönderilir.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-zinc-400" /> TELEGRAM_BOT_TOKEN <span className="text-rose-400">*</span>
          </label>
          <input
            type="password"
            value={config.telegram_bot_token || ''}
            onChange={(e) => onChange('telegram_bot_token', e.target.value)}
            placeholder="123456789:ABCdefGhIJKlmNo..."
            className="w-full shadcn-input font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-zinc-400" /> TELEGRAM_CHAT_ID <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={config.telegram_chat_id || ''}
            onChange={(e) => onChange('telegram_chat_id', e.target.value)}
            placeholder="987654321"
            className="w-full shadcn-input font-mono"
          />
        </div>
      </div>

      <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-400 space-y-1">
        <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
          <HelpCircle className="w-3.5 h-3.5 text-emerald-400" /> Telegram Chat ID Nasıl Alınır?
        </div>
        <p className="text-zinc-400 leading-relaxed">
          Telegram'da <code className="text-zinc-200 bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">@userinfobot</code> botuna mesaj atarak <strong>Id</strong> numaranızı öğrenebilirsiniz.
        </p>
      </div>

      <div className="pt-1">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition active:scale-95 disabled:opacity-50"
        >
          <Send className={`w-3.5 h-3.5 text-emerald-400 ${testing ? 'animate-spin' : ''}`} />
          <span>{testing ? 'Mesaj Gönderiliyor...' : 'Test Mesajı Gönder'}</span>
        </button>
      </div>
    </div>
  );
};
