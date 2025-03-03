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

export function getVirtualApiKey(): string {
  if (typeof window === "undefined") {
    throw new Error("Cannot access localStorage outside of browser environment");
  }
  
  const apiKey = window.localStorage.getItem("virtual_api_key");
  if (!apiKey) {
    console.error("No virtual_api_key found in localStorage");
    throw new Error("No virtual_api_key found in localStorage");
  }
  
  // Log the key to the console for debugging
  console.log("Retrieved virtual_api_key from localStorage:", apiKey);
  
  return apiKey;
}
