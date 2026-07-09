/**
 * OFFLINE EXPERIMENT — SyncProgressModal.tsx
 *
 * A floating panel (bottom-right) that appears during sync.
 * Shows each record being pushed to Supabase with its property number,
 * category (Inventory Item / Property Card / etc.) and status icon.
 */

import React from 'react';
import { CheckCircle2, XCircle, Loader2, Info, X, RefreshCw } from 'lucide-react';
import { SyncProgressEvent } from './syncEngine';
import { cn } from '@/lib/utils';

interface SyncProgressModalProps {
  isVisible: boolean;
  events: SyncProgressEvent[];
  isSyncing: boolean;
  onClose: () => void;
  onSyncNow?: () => void;
  pendingCount: number;
}

const statusIcon = (status: SyncProgressEvent['status']) => {
  switch (status) {
    case 'syncing':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400 shrink-0" />;
    case 'success':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    case 'skipped':
      return <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
    default:
      return <div className="h-3.5 w-3.5 rounded-full border border-slate-500 shrink-0" />;
  }
};

const categoryColor: Record<string, string> = {
  'Inventory Item': 'text-blue-300',
  'Property Card': 'text-purple-300',
  'Custodian Slip': 'text-amber-300',
  'Purchase Order': 'text-cyan-300',
  'System': 'text-slate-400',
};

const operationLabel: Record<string, string> = {
  create: 'Adding',
  update: 'Updating',
  delete: 'Removing',
};

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  isVisible,
  events,
  isSyncing,
  onClose,
  onSyncNow,
  pendingCount,
}) => {
  if (!isVisible) return null;

  // Deduplicate: prefer later events with same id-prefix
  const latestByPrefix = new Map<string, SyncProgressEvent>();
  events.forEach((e) => {
    const prefix = e.id.replace(/-ok$|-err$/, '');
    const existing = latestByPrefix.get(prefix);
    if (!existing || (e.status !== 'syncing')) {
      latestByPrefix.set(prefix, e);
    }
  });
  const deduped = Array.from(latestByPrefix.values());

  // Separate system messages from record-level events
  const systemEvents = deduped.filter((e) => e.category === 'System');
  const recordEvents = deduped.filter((e) => e.category !== 'System');

  // Group record events by category
  const grouped: Record<string, SyncProgressEvent[]> = {};
  recordEvents.forEach((e) => {
    if (!grouped[e.category]) grouped[e.category] = [];
    grouped[e.category].push(e);
  });

  const successCount = recordEvents.filter((e) => e.status === 'success').length;
  const errorCount = recordEvents.filter((e) => e.status === 'error').length;
  const syncingCount = recordEvents.filter((e) => e.status === 'syncing').length;

  const lastSystem = systemEvents[systemEvents.length - 1];
  const isDone = !isSyncing && lastSystem?.status !== 'syncing';

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-[9999] w-80 rounded-xl shadow-2xl border overflow-hidden',
        'bg-slate-900 border-slate-700 text-white',
        'transition-all duration-300 ease-out'
      )}
      style={{ animation: 'slideUpFade 0.3s ease-out' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2">
          {isSyncing
            ? <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            : isDone && errorCount === 0
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              : <RefreshCw className="h-4 w-4 text-amber-400" />
          }
          <span className="text-sm font-semibold text-white">
            {isSyncing ? 'Syncing to Live Database…' : isDone ? 'Sync Complete' : 'Sync Status'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body — scrollable */}
      <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-3 text-[11px]">

        {/* Pending notice if not yet syncing */}
        {events.length === 0 && pendingCount > 0 && (
          <div className="text-slate-400 text-center py-4">
            <p className="font-medium text-slate-300">{pendingCount} unsynced change{pendingCount !== 1 ? 's' : ''}</p>
            <p className="mt-1">These will be pushed to Supabase when you sync.</p>
          </div>
        )}

        {/* Grouped record events */}
        {Object.entries(grouped).map(([category, catEvents]) => (
          <div key={category}>
            <div className={cn('text-[10px] font-bold uppercase tracking-wider mb-1.5', categoryColor[category] ?? 'text-slate-300')}>
              {category}
            </div>
            <div className="space-y-1">
              {catEvents.map((ev) => (
                <div key={ev.id} className="flex items-start gap-2">
                  {statusIcon(ev.status)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {ev.operation && (
                        <span className="text-slate-500">{operationLabel[ev.operation]}</span>
                      )}
                      <span className="font-mono font-bold text-white truncate">
                        {ev.propertyNumber}
                      </span>
                    </div>
                    {ev.description && (
                      <div className="text-slate-400 truncate">{ev.description}</div>
                    )}
                    {ev.status === 'error' && ev.message && (
                      <div className="text-red-400 text-[10px] mt-0.5">{ev.message}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* System messages */}
        {systemEvents.length > 0 && events.length > 0 && (
          <div className="border-t border-slate-700 pt-2 space-y-1">
            {systemEvents.slice(-2).map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 text-slate-400">
                {statusIcon(ev.status)}
                <span>{ev.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-700 bg-slate-800/60 flex items-center justify-between">
        <div className="flex gap-3 text-[10px]">
          <span className="text-emerald-400">✅ {successCount} synced</span>
          {errorCount > 0 && <span className="text-red-400">❌ {errorCount} failed</span>}
          {syncingCount > 0 && <span className="text-blue-400">⏳ {syncingCount} syncing</span>}
        </div>
        {!isSyncing && onSyncNow && pendingCount > 0 && (
          <button
            onClick={onSyncNow}
            className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md font-medium transition-colors"
          >
            Sync Now
          </button>
        )}
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
