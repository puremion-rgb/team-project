"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

export default function ImagePlaceholder({
  className = "",
  rounded = "rounded-xl",
  iconSize = 22,
  src,
  alt = "",
}: {
  className?: string;
  rounded?: string;
  iconSize?: number;
  /** 실제로 보여줄 이미지 URL. 있으면 이 이미지를 렌더링하고, 없으면 기존
   * 회색 아이콘 플레이스홀더로 폴백해요. */
  src?: string | null;
  alt?: string;
}) {
  // ⚠️ src가 있어도 실제로는 깨진 링크(주소는 있지만 파일이 없거나, 백엔드
  // 주소가 이 기기에서 접속이 안 되는 경우 등)일 수 있어요. 예전엔 이럴 때
  // 브라우저 기본 "깨진 이미지" 아이콘이 그대로 보여서 마치 프로필 사진 기능
  // 자체가 고장 난 것처럼 보였어요. 이미지 로드가 실패하면 기존 회색
  // 플레이스홀더로 자동 대체해서, "사진이 없는 손님"과 "사진 로드에 실패한
  // 경우"가 최소한 화면에서는 똑같이 자연스러워 보이게 해요.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className={`bg-[#DDD9CC] object-cover ${rounded} ${className}`}
      />
    );
  }

  return (
    <div
      className={
        `flex items-center justify-center bg-[#DDD9CC] text-ink-muted/70 ${rounded} ` +
        className
      }
    >
      <ImageIcon size={iconSize} strokeWidth={1.5} />
    </div>
  );
}
