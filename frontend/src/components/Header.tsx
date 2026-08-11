import React from 'react';
import { Database, Server, RefreshCw, Plus, Shield, Code, Network, Layers, PlusCircle, Star, Github } from 'lucide-react';
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
    <header className="h-16 border-b border-slate-800 bg-[#0B0F19]/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-30">
      {/* Brand & Active Source & Database Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-[#0B0F19] rounded-[10px] flex items-center justify-center">
              <Database className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                PgPulse
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-full">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">PostgreSQL Studio & Workbench</p>
          </div>
        </div>

        {/* Source Switcher Button */}
        <div className="h-6 w-[1px] bg-slate-800" />

        <button
          onClick={onOpenSourceModal}
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all text-sm group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${activeSource ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400' : 'bg-amber-500'}`} />
            <Server className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            <span className="font-medium text-slate-200">
              {activeSource ? activeSource.name : 'Select PostgreSQL Source'}
            </span>
          </div>
          <Plus className="w-3.5 h-3.5 text-slate-400 ml-1" />
        </button>

        {/* Database Selector Dropdown & New DB Button */}
        {activeSource && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-900 border border-cyan-800/60 rounded-lg px-2 py-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-semibold uppercase text-slate-400">DB:</span>
              <select
                value={activeDb}
                onChange={(e) => onSelectDatabase(e.target.value)}
                className="bg-transparent text-xs font-bold text-cyan-300 font-mono focus:outline-none cursor-pointer"
              >
                {availableDbs.map((dbName) => (
                  <option key={dbName} value={dbName} className="bg-slate-900 text-slate-200 font-mono">
                    {dbName}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onOpenCreateDbModal}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Create a new PostgreSQL database"
            >
              <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>+ New DB</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'editor'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Code className="w-4 h-4" />
          SQL Studio
        </button>

        <button
          onClick={() => setActiveTab('schema')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'schema'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Network className="w-4 h-4" />
          Schema & ERD
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Shield className="w-4 h-4" />
          Users & Access
        </button>
      </div>

      {/* Action utilities & GitHub Star Button */}
      <div className="flex items-center gap-3">
        <a
          href="https://github.com/ali0083moi/pgPulse"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 hover:from-amber-500/20 hover:to-yellow-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all transform hover:-translate-y-0.5 cursor-pointer group"
          title="Give PgPulse a Star on GitHub!"
        >
          <Star className="w-4 h-4 text-amber-400 fill-amber-400/40 group-hover:fill-amber-400 group-hover:scale-110 transition-all duration-300" />
          <span className="hidden sm:inline font-bold">Star on GitHub</span>
          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
            ★
          </span>
        </a>

        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
