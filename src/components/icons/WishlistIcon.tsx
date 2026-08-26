import type { IconProps } from "./CouponIcon";

export default function WishlistIcon({
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
      <path d="M21.0136 4.99788C23.5931 8.69165 21.2877 13.664 12.0286 20H11.9714C2.71234 13.664 0.406904 8.69165 2.98636 4.99788C5.56582 1.30412 10.6586 3.15101 11.9714 7.1289H12.0286C13.3414 3.15101 18.4342 1.30412 21.0136 4.99788Z" />
    </svg>
  );
}
