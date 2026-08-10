import { executeQuery } from './postgres';
import { getDatabases } from './schema';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface UserRoleInfo {
  rolname: string;
  isSuperuser: boolean;
  canCreateDb: boolean;
  canCreateRole: boolean;
  canLogin: boolean;
  hasPassword: boolean;
}

export interface UserDbAccess {
  username: string;
  database: string;
  hasAccess: boolean;
  privileges: string;
}

export async function getUsersAndRoles(sourceId: string, superuserCreds?: { user?: string; password?: string }) {
  const sql = `
    SELECT 
      rolname,
      rolsuper AS "isSuperuser",
      rolcreatedb AS "canCreateDb",
      rolcreaterole AS "canCreateRole",
      canlogin AS "canLogin",
      rolpassword IS NOT NULL AS "hasPassword"
    FROM pg_roles r
    JOIN (
      SELECT rolname AS name, pg_has_role(rolname, 'USAGE') AS canlogin FROM pg_roles
    ) u ON u.name = r.rolname
    WHERE rolname NOT LIKE 'pg_%'
    ORDER BY rolname;
  `;

  let res = await executeQuery(sourceId, sql, superuserCreds);
  if (res.error && res.error.includes('permission denied')) {
    return { error: res.error, requiresSuperuser: true };
  }

  // Fallback simple query if pg_roles columns vary
  if (res.error) {
    const fallbackSql = `SELECT usename AS rolname, usesuper AS "isSuperuser", usecreatedb AS "canCreateDb" FROM pg_user ORDER BY usename;`;
    res = await executeQuery(sourceId, fallbackSql, superuserCreds);
  }

  const users: UserRoleInfo[] = res.rows.map((r) => ({
    rolname: r.rolname,
    isSuperuser: !!r.isSuperuser,
    canCreateDb: !!r.canCreateDb,
    canCreateRole: !!r.canCreateRole,
    canLogin: r.canLogin !== undefined ? !!r.canLogin : true,
    hasPassword: !!r.hasPassword,
  }));

  const databases = await getDatabases(sourceId);
  const matrix: UserDbAccess[] = [];

  for (const u of users) {
    for (const db of databases) {
      // Check database connection privilege
      const privSql = `SELECT has_database_privilege('${u.rolname}', '${db}', 'CONNECT') AS has_connect;`;
      const privRes = await executeQuery(sourceId, privSql, superuserCreds);
      const hasConnect = privRes.rows[0]?.has_connect ?? false;

      matrix.push({
        username: u.rolname,
        database: db,
        hasAccess: hasConnect,
        privileges: hasConnect ? 'CONNECT' : 'NONE',
      });
    }
  }

  return { users, matrix, databases };
}

export async function createUserRole(
  sourceId: string,
  data: { username: string; password?: string; isSuperuser?: boolean; canCreateDb?: boolean },
  superuserCreds?: { user?: string; password?: string }
) {
  const superStr = data.isSuperuser ? 'SUPERUSER' : 'NOSUPERUSER';
  const dbStr = data.canCreateDb ? 'CREATEDB' : 'NOCREATEDB';
  const passStr = data.password ? `WITH PASSWORD '${data.password.replace(/'/g, "''")}'` : '';

  const sql = `CREATE ROLE "${data.username.replace(/"/g, '""')}" LOGIN ${superStr} ${dbStr} ${passStr};`;
  const res = await executeQuery(sourceId, sql, superuserCreds);

  if (res.error && (res.error.toLowerCase().includes('permission denied') || res.error.toLowerCase().includes('must be superuser'))) {
    return { success: false, error: res.error, requiresSuperuser: true };
  }

  if (res.error) {
    return { success: false, error: res.error };
  }

  return { success: true, message: `User '${data.username}' created successfully.` };
}

export async function changeUserPassword(
  sourceId: string,
  data: { username: string; newPassword: string },
  superuserCreds?: { user?: string; password?: string }
) {
  const sql = `ALTER ROLE "${data.username.replace(/"/g, '""')}" WITH PASSWORD '${data.newPassword.replace(/'/g, "''")}';`;
  const res = await executeQuery(sourceId, sql, superuserCreds);

  if (res.error && (res.error.toLowerCase().includes('permission denied') || res.error.toLowerCase().includes('must be superuser'))) {
    return { success: false, error: res.error, requiresSuperuser: true };
  }

  if (res.error) {
    return { success: false, error: res.error };
  }

  return { success: true, message: `Password for '${data.username}' updated successfully.` };
}

export async function toggleDatabaseAccess(
  sourceId: string,
  data: { username: string; database: string; grant: boolean },
  superuserCreds?: { user?: string; password?: string }
) {
  const action = data.grant ? 'GRANT CONNECT ON DATABASE' : 'REVOKE CONNECT ON DATABASE';
  const sql = `${action} "${data.database.replace(/"/g, '""')}" FROM "${data.username.replace(/"/g, '""')}";`;
  const res = await executeQuery(sourceId, sql, superuserCreds);

  if (res.error && (res.error.toLowerCase().includes('permission denied') || res.error.toLowerCase().includes('must be superuser'))) {
    return { success: false, error: res.error, requiresSuperuser: true };
  }

  if (res.error) {
    return { success: false, error: res.error };
  }

  return { success: true, message: `Privileges updated for '${data.username}'.` };
}

export async function resetSystemOrContainerPassword(data: {
  containerId?: string;
  port?: number;
  username: string;
  newPassword: string;
  sudoPassword?: string;
}) {
  const userEsc = (data.username || 'postgres').replace(/"/g, '""');
  const passEsc = (data.newPassword || 'postgres').replace(/'/g, "''");

  // 1. Docker exec reset
  if (data.containerId) {
    try {
      const cmd = `docker exec ${data.containerId} psql -U ${userEsc} -c "ALTER USER \\"${userEsc}\\" WITH PASSWORD '${passEsc}';"`;
      const { stdout, stderr } = await execAsync(cmd);
      return { success: true, message: `Docker password reset successfully: ${stdout || stderr}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Docker exec password reset failed' };
    }
  }

  // 2. Localhost system reset via sudo -u postgres
  const port = data.port || 5432;
  try {
    let cmd = `sudo -n -u postgres psql -p ${port} -c "ALTER USER \\"${userEsc}\\" WITH PASSWORD '${passEsc}';"`;
    if (data.sudoPassword !== undefined && data.sudoPassword !== '') {
      const sudoEsc = data.sudoPassword.replace(/'/g, "'\\''");
      cmd = `echo '${sudoEsc}' | sudo -S -p '' -u postgres psql -p ${port} -c "ALTER USER \\"${userEsc}\\" WITH PASSWORD '${passEsc}';"`;
    }

    const { stdout, stderr } = await execAsync(cmd);
    return { success: true, message: `Local password reset successfully: ${stdout || stderr}` };
  } catch (err: any) {
    const errMsg = err.stderr || err.message || '';
    if (errMsg.toLowerCase().includes('incorrect password') || errMsg.toLowerCase().includes('authentication failed')) {
      return { success: false, requiresSudo: true, error: 'System Sudo password authentication failed.' };
    }
    if (!data.sudoPassword) {
      return { success: false, requiresSudo: true, error: 'Sudo password required for system password reset.' };
    }
    return { success: false, error: errMsg || 'Local system password reset failed' };
  }
}
