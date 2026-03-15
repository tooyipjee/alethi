'use client';

import { useState } from 'react';
import type { NegotiationPreview } from '@/app/api/negotiations/preview/route';
import type { TruthPacket } from '@/types/daemon';

interface ConsentDialogProps {
  preview: NegotiationPreview;
  onApprove: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function TruthPacketDisplay({ packet, privacyLevel }: { packet: TruthPacket; privacyLevel: string }) {
  return (
    <div className="space-y-3">
      {packet.availability.length > 0 && (
        <div className="p-3 bg-neutral-900/50 rounded-lg">
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">Availability</p>
          <ul className="space-y-1">
            {packet.availability.slice(0, 3).map((slot, i) => (
              <li key={i} className="text-[13px] text-neutral-300">{slot}</li>
            ))}
            {packet.availability.length > 3 && (
              <li className="text-[12px] text-neutral-500">+{packet.availability.length - 3} more</li>
            )}
          </ul>
        </div>
      )}

      {packet.workloadSummary && (
        <div className="p-3 bg-neutral-900/50 rounded-lg">
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">Workload</p>
          <p className="text-[13px] text-neutral-300">{packet.workloadSummary}</p>
        </div>
      )}

      {packet.relevantExpertise.length > 0 && (
        <div className="p-3 bg-neutral-900/50 rounded-lg">
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">Expertise</p>
          <div className="flex flex-wrap gap-1.5">
            {packet.relevantExpertise.map((exp, i) => (
              <span key={i} className="px-2 py-0.5 bg-neutral-800 rounded text-[12px] text-neutral-300">
                {exp}
              </span>
            ))}
          </div>
        </div>
      )}

      {packet.currentFocus && (
        <div className="p-3 bg-neutral-900/50 rounded-lg">
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">Current Focus</p>
          <p className="text-[13px] text-neutral-300">{packet.currentFocus}</p>
        </div>
      )}

      <div className="pt-2">
        <p className="text-[11px] text-neutral-600">
          Privacy level: <span className="text-neutral-400">{privacyLevel}</span>
        </p>
      </div>
    </div>
  );
}

export function ConsentDialog({ preview, onApprove, onCancel, isLoading }: ConsentDialogProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-900/30 flex items-center justify-center">
              <span className="text-[18px]">🔒</span>
            </div>
            <div>
              <h2 className="text-[16px] font-semibold">Approve sharing</h2>
              <p className="text-[12px] text-neutral-500">Review what you&apos;ll share with {preview.target.name}</p>
            </div>
          </div>

          <div className="p-4 bg-neutral-900/50 rounded-xl mb-4">
            <p className="text-[13px] text-neutral-300 leading-relaxed">
              Your <span className="text-white font-medium">{preview.initiator.daemonName}</span> will chat with{' '}
              <span className="text-white font-medium">{preview.target.name}</span>{' '}
              about:
            </p>
            <p className="text-[14px] text-white font-medium mt-2">
              &ldquo;{preview.topic}&rdquo;
            </p>
          </div>

          <div className="mb-4">
            <p className="text-[12px] text-neutral-400 mb-2">Information that will be shared:</p>
            <ul className="space-y-1.5">
              {preview.sharingDescription.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span className="text-neutral-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-[12px] text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
          >
            {showDetails ? '▼ Hide details' : '▶ Show exact data'}
          </button>

          {showDetails && (
            <div className="mb-4 p-4 bg-black rounded-xl border border-neutral-800">
              <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-3">Data preview</p>
              <TruthPacketDisplay 
                packet={preview.initiator.truthPacket} 
                privacyLevel={preview.initiator.privacyLevel} 
              />
            </div>
          )}

          <div className="p-3 bg-neutral-900/30 rounded-lg mb-4">
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              <span className="text-amber-500">Note:</span> Sensitive info (salary, medical, credentials) is automatically blocked by the privacy layer.
            </p>
          </div>
        </div>

        <div className="flex border-t border-neutral-800">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-4 text-[14px] text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="w-px bg-neutral-800" />
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="flex-1 py-4 text-[14px] font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-neutral-900 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Negotiating...' : 'Approve & Start'}
          </button>
        </div>
      </div>
    </div>
  );
}
