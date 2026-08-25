"use client";

import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";

type FavoriteButtonProps = {
  liked: boolean;
  onToggle: () => void;
  className?: string;
  iconSize?: number;
};

/** Shows the supplied heart animation only at the moment the favorite button is pressed. */
export default function FavoriteButton({
  liked,
  onToggle,
  className = "",
  iconSize = 20,
}: FavoriteButtonProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const handleClick = () => {
    onToggle();
    setShowAnimation(false);
    window.requestAnimationFrame(() => setShowAnimation(true));
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowAnimation(false), 3000);
  };

  return (
    <button
      type="button"
      aria-label={liked ? "찜 해제" : "찜하기"}
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center ${className}`}
    >
      <Heart
        size={iconSize}
        className={liked ? "fill-brand text-brand" : "text-ink"}
        strokeWidth={1.8}
      />
      {showAnimation && (
        <img
          src="/animations/favorite-heart-animated.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 max-w-none -translate-x-1/2 -translate-y-1/2"
        />
      )}
    </button>
  );
}
