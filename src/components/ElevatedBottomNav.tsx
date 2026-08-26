"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";

/** Accepts both lucide-react icons and our custom SVG icon components (icons/*.tsx). */
export type NavIconComponent = ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
}>;

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconComponent;
  exact?: boolean;
  /** Static image for a custom center icon (e.g. the map marker animation's still frame). */
  iconSrc?: string;
  /** Animated image shown only after this navigation item is pressed. */
  pressedAnimationSrc?: string;
};

const colorMap = {
  brand: { text: "text-brand", bgActive: "bg-brand", bgInactive: "bg-brand/85" },
  trust: { text: "text-trust", bgActive: "bg-trust", bgInactive: "bg-trust/85" },
} as const;

export default function ElevatedBottomNav({
  items,
  center,
  color = "brand",
}: {
  /** exactly 4 items — rendered as 2 on the left, 2 on the right of the center item */
  items: NavItem[];
  center: NavItem;
  color?: "brand" | "trust";
}) {
  const pathname = usePathname();
  const c = colorMap[color];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const left = items.slice(0, 2);
  const right = items.slice(2, 4);
  const centerActive = isActive(center.href, center.exact);
  const CenterIcon = center.icon;
  const [showCenterAnimation, setShowCenterAnimation] = useState(false);
  const centerAnimationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (centerAnimationTimer.current) clearTimeout(centerAnimationTimer.current);
  }, []);

  const playCenterAnimation = () => {
    if (!center.pressedAnimationSrc) return;
    setShowCenterAnimation(false);
    window.requestAnimationFrame(() => setShowCenterAnimation(true));
    if (centerAnimationTimer.current) clearTimeout(centerAnimationTimer.current);
    centerAnimationTimer.current = setTimeout(() => setShowCenterAnimation(false), 1900);
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href, item.exact);
    const Icon = item.icon;
    return (
      <li key={item.href} className="flex-1">
        <Link href={item.href} className="flex flex-col items-center gap-1 py-1">
          <span className="flex h-6 items-center justify-center">
            <Icon
              size={22}
              strokeWidth={active ? 2.4 : 1.8}
              className={active ? c.text : "text-ink-muted"}
            />
          </span>
          <span
            className={
              "text-[11px] " + (active ? `font-bold ${c.text}` : "text-ink-muted")
            }
          >
            {item.label}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <nav className="relative z-30 shrink-0 border-t border-border bg-white">
      <ul className="flex items-start justify-between px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {left.map(renderItem)}

        <li className="flex-1">
          <Link
            href={center.href}
            onClick={playCenterAnimation}
            className="flex flex-col items-center gap-1 py-1"
          >
            <span className="relative flex h-6 items-center justify-center">
              <span
                className={
                  center.iconSrc
                    ? "absolute -top-7 h-14 w-14 overflow-visible"
                    : "absolute -top-7 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white shadow-sheet transition-colors " +
                      (centerActive ? c.bgActive : c.bgInactive)
                }
              >
                {center.iconSrc ? (
                  <img
                    src={center.iconSrc}
                    alt=""
                    aria-hidden="true"
                    className="h-14 w-14"
                  />
                ) : (
                  <CenterIcon size={24} strokeWidth={2.2} className="text-white" />
                )}
                {showCenterAnimation && center.pressedAnimationSrc && (
                  <img
                    src={center.pressedAnimationSrc}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-14 w-14"
                  />
                )}
              </span>
            </span>
            <span
              className={
                "text-[11px] " +
                (centerActive ? `font-bold ${c.text}` : "text-ink-muted")
              }
            >
              {center.label}
            </span>
          </Link>
        </li>

        {right.map(renderItem)}
      </ul>
    </nav>
  );
}
