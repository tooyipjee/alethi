'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { toast } from 'sonner';

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const isDev = process.env.NODE_ENV !== 'production';

interface SyncStatus {
  googleConnected: boolean;
  sources: string[];
  lastSynced: string | null;
  hasRealContext: boolean;
}

interface RecentNegotiation {
  id: string;
  topic: string;
  status: string;
  initiator: { name: string; daemonName: string };
  target: { name: string; daemonName: string };
  isInitiator: boolean;
  sharedContext?: {
    initiator: { privacyLevel: string };
    target: { privacyLevel: string };
  };
  createdAt: string;
}

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [recentNegotiations, setRecentNegotiations] = useState<RecentNegotiation[]>([]);
  const [settings, setSettings] = useState({
    daemonName: session?.user?.daemonName || 'Pan',
    personality: session?.user?.daemonPersonality || 'supportive',
    privacyLevel: session?.user?.privacyLevel || 'balanced',
    provider: session?.user?.preferredProvider || 'ollama',
  });

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/google');
      if (res.ok) {
        setSyncStatus(await res.json());
      }
    } catch { /* ignore */ }
  }, []);

  const fetchRecentNegotiations = useCallback(async () => {
    try {
      const res = await fetch('/api/negotiations');
      if (res.ok) {
        const data = await res.json();
        setRecentNegotiations((data.negotiations || []).slice(0, 10));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
    fetchRecentNegotiations();
  }, [fetchSyncStatus, fetchRecentNegotiations]);

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

  const handleGoogleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/integrations/google', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        if (data.error?.includes('not connected')) {
          toast.error('Sign in with Google first to connect');
        } else {
          toast.error(data.error || 'Sync failed');
        }
        return;
      }

      toast.success(`Synced ${data.emailCount} emails and ${data.eventCount} events`);
      fetchSyncStatus();
    } catch {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm('This will clear all syncs and conversations. Continue?')) {
      return;
    }
    
    setIsResetting(true);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Reset failed');
        return;
      }

      toast.success(data.message || 'Demo state reset');
      // Refresh negotiations list
      fetchRecentNegotiations();
      // Clear localStorage
      if (typeof window !== 'undefined') {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('pan-chat-'));
        keys.forEach(k => localStorage.removeItem(k));
      }
    } catch {
      toast.error('Reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-14 px-6 md:px-6 pl-16 md:pl-6 flex items-center border-b border-neutral-900 bg-black shrink-0">
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

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-xl mx-auto p-6">
          <div className="space-y-8">

            {/* Profile Info */}
            {session?.user && (
              <Section title="Your Account">
                <div className="p-4 rounded-lg border border-neutral-900 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center text-[18px] font-semibold">
                    {session.user.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate">{session.user.name}</p>
                    <p className="text-[12px] text-neutral-500 truncate">{session.user.email}</p>
                  </div>
                  {session.user.googleConnected && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Google
                    </span>
                  )}
                </div>
              </Section>
            )}

            {/* Integrations — the important new section */}
            <Section title="Integrations">
              <div className="space-y-4">
                {isDemoMode ? (
                  <div className="p-4 rounded-lg border border-amber-900/50 bg-amber-950/20">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[14px]">🔒</span>
                      <p className="text-[13px] font-medium text-amber-200">Demo Mode Active</p>
                    </div>
                    <p className="text-[12px] text-amber-200/70 leading-relaxed">
                      Real Google sync is disabled. Pan uses simulated work context for demonstrations.
                      No personal data is accessed or stored.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-[10px] px-2 py-1 bg-amber-900/30 rounded text-amber-300/80">
                        Mock calendar
                      </span>
                      <span className="text-[10px] px-2 py-1 bg-amber-900/30 rounded text-amber-300/80">
                        Mock emails
                      </span>
                      <span className="text-[10px] px-2 py-1 bg-amber-900/30 rounded text-amber-300/80">
                        Mock tasks
                      </span>
                    </div>
                    <button
                      onClick={handleResetDemo}
                      disabled={isResetting}
                      className="mt-4 w-full py-2 px-3 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-800/50 rounded-lg text-[12px] text-amber-200 transition-colors disabled:opacity-50"
                    >
                      {isResetting ? 'Resetting...' : 'Reset Demo State'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-lg border border-neutral-900">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          <div>
                            <p className="text-[13px] font-medium">Google</p>
                            <p className="text-[11px] text-neutral-500">Gmail + Calendar</p>
                          </div>
                        </div>
                        {syncStatus?.googleConnected ? (
                          <span className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            Connected
                          </span>
                        ) : (
                          <span className="text-[11px] text-neutral-500">Not connected</span>
                        )}
                      </div>

                      {syncStatus?.googleConnected ? (
                        <div className="space-y-3">
                          {syncStatus.lastSynced && (
                            <p className="text-[11px] text-neutral-600">
                              Last synced: {new Date(syncStatus.lastSynced).toLocaleString()}
                            </p>
                          )}
                          {syncStatus.sources.length > 0 && (
                            <div className="flex gap-2">
                              {syncStatus.sources.map(s => (
                                <span key={s} className="text-[10px] px-2 py-0.5 bg-neutral-900 rounded-full text-neutral-400">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={handleGoogleSync}
                            disabled={isSyncing}
                            className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-lg text-[13px] font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
                          >
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => signIn('google', { callbackUrl: '/settings' })}
                          className="w-full h-10 bg-white text-black rounded-lg text-[13px] font-semibold hover:bg-neutral-100 transition-colors"
                        >
                          Connect Google Account
                        </button>
                      )}
                    </div>

                    <p className="text-[12px] text-neutral-600 leading-relaxed">
                      Pan reads your emails and calendar to understand your context.
                      Data stays on this server and is filtered through the privacy layer
                      before sharing with other Pans.
                    </p>
                  </>
                )}

                <div className="p-4 rounded-lg border border-neutral-900 opacity-50">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-neutral-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <div>
                      <p className="text-[13px] font-medium">GitHub</p>
                      <p className="text-[11px] text-neutral-500">Coming soon</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-neutral-900 opacity-50">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 text-center text-[14px] text-neutral-500">◆</span>
                    <div>
                      <p className="text-[13px] font-medium">Linear</p>
                      <p className="text-[11px] text-neutral-500">Coming soon</p>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Pan Name">
              <input
                type="text"
                value={settings.daemonName}
                onChange={(e) => setSettings({ ...settings, daemonName: e.target.value })}
                placeholder="Pan"
                className="w-full h-12 px-4 bg-neutral-950 border border-neutral-800 rounded-lg text-[14px] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors"
              />
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

            {/* Transparency Dashboard */}
            <Section title="Privacy Transparency">
              <div className="space-y-4">
                {/* What Pan Can Access */}
                <div className="p-4 rounded-lg border border-neutral-900">
                  <p className="text-[12px] text-neutral-500 uppercase tracking-wider mb-3">What Pan can access</p>
                  <div className="space-y-2">
                    {isDemoMode ? (
                      <>
                        <div className="flex items-center justify-between py-2 border-b border-neutral-900">
                          <span className="text-[13px] text-neutral-400">Calendar (mock)</span>
                          <span className="text-[11px] px-2 py-0.5 bg-amber-900/30 rounded text-amber-400">Demo</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-neutral-900">
                          <span className="text-[13px] text-neutral-400">Emails (mock)</span>
                          <span className="text-[11px] px-2 py-0.5 bg-amber-900/30 rounded text-amber-400">Demo</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-[13px] text-neutral-400">Tasks (mock)</span>
                          <span className="text-[11px] px-2 py-0.5 bg-amber-900/30 rounded text-amber-400">Demo</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between py-2 border-b border-neutral-900">
                          <span className="text-[13px] text-neutral-400">Google Calendar</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded ${
                            syncStatus?.googleConnected 
                              ? 'bg-emerald-900/30 text-emerald-400' 
                              : 'bg-neutral-800 text-neutral-500'
                          }`}>
                            {syncStatus?.googleConnected ? 'Connected' : 'Not connected'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-neutral-900">
                          <span className="text-[13px] text-neutral-400">Gmail</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded ${
                            syncStatus?.googleConnected 
                              ? 'bg-emerald-900/30 text-emerald-400' 
                              : 'bg-neutral-800 text-neutral-500'
                          }`}>
                            {syncStatus?.googleConnected ? 'Connected' : 'Not connected'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-[13px] text-neutral-400">GitHub / Linear</span>
                          <span className="text-[11px] px-2 py-0.5 bg-neutral-800 text-neutral-500 rounded">
                            Coming soon
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Always Protected */}
                <div className="p-4 rounded-lg border border-neutral-900 bg-neutral-950/50">
                  <p className="text-[12px] text-neutral-500 uppercase tracking-wider mb-3">Always protected</p>
                  <p className="text-[12px] text-neutral-500 mb-2">
                    These categories are never shared, regardless of privacy level:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Salary', 'Medical', 'HR matters', 'Legal', 'Credentials', 'Personal notes'].map(item => (
                      <span key={item} className="text-[11px] px-2 py-1 bg-red-900/20 text-red-400/80 rounded">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Recent Sharing Activity */}
                <div className="p-4 rounded-lg border border-neutral-900">
                  <p className="text-[12px] text-neutral-500 uppercase tracking-wider mb-3">Recent sharing activity</p>
                  {recentNegotiations.length === 0 ? (
                    <p className="text-[13px] text-neutral-600 py-4 text-center">
                      No syncs yet
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {recentNegotiations.map(neg => {
                        const otherPerson = neg.isInitiator ? neg.target.name : neg.initiator.name;
                        const otherDaemon = neg.isInitiator ? neg.target.daemonName : neg.initiator.daemonName;
                        const myPrivacy = neg.isInitiator 
                          ? neg.sharedContext?.initiator?.privacyLevel 
                          : neg.sharedContext?.target?.privacyLevel;
                        return (
                          <div key={neg.id} className="flex items-center justify-between py-2 border-b border-neutral-900/50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-neutral-300 truncate">
                                {neg.isInitiator ? 'You → ' : ''}{otherPerson}&apos;s {otherDaemon}
                              </p>
                              <p className="text-[11px] text-neutral-600 truncate">
                                {neg.topic.slice(0, 40)}{neg.topic.length > 40 ? '...' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {myPrivacy && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                                  {myPrivacy}
                                </span>
                              )}
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                neg.status === 'completed' ? 'bg-emerald-500' : 
                                neg.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                              }`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* Developer Tools - only show in dev mode */}
            {isDev && !isDemoMode && (
              <Section title="Developer Tools">
                <div className="space-y-3">
                  <p className="text-[12px] text-neutral-500">
                    These tools are only available in development mode.
                  </p>
                  <button
                    onClick={handleResetDemo}
                    disabled={isResetting}
                    className="w-full py-2.5 px-4 bg-red-950/30 hover:bg-red-950/50 border border-red-900/50 rounded-lg text-[13px] text-red-300 transition-colors disabled:opacity-50"
                  >
                    {isResetting ? 'Resetting...' : 'Reset All Syncs & Conversations'}
                  </button>
                </div>
              </Section>
            )}

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
