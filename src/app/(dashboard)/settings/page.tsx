'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    daemonName: session?.user?.daemonName || 'Pan',
    personality: session?.user?.daemonPersonality || 'supportive',
    privacyLevel: session?.user?.privacyLevel || 'balanced',
    provider: session?.user?.preferredProvider || 'anthropic',
  });

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      await update();
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="h-14 px-6 flex items-center border-b border-neutral-900 bg-black">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
            <span className="text-[14px]">⚙</span>
          </div>
          <div>
            <p className="text-[14px] font-medium">Settings</p>
            <p className="text-[11px] text-neutral-500">Configure your Pan</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-6">
          <div className="space-y-8">
            <Section title="Pan Name">
              <input
                type="text"
                value={settings.daemonName}
                onChange={(e) => setSettings({ ...settings, daemonName: e.target.value })}
                placeholder="Pan"
                className="w-full h-12 px-4 bg-neutral-950 border border-neutral-800 rounded-lg text-[14px] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors"
              />
              <p className="mt-2 text-[12px] text-neutral-600">
                What should your Pan be called?
              </p>
            </Section>

            <Section title="Personality">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'analytical', label: 'Analytical', desc: 'Data-driven responses' },
                  { id: 'supportive', label: 'Supportive', desc: 'Warm and encouraging' },
                  { id: 'direct', label: 'Direct', desc: 'Straight to the point' },
                  { id: 'creative', label: 'Creative', desc: 'Thinks outside the box' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSettings({ ...settings, personality: p.id })}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      settings.personality === p.id
                        ? 'border-neutral-700 bg-neutral-900'
                        : 'border-neutral-900 hover:border-neutral-800'
                    }`}
                  >
                    <p className="text-[13px] font-medium mb-0.5">{p.label}</p>
                    <p className="text-[11px] text-neutral-500">{p.desc}</p>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Privacy Level">
              <p className="text-[12px] text-neutral-600 mb-3">
                Controls what your Pan shares with other Pans
              </p>
              <div className="space-y-2">
                {[
                  { id: 'minimal', label: 'Minimal', desc: 'Only share availability' },
                  { id: 'balanced', label: 'Balanced', desc: 'Share project context (recommended)' },
                  { id: 'open', label: 'Open', desc: 'Share freely for better collaboration' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSettings({ ...settings, privacyLevel: p.id })}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      settings.privacyLevel === p.id
                        ? 'border-neutral-700 bg-neutral-900'
                        : 'border-neutral-900 hover:border-neutral-800'
                    }`}
                  >
                    <p className="text-[13px] font-medium mb-0.5">{p.label}</p>
                    <p className="text-[11px] text-neutral-500">{p.desc}</p>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="AI Model">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'anthropic', label: 'Claude', desc: 'Thoughtful, nuanced' },
                  { id: 'openai', label: 'GPT-4', desc: 'Fast, versatile' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSettings({ ...settings, provider: p.id })}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      settings.provider === p.id
                        ? 'border-neutral-700 bg-neutral-900'
                        : 'border-neutral-900 hover:border-neutral-800'
                    }`}
                  >
                    <p className="text-[13px] font-medium mb-0.5">{p.label}</p>
                    <p className="text-[11px] text-neutral-500">{p.desc}</p>
                  </button>
                ))}
              </div>
            </Section>

            <button
              onClick={handleSave}
              disabled={isLoading}
              className="h-12 px-8 bg-white text-black rounded-lg font-semibold text-[14px] hover:bg-neutral-100 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-neutral-400 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}
