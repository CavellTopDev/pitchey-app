import { BRAND } from '../constants/brand';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  sm: 'h-5',
  md: 'h-6',
  lg: 'h-8',
} as const;

const textSizeMap = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
} as const;

export default function Logo({ size = 'md', showText = true, className = '', onClick }: LogoProps) {
  return (
    <div
      className={`flex items-center gap-2 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <img
        src={BRAND.logo}
        alt={BRAND.logoAlt}
        className={`${sizeMap[size]} w-auto`}
        width={BRAND.logoWidth}
        height={BRAND.logoHeight}
      />
      {showText && (
        <span className={`${textSizeMap[size]} font-bold text-gray-900`}>{BRAND.name}</span>
      )}
    </div>
  );
}
