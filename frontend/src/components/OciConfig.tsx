import React from 'react';
import { Key, Globe, Shield, User, FileKey, Upload } from 'lucide-react';
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
      <div className="border-b border-zinc-800 pb-3">
        <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-400" /> OCI API Kimlik & Anahtar Bilgileri
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Oracle Cloud Console &gt; User Settings &gt; API Keys alanından alınan kimlik değerleri.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-zinc-400" /> User OCID <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={config.oci_user || ''}
            onChange={(e) => onChange('oci_user', e.target.value)}
            placeholder="ocid1.user.oc1..aaaaaaa..."
            className="w-full shadcn-input font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-zinc-400" /> Tenancy OCID <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={config.oci_tenancy || ''}
            onChange={(e) => onChange('oci_tenancy', e.target.value)}
            placeholder="ocid1.tenancy.oc1..aaaaaaa..."
            className="w-full shadcn-input font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-zinc-400" /> API Key Fingerprint <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={config.oci_fingerprint || ''}
            onChange={(e) => onChange('oci_fingerprint', e.target.value)}
            placeholder="45:22:c4:8a:36:d3:..."
            className="w-full shadcn-input font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-zinc-400" /> OCI Region
          </label>
          <input
            type="text"
            value={config.oci_region || 'eu-frankfurt-1'}
            onChange={(e) => onChange('oci_region', e.target.value)}
            placeholder="eu-frankfurt-1"
            className="w-full shadcn-input font-mono"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-amber-400" /> Availability Domain (AD) Manuel Liste / Prefix <span className="text-zinc-400 font-normal">(Opsiyonel - API 401 verirse bypass için Örn: Xbrv:EU-FRANKFURT-1-AD-1,Xbrv:EU-FRANKFURT-1-AD-2 ya da Xbrv)</span>
          </label>
          <input
            type="text"
            value={config.oci_ad_list || ''}
            onChange={(e) => onChange('oci_ad_list', e.target.value)}
            placeholder="Xbrv:EU-FRANKFURT-1-AD-1,Xbrv:EU-FRANKFURT-1-AD-2,Xbrv:EU-FRANKFURT-1-AD-3"
            className="w-full shadcn-input font-mono text-xs"
          />
        </div>
      </div>

      {/* Private Key PEM Editor */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <FileKey className="w-3.5 h-3.5 text-zinc-400" /> OCI Private Key (`private-key.pem`) <span className="text-rose-400">*</span>
          </label>
          <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-md border border-zinc-700 transition">
            <Upload className="w-3.5 h-3.5" />
            <span>.pem Yükle</span>
            <input type="file" accept=".pem,.key,.txt" onChange={handlePemFileUpload} className="hidden" />
          </label>
        </div>

        <textarea
          rows={7}
          value={config.private_key || ''}
          onChange={(e) => onChange('private_key', e.target.value)}
          placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEowIBAAKCAQEA...&#10;-----END RSA PRIVATE KEY-----"
          className="w-full shadcn-input font-mono text-xs leading-relaxed resize-y"
          spellCheck={false}
        />
        <p className="text-[11px] text-zinc-400">
          Bu anahtar güvenli şekilde saklanır ve OCI CLI container mount'una kopyalanır.
        </p>
      </div>
    </div>
  );
};
