import { useEffect, useRef } from "react";
import { AppSelect } from "../ui/AppSelect";
import { SUPPORTED_BANKS, BANK_OTHER } from "../../constants/vietnamBanks.js";

const labelClass = "mb-1.5 block text-xs font-semibold text-slate-700";

/** Cùng style cho dropdown + input — font/size/viền đồng bộ */
const fieldClass =
  "min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal leading-normal text-slate-900 shadow-none outline-none transition placeholder:text-slate-400 placeholder:font-normal focus:border-[#8037f4] focus:ring-2 focus:ring-[#8037f4]/10";

const selectTriggerClass = `${fieldClass} font-normal data-[placeholder]:text-slate-400 [&_[data-slot=select-value]]:font-normal [&_[data-slot=select-value]]:text-slate-900`;

export function RefundBankFields({
  bankSelect,
  onBankSelectChange,
  customBankName,
  onCustomBankNameChange,
  accountNumber,
  onAccountNumberChange,
  accountHolder,
  onAccountHolderChange,
  inputClassName = fieldClass,
}) {
  const customBankInputRef = useRef(null);

  useEffect(() => {
    if (bankSelect === BANK_OTHER) {
      customBankInputRef.current?.focus();
    }
  }, [bankSelect]);

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass} htmlFor="refund-bank-select">
          Ngân hàng
        </label>
        <AppSelect
          id="refund-bank-select"
          size="md"
          value={bankSelect || undefined}
          onValueChange={onBankSelectChange}
          placeholder="Chọn ngân hàng"
          triggerClassName={selectTriggerClass}
          options={[
            ...SUPPORTED_BANKS.map((bank) => ({ value: bank, label: bank })),
            { value: BANK_OTHER, label: "Ngân hàng khác…" },
          ]}
        />
        {bankSelect === BANK_OTHER ? (
          <div className="mt-3">
            <label className={labelClass} htmlFor="refund-custom-bank">
              Tên ngân hàng <span className="text-[#8037f4]">*</span>
            </label>
            <input
              id="refund-custom-bank"
              ref={customBankInputRef}
              type="text"
              autoComplete="off"
              maxLength={80}
              value={customBankName}
              onChange={(e) => onCustomBankNameChange(e.target.value)}
              placeholder="VD: MSB, SCB, Liên Việt PostBank"
              className={inputClassName}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Gõ đúng tên ngân hàng trên app hoặc thẻ ATM của bạn.
            </p>
          </div>
        ) : null}
      </div>
      <div>
        <label className={labelClass} htmlFor="refund-account-number">
          Số tài khoản
        </label>
        <input
          id="refund-account-number"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={accountNumber}
          onChange={(e) => onAccountNumberChange(e.target.value.replace(/\D/g, ""))}
          placeholder="8–19 chữ số"
          className={`${inputClassName} tabular-nums tracking-wide`}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="refund-account-holder">
          Chủ tài khoản
        </label>
        <input
          id="refund-account-holder"
          type="text"
          autoComplete="name"
          value={accountHolder}
          onChange={(e) => onAccountHolderChange(e.target.value)}
          placeholder="In hoa, không dấu"
          className={inputClassName}
        />
      </div>
    </div>
  );
}
