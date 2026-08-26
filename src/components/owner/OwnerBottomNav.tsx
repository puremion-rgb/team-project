"use client";

import { Receipt, Store } from "lucide-react";
import ElevatedBottomNav from "@/components/ElevatedBottomNav";
import HomeIcon from "@/components/icons/HomeIcon";
import MenuIcon from "@/components/icons/MenuIcon";
import MyIcon from "@/components/icons/MyIcon";

const items = [
  { href: "/owner", label: "홈", icon: HomeIcon, exact: true },
  { href: "/owner/reserve", label: "주문", icon: Receipt },
  { href: "/owner/menu", label: "메뉴", icon: MenuIcon },
  { href: "/owner/my", label: "MY", icon: MyIcon },
];

const center = { href: "/owner/store", label: "매장", icon: Store };

export default function OwnerBottomNav() {
  return <ElevatedBottomNav items={items} center={center} color="trust" />;
}
