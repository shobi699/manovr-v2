You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
animated-gradient-border.tsx
import React, { CSSProperties, ReactNode, HTMLAttributes } from 'react';

type AnimationMode = 'auto-rotate' | 'rotate-on-hover' | 'stop-rotate-on-hover';

interface BorderRotateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  children: ReactNode;
  className?: string;
 
  // Animation customization
  animationMode?: AnimationMode;
  animationSpeed?: number; // Duration in seconds
 
  // Color customization
  gradientColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  backgroundColor?: string;
 
  // Border customization
  borderWidth?: number;
  borderRadius?: number;
 
  // Container styling
  style?: CSSProperties;
}

const defaultGradientColors = {
  primary: '#584827',
  secondary: '#c7a03c',
  accent: '#f9de90'
};

const BorderRotate: React.FC<BorderRotateProps> = ({
  children,
  className = '',
  animationMode = 'auto-rotate',
  animationSpeed = 5,
  gradientColors = defaultGradientColors,
  backgroundColor = '#2d230f',
  borderWidth = 2,
  borderRadius = 20,
  style = {},
  ...props
}) => {
  // Get animation class based on mode
  const getAnimationClass = () => {
    switch (animationMode) {
      case 'auto-rotate':
        return 'gradient-border-auto';
      case 'rotate-on-hover':
        return 'gradient-border-hover';
      case 'stop-rotate-on-hover':
        return 'gradient-border-stop-hover';
      default:
        return '';
    }
  };
 
  const combinedStyle: CSSProperties = {
    '--gradient-primary': gradientColors.primary,
    '--gradient-secondary': gradientColors.secondary,
    '--gradient-accent': gradientColors.accent,
    '--bg-color': backgroundColor,
    '--border-width': `${borderWidth}px`,
    '--border-radius': `${borderRadius}px`,
    '--animation-duration': `${animationSpeed}s`,
    border: `${borderWidth}px solid transparent`,
    borderRadius: `${borderRadius}px`,
    backgroundImage: `
      linear-gradient(${backgroundColor}, ${backgroundColor}),
      conic-gradient(
        from var(--gradient-angle, 0deg),
        ${gradientColors.primary} 0%,
        ${gradientColors.secondary} 37%,
        ${gradientColors.accent} 30%,
        ${gradientColors.secondary} 33%,
        ${gradientColors.primary} 40%,
        ${gradientColors.primary} 50%,
        ${gradientColors.secondary} 77%,
        ${gradientColors.accent} 80%,
        ${gradientColors.secondary} 83%,
        ${gradientColors.primary} 90%
      )
    `,
    backgroundClip: 'padding-box, border-box',
    backgroundOrigin: 'padding-box, border-box',
    ...style,
  } as CSSProperties;
 
  return (
    <div
      className={`gradient-border-component ${getAnimationClass()} ${className}`}
      style={combinedStyle}
      {...props}
    >
      {children}
    </div>
  );
};

export { BorderRotate };

demo.tsx
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { Star, Zap, Shield, Heart, Download, Play, Settings, User, Mail, Phone } from "lucide-react";

function Default() {
  return (
    <BorderRotate className="w-96 h-65">
    </BorderRotate>
  );
}


function FastAnimation() {
  return (
    <BorderRotate
      animationSpeed={0.8}
      gradientColors={{
        primary: '#7f1d1d',
        secondary: '#dc2626',
        accent: '#f87171'
      }}
      backgroundColor="#410d0dff"
      className="p-6"
    >
      <div className="text-white text-center space-y-4">
        <div className="flex justify-center mb-4">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Security First</h3>
        <p className="text-gray-300 mb-4">0.5s rotation speed with vivid red theme</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-sm">
            <Shield className="w-4 h-4 inline mr-1" />
            Secure
          </button>
          <button className="px-3 py-2 border border-red-400 hover:border-red-300 rounded-lg transition-colors text-sm">
            <Download className="w-4 h-4 inline mr-1" />
            Download
          </button>
        </div>
      </div>
    </BorderRotate>
  );
}

function StopOnHover() {
  return (
    <BorderRotate
      animationMode="stop-rotate-on-hover"
      gradientColors={{
        primary: '#581c87',
        secondary: '#7c3aed',
        accent: '#a855f7'
      }}
      backgroundColor="#271832ff"
      className="p-6"
    >
      <div className="text-white text-center space-y-4">
        <div className="flex justify-center mb-4">
          <User className="w-8 h-8 text-purple-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">User Profile</h3>
        <p className="text-gray-300 mb-4">Animation pauses on hover - purple theme</p>
        <div className="space-y-3">
          <div className="flex gap-2 justify-center">
            <button className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors">
              <Mail className="w-4 h-4 inline mr-1" />
              Message
            </button>
            <button className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors">
              <Phone className="w-4 h-4 inline mr-1" />
              Call
            </button>
          </div>
          <div className="text-sm text-purple-300">
            Premium Member Since 2024
          </div>
        </div>
      </div>
    </BorderRotate>
  );
}

export {
  Default,
  FastAnimation,
  StopOnHover,
};
```

Extend existing Tailwind 4 index.css with this code (or if project uses Tailwind 3, extend tailwind.config.js or globals.css):
```css
@import "tailwindcss";
@import "tw-animate-css";


@keyframes gradient-rotate {
  from {
    --gradient-angle: 0deg;
  }
  to {
    --gradient-angle: 360deg;
  }
}
```

Implementation Guidelines
 1. Analyze the component structure and identify all required dependencies
 2. Review the component's argumens and state
 3. Identify any required context providers or hooks and install them
 4. Questions to Ask
 - What data/props will be passed to this component?
 - Are there any specific state management requirements?
 - Are there any required assets (images, icons, etc.)?
 - What is the expected responsive behavior?
 - What is the best place to use this component in the app?

Steps to integrate
 0. Copy paste all the code above in the correct directories
 1. Install external dependencies
 2. Fill image assets with Unsplash stock images you know exist
 3. Use lucide-react icons for svgs or logos if component requires them
