export function getRequiredDatabaseUrl(variableName: 'DATABASE_URL' | 'TEST_DATABASE_URL'): string {
  const value =
    variableName === 'DATABASE_URL' ? process.env.DATABASE_URL : process.env.TEST_DATABASE_URL;

  if (!value) {
    throw new Error(`${variableName} must be set before persistence is initialized`);
  }

  return value;
}
