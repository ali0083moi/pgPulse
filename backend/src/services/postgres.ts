import { Pool, PoolConfig, FieldDef } from 'pg';

export interface ConnectionConfig {
  id: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}

export interface QueryResultPayload {
  command: string;
  rowCount: number | null;
  durationMs: number;
  columns: Array<{ name: string; dataTypeId: number; type?: string }>;
  rows: any[];
  error?: string;
}

const activePools = new Map<string, Pool>();
const activeConfigs = new Map<string, ConnectionConfig>();

export function getOrCreatePool(config: ConnectionConfig): Pool {
  const existing = activePools.get(config.id);
  if (existing) {
    return existing;
  }

  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password || undefined,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  const pool = new Pool(poolConfig);
  activePools.set(config.id, pool);
  activeConfigs.set(config.id, config);
  return pool;
}

export function getActiveConfig(sourceId: string): ConnectionConfig | undefined {
  return activeConfigs.get(sourceId);
}

export async function switchDatabase(sourceId: string, targetDatabase: string): Promise<{ success: boolean; message: string }> {
  const currentConfig = activeConfigs.get(sourceId);
  if (!currentConfig) {
    throw new Error(`No active connection found for source ID: ${sourceId}`);
  }

  // End existing pool
  const oldPool = activePools.get(sourceId);
  if (oldPool) {
    await oldPool.end().catch(() => {});
    activePools.delete(sourceId);
  }

  const newConfig: ConnectionConfig = {
    ...currentConfig,
    database: targetDatabase,
  };

  // Create new pool targeting targetDatabase
  getOrCreatePool(newConfig);
  return { success: true, message: `Switched database to '${targetDatabase}'` };
}

export async function testConnection(config: ConnectionConfig): Promise<{ success: boolean; message: string; version?: string }> {
  let tempPool: Pool | null = null;
  try {
    tempPool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password || undefined,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 4000,
    });

    const res = await tempPool.query('SELECT version();');
    const version = res.rows[0]?.version || 'PostgreSQL';
    await tempPool.end();

    // Cache config
    // End old pool if switching config
    const old = activePools.get(config.id);
    if (old) {
      await old.end().catch(() => {});
      activePools.delete(config.id);
    }

    getOrCreatePool(config);

    return { success: true, message: 'Connected successfully', version };
  } catch (err: any) {
    if (tempPool) {
      tempPool.end().catch(() => {});
    }
    return { success: false, message: err.message || 'Failed to connect to database' };
  }
}

export async function executeQuery(
  sourceId: string,
  sql: string,
  overrideCredentials?: { user?: string; password?: string }
): Promise<QueryResultPayload> {
  const config = activeConfigs.get(sourceId);
  if (!config) {
    throw new Error(`No active connection found for source ID: ${sourceId}`);
  }

  let pool: Pool;
  if (overrideCredentials && (overrideCredentials.user || overrideCredentials.password)) {
    // Create temporary pool for elevated superuser action
    pool = new Pool({
      host: config.host,
      port: config.port,
      user: overrideCredentials.user || config.user,
      password: overrideCredentials.password || config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });
  } else {
    pool = getOrCreatePool(config);
  }

  const startTime = Date.now();
  try {
    const res = await pool.query(sql);
    const durationMs = Date.now() - startTime;

    // Handle multiple queries result array if pg returns array
    const lastResult = Array.isArray(res) ? res[res.length - 1] : res;
    const fields: FieldDef[] = lastResult.fields || [];

    const columns = fields.map((f) => ({
      name: f.name,
      dataTypeId: f.dataTypeID,
    }));

    if (overrideCredentials) {
      await pool.end().catch(() => {});
    }

    return {
      command: lastResult.command || 'OK',
      rowCount: lastResult.rowCount ?? lastResult.rows?.length ?? 0,
      durationMs,
      columns,
      rows: lastResult.rows || [],
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    if (overrideCredentials) {
      await pool.end().catch(() => {});
    }
    return {
      command: 'ERROR',
      rowCount: 0,
      durationMs,
      columns: [],
      rows: [],
      error: err.message || 'SQL Execution Error',
    };
  }
}

export async function disconnectSource(sourceId: string) {
  const pool = activePools.get(sourceId);
  if (pool) {
    await pool.end().catch(() => {});
    activePools.delete(sourceId);
    activeConfigs.delete(sourceId);
  }
}
