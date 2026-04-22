import type { SVGProps } from 'react';

const iconMap = {
  today: (
    <path
      d="M8.5 3.75V6m7-2.25V6M4.75 8.75h14.5M6.5 5.5h11A1.75 1.75 0 0 1 19.25 7.25v9.25A1.75 1.75 0 0 1 17.5 18.25h-11A1.75 1.75 0 0 1 4.75 16.5V7.25A1.75 1.75 0 0 1 6.5 5.5Zm2.25 6h2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  plus: (
    <path
      d="M12 5.75v12.5M5.75 12h12.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  history: (
    <path
      d="M5.75 7.75 3.75 9.5l2 1.75M4 9.5h8a4.25 4.25 0 1 1-4.25 4.25m4.25-1.75v-2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  profile: (
    <path
      d="M12 12a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm-5.75 6a5.75 5.75 0 0 1 11.5 0"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  spark: (
    <path
      d="m12 4 1.4 3.6L17 9l-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4L12 4Zm5.25 10.25.65 1.75 1.75.65-1.75.65-.65 1.75-.65-1.75-1.75-.65 1.75-.65.65-1.75ZM6.25 14.75l.5 1.35 1.35.5-1.35.5-.5 1.35-.5-1.35-1.35-.5 1.35-.5.5-1.35Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  photo: (
    <path
      d="M7 7.25h1.02c.3 0 .58-.15.75-.4l.55-.8c.17-.25.45-.4.75-.4h4.86c.3 0 .58.15.75.4l.55.8c.17.25.45.4.75.4H17A1.75 1.75 0 0 1 18.75 9v7A1.75 1.75 0 0 1 17 17.75H7A1.75 1.75 0 0 1 5.25 16V9A1.75 1.75 0 0 1 7 7.25Zm5 7.25a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  camera: (
    <path
      d="M8 7.25h1.02c.3 0 .58-.15.75-.4l.55-.8c.17-.25.45-.4.75-.4h3.86c.3 0 .58.15.75.4l.55.8c.17.25.45.4.75.4H16A1.75 1.75 0 0 1 17.75 9v6A1.75 1.75 0 0 1 16 16.75H8A1.75 1.75 0 0 1 6.25 15V9A1.75 1.75 0 0 1 8 7.25Zm4 6a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM18 8.5l1.75-1.25v9.5L18 15.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  text: (
    <path
      d="M6.75 7.25h10.5M6.75 11.5h10.5M6.75 15.75h6.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  microphone: (
    <path
      d="M12 14.25a3 3 0 0 0 3-3V8.5a3 3 0 1 0-6 0v2.75a3 3 0 0 0 3 3Zm0 0v3m-3.75-5v.25a3.75 3.75 0 1 0 7.5 0v-.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  upload: (
    <path
      d="M12 15.75V6.5m0 0-3 3m3-3 3 3M6.75 15.75v.75A1.75 1.75 0 0 0 8.5 18.25h7A1.75 1.75 0 0 0 17.25 16.5v-.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  target: (
    <path
      d="M12 5.5v2.25M12 16.25v2.25M18.5 12h-2.25M7.75 12H5.5M16.6 7.4l-1.6 1.6M9 15l-1.6 1.6M16.6 16.6 15 15M9 9 7.4 7.4M15.25 12A3.25 3.25 0 1 1 12 8.75a3.25 3.25 0 0 1 3.25 3.25Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  chevronRight: (
    <path d="m10 7.25 4.5 4.75L10 16.75" strokeLinecap="round" strokeLinejoin="round" />
  ),
  warning: (
    <path
      d="M12 8.5v3.75m0 3h.01M10.2 5.5l-5 8.5a1 1 0 0 0 .86 1.5h10a1 1 0 0 0 .86-1.5l-5-8.5a1 1 0 0 0-1.72 0Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  check: (
    <path d="m7.75 12.25 2.5 2.5 6-6.25" strokeLinecap="round" strokeLinejoin="round" />
  ),
  chart: (
    <path
      d="M6.5 18.25V10.5m5.5 7.75V5.75m5.5 12.5v-4.5M4.75 18.25h14.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
} as const;

export type IconName = keyof typeof iconMap;

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
};

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" {...props}>
      {iconMap[name]}
    </svg>
  );
}
