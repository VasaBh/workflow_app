"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Play,
  Clock,
  Calendar,
  Bell,
} from "lucide-react";
import { useNotificationStore, LiveMessage } from "@/store/notifications";
import clsx from "clsx";

type IconComponent = React.ComponentType<{ className?: string }>;

interface EventConfig {
  borderColor: string;
  bg: string;
  badgeClass: string;
  iconClass: string;
  Icon: IconComponent;
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  run_completed: {
    borderColor: "border-l-green-500",
    bg: "bg-green-950/80",
    badgeClass: "bg-green-900/40 text-green-300",
    iconClass: "text-green-400",
    Icon: CheckCircle2,
  },
  run_failed: {
    borderColor: "border-l-red-500",
    bg: "bg-red-950/80",
    badgeClass: "bg-red-900/40 text-red-300",
    iconClass: "text-red-400",
    Icon: AlertCircle,
  },
  run_started: {
    borderColor: "border-l-blue-500",
    bg: "bg-blue-950/80",
    badgeClass: "bg-blue-900/40 text-blue-300",
    iconClass: "text-blue-400",
    Icon: Play,
  },
  step_pending: {
    borderColor: "border-l-orange-500",
    bg: "bg-orange-950/80",
    badgeClass: "bg-orange-900/40 text-orange-300",
    iconClass: "text-orange-400",
    Icon: Clock,
  },
  step_failed: {
    borderColor: "border-l-red-500",
    bg: "bg-red-950/80",
    badgeClass: "bg-red-900/40 text-red-300",
    iconClass: "text-red-400",
    Icon: AlertCircle,
  },
  schedule_triggered: {
    borderColor: "border-l-indigo-500",
    bg: "bg-indigo-950/80",
    badgeClass: "bg-indigo-900/40 text-indigo-300",
    iconClass: "text-indigo-400",
    Icon: Calendar,
  },
};

const DEFAULT_CONFIG: EventConfig = {
  borderColor: "border-l-slate-500",
  bg: "bg-slate-900/90",
  badgeClass: "bg-slate-700 text-slate-400",
  iconClass: "text-slate-400",
  Icon: Bell,
};

export default function NotificationToast() {
  const { liveMessage, setLiveMessage, settings } = useNotificationStore();
  const [localMsg, setLocalMsg] = useState<LiveMessage | null>(liveMessage);
  const [isExiting, setIsExiting] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (liveMessage) {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      setIsExiting(false);
      setLocalMsg(liveMessage);
    } else if (localMsg) {
      setIsExiting(true);
      exitTimerRef.current = setTimeout(() => {
        setLocalMsg(null);
        setIsExiting(false);
      }, 350);
    }
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [liveMessage]);

  const dismiss = () => {
    setLiveMessage(null);
  };

  if (!localMsg || !settings.enableAnimations) return null;

  const cfg =
    (localMsg.event_type && EVENT_CONFIG[localMsg.event_type]) ||
    DEFAULT_CONFIG;
  const { Icon } = cfg;

  return (
    <div
      className={clsx(
        "fixed top-16 right-4 z-50 w-80 rounded-xl border border-slate-700/50 border-l-4 shadow-2xl overflow-hidden backdrop-blur-sm",
        cfg.borderColor,
        cfg.bg,
        isExiting
          ? "animate-notification-toast-out"
          : "animate-notification-toast-in",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className={clsx("w-5 h-5 flex-shrink-0 mt-0.5", cfg.iconClass)} />
        <div className="flex-1 min-w-0">
          {localMsg.event_type && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badgeClass}`}
            >
              {localMsg.event_type.replace(/_/g, " ")}
            </span>
          )}
          {localMsg.title && (
            <p className="text-sm font-medium text-slate-100 mt-1 truncate">
              {localMsg.title}
            </p>
          )}
          {localMsg.message && (
            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
              {localMsg.message}
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          className="text-slate-500 hover:text-slate-300 flex-shrink-0 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Progress bar — 8s matches the auto-dismiss timer */}
      <div className="h-0.5 bg-white/10">
        <div className="h-full bg-white/30 animate-notification-toast-progress" />
      </div>
    </div>
  );
}
