import React from 'react';
import { Role, ROLE_DISPLAY_NAMES, ROLE_COLORS } from '../config/roles';

interface RoleBadgeProps {
  role: Role;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'md', showIcon = true }) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const getRoleIcon = (role: Role): string => {
    switch (role) {
      case 'admin':
        return '👑';
      case 'general_manager':
        return '🎯';
      case 'area_manager':
        return '🏢';
      case 'store_manager':
        return '🏪';
      case 'employee':
        return '👤';
      default:
        return '👤';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]} ${ROLE_COLORS[role]}`}>
      {showIcon && (
        <span className={`${iconClasses[size]} flex items-center justify-center`}>
          {getRoleIcon(role)}
        </span>
      )}
      {ROLE_DISPLAY_NAMES[role]}
    </span>
  );
};

export default RoleBadge;
