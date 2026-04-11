import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { router } from "./routes";
import { restoreSession } from "./utils/auth";

export default function App() {
  // Khôi phục phiên JWT (/api/auth/me) sau khi refresh trang
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
        style={{ background: "#120B2E" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #6E35E8, #8B4DFF)",
              boxShadow: "0 0 24px rgba(110,53,232,0.35)",
            }}
          >
            <span className="text-xl font-bold text-white">P</span>
          </div>
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
            style={{
              borderColor: "rgba(196, 255, 71,0.45)",
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