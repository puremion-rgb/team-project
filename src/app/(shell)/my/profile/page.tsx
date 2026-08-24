"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Button from "@/components/Button";
import ImageUploadField from "@/components/customer/ProfileImageUploadField";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/auth-store";

// ⚠️ 예전엔 휴대폰 번호/생년월일 둘 다 그냥 자유 입력 텍스트 필드라서, 사용자가
// 입력하는 대로(점 "." 이든 대시 "-"이든) 그대로 저장됐어요. 그래서 화면엔
// "1995.05.20"처럼 점으로 보이는 값이 남아있었어요. 이제 숫자만 입력받고,
// 휴대폰 번호(010-0000-0000)처럼 생년월일도 항상 대시(0000-00-00) 형식으로
// 입력 중에 자동으로 맞춰줘요.
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatBirthInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export default function ProfileEditPage() {
  const { profile, profileLoading, authLoading, updateProfile } = useAuth();

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(formatPhoneInput(profile.phone ?? ""));
  const [birth, setBirth] = useState(formatBirthInput(profile.birth ?? ""));
  const [imageUrl, setImageUrl] = useState<string | null>(profile.profileImageUrl);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 서버에서 프로필을 늦게 받아오는 경우(새로고침 직후 등) 폼 값을 채워줘요.
  // 사용자가 이미 입력을 시작한 뒤에는 덮어쓰지 않아요.
  useEffect(() => {
    if (profileLoading) return;
    setName((prev) => (prev ? prev : profile.name));
    setPhone((prev) => (prev ? prev : formatPhoneInput(profile.phone ?? "")));
    setBirth((prev) => (prev ? prev : formatBirthInput(profile.birth ?? "")));
    setImageUrl((prev) => (prev ? prev : profile.profileImageUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profile.name, profile.phone, profile.birth, profile.profileImageUrl]);

  const handleImageChange = (dataUrl: string | null) => {
    setImageUrl(dataUrl);
    if (dataUrl === null) setImageFile(null);
  };

  const handleSave = async () => {
    setError(null);
    const result = await updateProfile({
      name: name.trim(),
      phone: phone.trim() || null,
      birth: birth.trim() || null,
      imageFile,
      profileImageUrl: imageUrl,
    });
    if (result.ok) {
      setImageFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="프로필 관리" />

      <div className="flex flex-col items-center px-6 pt-6">
        <p className="text-[14px] font-bold text-ink">프로필 사진</p>
        <div className="mt-3">
          <ImageUploadField
            value={imageUrl}
            onChange={handleImageChange}
            onFile={setImageFile}
            rounded="rounded-full"
            size="h-24 w-24"
            badgeSize="h-8 w-8"
            badgeIconSize={16}
            badgeOffset="-bottom-0.5 -right-0.5"
            badgeColor="bg-brand"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col divide-y divide-border rounded-2xl border border-border bg-white px-5 mx-6">
        <Field label="이름" value={name} onChange={setName} />
        <Field label="이메일" value={profile.email} readOnly />
        <Field
          label="휴대폰 번호"
          value={phone}
          onChange={(v) => setPhone(formatPhoneInput(v))}
          placeholder="010-0000-0000"
        />
        <Field
          label="생년월일"
          value={birth}
          onChange={(v) => setBirth(formatBirthInput(v))}
          placeholder="0000-00-00"
        />
      </div>

      {error && <p className="mt-3 px-6 text-[13px] text-danger">{error}</p>}

      <p className="mt-4 px-6 text-[12.5px] text-ink-muted">
        이메일은 회원가입 시 등록한 정보라 여기서는 변경할 수 없어요.
      </p>

      <div className="mt-8 px-6 pb-8">
        <Button onClick={handleSave} disabled={authLoading || !name.trim()}>
          {authLoading ? "저장 중..." : "저장하기"}
        </Button>
      </div>

      <Toast show={saved} message="수정되었습니다" />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="py-3.5">
      <label className="text-[12.5px] text-ink-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`mt-1 block w-full bg-transparent text-[16px] font-medium text-ink focus:outline-none ${
          readOnly ? "text-ink-muted" : ""
        }`}
      />
    </div>
  );
}
