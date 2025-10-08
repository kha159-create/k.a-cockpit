import React from 'react';

interface AnimatedCardProps {
  title?: string;
  value?: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  onClick, 
  className = "" 
}) => {
  return (
    <div className={`card-outer ${className}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="card-dot"></div>
      <div className="card-inner">
        <div className="card-ray"></div>
        
        {/* Lines */}
        <div className="card-line card-line-top"></div>
        <div className="card-line card-line-bottom"></div>
        <div className="card-line card-line-left"></div>
        <div className="card-line card-line-right"></div>
        
        {/* Content */}
        <div className="flex flex-col items-center justify-center text-center px-4 relative z-10">
          {icon && (
            <div className="mb-4 text-white/80">
              {icon}
            </div>
          )}
          
          {value && (
            <div className="card-text mb-2">
              {value}
            </div>
          )}
          
          {title && (
            <h3 className="text-lg font-semibold text-white/90 mb-1">
              {title}
            </h3>
          )}
          
          {subtitle && (
            <p className="text-sm text-white/70">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimatedCard;
