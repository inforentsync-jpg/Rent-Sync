export function shouldUseDatabase() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.RENT_SYNC_DATABASE_MODE === "live"
  );
}
