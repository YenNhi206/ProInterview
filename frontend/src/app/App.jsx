import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { Toaster } from "./components/ui/sonner";
import { router } from "./routes";
import {
  restoreSession,
  hasAuthCredentials,
  isProtectedAppPath,
  AUTH_CHANGED_EVENT,
} from "./utils/auth/auth.js";
import { getCurrentAppPath } from "./utils/auth/appPath.js";

const AUTH_STORAGE_KEYS = new Set([
  "prointerview_auth",
  "prointerview_access_token",
  "prointerview_refresh_token",
]);

export default function App() {
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const { hash } = window.location;
    if (hash.startsWith("#/")) {
      window.location.replace(hash.slice(1) || "/");
      return;
    }

    if (window.location.search.includes("vnp_ResponseCode")) {
      const search = window.location.search;
      window.location.href = `${window.location.origin}/payment-return${search}`;
      return;
    }

    restoreSession()
      .catch((err) => console.log("restoreSession error:", err))
      .finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    if (!sessionChecked) return undefined;

    const redirectToLoginIfNeeded = () => {
      if (hasAuthCredentials()) return;
      const path = getCurrentAppPath();
      const bare = path.split("?")[0] || "/";
      if (isProtectedAppPath(bare)) {
        window.location.assign(`/login?redirect=${encodeURIComponent(path)}`);
      }
    };

    const onStorage = (event) => {
      if (!AUTH_STORAGE_KEYS.has(event.key) || event.newValue != null) return;
      redirectToLoginIfNeeded();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_CHANGED_EVENT, redirectToLoginIfNeeded);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUTH_CHANGED_EVENT, redirectToLoginIfNeeded);
    };
  }, [sessionChecked]);

  if (!sessionChecked) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#f3f0f9]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(128, 55, 244, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(128, 55, 244, 0.045) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
          aria-hidden
        />
        <div className="relative z-10 flex flex-col items-center gap-5">
          <img
            src="/logo-mark.png?v=9"
            alt="ProInterview"
            className="h-16 w-auto object-contain sm:h-20"
          />
          <div
            className="h-7 w-7 animate-spin rounded-full border-2 border-[#8037f4]/25 border-t-[#8037f4]"
            role="status"
            aria-label="Đang tải"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" closeButton duration={4500} />
    </>
  );
}
