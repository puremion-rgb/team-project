"use client";

import { Receipt, MapPin } from "lucide-react";
import ElevatedBottomNav from "@/components/ElevatedBottomNav";
import WishlistIcon from "@/components/icons/WishlistIcon";
import CouponIcon from "@/components/icons/CouponIcon";
import MyIcon from "@/components/icons/MyIcon";

const items = [
  { href: "/wishlist", label: "찜", icon: WishlistIcon },
  { href: "/reserve", label: "주문내역", icon: Receipt },
  { href: "/benefits", label: "혜택", icon: CouponIcon },
  { href: "/my", label: "MY", icon: MyIcon },
];

const center = {
  href: "/map",
  label: "지도",
  icon: MapPin,
  iconSrc: "/animations/map-navigation-static.svg",
  pressedAnimationSrc: "/animations/area-search-animated.svg",
};

export default function BottomNav() {
  return <ElevatedBottomNav items={items} center={center} color="brand" />;
}
