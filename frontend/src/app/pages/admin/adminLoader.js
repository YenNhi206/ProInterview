import { createRoleLoader } from "../../utils/auth/roleLoader.js";

/** Chỉ user đã đăng nhập với role `admin` (xác minh qua /api/auth/me). */
export const adminLoader = createRoleLoader("admin", "/admin");
