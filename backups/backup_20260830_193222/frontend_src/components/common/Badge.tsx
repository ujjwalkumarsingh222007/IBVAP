import React from 'react';
import { CameraStatus, EventType } from '../../types';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'purple'
  | 'cyan'
  | 'neutral'
  | EventType
  | string;

interface BadgeProps {
  children?: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  pulse = false,
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  let colorClasses = 'bg-slate-800 text-slate-300 border border-slate-700';
  let label = children;

  switch (variant) {
    case 'success':
      colorClasses = 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60';
      break;
    case 'danger':
    case 'INTRUSION_DETECTED':
      colorClasses = 'bg-red-950/90 text-red-300 border border-red-700/80';
      if (!children) label = 'INTRUSION';
      break;
    case 'warning':
    case 'SUSPICIOUS_ACTIVITY':
      colorClasses = 'bg-amber-950/80 text-amber-300 border border-amber-800/60';
      if (!children) label = 'SUSPICIOUS';
      break;
    case 'WATCHLIST_MATCH':
      colorClasses = 'bg-orange-950/90 text-orange-300 border border-orange-700/80';
      if (!children) label = 'WATCHLIST HIT';
      break;
    case 'info':
    case 'PERSON_DETECTED':
      colorClasses = 'bg-blue-950/80 text-blue-300 border border-blue-800/60';
      if (!children) label = 'PERSON';
      break;
    case 'VEHICLE_DETECTED':
      colorClasses = 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60';
      if (!children) label = 'VEHICLE';
      break;
    case 'purple':
    case 'ANPR_DETECTED':
      colorClasses = 'bg-purple-950/80 text-purple-300 border border-purple-800/60';
      if (!children) label = 'ANPR';
      break;
    case 'cyan':
    case 'OBJECT_DETECTED':
      colorClasses = 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60';
      if (!children) label = 'OBJECT';
      break;
    case 'neutral':
      colorClasses = 'bg-slate-900 text-slate-400 border border-slate-800';
      break;
    default:
      colorClasses = 'bg-slate-800 text-slate-300 border border-slate-700';
      break;
  }

  const shouldPulse =
    pulse ||
    variant === 'INTRUSION_DETECTED' ||
    variant === 'WATCHLIST_MATCH' ||
    variant === 'SUSPICIOUS_ACTIVITY';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md tracking-wider uppercase font-mono ${sizeClasses} ${colorClasses}`}
    >
      {shouldPulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      {label || children}
    </span>
  );
};

export const EventBadge: React.FC<{ eventType: EventType | string }> = ({ eventType }) => {
  return <Badge variant={eventType} />;
};

export const CameraStatusBadge: React.FC<{ status: CameraStatus }> = ({ status }) => {
  switch (status) {
    case 'ONLINE':
      return (
        <Badge variant="success" pulse>
          Online
        </Badge>
      );
    case 'OFFLINE':
      return <Badge variant="danger">Offline</Badge>;
    case 'UNKNOWN':
    default:
      return <Badge variant="warning">Unknown</Badge>;
  }
};
