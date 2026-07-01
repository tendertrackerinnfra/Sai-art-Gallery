import Image from "next/image";

import { cn } from "@/lib/utils";

type AppLogoProps = {
  variant?: "square" | "wide";
  className?: string;
  priority?: boolean;
};

const logoConfig = {
  square: {
    src: "/branding/sag-logo-square.png",
    width: 1024,
    height: 1024,
  },
  wide: {
    src: "/branding/sag-logo-wide.png",
    width: 1400,
    height: 520,
  },
} as const;

export function AppLogo({ variant = "square", className, priority = false }: AppLogoProps) {
  const logo = logoConfig[variant];

  return (
    <Image
      src={logo.src}
      alt="Sai Art Gallery logo"
      width={logo.width}
      height={logo.height}
      priority={priority}
      className={cn("h-auto w-auto", className)}
    />
  );
}
