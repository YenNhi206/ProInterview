import { redirect } from "react-router";
import { getUser } from "../../utils/auth";

/** Chỉ user đã đăng nhập với role `admin` được vào /admin/* */
export function adminLoader() {
  const u = getUser();
  if (!u || u.role !== "admin") {
    throw redirect("/login?redirect=/admin");
  }
  return null;
}
