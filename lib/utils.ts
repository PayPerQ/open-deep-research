import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isMobile = () => {
  if (typeof window === "undefined") return false;
  const width = window.innerWidth;
  return width <= 1024;
};

export function getCurrentFormattedDate(): string {
  const currentDate = new Date();
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  };
  return new Intl.DateTimeFormat("en-US", options).format(currentDate);
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const dateString = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeString = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${dateString} at ${timeString}`;
}

export function getApiBasePath() {
  // When running via the main app's proxy at /deepresearch
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/deepresearch')) {
    return '/deepresearch';
  }
  // When running standalone or directly accessed
  return '';
}

export function getCreditId(): string {
  console.log("\n🔍 [UTILS] === getCreditId Called ===");
  
  if (typeof window === "undefined") {
    console.error("[UTILS] Cannot access localStorage - not in browser environment");
    throw new Error("Cannot access localStorage outside of browser environment");
  }
  
  const creditId = window.localStorage.getItem("credit_id");
  if (!creditId) {
    console.error("[UTILS] No credit_id found in localStorage");
    throw new Error("No credit_id found in localStorage");
  }
  
  console.log("[UTILS] Successfully retrieved credit_id from localStorage");
  console.log("[UTILS] ID length:", creditId.length);
  
  return creditId;
}
