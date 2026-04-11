import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { getUser, loginWithGoogleCredential } from "../../utils/auth";
import { AUTH_CTA_FRAME_CLASS } from "./AuthShell";

const CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

function loadGoogleScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      if (window.google?.accounts?.id) resolve();
      else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("gsi")));
      }
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gsi"));
    document.head.appendChild(s);
  });
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/** Luôn dùng luồng đăng nhập Google (tạo tài khoản nếu email chưa có). */
export function GoogleSignInBlock({ onError }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const [btnWidth, setBtnWidth] = useState(320);

  const onCredential = useCallback(
    async (response) => {
      onError?.("");
      const cred = response?.credential;
      if (!cred) {
        onError?.("Không nhận được phản hồi từ Google.");
        return;
      }
      const result = await loginWithGoogleCredential(cred);
      if (!result.success) {
        onError?.(result.error);
        return;
      }
      const user = getUser();
      const redirect = params.get("redirect");
      if (user?.role === "mentor") {
        navigate(redirect || "/mentor/dashboard");
      } else {
        navigate(redirect || "/dashboard");
      }
    },
    [navigate, onError, params],
  );

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const w = el.getBoundingClientRect().width;
      setBtnWidth(Math.max(280, Math.floor(w)));
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;

    (async () => {
      try {
        await loadGoogleScript();
        if (cancelled || !btnRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (res) => {
            void onCredential(res);
          },
          auto_select: false,
        });

        btnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(btnRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "signin_with",
          shape: "pill",
          width: btnWidth,
          locale: "vi",
        });
      } catch {
        if (!cancelled) {
          onError?.("Không tải được Google. Kiểm tra mạng hoặc thử lại.");
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [CLIENT_ID, btnWidth, onCredential, onError]);

  const fallbackLabel = "Đăng nhập bằng Google";

  if (!CLIENT_ID) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          className={`${AUTH_CTA_FRAME_CLASS} gap-3 border border-white/15 bg-white/[0.06] text-base font-bold text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/[0.1]`}
          onClick={() => {
            onError?.(
              "Đăng nhập Google chưa được bật (thiếu VITE_GOOGLE_CLIENT_ID). Vui lòng dùng email và mật khẩu.",
            );
          }}
        >
          <GoogleMark />
          {fallbackLabel}
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`${AUTH_CTA_FRAME_CLASS} w-full`}>
      <div
        ref={btnRef}
        className="flex w-full flex-1 items-center justify-center [&>iframe]:max-w-full"
      />
    </div>
  );
}
