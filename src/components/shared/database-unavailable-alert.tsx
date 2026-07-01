import { Alert } from "@/components/ui/alert";

function isHostedRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export function DatabaseUnavailableAlert({
  scope = "This page",
}: {
  scope?: string;
}) {
  if (isHostedRuntime()) {
    return (
      <Alert variant="destructive">
        <strong>Database unavailable.</strong> {scope} cannot reach the hosted database. Check Vercel
        <code> DATABASE_URL </code>
        and
        <code> DIRECT_URL </code>
        environment variables, verify the Supabase password, then run Prisma deploy against Supabase.
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <strong>Database unavailable.</strong> Check PostgreSQL, the configured environment variables,
      and the applied Prisma migration.
    </Alert>
  );
}
