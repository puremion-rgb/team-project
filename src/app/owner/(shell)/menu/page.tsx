"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import Header from "@/components/Header";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import ImageUploadField from "@/components/owner/ImageUploadField";
import Toast from "@/components/Toast";
import {
  useOwner,
  type MenuCategory,
  type OwnerMenuItem,
} from "@/lib/owner-store";
import { resolveImageUrl } from "@/lib/api";

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
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
  };

  const submitEdit = () => {
    if (!editingId) return;
    updateMenuItem(editingId, {
      name: form.name.trim() || "이름 없음",
      price: Number(form.price) || 0,
      category: form.category,
      stock: form.stock.trim() === "" ? null : Number(form.stock),
      imageUrl: form.imageUrl,
    });
    setEditingId(null);
    setForm(emptyForm);
  };

  const submitAdd = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setErrorMsg(null);
    const result = await addMenuItem({
      name: form.name.trim(),
      price: Number(form.price) || 0,
      category: form.category,
      stock: form.stock.trim() === "" ? null : Number(form.stock),
      imageUrl: form.imageUrl,
    });
    setSaving(false);
    if (!result.ok) {
      // 저장에 실패하면 입력한 내용을 잃지 않도록 창을 닫지 않고 에러만 보여줘요.
      setErrorMsg(result.error ?? "메뉴를 저장하지 못했어요.");
      return;
    }
    setShowAdd(false);
    setForm(emptyForm);
    setToast(true);
    setTimeout(() => setToast(false), 1800);
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
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  · 재고 {item.stock === null ? "무제한" : `${item.stock}개`}
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
                  onClick={() => removeMenuItem(item.id)}
                  aria-label="메뉴 삭제"
                  className="flex h-9 w-9 items-center justify-center text-ink-muted"
                >
                  <Trash2 size={17} strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {editingId === item.id && (
              <MenuForm
                form={form}
                setForm={setForm}
                onCancel={() => setEditingId(null)}
                onSubmit={submitEdit}
                submitLabel="수정 완료"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto px-6 pb-8 pt-2">
        <button
          onClick={() => {
            setShowAdd(true);
            setForm(emptyForm);
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
              onCancel={() => setShowAdd(false)}
              onSubmit={submitAdd}
              submitLabel={saving ? "추가하는 중..." : "추가하기"}
              submitDisabled={saving}
              embedded
            />
          </div>
        </div>
      )}

      <Toast show={toast} message="메뉴가 추가되었어요" />
    </div>
  );
}

function MenuForm({
  form,
  setForm,
  onCancel,
  onSubmit,
  submitLabel,
  submitDisabled = false,
  embedded = false,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
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
      <Field label="재고 (비워두면 무제한)">
        <input
          type="number"
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
