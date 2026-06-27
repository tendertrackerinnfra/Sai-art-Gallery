"use server";

import { redirect } from "next/navigation";

import { clearSession, setSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

function loginError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email || !password || password.length > 128) {
    loginError("Enter your email address and password.");
  }

  let user;
  try {
    user = await getDb().user.findFirst({
      where: { email, status: "active" },
      include: { role: true },
    });
  } catch {
    loginError("Database unavailable. Start PostgreSQL and complete the initial migration.");
  }

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    loginError("Email or password is incorrect.");
  }

  await getDb().$transaction([
    getDb().user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
    getDb().auditLog.create({
      data: {
        userId: user.id,
        action: "authentication.login",
        entityType: "User",
        entityId: user.id,
        newValue: { role: user.role.name },
      },
    }),
  ]);

  await setSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

