import React from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

const BADGE_COLORS = {
  purple: "bg-primary/10 text-primary border border-primary/20",
  lime: "bg-secondary/40 text-secondary-foreground border border-secondary/60",
  amber: "bg-accent/20 text-accent-foreground border border-accent/30",
  blue: "bg-sky-500/10 text-sky-700 border border-sky-500/20",
};

export function PageHeader({
  title,
  subtitle,
  backTo,
  backLabel = "Quay lại",
  actions,
  badge,
  badgeColor = "purple",
}) {
  const navigate = useNavigate();

  return (
    <div className="mb-8">
      {/* Back button */}
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="group inline-flex items-center gap-2 mb-5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted -ml-3"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          {backLabel}
        </button>
      )}

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          {badge && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-3 ${BADGE_COLORS[badgeColor]}`}>
              {badge}
            </span>
          )}
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2 }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground mt-1.5 leading-relaxed" style={{ fontSize: "0.9375rem" }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>

      {/* Divider */}
      <div className="mt-6 h-px bg-gradient-to-r from-primary/20 via-border to-transparent" />
    </div>
  );
}