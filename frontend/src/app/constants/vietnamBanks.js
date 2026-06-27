export const SUPPORTED_BANKS = [
  "Vietcombank",
  "BIDV",
  "VietinBank",
  "Agribank",
  "Techcombank",
  "MB Bank",
  "ACB",
  "VPBank",
  "TPBank",
  "Sacombank",
  "HDBank",
  "VIB",
  "SHB",
  "OCB",
  "Eximbank",
  "SeABank",
  "PVcomBank",
  "Nam A Bank",
];

export const BANK_OTHER = "__other__";

export function resolveBankFields(savedName) {
  const name = String(savedName || "").trim();
  if (!name) return { select: "", custom: "" };
  if (SUPPORTED_BANKS.includes(name)) return { select: name, custom: "" };
  return { select: BANK_OTHER, custom: name };
}

export function effectiveBankName(bankSelect, customBankName) {
  if (bankSelect === BANK_OTHER) return String(customBankName || "").trim();
  return String(bankSelect || "").trim();
}

export function refundBankValidationMessage(bankSelect, customBankName) {
  if (!bankSelect) return "Vui lòng chọn ngân hàng.";
  if (bankSelect === BANK_OTHER && !String(customBankName || "").trim()) {
    return "Bạn chọn «Ngân hàng khác» — vui lòng nhập tên ngân hàng.";
  }
  return "";
}
