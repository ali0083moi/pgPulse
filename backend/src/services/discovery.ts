import Docker from 'dockerode';
import net from 'net';

export interface DiscoveredSource {
  id: string;
  name: string;
  type: 'docker' | 'local' | 'manual';
  host: string;
  port: number;
  containerId?: string;
  status: 'running' | 'available' | 'unknown';
  user?: string;
  database?: string;
  defaultPassword?: string;
}

const isWindows = process.platform === 'win32';
const dockerSocketPath = isWindows
  ? '//./pipe/docker_engine'
  : '/var/run/docker.sock';

let docker: Docker | null = null;
try {
  docker = new Docker({ socketPath: dockerSocketPath });
} catch (e) {
  console.warn('Docker socket initialization warning:', e);
}

export async function discoverDockerSources(): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];
  if (!docker) return sources;

  try {
    const containers = await docker.listContainers({ all: false });
    for (const c of containers) {
      const isPostgresImage = c.Image.toLowerCase().includes('postgres');
      const has5432Port = c.Ports.some(
        (p) => p.PrivatePort === 5432 || p.PublicPort === 5432
      );

      if (isPostgresImage || has5432Port) {
        const publicPort =
          c.Ports.find((p) => p.PublicPort)?.PublicPort || 5432;
        const containerName = c.Names[0]?.replace(/^\//, '') || 'pg-container';

        // Inspect container environment variables for POSTGRES_USER, POSTGRES_DB, POSTGRES_PASSWORD
        let user = 'postgres';
        let database = 'postgres';
        let defaultPassword = '';

        try {
          const details = await docker.getContainer(c.Id).inspect();
          const envArray = details.Config?.Env || [];
          for (const item of envArray) {
            if (item.startsWith('POSTGRES_USER=')) user = item.split('=')[1] || 'postgres';
            if (item.startsWith('POSTGRES_DB=')) database = item.split('=')[1] || 'postgres';
            if (item.startsWith('POSTGRES_PASSWORD=')) defaultPassword = item.split('=')[1] || '';
          }
        } catch (e) {
          // fallback to defaults
        }

        sources.push({
          id: `docker-${c.Id.substring(0, 12)}`,
          name: `Docker: ${containerName} (${c.Image.split(':')[0]})`,
          type: 'docker',
          host: '127.0.0.1',
          port: publicPort,
          containerId: c.Id,
          status: 'running',
          user,
          database,
          defaultPassword,
        });
      }
    }
  } catch (err) {
    console.log('Docker discovery not available or permission denied:', (err as Error).message);
  }

  return sources;
}

export async function checkPort(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export async function discoverLocalSources(): Promise<DiscoveredSource[]> {
  const portsToScan = [5432, 5433, 5434];
  const sources: DiscoveredSource[] = [];

  for (const port of portsToScan) {
    const isOpen = await checkPort(port);
    if (isOpen) {
      sources.push({
        id: `local-port-${port}`,
        name: `Localhost Postgres (Port ${port})`,
        type: 'local',
        host: '127.0.0.1',
        port,
        status: 'available',
        user: 'postgres',
        database: 'postgres'
      });
    }
  }

  return sources;
}
