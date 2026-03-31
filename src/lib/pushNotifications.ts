import { supabase } from "@/integrations/supabase/client";

// Generated VAPID public key
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

export async function requestPushPermission(): Promise<boolean> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.log("Push notifications not supported");
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.log("Push notification permission denied");
    return false;
  }

  return true;
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    const permission = await requestPushPermission();
    if (!permission) return false;

    const registration = await navigator.serviceWorker.ready;
    
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Save to database - upsert by user_id
    const subJson = subscription.toJSON();
    
    // Delete old subscriptions for this user first, then insert new
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId);

    const { error } = await supabase
      .from("push_subscriptions")
      .insert({
        user_id: userId,
        subscription: subJson as any,
      });

    if (error) {
      console.error("Failed to save push subscription:", error);
      return false;
    }

    console.log("Push subscription saved successfully");
    return true;
  } catch (err) {
    console.error("Failed to subscribe to push:", err);
    return false;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Remove from database
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId);

    console.log("Push subscription removed");
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
