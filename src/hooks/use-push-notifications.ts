import { useEffect, useState, useCallback } from "react";
import { useToast } from "./use-toast";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function usePushNotifications() {
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) void checkSubscription();
  }, [checkSubscription]);

  const subscribe = useCallback(async () => {
    if (!isSupported) return;
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast({ title: "அனுமதி மறுக்கப்பட்டது", description: "உலாவி அமைப்புகளில் அறிவிப்புகளை இயக்கவும்.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const keyRes = await fetch("/api/push/vapid-key");
      if (!keyRes.ok) throw new Error("Failed to fetch VAPID key");
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
        expirationTime?: number | null;
      };

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subJson),
      });

      if (!saveRes.ok) {
        const err = (await saveRes.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to save subscription");
      }

      setIsSubscribed(true);
      toast({
        title: "அறிவிப்புகள் இயக்கப்பட்டன!",
        description: "புதிய செய்திகள் வரும்போது உடனே தெரிவிக்கப்படும்.",
      });
    } catch (err) {
      console.error("[push] subscribe error:", err);
      toast({
        title: "பிழை",
        description: "அறிவிப்புகளை இயக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, toast]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setIsSubscribed(false);
      toast({ title: "அறிவிப்புகள் நிறுத்தப்பட்டன" });
    } catch {
      toast({ title: "பிழை", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}
