export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold">You are offline</h1>
        <p className="text-sm text-muted-foreground">
          Sai Art Gallery could not reach the network. Reconnect and reopen the app to continue with live stock,
          sales, expenses, and finance data.
        </p>
      </div>
    </main>
  );
}
