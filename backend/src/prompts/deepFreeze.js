/** Đóng băng sâu object cấu hình (template mặc định không bị sửa lúc chạy). */
export default function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
