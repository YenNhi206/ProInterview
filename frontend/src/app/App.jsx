import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { router } from "./routes";
import { restoreSession } from "./utils/auth";

/* ── Suppress benign Supabase "Multiple GoTrueClient instances" warning ──────
   Figma Make's platform creates one GoTrueClient at the environment level
   (instance 1); our singleton in auth.ts creates a second (instance 2).
   Both use the same storage key so they share session state automatically.
   The warning is not an error — we silence it once to keep the console clean.
   Any OTHER console.warn calls pass through unchanged.
─────────────────────────────────────────────────────────────────────────── */
if (typeof window !== "undefined") {
  const _origWarn = console.warn.bind(console);
  console.warn = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes(
        "Multiple GoTrueClient instances detected",
      )
    ) {
      return; // swallow only this specific message
    }
    _origWarn(...args);
  };
}

export default function App() {
  // Restore Supabase session on first load so getUser() stays populated
  // after a page refresh. We show nothing until the check is done to avoid
  // a flash where protected pages redirect the user away unnecessarily.
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    restoreSession()
      .catch((err) => console.log("restoreSession error:", err))
      .finally(() => setSessionChecked(true));
  }, []);

  if (!sessionChecked) {
    // Minimal full-screen loader — matches brand purple
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#F4F5F7" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, #6E35E8, #8B4DFF)",
            }}
          >
            <span className="text-white text-xl font-bold">
              P
            </span>
          </div>
          <div
            className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{
              borderColor: "#8B4DFF",
              borderTopColor: "transparent",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}