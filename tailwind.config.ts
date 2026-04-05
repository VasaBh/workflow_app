import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [],
  safelist: [
    // StatusBadge colors — must be safelisted so Tailwind includes them
    'bg-gray-100', 'text-gray-700', 'ring-gray-600/20',
    'bg-indigo-100', 'text-indigo-700', 'ring-indigo-600/20',
    'bg-blue-100', 'text-blue-700', 'ring-blue-600/20',
    'bg-yellow-100', 'text-yellow-700', 'ring-yellow-600/20',
    'bg-green-100', 'text-green-700', 'ring-green-600/20',
    'bg-red-100', 'text-red-700', 'ring-red-600/20',
    'bg-orange-100', 'text-orange-700', 'ring-orange-600/20',
    'bg-purple-100', 'text-purple-700', 'ring-purple-600/20',
  ],
};

export default config;
