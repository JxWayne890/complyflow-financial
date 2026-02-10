import React from 'react';
import { ContentStatus } from '../types';

const StatusBadge: React.FC<{ status: ContentStatus }> = ({ status }) => {
  const getStyles = (s: ContentStatus) => {
    switch (s) {
      case ContentStatus.APPROVED:
        return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
      case ContentStatus.REJECTED:
        return 'bg-red-50 text-red-700 ring-red-600/10';
      case ContentStatus.IN_REVIEW:
        return 'bg-amber-50 text-amber-700 ring-amber-600/20';
      case ContentStatus.SUBMITTED:
        return 'bg-blue-50 text-blue-700 ring-blue-700/10';
      case ContentStatus.CHANGES_REQUESTED:
        return 'bg-orange-50 text-orange-700 ring-orange-600/20';
      case ContentStatus.POSTED:
        return 'bg-purple-50 text-purple-700 ring-purple-600/20';
      default:
        return 'bg-slate-100 text-slate-600 ring-slate-500/10';
    }
  };

  const labels: Record<string, string> = {
    [ContentStatus.DRAFT]: 'Draft',
    [ContentStatus.SUBMITTED]: 'Submitted',
    [ContentStatus.IN_REVIEW]: 'In Review',
    [ContentStatus.CHANGES_REQUESTED]: 'Changes Needed',
    [ContentStatus.APPROVED]: 'Approved',
    [ContentStatus.POSTED]: 'Published',
    [ContentStatus.REJECTED]: 'Rejected',
    [ContentStatus.SCHEDULED]: 'Scheduled',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStyles(status)}`}>
      {labels[status] || status}
    </span>
  );
};

export default StatusBadge;