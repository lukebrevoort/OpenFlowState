/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        // FlowState warm, earthy color palette
        flowstate: {
          primary: '#8B6B59',
          secondary: '#665F5D',
          background: '#F6EEE3',
          surface: '#E8DFD3',
          text: '#1E1E1E',
          'text-muted': '#5A5A5A',
          accent: '#331C16',
          success: '#4A7C59',
          warning: '#D4A574',
          error: '#C45B4A',
          border: '#D4C9BD',
          selection: '#C9B8A8',
          highlight: '#DED4C7',
        },
        // Semantic colors
        semantic: {
          approval: '#4A7C59',
          pending: '#D4A574',
          denied: '#C45B4A',
          info: '#8B6B59',
          connected: '#4A7C59',
          disconnected: '#C45B4A',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        'flowstate': '12px',
      },
      boxShadow: {
        'flowstate': '0 2px 8px rgba(139, 107, 89, 0.12)',
        'flowstate-lg': '0 4px 16px rgba(139, 107, 89, 0.16)',
      },
    },
  },
  plugins: [],
};
