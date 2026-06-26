import React, { useEffect } from "react";

export function LegalSection({ title, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-[1.75] text-slate-600 sm:text-[15px]">{children}</div>
    </section>
  );
}

/** Dòng định nghĩa: **Thuật ngữ:** nội dung */
export function LegalDef({ term, children }) {
  return (
    <p>
      <strong className="font-semibold text-slate-900">{term}</strong> {children}
    </p>
  );
}

export function LegalDocumentLayout({ title, subtitle, lastUpdated, intro, children }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[-1] bg-gradient-to-br from-violet-100 via-white to-fuchsia-100" aria-hidden />
      <div className="min-h-full bg-transparent px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-sm px-6 py-10 shadow-sm sm:px-10 sm:py-12 lg:px-14 lg:py-14">
          <header className="mb-6 text-center">
            <h1 className="text-lg font-bold uppercase leading-snug tracking-wide text-[#8037f4] sm:text-xl lg:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mx-auto mt-4 max-w-2xl text-xs font-bold uppercase leading-relaxed tracking-wide text-slate-900 sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </header>

          {lastUpdated ? (
            <p className="mb-8 text-left text-sm text-slate-500">
              Cập nhật lần cuối: <span className="text-slate-600">{lastUpdated}</span>
            </p>
          ) : null}

          {intro ? <p className="mb-8 text-sm leading-relaxed text-slate-600 sm:text-[15px]">{intro}</p> : null}

          <div className="flex flex-col gap-8">{children}</div>

          <p className="mt-12 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} ProInterview. All rights reserved.
          </p>
        </article>
      </div>
    </>
  );
}
