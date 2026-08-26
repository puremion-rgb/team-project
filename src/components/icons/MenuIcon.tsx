import type { IconProps } from "./CouponIcon";

export default function MenuIcon({
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
      <path d="M19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5Z" />
      <path d="M3 10H21" />
      <path d="M7 14H13" />
      <path d="M6.75 17H17.25" />
      <path d="M8 3V7M16 3V7" />
    </svg>
  );
}
