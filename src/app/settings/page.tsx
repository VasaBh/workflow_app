"use client";

import { useState } from "react";
import { Volume2, VolumeX, Zap } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { useNotificationStore } from "@/store/notifications";

export default function SettingsPage() {
  const { settings, toggleSound, toggleAnimations, setSoundVolume } =
    useNotificationStore();
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSoundToggle = () => {
    toggleSound();
    showSavedMessage();
  };

  const handleAnimationsToggle = () => {
    toggleAnimations();
    showSavedMessage();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseInt(e.target.value) / 100;
    setSoundVolume(volume);
    showSavedMessage();
  };

  const showSavedMessage = () => {
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  return (
    <AppShell title="Settings">
      <div className="p-6 space-y-6 max-w-2xl">
        {/* Saved message */}
        {savedMessage && (
          <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg text-green-300 text-sm flex items-center gap-2 animate-notification-slide-down">
            <Zap className="w-4 h-4" />
            Settings saved successfully
          </div>
        )}

        {/* Notification Settings Card */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Notifications
              </h2>
              <p className="text-sm text-slate-400">
                Configure how you receive notifications
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Sound Notifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-200">
                    Sound Notifications
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Play audio alerts for run events
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableSound}
                    onChange={handleSoundToggle}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              {/* Event types info */}
              <div className="px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-xs font-medium text-slate-300 mb-2">
                  Sounds play for:
                </p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Run started
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Run completed
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Run failed
                  </li>
                </ul>
              </div>
            </div>

            {/* Volume Control */}
            {settings.enableSound && (
              <div className="space-y-3 pt-4 border-t border-slate-700">
                <label className="text-sm font-medium text-slate-200 block">
                  Volume Level
                </label>
                <div className="flex items-center gap-4">
                  <VolumeX className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.soundVolume * 100}
                    onChange={handleVolumeChange}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <Volume2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="text-sm text-slate-300 w-12 text-right">
                    {Math.round(settings.soundVolume * 100)}%
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Adjust how loud notification sounds should be
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Animation Settings Card */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Visual Notifications
              </h2>
              <p className="text-sm text-slate-400">
                Animated toasts and bell effects
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-200">
                    Visual Notifications
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Show animated toasts and bell effects for run events
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableAnimations}
                    onChange={handleAnimationsToggle}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div className="px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-xs font-medium text-slate-300 mb-2">
                  Includes:
                </p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Floating toast in top-right corner
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Bell ring &amp; bounce animation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Live banner inside notification panel
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-4">
          <p className="text-sm text-indigo-200">
            💡 <span className="font-medium">Pro Tip:</span> You can also access
            notification settings from the notification bell in the top right
            corner of the app.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
