import { ReactNode } from 'react';

// Base shimmer animation class
const shimmer = 'animate-pulse bg-gradient-to-r from-navy-100 via-navy-50 to-navy-100 dark:from-navy-800 dark:via-navy-700 dark:to-navy-800 bg-[length:200%_100%]';

interface SkeletonProps {
  className?: string;
}

export function SkeletonLine({ className = '' }: SkeletonProps) {
  return (
    <div className={`h-4 rounded ${shimmer} ${className}`} />
  );
}

export function SkeletonCircle({ className = '' }: SkeletonProps) {
  return (
    <div className={`rounded-full ${shimmer} ${className}`} />
  );
}

export function SkeletonCard({ className = '', children }: SkeletonProps & { children?: ReactNode }) {
  return (
    <div className={`rounded-xl border border-clinical-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4 ${className}`}>
      {children}
    </div>
  );
}

// Pre-built skeleton variants

export function SkeletonPatientRow() {
  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-clinical-100 dark:border-navy-800">
      <div className="col-span-4 flex items-center gap-3">
        <SkeletonCircle className="w-10 h-10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-3/4" />
          <SkeletonLine className="w-1/2 h-3" />
        </div>
      </div>
      <div className="col-span-2 flex items-center">
        <SkeletonLine className="w-24" />
      </div>
      <div className="col-span-2 flex items-center">
        <SkeletonLine className="w-20" />
      </div>
      <div className="col-span-2 flex items-center">
        <SkeletonLine className="w-20" />
      </div>
      <div className="col-span-2 flex items-center justify-end">
        <SkeletonLine className="w-24" />
      </div>
    </div>
  );
}

export function SkeletonPatientHeader() {
  return (
    <div className="p-6 rounded-xl border border-clinical-200 dark:border-navy-700 bg-white dark:bg-navy-900">
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-3">
          <SkeletonLine className="w-64 h-8" />
          <div className="flex gap-4">
            <SkeletonLine className="w-24 h-5" />
            <SkeletonLine className="w-20 h-5" />
            <SkeletonLine className="w-16 h-5" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonLine className="w-24 h-10 rounded-lg" />
          <SkeletonLine className="w-32 h-10 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-3 rounded-lg bg-clinical-50 dark:bg-navy-800">
            <SkeletonLine className="w-16 h-3 mb-2" />
            <SkeletonLine className="w-24 h-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDocumentCard() {
  return (
    <div className="p-4 rounded-lg border border-clinical-200 dark:border-navy-700 bg-white dark:bg-navy-900">
      <div className="flex items-start gap-4">
        <SkeletonCircle className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-3/4 h-5" />
          <SkeletonLine className="w-1/2 h-3" />
          <SkeletonLine className="w-full h-3" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCalendarDay() {
  return (
    <div className="p-2 min-h-[100px] rounded-lg bg-clinical-50 dark:bg-navy-800">
      <SkeletonLine className="w-6 h-6 rounded mb-2" />
      <div className="space-y-1">
        <SkeletonLine className="w-full h-4 rounded" />
        <SkeletonLine className="w-3/4 h-4 rounded" />
      </div>
    </div>
  );
}

export function SkeletonTableRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <SkeletonPatientRow key={i} />
      ))}
    </>
  );
}
