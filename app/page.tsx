import type { Metadata } from "next";
import Kiosk from "./kiosk/Kiosk";

export const metadata: Metadata = {
  title: "Stride One — Interactive Exhibit",
  description: "Touch-free expo kiosk: point at a part of the shoe to learn what it does.",
};

export default function Home() {
  return <Kiosk />;
}
