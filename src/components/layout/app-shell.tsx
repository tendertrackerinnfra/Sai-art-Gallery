import Link from "next/link";
import { LogOut } from "lucide-react";

import { appIdentity, navigationItems } from "@/config/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccess, type CurrentUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export function AppShell({ children, user }: { children: React.ReactNode; user: CurrentUser }) {
  const BrandIcon = appIdentity.icon;
  const visibleNavigation = navigationItems.filter((item) => {
    if (item.href === "/backup-restore") return user.role === "Owner";
    return canAccess(user.role, item.href.slice(1));
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-card px-4 py-5 lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BrandIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold">{appIdentity.name}</span>
            <span className="block text-xs text-muted-foreground">{appIdentity.businessType}</span>
          </span>
        </Link>
        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto pr-1">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{appIdentity.name}</p>
              <p className="text-xs text-muted-foreground">Local business management system</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Badge>{user.role}</Badge>
              <form action={logout}>
                <Button type="submit" variant="ghost" size="icon" title="Sign out">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Sign out</span>
                </Button>
              </form>
            </div>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 py-2 lg:hidden">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.title}
              </Link>
            );
          })}
        </nav>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
