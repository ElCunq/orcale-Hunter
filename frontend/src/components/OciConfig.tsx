import React from 'react';
import { Key, Globe, Shield, User, FileKey } from 'lucide-react';
import { ConfigData } from '../api/client';

interface OciConfigProps {
  config: ConfigData;
  onChange: (key: keyof ConfigData, value: string) => void;
}

export const OciConfig: React.FC<OciConfigProps> = ({ config, onChange }) => {
  const handlePemFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          onChange('private_key', content);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-800 pb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Key className="w-5 h-5 text-pink-400" /> OCI API Kimlik & Anahtar Bilgileri
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Oracle Cloud kimlik bilgileriniz ve Private Key (`private-key.pem`) ayarları.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-pink-400" /> User OCID
          </label>
          <input
            type="text"
            value={config.oci_user || ''}
            onChange={(e) => onChange('oci_user', e.target.value)}
            placeholder="ocid1.user.oc1..aaaaaaa..."
            className="w-full glass-input rounded-xl px-4 py-2.5 text-xs font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-400" /> Tenancy OCID
          </label>
          <input
            type="text"
            value={config.oci_tenancy || ''}
            onChange={(e) => onChange('oci_tenancy', e.target.value)}
            placeholder="ocid1.tenancy.oc1..aaaaaaa..."
            className="w-full glass-input rounded-xl px-4 py-2.5 text-xs font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-cyan-400" /> API Key Fingerprint
          </label>
          <input
            type="text"
            value={config.oci_fingerprint || ''}
            onChange={(e) => onChange('oci_fingerprint', e.target.value)}
            placeholder="45:22:c4:8a:36:d3:..."
            className="w-full glass-input rounded-xl px-4 py-2.5 text-xs font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-400" /> OCI Region
          </label>
          <input
            type="text"
            value={config.oci_region || 'eu-frankfurt-1'}
            onChange={(e) => onChange('oci_region', e.target.value)}
            placeholder="eu-frankfurt-1"
            className="w-full glass-input rounded-xl px-4 py-2.5 text-xs font-mono"
          />
        </div>
      </div>

      {/* Private Key PEM Editor */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <FileKey className="w-4 h-4 text-amber-400" /> OCI Private Key (`private-key.pem`)
          </label>
          <label className="cursor-pointer text-xs font-medium text-pink-400 hover:text-pink-300 flex items-center gap-1 bg-pink-500/10 hover:bg-pink-500/20 px-3 py-1 rounded-lg border border-pink-500/30 transition">
            <span>.pem Dosyası Yükle</span>
            <input type="file" accept=".pem,.key,.txt" onChange={handlePemFileUpload} className="hidden" />
          </label>
        </div>

        <textarea
          rows={8}
          value={config.private_key || ''}
          onChange={(e) => onChange('private_key', e.target.value)}
          placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
          className="w-full glass-input rounded-xl p-4 text-xs font-mono leading-relaxed resize-y focus:ring-1 focus:ring-pink-500"
          spellCheck={false}
        />
        <p className="text-[11px] text-gray-500 mt-1">
          Bu anahtar sunucuda `./oci/private-key.pem` dosyasına güvenli şekilde kaydedilir ve container'a mount edilir.
        </p>
      </div>
    </div>
  );
};
