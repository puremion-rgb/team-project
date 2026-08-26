"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X, AlertTriangle } from "lucide-react";
import Header from "@/components/Header";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import ImageUploadField from "@/components/owner/ImageUploadField";
import Toast from "@/components/Toast";
import {
  useOwner,
  type MenuCategory,
  type OwnerMenuItem,
} from "@/lib/owner-store";
import { apiUploadImage, isApiConfigured, lastUploadImageError, resolveImageUrl } from "@/lib/api";

const categories = ["전체", "커피", "음료", "디저트"] as const;

type FormState = {
  name: string;
  price: string;
  category: MenuCategory;
  stock: string; // "" = 무제한
  imageUrl: string | null;
};

const emptyForm: FormState = {
  name: "",
  price: "",
  category: "커피",
  stock: "",
  imageUrl: null,
};

export default function OwnerMenuPage() {
  const {
    menu,
    menusLoading,
    menusLoadFailed,
    retryMenusLoad,
    addMenuItem,
    updateMenuItem,
    removeMenuItem,
  } = useOwner();
  const [tab, setTab] = useState<(typeof categories)[number]>("전체");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  // ⚠️ "메뉴 사진" 칸에서 새로 고른 원본 파일이에요. form.imageUrl은 화면에
  // 바로 보여줄 미리보기(base64)라서, 저장 직전에 이 파일을 실제로
  // 서버(apiUploadImage)에 업로드해서 진짜 URL로 바꾼 다음 그 URL을 저장해요.
  // (아래 "새로 추가한 메뉴 사진이 깨져 보이는 문제" 수정 참고)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // ⚠️ 예전엔 삭제 버튼을 누르면 확인 절차 없이 곧바로 지워졌어요. 수정
  // 버튼과 삭제 버튼이 위아래로 붙어있어서, 수정하려다 삭제를 잘못 눌러도
  // 되돌릴 방법 없이 바로 사라졌어요. 이제 삭제 버튼을 누르면 먼저 확인
  // 팝업을 띄우고, "삭제하겠습니다"를 눌러야만 실제로 지워져요.
  const [deleteTarget, setDeleteTarget] = useState<OwnerMenuItem | null>(null);

  const filtered =
    tab === "전체" ? menu : menu.filter((m) => m.category === tab);

  const startEdit = (item: OwnerMenuItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      price: String(item.price),
      category: item.category,
      stock: item.stock === null ? "" : String(item.stock),
      imageUrl: item.imageUrl,
    });
    setImageFile(null);
    setErrorMsg(null);
  };

  /** 새로 고른 사진 파일이 있으면 서버에 실제로 업로드해서 진짜 URL을
   * 받아와요. 없으면(사진을 안 바꿨으면) 폼에 있던 값을 그대로 써요.
   * ⚠️ 예전엔 이 단계가 아예 없어서, ImageUploadField가 만든 미리보기용
   * base64 문자열(사진 전체를 텍스트로 인코딩한, 수만 자 넘는 긴 문자열)을
   * 그대로 메뉴의 image_url로 서버에 저장했어요. 매장 프로필 사진(사장님
   * 프로필 화면)은 이미 실제 업로드 API로 고쳐져 있었는데 메뉴 사진만
   * 빠져있었던 거예요. 서버의 image_url 칸은 실제 파일 URL을 담는 자리라
   * 그렇게 긴 문자열을 넣으면 서버가 잘라서 저장하거나 유효하지 않은
   * 주소로 취급해서, 나중에 그 값을 다시 불러와 사진을 보여주려 하면 깨진
   * 이미지 아이콘만 뜨는 거였어요(방금 고른 사진이 이 화면에서 "미리보기"로
   * 보이는 것과, 그게 실제로 서버에 올바르게 저장되는 것은 서로 다른
   * 일이었어요). */
  const resolveImageForSave = async (): Promise<{
    ok: boolean;
    imageUrl: string | null;
  }> => {
    if (!imageFile || !isApiConfigured()) {
      return { ok: true, imageUrl: form.imageUrl };
    }
    const uploaded = await apiUploadImage(imageFile, "owner");
    if (!uploaded) return { ok: false, imageUrl: form.imageUrl };
    return { ok: true, imageUrl: uploaded };
  };
  const submitEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setErrorMsg(null);
    const { ok: uploadOk, imageUrl } = await resolveImageForSave();
    if (!uploadOk) {
      setSaving(false);
      // ⚠️ 예전엔 "사진 업로드에 실패했어요. 잠시 후 다시 시도해주세요."라는
      // 뻔한 문구만 보여줘서, 로그인이 만료됐는지/파일이 너무 큰지/서버가
      // 거부했는지 화면만 봐서는 전혀 알 수 없었고 콘솔을 직접 열어야 했어요.
      // 이제 apiUploadImage가 실제로 겪은 이유(lastUploadImageError)를 그대로
      // 보여줘요.
      setErrorMsg(
        lastUploadImageError ?? "사진 업로드에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
      return;
    }
    // ⚠️ 예전엔 updateMenuItem 결과를 확인하지 않고 곧바로 수정 화면을
    // 닫아버렸어요. 그래서 서버 저장이 실제로 실패해도 화면엔 성공한 것처럼
    // 잠깐 보였다가, 8초마다 자동으로 메뉴 목록을 새로고침할 때 원래 값으로
    // 조용히 되돌아갔어요("수정완료를 눌러도 반영이 안 된다"는 문제의 원인).
    // 이제 결과를 기다렸다가 실패하면 화면을 닫지 않고 에러를 보여줘요.
    const result = await updateMenuItem(editingId, {
      name: form.name.trim() || "이름 없음",
      price: Number(form.price) || 0,
      category: form.category,
      stock: form.stock.trim() === "" ? null : Number(form.stock),
      imageUrl,
    });
    setSaving(false);
    if (!result.ok) {
      setErrorMsg(result.error ?? "메뉴를 수정하지 못했어요.");
      return;
    }
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setErrorMsg(null);
    setToast("수정이 완료되었습니다");
    setTimeout(() => setToast(null), 1800);
  };

  const submitAdd = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setErrorMsg(null);
    const { ok: uploadOk, imageUrl } = await resolveImageForSave();
    if (!uploadOk) {
      setSaving(false);
      setErrorMsg(
        lastUploadImageError ?? "사진 업로드에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
      return;
    }
    const result = await addMenuItem({
      name: form.name.trim(),
      price: Number(form.price) || 0,
      category: form.category,
      stock: form.stock.trim() === "" ? null : Number(form.stock),
      imageUrl,
    });
    setSaving(false);
    if (!result.ok) {
      // 저장에 실패하면 입력한 내용을 잃지 않도록 창을 닫지 않고 에러만 보여줘요.
      setErrorMsg(result.error ?? "메뉴를 저장하지 못했어요.");
      return;
    }
    setShowAdd(false);
    setForm(emptyForm);
    setImageFile(null);
    setToast("메뉴가 추가되었어요");
    setTimeout(() => setToast(null), 1800);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeMenuItem(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col">
      <Header title="메뉴 관리" />

      <div className="flex border-b border-border px-6">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={
              "flex-1 border-b-2 py-3 text-[15px] font-bold " +
              (tab === c
                ? "border-trust text-trust"
                : "border-transparent text-ink-muted")
            }
          >
            {c}
          </button>
        ))}
      </div>

      {/* ⚠️ 메뉴 목록을 서버에서 불러오지 못했을 때(일시적 네트워크 오류 등)
          "등록된 메뉴가 없어요"만 보여주면 실제로는 메뉴가 있는데 이번에
          못 불러온 것뿐인데도 없는 것처럼 보였어요. 8초마다 자동으로 다시
          시도하지만, 바로 다시 시도할 수 있게 버튼도 함께 보여줘요. */}
      {menusLoadFailed && (
        <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-xl bg-danger-tint px-4 py-3 text-[13px] font-medium text-danger">
          <span>메뉴 목록을 불러오지 못했어요. 서버 연결을 확인해주세요.</span>
          <button
            onClick={retryMenusLoad}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-bold text-danger"
          >
            다시 시도
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 px-6 py-6">
        {filtered.length === 0 && menu.length === 0 && menusLoading && (
          <p className="mt-10 text-center text-[14px] text-ink-muted">
            메뉴를 불러오는 중이에요...
          </p>
        )}
        {filtered.length === 0 && !(menu.length === 0 && menusLoading) && (
          <p className="mt-10 text-center text-[14px] text-ink-muted">
            등록된 메뉴가 없어요.
          </p>
        )}

        {filtered.map((item) => (
          <div key={item.id}>
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4">
              {resolveImageUrl(item.imageUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveImageUrl(item.imageUrl) ?? undefined}
                  alt={item.name}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <ImagePlaceholder className="h-16 w-16 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-ink">
                  {item.name}
                </p>
                <p className="mt-0.5 text-[16px] font-bold text-ink">
                  {item.price.toLocaleString()}원
                </p>
                <p
                  className={
                    "mt-0.5 text-[12.5px] " +
                    (item.stock === 0
                      ? "font-bold text-danger"
                      : "text-ink-muted")
                  }
                >
                  ·{" "}
                  {item.stock === null
                    ? "재고 무제한"
                    : item.stock === 0
                      ? "재고 없음 (품절)"
                      : `재고 ${item.stock}개`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <button
                  onClick={() =>
                    editingId === item.id ? setEditingId(null) : startEdit(item)
                  }
                  aria-label="메뉴 수정"
                  className="flex h-9 w-9 items-center justify-center text-ink"
                >
                  <Pencil size={18} strokeWidth={1.8} />
                </button>
                <button
                  onClick={() => setDeleteTarget(item)}
                  aria-label="메뉴 삭제"
                  className="flex h-9 w-9 items-center justify-center text-ink-muted"
                >
                  <Trash2 size={17} strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {editingId === item.id && (
              <div className="mt-2 rounded-2xl border border-border bg-white p-4">
                {/* ⚠️ 예전엔 수정 실패 메시지(errorMsg)를 여기서 아예 보여주지
                    않았어요 — "메뉴 추가하기" 팝업에만 있었어요. 그래서 서버
                    저장이 실패해도 사용자는 이유를 알 수 없었어요. */}
                {errorMsg && (
                  <p className="mb-3 text-[13px] font-medium text-danger">
                    {errorMsg}
                  </p>
                )}
                <MenuForm
                  form={form}
                  setForm={setForm}
                  onFile={setImageFile}
                  onCancel={() => {
                    setEditingId(null);
                    setImageFile(null);
                    setErrorMsg(null);
                  }}
                  onSubmit={submitEdit}
                  submitLabel={saving ? "수정하는 중..." : "수정 완료"}
                  submitDisabled={saving}
                  embedded
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto px-6 pb-8 pt-2">
        <button
          onClick={() => {
            setShowAdd(true);
            setForm(emptyForm);
            setImageFile(null);
            setErrorMsg(null);
          }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-trust text-[16px] font-bold text-white active:bg-trust-dark"
        >
          <Plus size={19} strokeWidth={2.4} />
          메뉴 추가하기
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
          <div className="max-h-[85dvh] w-full max-w-app overflow-y-auto rounded-t-3xl bg-white p-6 pb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[17px] font-bold text-ink">메뉴 추가하기</h3>
              <button
                onClick={() => setShowAdd(false)}
                aria-label="닫기"
                className="flex h-9 w-9 items-center justify-center text-ink-muted"
              >
                <X size={20} />
              </button>
            </div>
            {errorMsg && (
              <p className="mb-3 text-[13px] font-medium text-danger">{errorMsg}</p>
            )}
            <MenuForm
              form={form}
              setForm={setForm}
              onFile={setImageFile}
              onCancel={() => setShowAdd(false)}
              onSubmit={submitAdd}
              submitLabel={saving ? "추가하는 중..." : "추가하기"}
              submitDisabled={saving}
              embedded
            />
          </div>
        </div>
      )}

      {/* ⚠️ 삭제 확인 팝업. "삭제하겠습니다"를 눌러야만 실제 삭제 API가
          호출돼요 — 실수로 삭제 아이콘을 눌러도 여기서 한 번 더 멈춰서
          되돌릴 기회를 줘요. */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={20} strokeWidth={2} />
              <h3 className="text-[16px] font-bold text-ink">메뉴 삭제</h3>
            </div>
            <p className="mt-3 text-[14px] text-ink-secondary">
              <span className="font-bold text-ink">{deleteTarget.name}</span>{" "}
              메뉴를 삭제할까요? 삭제하면 되돌릴 수 없어요.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-12 flex-1 rounded-xl border border-border text-[14.5px] font-bold text-ink-secondary"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="h-12 flex-1 rounded-xl bg-danger text-[14.5px] font-bold text-white active:opacity-90"
              >
                삭제하겠습니다
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast show={toast !== null} message={toast ?? ""} />
    </div>
  );
}

function MenuForm({
  form,
  setForm,
  onFile,
  onCancel,
  onSubmit,
  submitLabel,
  submitDisabled = false,
  embedded = false,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onFile: (file: File | null) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  embedded?: boolean;
}) {
  const content = (
    <div className="flex flex-col gap-3">
      <Field label="메뉴 사진">
        <ImageUploadField
          value={form.imageUrl}
          onChange={(v) => setForm({ ...form, imageUrl: v })}
          onFile={onFile}
          size="h-20 w-20"
        />
      </Field>
      <Field label="메뉴명">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="예: 아메리카노"
          className="h-11 w-full rounded-xl border border-border bg-white px-3.5 text-[14.5px] outline-none focus:border-trust"
        />
      </Field>
      <Field label="가격">
        <input
          type="number"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          placeholder="예: 4500"
          className="h-11 w-full rounded-xl border border-border bg-white px-3.5 text-[14.5px] outline-none focus:border-trust"
        />
      </Field>
      <Field label="카테고리">
        <div className="flex gap-2">
          {(["커피", "음료", "디저트"] as MenuCategory[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm({ ...form, category: c })}
              className={
                "h-10 flex-1 rounded-xl text-[13.5px] font-bold " +
                (form.category === c
                  ? "bg-trust text-white"
                  : "bg-cream text-ink-secondary")
              }
            >
              {c}
            </button>
          ))}
        </div>
      </Field>
      <Field label="재고 (비워두면 무제한, 0을 입력하면 품절 처리돼요)">
        <input
          type="number"
          min={0}
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
          placeholder="예: 5"
          className="h-11 w-full rounded-xl border border-border bg-white px-3.5 text-[14.5px] outline-none focus:border-trust"
        />
      </Field>

      <div className="mt-2 flex gap-2">
        <button
          onClick={onCancel}
          className="h-12 flex-1 rounded-xl border border-border text-[14.5px] font-bold text-ink-secondary"
        >
          취소
        </button>
        <button
          onClick={onSubmit}
          disabled={submitDisabled}
          className="h-12 flex-1 rounded-xl bg-trust text-[14.5px] font-bold text-white active:bg-trust-dark disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="mt-2 rounded-2xl border border-border bg-white p-4">
      {content}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
