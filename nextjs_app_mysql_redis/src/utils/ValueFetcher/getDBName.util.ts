export function getDBName(): string {
  try {
    if (process.env.PROD_DB_NAME) {
      return process.env.PROD_DB_NAME;
    } else if (process.env.LOCAL_DB_NAME) {
      return process.env.LOCAL_DB_NAME;
    } else {
      return "DB_NAME";
    }
  } catch (error: unknown) {
    console.error("Failed to determine DB name,", error);
    return "DB_NAME";
  }
}
