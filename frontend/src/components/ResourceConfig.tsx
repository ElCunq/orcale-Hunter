import React from 'react';
import { Server, Network, Image as ImageIcon, KeyRound, Cpu, HardDrive } from 'lucide-react';
import { ConfigData } from '../api/client';

interface ResourceConfigProps {
  config: ConfigData;
  onChange: (key: keyof ConfigData, value: string) => void;
}

export const ResourceConfig: React.FC<ResourceConfigProps> = ({ config, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-3">
        <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" /> Oracle Sunucu & Donanım Kaynak Ayarları
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Oluşturulacak VM.Standard.A1.Flex sunucusunun OCPU/RAM donanımı, ağ (Subnet) ve SSH bilgileri.
        </p>
      </div>

      {/* Target Spec Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Hedef OCPU Sayısı
          </label>
          <select
            value={config.oci_ocpus || '4'}
            onChange={(e) => onChange('oci_ocpus', e.target.value)}
            className="w-full shadcn-input font-mono cursor-pointer"
          >
            <option value="4">4 OCPU (Maksimum Always Free)</option>
            <option value="3">3 OCPU</option>
            <option value="2">2 OCPU</option>
            <option value="1">1 OCPU</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Hedef RAM Miktarı (GB)
          </label>
          <select
            value={config.oci_memory_gb || '24'}
            onChange={(e) => onChange('oci_memory_gb', e.target.value)}
            className="w-full shadcn-input font-mono cursor-pointer"
          >
            <option value="24">24 GB RAM (Maksimum Always Free)</option>
            <option value="18">18 GB RAM</option>
            <option value="12">12 GB RAM</option>
            <option value="6">6 GB RAM</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5 text-zinc-400" /> OCI Subnet OCID <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={config.oci_subnet_id || ''}
            onChange={(e) => onChange('oci_subnet_id', e.target.value)}
            placeholder="ocid1.subnet.oc1.eu-frankfurt-1.aaaaaaa..."
            className="w-full shadcn-input font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-zinc-400" /> Compartment OCID <span className="text-zinc-400 font-normal">(Opsiyonel - Boşsa Tenancy kullanılır)</span>
          </label>
          <input
            type="text"
            value={config.oci_compartment_id || ''}
            onChange={(e) => onChange('oci_compartment_id', e.target.value)}
            placeholder="ocid1.tenancy.oc1..aaaaaaa..."
            className="w-full shadcn-input font-mono"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-zinc-400" /> Image OCID <span className="text-zinc-400 font-normal">(Opsiyonel - Boş bırakılırsa en güncel Canonical Ubuntu ARM64 otomatik seçilir)</span>
          </label>
          <input
            type="text"
            value={config.oci_image_id || ''}
            onChange={(e) => onChange('oci_image_id', e.target.value)}
            placeholder="Boş bırakılabilir veya ocid1.image.oc1.eu-frankfurt-1.aaaaaaa..."
            className="w-full shadcn-input font-mono"
          />
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-zinc-400" /> SSH Authorized Public Key <span className="text-rose-400">*</span>
        </label>
        <textarea
          rows={3}
          value={config.ssh_public_key || ''}
          onChange={(e) => onChange('ssh_public_key', e.target.value)}
          placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... user@email.com"
          className="w-full shadcn-input font-mono text-xs resize-y"
        />
        <p className="text-[11px] text-zinc-400">
          Bu anahtar oluşturulan Ubuntu sunucusunun <code className="text-zinc-300 bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">authorized_keys</code> dosyasına otomatik yazılır.
        </p>
      </div>
    </div>
  );
};
