import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SourceModal } from './components/SourceModal';
import { SqlStudio } from './components/SqlStudio';
import { SchemaBrowser } from './components/SchemaBrowser';
import { UserManagement } from './components/UserManagement';
import { CreateDatabaseModal } from './components/CreateDatabaseModal';
import { CreateTableModal } from './components/CreateTableModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DiscoveredSource, SchemaTreeResponse } from './types';
import { fetchDiscovery, fetchSchema, switchDatabase } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'editor' | 'schema' | 'users'>('editor');
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isCreateDbModalOpen, setIsCreateDbModalOpen] = useState(false);
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);

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

  const handleDatabaseCreated = async (newDbName: string) => {
    await handleSelectDatabase(newDbName);
    await loadSchema();
  };

  const handleTableCreated = async () => {
    await loadSchema();
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
        onOpenCreateDbModal={() => setIsCreateDbModalOpen(true)}
        onRefresh={() => {
          loadDiscovery();
          loadSchema();
        }}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'editor' && (
          <ErrorBoundary fallbackTitle="SQL Studio Error">
            <SqlStudio
              activeSource={activeSource}
              schemaData={schemaData}
              onOpenCreateTableModal={() => setIsCreateTableModalOpen(true)}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'schema' && (
          <ErrorBoundary fallbackTitle="Schema Visualizer Error">
            <SchemaBrowser
              schemaData={schemaData}
              onSelectTable={() => {
                setActiveTab('editor');
              }}
              onOpenCreateTableModal={() => setIsCreateTableModalOpen(true)}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'users' && (
          <ErrorBoundary fallbackTitle="User Management Error">
            <UserManagement activeSource={activeSource} />
          </ErrorBoundary>
        )}
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

      {/* Visual Database Creator Modal */}
      <ErrorBoundary fallbackTitle="Create Database Modal Error">
        <CreateDatabaseModal
          isOpen={isCreateDbModalOpen}
          onClose={() => setIsCreateDbModalOpen(false)}
          onDatabaseCreated={handleDatabaseCreated}
          activeSourceId={activeSource?.id}
        />
      </ErrorBoundary>

      {/* Visual Table Creator Modal */}
      <ErrorBoundary fallbackTitle="Create Table Modal Error">
        <CreateTableModal
          isOpen={isCreateTableModalOpen}
          onClose={() => setIsCreateTableModalOpen(false)}
          onTableCreated={handleTableCreated}
          activeSourceId={activeSource?.id}
          schemaData={schemaData}
        />
      </ErrorBoundary>
    </div>
  );
};
