import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;

  return (
    Capacitor.isNativePlatform() ||
    new URLSearchParams(window.location.search).get("platform") === "app" ||
    localStorage.getItem("platform") === "app" ||
    localStorage.getItem("isNativeApp") === "true"
  );
}

export function rememberNativeApp(): boolean {
  const native = isNativeApp();
  if (native) {
    localStorage.setItem("platform", "app");
    localStorage.setItem("isNativeApp", "true");
    document.documentElement.classList.add("native-app");
  }
  return native;
}
