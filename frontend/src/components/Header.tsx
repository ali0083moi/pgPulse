import React from 'react';
import { Database, Server, RefreshCw, Plus, Shield, Code, Network, Layers } from 'lucide-react';
import { DiscoveredSource } from '../types';

interface HeaderProps {
  activeSource: DiscoveredSource | null;
  onOpenSourceModal: () => void;
  activeTab: 'editor' | 'schema' | 'users';
  setActiveTab: (tab: 'editor' | 'schema' | 'users') => void;
  activeDb: string;
  availableDbs: string[];
  onSelectDatabase: (db: string) => void;
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
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all text-sm group"
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

        {/* Database Selector Dropdown */}
        {activeSource && availableDbs.length > 0 && (
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
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
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
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
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
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'users'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Shield className="w-4 h-4" />
          Users & Access
        </button>
      </div>

      {/* Action utilities */}
      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
