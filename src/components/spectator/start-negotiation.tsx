'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface PanUser {
  id: string;
  name: string;
  daemonName: string;
  image?: string;
}

interface StartNegotiationProps {
  onSuccess?: () => void;
  initialTarget?: PanUser;
}

export function StartNegotiation({ onSuccess, initialTarget }: StartNegotiationProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<PanUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<PanUser | null>(initialTarget || null);
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    
    const search = async () => {
      try {
        const url = searchQuery 
          ? `/api/users?q=${encodeURIComponent(searchQuery)}`
          : '/api/users';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } catch {
        // ignore
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [open, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) {
      toast.error('Please select a user to sync with');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetName: selectedUser.name,
          topic: topic || `Sync with ${selectedUser.name}`,
          message: message || `I'd like to coordinate with ${selectedUser.name}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start sync');
      }

      toast.success(`Started sync with ${selectedUser.name}'s Pan!`);
      setOpen(false);
      setSelectedUser(null);
      setTopic('');
      setMessage('');
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) {
    // Smaller button when used inline with initialTarget
    if (initialTarget) {
      return (
        <button
          onClick={() => setOpen(true)}
          className="px-2 py-1 text-[11px] text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
        >
          Message
        </button>
      );
    }
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-white text-black rounded-lg text-[13px] font-semibold hover:bg-neutral-100 transition-colors"
      >
        + New
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={() => setOpen(false)} />
      <div className="relative bg-neutral-950 border border-neutral-800 rounded-xl w-full max-w-md p-6">
        <h2 className="text-[18px] font-semibold mb-1">Start a Sync</h2>
        <p className="text-[13px] text-neutral-500 mb-6">
          Your Pan will sync with another user&apos;s Pan on your behalf.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Selection */}
          <div className="space-y-2">
            <label className="text-[13px] text-neutral-400">Who to sync with</label>
            {selectedUser ? (
              <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                    <span className="text-[12px]">◉</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{selectedUser.name}</p>
                    <p className="text-[11px] text-neutral-500">{selectedUser.daemonName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="text-[12px] text-neutral-500 hover:text-white"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 px-3 bg-neutral-900 border border-neutral-800 rounded-lg text-[13px] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700"
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {users.length === 0 ? (
                    <p className="text-[12px] text-neutral-600 text-center py-4">
                      {searchQuery ? 'No users found' : 'No other users yet'}
                    </p>
                  ) : (
                    users.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUser(user)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-900 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center shrink-0">
                          <span className="text-[12px]">◉</span>
                        </div>
                        <div>
                          <p className="text-[13px] font-medium">{user.name}</p>
                          <p className="text-[11px] text-neutral-500">{user.daemonName}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <label className="text-[13px] text-neutral-400">Topic</label>
            <input
              type="text"
              placeholder="e.g., Schedule a meeting, Request code review"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full h-10 px-3 bg-neutral-900 border border-neutral-800 rounded-lg text-[13px] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label className="text-[13px] text-neutral-400">Your request</label>
            <textarea
              placeholder="Tell your Pan what you want to achieve..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-[13px] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-[13px] text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedUser}
              className="px-4 py-2 bg-white text-black rounded-lg text-[13px] font-semibold hover:bg-neutral-100 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Starting...' : 'Start Sync'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
