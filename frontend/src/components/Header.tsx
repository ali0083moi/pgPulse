import React from 'react';
import { Database, Server, RefreshCw, Plus, Shield, Code, Network, Layers, PlusCircle, Star } from 'lucide-react';
import { DiscoveredSource } from '../types';

interface HeaderProps {
  activeSource: DiscoveredSource | null;
  onOpenSourceModal: () => void;
  activeTab: 'editor' | 'schema' | 'users';
  setActiveTab: (tab: 'editor' | 'schema' | 'users') => void;
  activeDb: string;
  availableDbs: string[];
  onSelectDatabase: (db: string) => void;
  onOpenCreateDbModal: () => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeSource,
  onOpenSourceModal,
  activeTab,
  setActiveTab,
  activeDb,
  availableDbs,
  onSelectDatabase,
  onOpenCreateDbModal,
  onRefresh,
}) => {
  return (
    <header className="h-14 border-b border-[#30363D] bg-[#161B22] px-5 flex items-center justify-between shrink-0 z-30 select-none">
      {/* Brand & Active Source & Database Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1F6FEB]/15 border border-[#1F6FEB]/40 flex items-center justify-center text-[#58A6FF]">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-[#F0F6FC]">
                PgPulse
              </span>
              <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-[#21262D] text-[#8B949E] border border-[#30363D] rounded">
                v1.0
              </span>
            </div>
          </div>
        </div>

        <div className="h-5 w-[1px] bg-[#30363D]" />

        {/* Source Switcher Button */}
        <button
          onClick={onOpenSourceModal}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#0D1117] hover:bg-[#21262D] border border-[#30363D] transition-all text-xs group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${activeSource ? 'bg-[#3FB950]' : 'bg-[#D29922]'}`} />
            <Server className="w-3.5 h-3.5 text-[#8B949E] group-hover:text-[#58A6FF] transition-colors" />
            <span className="font-medium text-[#C9D1D9]">
              {activeSource ? activeSource.name : 'Select PostgreSQL Source'}
            </span>
          </div>
          <Plus className="w-3.5 h-3.5 text-[#8B949E] ml-1" />
        </button>

        {/* Database Selector Dropdown & New DB Button */}
        {activeSource && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#0D1117] border border-[#30363D] rounded-lg px-2.5 py-1">
              <Layers className="w-3.5 h-3.5 text-[#58A6FF]" />
              <span className="text-[11px] font-semibold uppercase text-[#8B949E]">DB:</span>
              <select
                value={activeDb}
                onChange={(e) => onSelectDatabase(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#58A6FF] font-mono focus:outline-none cursor-pointer"
              >
                {availableDbs.map((dbName) => (
                  <option key={dbName} value={dbName} className="bg-[#161B22] text-[#C9D1D9] font-mono">
                    {dbName}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onOpenCreateDbModal}
              className="px-2.5 py-1 rounded-lg bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#C9D1D9] hover:text-[#58A6FF] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              title="Create a new PostgreSQL database"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#58A6FF]" />
              <span>New DB</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-[#0D1117] p-1 rounded-lg border border-[#30363D]">
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 px-3.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${activeTab === 'editor'
              ? 'bg-[#1F6FEB] text-white font-semibold'
              : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#21262D]'
            }`}
        >
          <Code className="w-3.5 h-3.5" />
          SQL Studio
        </button>

        <button
          onClick={() => setActiveTab('schema')}
          className={`flex items-center gap-2 px-3.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${activeTab === 'schema'
              ? 'bg-[#1F6FEB] text-white font-semibold'
              : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#21262D]'
            }`}
        >
          <Network className="w-3.5 h-3.5" />
          Schema & ERD
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-3.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${activeTab === 'users'
              ? 'bg-[#1F6FEB] text-white font-semibold'
              : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#21262D]'
            }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Users & Access
        </button>
      </div>

      {/* Action utilities & GitHub Star Button */}
      <div className="flex items-center gap-2.5">
        <a
          href="https://github.com/ali0083moi/pgPulse"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#D29922] hover:bg-[#E3B341] border border-[#E3B341] text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer group"
          title="Give PgPulse a Star on GitHub!"
        >
          <Star className="w-3.5 h-3.5 text-slate-950 fill-slate-950 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">Star on GitHub</span>
        </a>

        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg bg-[#0D1117] hover:bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#C9D1D9] transition-colors cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
