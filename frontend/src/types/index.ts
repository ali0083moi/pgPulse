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
}

export interface ColumnInfo {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: string | null;
}

export interface TableInfo {
  name: string;
  schema: string;
  type: 'BASE TABLE' | 'VIEW';
  columns: ColumnInfo[];
}

export interface ForeignKeyInfo {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
}

export interface SchemaTreeResponse {
  databases: string[];
  schemas: string[];
  tables: TableInfo[];
  foreignKeys: ForeignKeyInfo[];
}

export interface QueryResultPayload {
  command: string;
  rowCount: number | null;
  durationMs: number;
  columns: Array<{ name: string; dataTypeId: number }>;
  rows: any[];
  error?: string;
}

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

export interface UsersResponse {
  users?: UserRoleInfo[];
  matrix?: UserDbAccess[];
  databases?: string[];
  error?: string;
  requiresSuperuser?: boolean;
}
