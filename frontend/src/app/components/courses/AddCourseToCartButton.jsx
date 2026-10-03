import { useState } from "react";
import { useNavigate } from "react-router";
import { ShoppingBag, Check } from "lucide-react";
import { useCart } from "../../hooks/useCart.jsx";
import { hasAuthCredentials, getUser } from "../../utils/auth/auth.js";
import { buildLoginPath } from "../../utils/auth/authGate.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";

export function AddCourseToCartButton({ courseId, className = "" }) {
  const { cart, add } = useCart();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const user = getUser();
  if (user && user.role !== "customer") return null;
  const inCart = cart.items.some((item) => String(item.courseId) === String(courseId));
  const handleClick = async (event) => {
    event.stopPropagation();
    if (!hasAuthCredentials()) { navigate(buildLoginPath(`/courses/${courseId}`)); return; }
    if (inCart) { navigate("/cart"); return; }
    setBusy(true);
    try { await add(courseId); toastApiSuccess("Đã thêm khóa học vào giỏ hàng."); }
    catch (error) { toastApiError(error.message); }
    finally { setBusy(false); }
  };
  const Icon = inCart ? Check : ShoppingBag;
  return <button type="button" disabled={busy} onClick={handleClick}
    aria-busy={busy}
    className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-white/[0.12] hover:border-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 active:scale-[0.98] cursor-pointer disabled:cursor-wait disabled:opacity-50 ${className}`}>
    <Icon className="size-4 text-violet-300" strokeWidth={1.8} aria-hidden="true" />{busy ? "Đang thêm…" : inCart ? "Xem trong giỏ hàng" : "Thêm vào giỏ"}
  </button>;
}
