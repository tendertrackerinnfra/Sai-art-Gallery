import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";

import { AppLogo } from "@/components/branding/app-logo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appIdentity } from "@/config/navigation";
import { getCurrentUser } from "@/lib/auth";

import { login } from "./actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [user, { error }] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect("/dashboard");

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(320px,0.8fr)_minmax(480px,1.2fr)]">
      <section className="hidden border-r border-border bg-card p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm">
            <AppLogo variant="square" className="h-12 w-12 object-contain" priority />
          </span>
          <div>
            <p className="font-semibold">{appIdentity.name}</p>
            <p className="text-sm text-muted-foreground">{appIdentity.businessType}</p>
          </div>
        </div>
        <div className="max-w-sm">
          <AppLogo variant="wide" className="mb-8 max-w-[320px]" priority />
          <p className="text-3xl font-semibold leading-tight">Your local business workspace.</p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Inventory, sales, invoices, production, payments, reports, and backups remain on your local system.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Development database: sai_art_gallery_dev</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm">
              <AppLogo variant="square" className="h-10 w-10 object-contain" priority />
            </span>
            <div>
              <p className="font-semibold">{appIdentity.name}</p>
              <p className="text-xs text-muted-foreground">Local business management</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                Sign in
              </CardTitle>
              <CardDescription>Use the local account created during database setup.</CardDescription>
            </CardHeader>
            <CardContent>
              {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
              <form action={login} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="owner@saiartgallery.local"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={12}
                  />
                </div>
                <Button type="submit" className="w-full">Sign in</Button>
              </form>
            </CardContent>
          </Card>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Accounts are stored only in the configured local PostgreSQL database.
          </p>
        </div>
      </section>
    </main>
  );
}
