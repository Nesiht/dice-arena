import type { Sql, TransactionSql } from 'postgres';

export async function withTransaction<T>(
  client: Sql,
  operation: (transaction: TransactionSql) => Promise<T>,
): Promise<T> {
  return client.begin(async (transaction) => operation(transaction)) as unknown as Promise<T>;
}
