import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "../ui/pagination";

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 11) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items = [1];
  const windowStart = Math.max(2, currentPage - 2);
  const windowEnd = Math.min(totalPages - 1, currentPage + 2);
  if (windowStart > 2) items.push("ellipsis-start");
  for (let p = windowStart; p <= windowEnd; p += 1) items.push(p);
  if (windowEnd < totalPages - 1) items.push("ellipsis-end");
  items.push(totalPages);
  return items;
}

function cnPageNav(disabled) {
  return `gap-1 px-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 ${
    disabled ? "pointer-events-none opacity-40" : ""
  }`;
}

function changePage(onPageChange, page) {
  onPageChange(page);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function ListPagination({ currentPage, totalPages, onPageChange, className = "mt-8 border-t border-slate-100 pt-6" }) {
  if (totalPages <= 1) return null;

  const items = getPaginationItems(currentPage, totalPages);

  return (
    <Pagination className={className}>
      <PaginationContent className="gap-1 sm:gap-2">
        <PaginationItem>
          <PaginationLink
            href="#"
            size="default"
            className={cnPageNav(currentPage <= 1)}
            aria-disabled={currentPage <= 1}
            onClick={(e) => {
              e.preventDefault();
              if (currentPage > 1) changePage(onPageChange, currentPage - 1);
            }}
          >
            <ChevronLeft className="size-4" />
            <span>Trước</span>
          </PaginationLink>
        </PaginationItem>

        {items.map((item) =>
          typeof item === "string" ? (
            <PaginationItem key={item}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={item === currentPage}
                size="icon"
                className={
                  item === currentPage
                    ? "min-w-9 border-slate-200 bg-white font-semibold text-slate-900 shadow-sm"
                    : "min-w-9 font-medium text-slate-700 hover:bg-slate-50"
                }
                onClick={(e) => {
                  e.preventDefault();
                  changePage(onPageChange, item);
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationLink
            href="#"
            size="default"
            className={cnPageNav(currentPage >= totalPages)}
            aria-disabled={currentPage >= totalPages}
            onClick={(e) => {
              e.preventDefault();
              if (currentPage < totalPages) changePage(onPageChange, currentPage + 1);
            }}
          >
            <span>Sau</span>
            <ChevronRight className="size-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
