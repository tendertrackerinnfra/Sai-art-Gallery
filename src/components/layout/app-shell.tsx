"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { appIdentity, navigationItems } from "@/config/navigation";
import { roleAccess, type Role } from "@/config/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { logout } from "@/app/login/actions";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function canAccess(role: Role, capability: string) {
  const allowed = roleAccess[role] ?? [];
  return allowed.includes("*") || allowed.includes(capability);
}

export function AppShell({ children, user }: { children: React.ReactNode; user: CurrentUser }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const BrandIcon = appIdentity.icon;

  const visibleNavigation = useMemo(
    () =>
      navigationItems.filter(
        (item) =>
          canAccess(user.role, item.href.slice(1)) &&
          item.title.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query, user.role],
  );

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={cn("space-y-1", mobile && "mt-4")}>
      {visibleNavigation.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors",
              sidebarCollapsed && !mobile && "justify-center px-0",
              active
                ? "bg-primary text-primary-foreground shadow-[0_12px_20px_-18px_rgba(190,24,93,0.9)]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {sidebarCollapsed && !mobile ? null : <span>{item.title}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-border/70 bg-card/95 px-4 py-5 backdrop-blur lg:flex lg:flex-col",
          sidebarCollapsed ? "w-[92px]" : "w-72",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3 px-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <BrandIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            {sidebarCollapsed ? null : (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{appIdentity.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{appIdentity.businessType}</span>
              </span>
            )}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed((value) => !value)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <div className={cn("mt-6", sidebarCollapsed && "hidden")}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Search modules"
              placeholder="Search modules"
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto pr-1">
          <NavLinks />
        </div>

        <div className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-muted/45 p-3">
          {sidebarCollapsed ? (
            <div className="flex flex-col gap-2">
              <Link href="/sales">
                <Button type="button" size="icon" className="w-full">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <form action={logout}>
                <Button type="submit" variant="outline" size="icon" className="w-full">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </div>
          ) : (
            <>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge className="rounded-full px-2.5 py-1">{user.role}</Badge>
                <Link href="/sales">
                  <Button type="button" size="sm">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Quick sale
                  </Button>
                </Link>
              </div>
              <form action={logout}>
                <Button type="submit" variant="outline" className="w-full">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </Button>
              </form>
            </>
          )}
        </div>
      </aside>

      <div className={cn("transition-[padding] duration-200", sidebarCollapsed ? "lg:pl-[92px]" : "lg:pl-72")}>
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 lg:hidden">
              <Button type="button" variant="outline" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                <Menu className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="text-sm font-semibold">{appIdentity.name}</span>
            </div>

            <div className="hidden min-w-0 lg:block">
              <p className="text-sm font-semibold">{appIdentity.name}</p>
              <p className="text-xs text-muted-foreground">Jewellery operations dashboard</p>
            </div>

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Filter sidebar modules"
                placeholder="Search modules, pages, or workflows"
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Badge className="hidden rounded-full px-2.5 py-1 sm:inline-flex">{user.role}</Badge>
              <Link href="/sales">
                <Button type="button" className="hidden sm:inline-flex">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Quick action
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>

      {mobileOpen ? (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/35"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-sm border-r border-border/70 bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <Link href="/dashboard" className="flex min-w-0 items-center gap-3" onClick={() => setMobileOpen(false)}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <BrandIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{appIdentity.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{appIdentity.businessType}</span>
                </span>
              </Link>
              <Button type="button" variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-5 rounded-2xl border border-border/70 bg-muted/45 p-3">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge className="rounded-full px-2.5 py-1">{user.role}</Badge>
                <Link href="/sales" onClick={() => setMobileOpen(false)}>
                  <Button type="button" size="sm">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Quick sale
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  aria-label="Search modules"
                  placeholder="Search modules"
                  className="pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 max-h-[calc(100vh-17rem)] overflow-y-auto pr-1">
              <NavLinks mobile />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
