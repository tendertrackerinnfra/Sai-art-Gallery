"use client";

import { useEffect } from "react";

export function InstallRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure should not block the app shell.
    });
  }, []);

  return null;
}
