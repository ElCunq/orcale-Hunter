import React from 'react';
import { Server, Network, Image as ImageIcon, KeyRound } from 'lucide-react';
import { ConfigData } from '../api/client';

interface ResourceConfigProps {
  config: ConfigData;
  onChange: (key: keyof ConfigData, value: string) => void;
}

export const ResourceConfig: React.FC<ResourceConfigProps> = ({ config, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-800 pb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Server className="w-5 h-5 text-emerald-400" /> Oracle Sunucu & Ağ Kaynak Ayarları
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Target Subnet, Compartment ID, Image OCID ve SSH Public Key bilgileri.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5 text-emerald-400" /> OCI Subnet OCID (Gerekli)
          </label>
          <input
            type="text"
            value={config.oci_subnet_id || ''}
            onChange={(e) => onChange('oci_subnet_id', e.target.value)}
            placeholder="ocid1.subnet.oc1.eu-frankfurt-1.aaaaaaa..."
            className="w-full glass-input rounded-xl px-4 py-2.5 text-xs font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-pink-400" /> Compartment OCID (Boşsa Tenancy kullanılır)
          </label>
          <input
            type="text"
            value={config.oci_compartment_id || ''}
            onChange={(e) => onChange('oci_compartment_id', e.target.value)}
            placeholder="ocid1.tenancy.oc1..aaaaaaa..."
            className="w-full glass-input rounded-xl px-4 py-2.5 text-xs font-mono"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-purple-400" /> Image OCID (Gerekli - Region'a özel Canonical Ubuntu Minimal aarch64 Image OCID'si)
          </label>
          <input
            type="text"
            value={config.oci_image_id || ''}
            onChange={(e) => onChange('oci_image_id', e.target.value)}
            placeholder="ocid1.image.oc1.eu-frankfurt-1.aaaaaaa..."
            className="w-full glass-input rounded-xl px-4 py-2.5 text-xs font-mono"
          />
        </div>
      </div>

      <div className="pt-2">
        <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-amber-400" /> SSH Authorized Key (Oluşturulacak sunucuya eklenecek SSH Public Key)
        </label>
        <textarea
          rows={3}
          value={config.ssh_public_key || ''}
          onChange={(e) => onChange('ssh_public_key', e.target.value)}
          placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... elcunq@proton.me"
          className="w-full glass-input rounded-xl p-3 text-xs font-mono resize-y"
        />
        <p className="text-[11px] text-gray-500 mt-1">
          Bu key `./ssh/authorized_keys` dosyasına ve container mount'una otomatik yazılır.
        </p>
      </div>
    </div>
  );
};
