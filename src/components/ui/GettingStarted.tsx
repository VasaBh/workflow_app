"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  GitBranch,
  Code2,
  Play,
  Clock,
  Bell,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";


interface Step {
  id: number;
  icon: React.ElementType;
  iconClass: string;
  title: string;
  description: string;
  action: string;
  href: string;
}

const STEPS: Step[] = [
  {
    id: 1,
    icon: GitBranch,
    iconClass: "text-indigo-400 bg-indigo-900/40",
    title: "Create a Blueprint",
    description:
      "A Blueprint defines your workflow. Add steps (manual, script, or approval) and set their order and dependencies.",
    action: "Go to Blueprints",
    href: "/blueprints",
  },
  {
    id: 2,
    icon: Code2,
    iconClass: "text-purple-400 bg-purple-900/40",
    title: "Add Scripts",
    description:
      "Scripts are reusable automation units attached to script steps. Upload or write your script and link it to a blueprint step.",
    action: "Go to Scripts",
    href: "/scripts",
  },
  {
    id: 3,
    icon: Play,
    iconClass: "text-green-400 bg-green-900/40",
    title: "Start a Run",
    description:
      "Trigger a run from a published blueprint. Monitor progress in real-time — complete manual steps and approve approval gates.",
    action: "Go to Runs",
    href: "/runs",
  },
  {
    id: 4,
    icon: Clock,
    iconClass: "text-blue-400 bg-blue-900/40",
    title: "Schedule Runs",
    description:
      "Automate recurring runs with a cron schedule. Flowcraft will trigger blueprints at the configured interval.",
    action: "Go to Schedules",
    href: "/schedules",
  },
  {
    id: 5,
    icon: Bell,
    iconClass: "text-yellow-400 bg-yellow-900/40",
    title: "Configure Notifications",
    description:
      "Get real-time sound and visual alerts for run started, completed, and failed events. Customise volume and toggle effects.",
    action: "Go to Settings",
    href: "/settings",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function GettingStarted({ open, onClose }: Props) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(1);

  const handleNavigate = (href: string) => {
    onClose();
    router.push(href);
  };

  const handleDismiss = () => {
    onClose();
  };

  if (!open) return null;

  const step = STEPS[activeStep - 1];
  const Icon = step.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-slate-900 border-l border-slate-700 shadow-2xl animate-notification-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600/20 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Get Started with Flowcraft
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {STEPS.filter((_, i) => i < activeStep - 1).length} of {STEPS.length} steps completed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step nav */}
        <div className="flex items-center gap-1.5 px-6 py-4 border-b border-slate-700/60 overflow-x-auto">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStep(s.id)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0",
                s.id === activeStep
                  ? "bg-indigo-600 text-white"
                  : s.id < activeStep
                  ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700",
              )}
            >
              {s.id < activeStep ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">
                  {s.id}
                </span>
              )}
              {s.title.split(" ").slice(0, 2).join(" ")}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Step header */}
            <div className="flex items-start gap-4">
              <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", step.iconClass)}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  Step {step.id} of {STEPS.length}
                </p>
                <h3 className="text-xl font-semibold text-slate-100">
                  {step.title}
                </h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-300 leading-relaxed">
              {step.description}
            </p>

            {/* Tips per step */}
            <StepTips stepId={step.id} />

            {/* Action */}
            <button
              onClick={() => handleNavigate(step.href)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {step.action}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={handleDismiss}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Don't show again
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep((p) => Math.max(1, p - 1))}
              disabled={activeStep === 1}
              className="px-3 py-1.5 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            {activeStep < STEPS.length ? (
              <button
                onClick={() => setActiveStep((p) => p + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 text-slate-200 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleDismiss}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Done
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StepTips({ stepId }: { stepId: number }) {
  const tips: Record<number, { label: string; text: string }[]> = {
    1: [
      { label: "Sequential vs parallel", text: "Enable sequential mode to run steps one-by-one, or leave it off for parallel execution." },
      { label: "Step types", text: "Manual steps require human action, script steps run code automatically, approval steps wait for sign-off." },
      { label: "Dependencies", text: "Set step dependencies to ensure a step only starts after its prerequisites complete." },
    ],
    2: [
      { label: "Supported languages", text: "Scripts can be written in Python, Bash, or Node.js depending on your server setup." },
      { label: "Parameters", text: "Pass dynamic values to scripts using script_params — these are injected at run time." },
    ],
    3: [
      { label: "Live updates", text: "The run detail page updates in real time via WebSocket — you'll see steps flip status as they complete." },
      { label: "Manual steps", text: "When a manual step becomes active, click Complete to mark it done and unblock the next step." },
      { label: "Failed runs", text: "Use the Retry button to restart a failed run from the point of failure." },
    ],
    4: [
      { label: "Cron syntax", text: "Schedules use standard cron syntax. Example: `0 9 * * 1-5` runs at 9am every weekday." },
      { label: "Timezone", text: "Set the schedule timezone to match your team — the server stores all times in UTC but displays in your zone." },
    ],
    5: [
      { label: "Sound alerts", text: "Browser audio must be unlocked by a first click — after that, sounds fire automatically for every event." },
      { label: "Visual toasts", text: "Animated toasts appear in the top-right corner with a blueprint name and a direct link to the run." },
      { label: "Toggle anytime", text: "Use the bell icon or Settings page to disable sound or animations independently." },
    ],
  };

  const items = tips[stepId] ?? [];
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tips</p>
      <div className="space-y-2">
        {items.map((tip) => (
          <div key={tip.label} className="flex gap-2.5 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
            <ChevronRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-medium text-slate-200">{tip.label}: </span>
              <span className="text-xs text-slate-400">{tip.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function useGettingStarted() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
