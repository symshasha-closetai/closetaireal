import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BPwsylb5rG9Mo9dmJtI13QgpjVSiHhtw1BcDFOXz-eEl3f3QbOX3tshVRJnCmXU7asKYCeZ7uyKYGXL9rcj-tz4";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushResult = {
  success: boolean;
  reason?: "not_supported" | "permission_denied" | "permission_dismissed" | "sw_unavailable" | "subscribe_failed" | "db_failed";
};

/**
 * Request permission via user gesture only.
 */
export async function requestPushPermission(): Promise<"granted" | "denied" | "not_supported"> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return "not_supported";
  }
  const permission = await Notification.requestPermission();
  return permission === "granted" ? "granted" : "denied";
}

/**
 * Silently ensure subscription exists when permission is already granted.
 * Does NOT prompt the user. Safe to call on auth state change.
 */
export async function ensurePushSubscription(userId: string): Promise<boolean> {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
    if (Notification.permission !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Check if already saved
    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) return true;

    const subJson = subscription.toJSON();
    const { error } = await supabase
      .from("push_subscriptions")
      .insert({ user_id: userId, subscription: subJson as any });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Full subscribe flow with permission prompt. Call from user gesture only.
 */
export async function subscribeToPush(userId: string): Promise<PushResult> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { success: false, reason: "not_supported" };
  }

  const currentPermission = Notification.permission;
  const permission = await Notification.requestPermission();

  if (permission === "denied") {
    return { success: false, reason: "permission_denied" };
  }
  if (permission === "default") {
    return { success: false, reason: "permission_dismissed" };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } catch {
        return { success: false, reason: "subscribe_failed" };
      }
    }

    const subJson = subscription.toJSON();

    await supabase.from("push_subscriptions").delete().eq("user_id", userId);

    const { error } = await supabase
      .from("push_subscriptions")
      .insert({ user_id: userId, subscription: subJson as any });

    if (error) {
      console.error("Failed to save push subscription:", error);
      return { success: false, reason: "db_failed" };
    }

    return { success: true };
  } catch (err) {
    console.error("Failed to subscribe to push:", err);
    return { success: false, reason: "subscribe_failed" };
  }
}

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    return true;
  } catch (err) {
    console.error("Failed to unsubscribe from push:", err);
    return false;
  }
}

export async function isPushSubscribed(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
