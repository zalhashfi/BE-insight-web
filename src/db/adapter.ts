export type DbQuery = <T>(sql: string, params?: Array<string | number | null>) => Promise<T>;

let adapter: DbQuery | null = null;

export function setQueryAdapter(fn: DbQuery): void {
  adapter = fn;
}

export function getQueryAdapter(): DbQuery {
  if (!adapter) {
    throw new Error('Database adapter not initialized');
  }
  return adapter;
}
