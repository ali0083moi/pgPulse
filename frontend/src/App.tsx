import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SourceModal } from './components/SourceModal';
import { SqlStudio } from './components/SqlStudio';
import { SchemaBrowser } from './components/SchemaBrowser';
import { UserManagement } from './components/UserManagement';
import { CreateDatabaseModal } from './components/CreateDatabaseModal';
import { CreateTableModal } from './components/CreateTableModal';
import { CreateIndexModal } from './components/CreateIndexModal';
import { DbActivityModal } from './components/DbActivityModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DiscoveredSource, SchemaTreeResponse } from './types';
import { fetchDiscovery, fetchSchema, switchDatabase, connectSource } from './services/api';

const STORAGE_KEY_ACTIVE_SOURCE = 'pgpulse_active_source';
const STORAGE_KEY_ACTIVE_DB = 'pgpulse_active_db';
const STORAGE_KEY_CREDS = 'pgpulse_source_credentials';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'editor' | 'schema' | 'users'>('editor');
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isCreateDbModalOpen, setIsCreateDbModalOpen] = useState(false);
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);
  const [isCreateIndexModalOpen, setIsCreateIndexModalOpen] = useState(false);
  const [isDbActivityModalOpen, setIsDbActivityModalOpen] = useState(false);
  const [isRefreshingDiscovery, setIsRefreshingDiscovery] = useState(false);

  // Discovered Sources
  const [dockerSources, setDockerSources] = useState<DiscoveredSource[]>([]);
  const [localSources, setLocalSources] = useState<DiscoveredSource[]>([]);
  const [manualSources, setManualSources] = useState<DiscoveredSource[]>([]);
  const [activeSource, setActiveSource] = useState<DiscoveredSource | null>(null);

  // Schema & Databases
  const [availableDbs, setAvailableDbs] = useState<string[]>([]);
  const [schemaData, setSchemaData] = useState<SchemaTreeResponse | null>(null);
  const [activeDb, setActiveDb] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_DB) || 'postgres';
  });

  const loadDiscovery = async (autoConnectSaved = false) => {
    setIsRefreshingDiscovery(true);
    try {
      const res = await fetchDiscovery();
      setDockerSources(res.dockerSources);
      setLocalSources(res.localSources);
      setManualSources(res.manualSources);

      // Auto-reconnect saved source on first app mount
      if (autoConnectSaved && !activeSource) {
        const savedSourceStr = localStorage.getItem(STORAGE_KEY_ACTIVE_SOURCE);
        if (savedSourceStr) {
          try {
            const savedSource = JSON.parse(savedSourceStr) as DiscoveredSource;
            const savedCredsStr = localStorage.getItem(STORAGE_KEY_CREDS);
            const savedCredsMap = savedCredsStr ? JSON.parse(savedCredsStr) : {};
            const creds = savedCredsMap[savedSource.id] || {};

            const userToUse = savedSource.user || creds.user || 'postgres';
            const passToUse = creds.pass !== undefined ? creds.pass : (savedSource.defaultPassword || '');
            const dbToUse = localStorage.getItem(STORAGE_KEY_ACTIVE_DB) || savedSource.database || creds.db || 'postgres';

            const connRes = await connectSource({
              id: savedSource.id,
              host: savedSource.host,
              port: savedSource.port,
              user: userToUse,
              password: passToUse,
              database: dbToUse,
            });

            if (connRes.success) {
              const restoredSource = { ...savedSource, user: userToUse, database: dbToUse };
              setActiveSource(restoredSource);
              setIsSourceModalOpen(false);
              return;
            }
          } catch (e) {
            console.warn('Auto-reconnect to saved source failed:', e);
          }
        }

        // If no saved source or auto-reconnect failed, open source modal
        setIsSourceModalOpen(true);
      }
    } catch (err) {
      console.warn('Failed to load discovery:', err);
    } finally {
      setIsRefreshingDiscovery(false);
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
          const fallbackDb = data.databases[0];
          setActiveDb(fallbackDb);
          localStorage.setItem(STORAGE_KEY_ACTIVE_DB, fallbackDb);
        }
      }
    } catch (err) {
      console.warn('Failed to load schema:', err);
    }
  };

  const handleSelectSource = (src: DiscoveredSource) => {
    setActiveSource(src);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_SOURCE, JSON.stringify(src));
      if (src.database) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_DB, src.database);
        setActiveDb(src.database);
      }
    } catch (e) {
      console.warn('Failed to save active source to localStorage:', e);
    }
  };

  const handleSelectDatabase = async (newDb: string) => {
    if (!activeSource) return;
    try {
      const res = await switchDatabase(activeSource.id, newDb);
      setActiveDb(newDb);
      localStorage.setItem(STORAGE_KEY_ACTIVE_DB, newDb);

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

  const handleIndexCreated = async () => {
    await loadSchema();
  };

  useEffect(() => {
    loadDiscovery(true);
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
          loadDiscovery(false);
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
              onOpenCreateIndexModal={() => setIsCreateIndexModalOpen(true)}
              onOpenDbActivityModal={() => setIsDbActivityModalOpen(true)}
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
        onSelectSource={handleSelectSource}
        onRefreshDiscovery={() => loadDiscovery(false)}
        isRefreshingDiscovery={isRefreshingDiscovery}
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

      {/* Visual Index Creator Modal */}
      <ErrorBoundary fallbackTitle="Create Index Modal Error">
        <CreateIndexModal
          isOpen={isCreateIndexModalOpen}
          onClose={() => setIsCreateIndexModalOpen(false)}
          onIndexCreated={handleIndexCreated}
          activeSourceId={activeSource?.id}
          schemaData={schemaData}
        />
      </ErrorBoundary>

      {/* Live DB Activity & Process Killer Modal */}
      <ErrorBoundary fallbackTitle="DB Activity Monitor Error">
        <DbActivityModal
          isOpen={isDbActivityModalOpen}
          onClose={() => setIsDbActivityModalOpen(false)}
          activeSourceId={activeSource?.id}
        />
      </ErrorBoundary>
    </div>
  );
};
