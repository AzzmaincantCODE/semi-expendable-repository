/**
 * OFFLINE EXPERIMENT — SnapshotProgressScreen.tsx
 *
 * Full-screen overlay shown while downloading the Supabase snapshot.
 * Shows each data category being downloaded with count + status icon.
 */

import React from 'react';
import { CheckCircle2, XCircle, Loader2, Database, WifiOff } from 'lucide-react';
import { SnapshotStep } from './snapshotEngine';
import { cn } from '@/lib/utils';

interface SnapshotProgressScreenProps {
  isVisible: boolean;
  steps: SnapshotStep[];
  isDone: boolean;
  hasFailed: boolean;
  onCancel?: () => void;
}

const stepIcon = (status: SnapshotStep['status']) => {
  switch (status) {
    case 'loading': return <Loader2 className="h-5 w-5 animate-spin text-blue-400" />;
    case 'done':    return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
    case 'error':   return <XCircle className="h-5 w-5 text-red-400" />;
    default:        return <div className="h-5 w-5 rounded-full border-2 border-slate-600" />;
  }
};

export const SnapshotProgressScreen: React.FC<SnapshotProgressScreenProps> = ({
  isVisible,
  steps,
  isDone,
  hasFailed,
  onCancel,
}) => {
  if (!isVisible) return null;

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const totalCount = steps.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="flex items-center justify-center mb-3">
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center',
              isDone && !hasFailed ? 'bg-emerald-500/20' : hasFailed ? 'bg-red-500/20' : 'bg-blue-500/20'
            )}>
              {isDone && !hasFailed
                ? <WifiOff className="h-7 w-7 text-emerald-400" />
                : hasFailed
                  ? <XCircle className="h-7 w-7 text-red-400" />
                  : <Database className="h-7 w-7 text-blue-400 animate-pulse" />
              }
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">
            {isDone && !hasFailed
              ? 'Ready for Offline Use'
              : hasFailed
                ? 'Snapshot Incomplete'
                : 'Preparing Offline Data…'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {isDone && !hasFailed
              ? 'All data has been saved locally. You are now offline.'
              : hasFailed
                ? 'Some data could not be downloaded. Offline mode may be limited.'
                : 'Downloading your data from Supabase. Please wait…'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-6 pb-2">
          <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                hasFailed ? 'bg-red-500' : 'bg-blue-500'
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>{doneCount} of {totalCount} completed</span>
            <span>{progressPct}%</span>
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 pb-4 space-y-2.5 mt-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                step.status === 'loading' && 'bg-blue-500/10 border border-blue-500/20',
                step.status === 'done'    && 'bg-emerald-500/10',
                step.status === 'error'  && 'bg-red-500/10 border border-red-500/20',
                step.status === 'pending' && 'opacity-40',
              )}
            >
              {stepIcon(step.status)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{step.label}</div>
                {step.status === 'error' && step.error && (
                  <div className="text-[11px] text-red-400 mt-0.5 truncate">{step.error}</div>
                )}
              </div>
              {step.status === 'done' && step.count !== undefined && (
                <span className="text-xs font-mono text-emerald-400 shrink-0">
                  {step.count.toLocaleString()} rows
                </span>
              )}
              {step.status === 'loading' && (
                <span className="text-xs text-blue-400 shrink-0 animate-pulse">Loading…</span>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {(isDone || hasFailed) && onCancel && (
          <div className="px-6 pb-6">
            <button
              onClick={onCancel}
              className={cn(
                'w-full py-2.5 rounded-xl text-sm font-semibold transition-colors',
                hasFailed
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              )}
            >
              {hasFailed ? 'Continue Anyway (Limited Offline)' : 'Start Working Offline'}
            </button>
          </div>
        )}

        {!isDone && !hasFailed && (
          <div className="px-6 pb-6">
            <p className="text-center text-[11px] text-slate-600">
              Do not close the app during download
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
