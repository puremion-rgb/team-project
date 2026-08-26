import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number | string;
};

export default function CouponIcon({
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
      <path d="M6.60999 4.88V7.43001" />
      <path d="M6.60999 11.24V12.51" />
      <path d="M6.60999 16.33V18.88" />
      <path d="M16.35 7.88L10.35 14.88" />
      <path d="M10.6 9.38C11.0142 9.38 11.35 9.04422 11.35 8.63C11.35 8.21579 11.0142 7.88 10.6 7.88C10.1858 7.88 9.84998 8.21579 9.84998 8.63C9.84998 9.04422 10.1858 9.38 10.6 9.38Z" />
      <path d="M15.6 15.38C16.0142 15.38 16.35 15.0442 16.35 14.63C16.35 14.2158 16.0142 13.88 15.6 13.88C15.1858 13.88 14.85 14.2158 14.85 14.63C14.85 15.0442 15.1858 15.38 15.6 15.38Z" />
      <path d="M20.55 12.38C19.88 12.38 19.34 11.84 19.34 11.17V11.06C19.34 10.39 19.88 9.85 20.55 9.85H21.85V6.88C21.85 5.78 20.95 4.88 19.85 4.88H3.84998C2.74998 4.88 1.84998 5.78 1.84998 6.88V10.35H3.00998C3.67998 10.35 4.21998 10.89 4.21998 11.56V11.67C4.21998 12.34 3.67998 12.88 3.00998 12.88H1.84998V16.87C1.84998 17.97 2.74998 18.87 3.84998 18.87H19.85C20.95 18.87 21.85 17.97 21.85 16.87V12.38H20.55Z" />
    </svg>
  );
}
