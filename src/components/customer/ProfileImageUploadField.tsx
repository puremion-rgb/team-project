"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import { resolveImageUrl } from "@/lib/api";

/**
 * 손님용 "프로필 관리" 화면 전용 프로필 사진 업로드 컴포넌트예요.
 * ------------------------------------------------------------------
 * ⚠️ 사장님 화면이 쓰는 src/components/owner/ImageUploadField.tsx와 거의
 * 똑같이 생겼지만, 일부러 별도 파일로 분리했어요. 사장님 화면(매장 로고,
 * 메뉴 사진 등)이 이 컴포넌트를 공유해서 쓰다 보니, 손님 프로필 사진 문제를
 * 고치려고 그 파일을 손대면 사장님 화면까지 같이 영향을 받을 위험이 있어서예요.
 * 이 파일은 손님 프로필 화면(src/app/(shell)/my/profile/page.tsx)에서만 써요.
 *
 * owner/ImageUploadField.tsx와 다른 점 (손님 쪽 "사진이 안 뜬다" 문제 대응):
 * 1) resolveImageUrl로 절대 URL을 만든 뒤에도 실제 로드에 실패할 수 있어요
 *    (백엔드 주소가 이 기기에서 접속이 안 되거나, 경로는 맞지만 파일이 없는
 *    경우 등). 이럴 때 <img>는 브라우저 기본 "깨진 이미지" 아이콘을 보여주는데,
 *    onError로 이를 감지해서 기존 회색 플레이스홀더로 자연스럽게 대체해요
 *    (ImagePlaceholder와 동일한 처리 방식).
 * 2) 어떤 URL이 왜 실패했는지 브라우저 콘솔에 남겨서(F12 → Console,
 *    "[ProfileImageUploadField]"로 시작), 실제 백엔드 주소/경로가 잘못된
 *    건지 원인을 바로 확인할 수 있게 했어요.
 */
export default function ProfileImageUploadField({
  value,
  onChange,
  onFile,
  rounded = "rounded-full",
  size = "h-24 w-24",
  badgeSize = "h-8 w-8",
  badgeIconSize = 16,
  badgeOffset = "-bottom-0.5 -right-0.5",
  badgeColor = "bg-brand",
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  /** 선택한 원본 파일이 필요할 때(서버 업로드 등) 함께 받을 수 있어요. */
  onFile?: (file: File | null) => void;
  rounded?: string;
  size?: string;
  badgeSize?: string;
  badgeIconSize?: number;
  badgeOffset?: string;
  badgeColor?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resolvedValue = resolveImageUrl(value);

  // 이미지 로드 실패 여부. value(=resolvedValue의 원본)가 바뀌면(새 사진을
  // 고르거나, 서버에서 프로필을 다시 불러와서 URL이 바뀌면) 다시 시도할 수
  // 있게 초기화해요.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [resolvedValue]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    onFile?.(file);
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  const showImage = !!resolvedValue && !failed;

  return (
    <div className={`relative ${size} shrink-0`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedValue}
          alt="업로드된 이미지"
          onError={() => {
            // eslint-disable-next-line no-console
            console.error(
              "[ProfileImageUploadField] 프로필 사진을 불러오지 못했어요. 주소를 확인해주세요:",
              resolvedValue,
            );
            setFailed(true);
          }}
          className={`h-full w-full object-cover ${rounded}`}
        />
      ) : (
        <ImagePlaceholder className={`h-full w-full ${size}`} rounded={rounded} />
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="이미지 업로드"
        className={`absolute ${badgeOffset} flex ${badgeSize} items-center justify-center rounded-full border-2 border-white ${badgeColor} text-white shadow-sheet`}
      >
        <Camera size={badgeIconSize} strokeWidth={2.4} />
      </button>

      {value && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            onFile?.(null);
          }}
          aria-label="이미지 삭제"
          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-ink-secondary text-white"
        >
          <X size={10} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
