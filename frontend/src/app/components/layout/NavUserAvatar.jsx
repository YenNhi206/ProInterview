import { useEffect, useState } from "react";
import { resolveMediaUrl } from "../../utils/shared/mediaUrl.js";

/** Avatar navbar — ưu tiên ảnh user, fallback chữ cái viết tắt. */
export function NavUserAvatar({ avatar, initials, className = "" }) {
  const [broken, setBroken] = useState(false);
  const src = resolveMediaUrl(avatar);
  const showImage = Boolean(src) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [avatar]);

  return (
    <span
      className={`flex size-full shrink-0 items-center justify-center overflow-hidden rounded-full md:size-8 ${className}`.trim()}
      style={showImage ? undefined : { background: "#8037f4" }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-[10px] font-bold leading-none text-white md:text-xs">{initials}</span>
      )}
    </span>
  );
}
