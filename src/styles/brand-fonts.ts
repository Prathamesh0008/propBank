import { Cormorant_Garamond, DM_Sans } from "next/font/google";

export const brandUI = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-brand-ui",
});

export const brandEditorial = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-brand-editorial",
});
