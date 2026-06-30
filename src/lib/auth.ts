import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { roleAccess, type Role } from "@/config/roles";
import { getDb } from "@/lib/db";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  verifySessionToken,
} from "@/lib/session-token";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export function canAccess(role: Role, capability: string) {
  const allowed = roleAccess[role] ?? [];
  return allowed.includes("*") || allowed.includes(capability);
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const payload = verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!payload) return null;

  try {
    const user = await getDb().user.findFirst({
      where: { id: payload.userId, status: "active" },
      include: { role: true },
    });

    if (!user || !(user.role.name in roleAccess)) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name as Role,
    };
  } catch {
    return null;
  }
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard?forbidden=1");
  return user;
}

export async function requireCapability(capability: string) {
  const user = await requireUser();
  if (!canAccess(user.role, capability)) redirect("/dashboard?forbidden=1");
  return user;
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
