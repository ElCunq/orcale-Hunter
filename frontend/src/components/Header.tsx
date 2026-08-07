import React from 'react';
import { ShieldCheck, Cpu, Terminal, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, isRefreshing }) => {
  return (
    <header className="sticky top-0 z-50 glass-card border-b border-gray-800/80 px-6 py-4 mb-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 via-purple-600 to-cyan-500 p-0.5 shadow-lg shadow-pink-500/20">
            <div className="w-full h-full bg-dark-900 rounded-[10px] flex items-center justify-center">
              <Cpu className="w-5 h-5 text-pink-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-pink-400 bg-clip-text text-transparent">
              Oracle A1 Hunter
            </h1>
            <p className="text-xs text-gray-400 font-mono">VM.Standard.A1.Flex (2 OCPU / 12GB RAM / 200GB)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-300 text-xs font-medium border border-gray-700/60 transition duration-200 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-pink-400' : ''}`} />
            <span>Yenile</span>
          </button>

          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            OCI API Active
          </span>
        </div>
      </div>
    </header>
  );
};
