import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";

interface PushNotificationButtonProps {
  variant?: "icon" | "full";
  className?: string;
}

export default function PushNotificationButton({ variant = "icon", className }: PushNotificationButtonProps) {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  const handleClick = () => {
    if (isSubscribed) void unsubscribe();
    else void subscribe();
  };

  if (variant === "full") {
    return (
      <Button
        variant={isSubscribed ? "outline" : "default"}
        size="sm"
        onClick={handleClick}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        <span className="ml-2">{isSubscribed ? "அறிவிப்பு நிறுத்து" : "அறிவிப்பு இயக்கு"}</span>
      </Button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      title={isSubscribed ? "அறிவிப்புகளை நிறுத்து" : "புதிய செய்தி அறிவிப்புகளை இயக்கு"}
      aria-label={isSubscribed ? "அறிவிப்புகளை நிறுத்து" : "அறிவிப்புகளை இயக்கு"}
      className={`transition-colors p-1 disabled:opacity-50 ${className ?? ""}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="h-4 w-4 fill-current" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
    </button>
  );
}
