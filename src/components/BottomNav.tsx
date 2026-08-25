"use client";

import { Heart, Receipt, MapPin, Ticket, User } from "lucide-react";
import ElevatedBottomNav from "@/components/ElevatedBottomNav";

const items = [
  { href: "/wishlist", label: "찜", icon: Heart },
  { href: "/reserve", label: "주문내역", icon: Receipt },
  { href: "/benefits", label: "혜택", icon: Ticket },
  { href: "/my", label: "MY", icon: User },
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
