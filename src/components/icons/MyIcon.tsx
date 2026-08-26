import type { IconProps } from "./CouponIcon";

export default function MyIcon({
  size = 24,
  strokeWidth = 1.75,
  ...props
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 20V19.5C2 18.0413 2.77262 16.6424 4.14788 15.6109C5.52315 14.5795 7.38841 14 9.33333 14H14.6667C16.6116 14 18.4769 14.5795 19.8521 15.6109C21.2274 16.6424 22 18.0413 22 19.5V20" />
      <circle cx="12" cy="7" r="5" />
    </svg>
  );
}
