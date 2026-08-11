import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SourceModal } from './components/SourceModal';
import { SqlStudio } from './components/SqlStudio';
import { SchemaBrowser } from './components/SchemaBrowser';
import { UserManagement } from './components/UserManagement';
import { DiscoveredSource, SchemaTreeResponse } from './types';
import { fetchDiscovery, fetchSchema, switchDatabase } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'editor' | 'schema' | 'users'>('editor');
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);

  // Discovered Sources
  const [dockerSources, setDockerSources] = useState<DiscoveredSource[]>([]);
  const [localSources, setLocalSources] = useState<DiscoveredSource[]>([]);
  const [manualSources, setManualSources] = useState<DiscoveredSource[]>([]);
  const [activeSource, setActiveSource] = useState<DiscoveredSource | null>(null);

  // Schema & Databases
  const [availableDbs, setAvailableDbs] = useState<string[]>([]);
  const [schemaData, setSchemaData] = useState<SchemaTreeResponse | null>(null);
  const [activeDb, setActiveDb] = useState<string>('postgres');

  const loadDiscovery = async () => {
    try {
      const res = await fetchDiscovery();
      setDockerSources(res.dockerSources);
      setLocalSources(res.localSources);
      setManualSources(res.manualSources);

      if (!activeSource) {
        setIsSourceModalOpen(true);
      }
    } catch (err) {
      console.warn('Failed to load discovery:', err);
    }
  };

  const loadSchema = async () => {
    if (!activeSource) return;
    try {
      const data = await fetchSchema(activeSource.id);
      setSchemaData(data);
      if (data.databases && data.databases.length > 0) {
        setAvailableDbs(data.databases);
        if (!data.databases.includes(activeDb)) {
          setActiveDb(data.databases[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load schema:', err);
    }
  };

  const handleSelectDatabase = async (newDb: string) => {
    if (!activeSource) return;
    try {
      const res = await switchDatabase(activeSource.id, newDb);
      setActiveDb(newDb);
      if (res.databases) setAvailableDbs(res.databases);
      setSchemaData({
        databases: res.databases || availableDbs,
        schemas: res.schemas || [],
        tables: res.tables || [],
        foreignKeys: res.foreignKeys || [],
      });
    } catch (err) {
      console.warn('Failed to switch database:', err);
    }
  };

  useEffect(() => {
    loadDiscovery();
  }, []);

  useEffect(() => {
    if (activeSource) {
      loadSchema();
    }
  }, [activeSource]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0F19] text-slate-100 overflow-hidden font-sans">
      {/* Top Bar Header */}
      <Header
        activeSource={activeSource}
        onOpenSourceModal={() => setIsSourceModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeDb={activeDb}
        availableDbs={availableDbs}
        onSelectDatabase={handleSelectDatabase}
        onRefresh={() => {
          loadDiscovery();
          loadSchema();
        }}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'editor' && (
          <SqlStudio activeSource={activeSource} schemaData={schemaData} />
        )}

        {activeTab === 'schema' && (
          <SchemaBrowser
            schemaData={schemaData}
            onSelectTable={() => {
              setActiveTab('editor');
            }}
          />
        )}

        {activeTab === 'users' && <UserManagement activeSource={activeSource} />}
      </main>

      {/* Source Switcher & Connection Modal */}
      <SourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        dockerSources={dockerSources}
        localSources={localSources}
        manualSources={manualSources}
        activeSource={activeSource}
        onSelectSource={(src) => {
          setActiveSource(src);
          setIsSourceModalOpen(false);
        }}
      />
    </div>
  );
};
