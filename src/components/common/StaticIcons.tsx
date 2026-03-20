import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconProps {
    size?: number;
    color?: string;
    style?: any;
}

export const MenuIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Path d="M3 12h18M3 6h18M3 18h18" />
    </Svg>
);

export const CloseIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
);

export const FileSearchIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Path d="M15 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7l-5-5z" />
        <Path d="M14 2v4a1 1 0 001 1h4" />
        <Circle cx="10" cy="14" r="3" />
        <Path d="M20.2 20.2L12.5 12.5" />
    </Svg>
);

export const FileEditIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <Path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
);

export const PlusCircleIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Circle cx="12" cy="12" r="10" />
        <Path d="M12 8v8M8 12h8" />
    </Svg>
);

export const FilePlusIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <Path d="M14 2v6h6M12 18v-6M9 15h6" />
    </Svg>
);

export const MailIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <Path d="M22 6l-10 7L2 6" />
    </Svg>
);

export const BookOpenIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </Svg>
);

export const GraduationCapIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Path d="M22 10L12 5 2 10l10 5 10-5z" />
        <Path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
    </Svg>
);

export const PhoneIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.81 12.81 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </Svg>
);

export const AppleIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
        <Path d="M17.05 20.28c-.98.95-2.05 1.78-3.15 1.76-1.09-.02-1.74-.6-3.14-.6-1.42 0-2.19.6-3.12.62-1.12.02-2.31-.88-3.32-1.88-2.07-2.04-3.18-5.83-1.08-8.83 1.05-1.5 2.58-2.45 4.04-2.43 1.13.02 2.11.75 2.8.75s1.84-.88 3.19-.74c.57.02 2.18.23 3.2 1.72-.08.05-1.92 1.12-1.9 3.33.02 2.65 2.33 3.56 2.36 3.58-.02.06-.37 1.25-1.08 2.22zM13.62 4.41c.62-.75 1.03-1.78.91-2.82-.89.04-1.97.6-2.61 1.35-.57.65-1.07 1.71-.94 2.73 1 .08 2.02-.51 2.64-1.26z" />
    </Svg>
);

export const GooglePlayIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
        <Path d="M3.61 2.16c-.16.18-.26.46-.26.8v18.08c0 .34.1.62.26.8l.06.06L14.33 11.23v-.2L3.67 2.1l-.06.06zM17.86 14.77l-3.53-3.53v-.2l3.53-3.53.11.06 4.18 2.38c1.2.68 1.2 1.8 0 2.48l-4.18 2.38-.11.06zM13.88 10.82L3.89 1.19a.66.66 0 00-.28 0m.28.23l4.63 4.63-4.63-4.63z" />
    </Svg>
);

export const CheckCircleIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <Path d="M22 4L12 14.01l-3-3" />
    </Svg>
);

export const TwitterIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
        <Path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
    </Svg>
);

export const LinkedInIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
        <Path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.454C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </Svg>
);

export const GitHubIcon = ({ size = 24, color = 'currentColor', style }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
        <Path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </Svg>
);
