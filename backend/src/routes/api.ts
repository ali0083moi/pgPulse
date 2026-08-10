import { Router } from 'express';
import { discoverDockerSources, discoverLocalSources, DiscoveredSource } from '../services/discovery';
import { testConnection, executeQuery, disconnectSource, switchDatabase, ConnectionConfig } from '../services/postgres';
import { getSchemaTree, getDatabases } from '../services/schema';
import { getUsersAndRoles, createUserRole, changeUserPassword, toggleDatabaseAccess, resetSystemOrContainerPassword } from '../services/userAdmin';

const router = Router();

// Store manual connection sources in-memory
const manualSources: DiscoveredSource[] = [];

// GET /api/discovery
router.get('/discovery', async (req, res) => {
  try {
    const dockerSources = await discoverDockerSources();
    const localSources = await discoverLocalSources();
    res.json({
      dockerSources,
      localSources,
      manualSources,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/connect
router.post('/connect', async (req, res) => {
  try {
    const config: ConnectionConfig = req.body;
    if (!config.id || !config.host || !config.port || !config.user || !config.database) {
      return res.status(400).json({ error: 'Missing required connection parameters' });
    }

    const testRes = await testConnection(config);
    if (!testRes.success) {
      return res.status(400).json(testRes);
    }

    if (config.id.startsWith('manual-')) {
      const exists = manualSources.some((s) => s.id === config.id);
      if (!exists) {
        manualSources.push({
          id: config.id,
          name: `Manual: ${config.host}:${config.port} (${config.database})`,
          type: 'manual',
          host: config.host,
          port: config.port,
          status: 'running',
          user: config.user,
          database: config.database,
        });
      }
    }

    res.json(testRes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/switch-database
router.post('/switch-database', async (req, res) => {
  try {
    const { sourceId, database } = req.body;
    if (!sourceId || !database) {
      return res.status(400).json({ error: 'sourceId and database parameters are required' });
    }

    const switchRes = await switchDatabase(sourceId, database);
    const databases = await getDatabases(sourceId);
    const schemaData = await getSchemaTree(sourceId);

    res.json({
      ...switchRes,
      databases,
      ...schemaData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disconnect
router.post('/disconnect', async (req, res) => {
  try {
    const { sourceId } = req.body;
    if (sourceId) {
      await disconnectSource(sourceId);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/query
router.post('/query', async (req, res) => {
  try {
    const { sourceId, sql, superuserCreds } = req.body;
    if (!sourceId || !sql) {
      return res.status(400).json({ error: 'sourceId and sql parameters are required' });
    }

    const result = await executeQuery(sourceId, sql, superuserCreds);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schema
router.get('/schema', async (req, res) => {
  try {
    const sourceId = req.query.sourceId as string;
    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId parameter is required' });
    }

    const databases = await getDatabases(sourceId);
    const schemaData = await getSchemaTree(sourceId);

    res.json({
      databases,
      ...schemaData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users
router.get('/users', async (req, res) => {
  try {
    const sourceId = req.query.sourceId as string;
    const superuserUser = req.query.superUser as string;
    const superuserPass = req.query.superPass as string;

    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId parameter is required' });
    }

    const creds = superuserUser || superuserPass ? { user: superuserUser, password: superuserPass } : undefined;
    const data = await getUsersAndRoles(sourceId, creds);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/create
router.post('/users/create', async (req, res) => {
  try {
    const { sourceId, data, superuserCreds } = req.body;
    const result = await createUserRole(sourceId, data, superuserCreds);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/change-password
router.post('/users/change-password', async (req, res) => {
  try {
    const { sourceId, data, superuserCreds } = req.body;
    const result = await changeUserPassword(sourceId, data, superuserCreds);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/grant-privileges
router.post('/users/grant-privileges', async (req, res) => {
  try {
    const { sourceId, data, superuserCreds } = req.body;
    const result = await toggleDatabaseAccess(sourceId, data, superuserCreds);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/reset-system-password
router.post('/users/reset-system-password', async (req, res) => {
  try {
    const result = await resetSystemOrContainerPassword(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
