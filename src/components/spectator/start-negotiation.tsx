'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface StartNegotiationProps {
  onSuccess?: () => void;
}

export function StartNegotiation({ onSuccess }: StartNegotiationProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    targetEmail: '',
    topic: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: form.targetEmail,
          topic: form.topic,
          initialMessage: form.message,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start negotiation');
      }

      toast.success('Negotiation started! Watch your Dæmons work.');
      setOpen(false);
      setForm({ targetEmail: '', topic: '', message: '' });
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 transition-colors">
        New Negotiation
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Start a Negotiation</DialogTitle>
          <DialogDescription className="text-slate-400">
            Your Dæmon will negotiate with another user&apos;s Dæmon on your behalf.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Target User ID</label>
            <Input
              placeholder="User ID to negotiate with"
              value={form.targetEmail}
              onChange={(e) => setForm({ ...form, targetEmail: e.target.value })}
              className="bg-slate-800/50 border-slate-700 text-slate-100"
              required
            />
            <p className="text-xs text-slate-500">
              Enter the user ID of the person you want your Dæmon to negotiate with
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Topic</label>
            <Input
              placeholder="e.g., Schedule a meeting, Request code review"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              className="bg-slate-800/50 border-slate-700 text-slate-100"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Your Request</label>
            <Textarea
              placeholder="Tell your Dæmon what you want to achieve..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="bg-slate-800/50 border-slate-700 text-slate-100 min-h-[100px]"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold"
            >
              {isLoading ? 'Starting...' : 'Start Negotiation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
