import React from 'react';

interface SpeakBloomLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'filled' | 'glyph';
  className?: string;
}

export const SpeakBloomLogo: React.FC<SpeakBloomLogoProps> = ({
  size = 'md',
  variant = 'filled',
  className = '',
}) => {
  // Sizing configurations
  const dimensions = {
    sm: { box: 'w-8 h-8 rounded-xl', icon: 'w-4 h-4' },
    md: { box: 'w-10 h-10 rounded-2xl', icon: 'w-5 h-5' },
    lg: { box: 'w-14 h-14 rounded-2xl', icon: 'w-8 h-8' },
    xl: { box: 'w-20 h-20 rounded-3xl', icon: 'w-12 h-12' },
  };

  const dim = dimensions[size] || dimensions.md;

  /**
   * The Bloom Blossom & Voice Acoustic Mark:
   * Features a blooming geometric 6-petal flower (representing Bloom's 6 cognitive levels:
   * Remember, Understand, Apply, Analyze, Evaluate, Create) combined with an inner
   * soundwave voice nucleus.
   */
  const BloomIcon = ({ iconClass = '' }: { iconClass?: string }) => (
    <svg
      className={`${iconClass} shrink-0`}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bloomPetalGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8A6FF2" />
          <stop offset="50%" stopColor="#6546D7" />
          <stop offset="100%" stopColor="#4A2EB8" />
        </linearGradient>
        <linearGradient id="bloomCenterGrad" x1="12" y1="12" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2DBFC" />
        </linearGradient>
      </defs>

      {/* 6 Blooming Petals arranged in 60-degree rotation */}
      <g transform="translate(16, 16)">
        {/* Petal 1 (0 deg - Remember) */}
        <path
          d="M0 -3 C-3 -7, -2.5 -13, 0 -14 C2.5 -13, 3 -7, 0 -3 Z"
          fill="currentColor"
          opacity="0.95"
        />
        {/* Petal 2 (60 deg - Understand) */}
        <path
          d="M0 -3 C-3 -7, -2.5 -13, 0 -14 C2.5 -13, 3 -7, 0 -3 Z"
          fill="currentColor"
          opacity="0.9"
          transform="rotate(60)"
        />
        {/* Petal 3 (120 deg - Apply) */}
        <path
          d="M0 -3 C-3 -7, -2.5 -13, 0 -14 C2.5 -13, 3 -7, 0 -3 Z"
          fill="currentColor"
          opacity="0.85"
          transform="rotate(120)"
        />
        {/* Petal 4 (180 deg - Analyze) */}
        <path
          d="M0 -3 C-3 -7, -2.5 -13, 0 -14 C2.5 -13, 3 -7, 0 -3 Z"
          fill="currentColor"
          opacity="0.95"
          transform="rotate(180)"
        />
        {/* Petal 5 (240 deg - Evaluate) */}
        <path
          d="M0 -3 C-3 -7, -2.5 -13, 0 -14 C2.5 -13, 3 -7, 0 -3 Z"
          fill="currentColor"
          opacity="0.85"
          transform="rotate(240)"
        />
        {/* Petal 6 (300 deg - Create) */}
        <path
          d="M0 -3 C-3 -7, -2.5 -13, 0 -14 C2.5 -13, 3 -7, 0 -3 Z"
          fill="currentColor"
          opacity="0.9"
          transform="rotate(300)"
        />

        {/* Central Acoustic Speaking Core */}
        <circle r="4.2" fill="currentColor" opacity="0.3" />
        <circle r="2.8" fill="currentColor" />

        {/* Dynamic Voice Pulse Ring */}
        <circle
          r="7.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="2 3"
          opacity="0.6"
        />
      </g>
    </svg>
  );

  if (variant === 'glyph') {
    return (
      <div className={`text-[#6546D7] flex items-center justify-center ${className}`}>
        <BloomIcon iconClass={dim.icon} />
      </div>
    );
  }

  return (
    <div
      className={`${dim.box} bg-gradient-to-br from-[#7757EB] via-[#6546D7] to-[#4F2EB5] text-white flex items-center justify-center shadow-md shadow-[#6546D7]/20 select-none ${className}`}
    >
      <BloomIcon iconClass={dim.icon} />
    </div>
  );
};
