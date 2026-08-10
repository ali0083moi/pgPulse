import { executeQuery } from './postgres';

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

export async function getDatabases(sourceId: string): Promise<string[]> {
  const sql = `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;`;
  const result = await executeQuery(sourceId, sql);
  if (result.error) return ['postgres'];
  return result.rows.map((r) => r.datname);
}

export async function getSchemaTree(sourceId: string): Promise<{
  schemas: string[];
  tables: TableInfo[];
  foreignKeys: ForeignKeyInfo[];
}> {
  const schemaSql = `
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name;
  `;
  const schemaRes = await executeQuery(sourceId, schemaSql);
  const schemas = schemaRes.rows.map((r) => r.schema_name);

  const tablesSql = `
    SELECT 
      t.table_schema,
      t.table_name,
      t.table_type,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      tc.constraint_type
    FROM information_schema.tables t
    JOIN information_schema.columns c 
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    LEFT JOIN information_schema.key_column_usage kcu
      ON c.table_schema = kcu.table_schema 
      AND c.table_name = kcu.table_name 
      AND c.column_name = kcu.column_name
    LEFT JOIN information_schema.table_constraints tc
      ON kcu.constraint_name = tc.constraint_name
      AND kcu.table_schema = tc.table_schema
      AND tc.constraint_type = 'PRIMARY KEY'
    WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY t.table_schema, t.table_name, c.ordinal_position;
  `;

  const tablesRes = await executeQuery(sourceId, tablesSql);

  const tableMap = new Map<string, TableInfo>();

  for (const row of tablesRes.rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!tableMap.has(key)) {
      tableMap.set(key, {
        name: row.table_name,
        schema: row.table_schema,
        type: row.table_type === 'VIEW' ? 'VIEW' : 'BASE TABLE',
        columns: [],
      });
    }

    const table = tableMap.get(key)!;
    const existsCol = table.columns.find((col) => col.name === row.column_name);
    if (!existsCol) {
      table.columns.push({
        name: row.column_name,
        type: row.data_type,
        isNullable: row.is_nullable === 'YES',
        isPrimaryKey: row.constraint_type === 'PRIMARY KEY',
        defaultValue: row.column_default,
      });
    }
  }

  const fkSql = `
    SELECT
      tc.constraint_name,
      kcu.table_name AS from_table,
      kcu.column_name AS from_column,
      ccu.table_name AS to_table,
      ccu.column_name AS to_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast');
  `;

  const fkRes = await executeQuery(sourceId, fkSql);
  const foreignKeys: ForeignKeyInfo[] = fkRes.rows.map((row, idx) => ({
    id: `fk-${idx}-${row.from_table}-${row.to_table}`,
    fromTable: row.from_table,
    fromColumn: row.from_column,
    toTable: row.to_table,
    toColumn: row.to_column,
    constraintName: row.constraint_name,
  }));

  return {
    schemas,
    tables: Array.from(tableMap.values()),
    foreignKeys,
  };
}
