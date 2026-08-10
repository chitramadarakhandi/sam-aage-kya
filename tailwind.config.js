/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#06080F',
          950: '#06080F',
          900: '#0A0F1E',
          800: '#111827',
          700: '#1F2937',
          600: '#374151',
        },
        saffron: {
          DEFAULT: '#FF6B00',
          light: '#FF8C33',
          dark: '#CC5500',
        },
        'light-gray': '#F8FAFC',
        // Premium accent palette for the blue → purple → pink → orange
        // gradient system. Kept alongside (not replacing) saffron so
        // existing saffron-based classes keep working unchanged.
        electric: {
          blue: '#4F7CFF',
          purple: '#A855F7',
          pink: '#EC4899',
          orange: '#FF6B00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': 'radial-gradient(at 27% 37%, hsla(215, 98%, 61%, 0.08) 0px, transparent 50%), radial-gradient(at 97% 21%, hsla(25, 98%, 72%, 0.12) 0px, transparent 50%), radial-gradient(at 52% 99%, hsla(354, 98%, 61%, 0.04) 0px, transparent 50%), radial-gradient(at 10% 29%, hsla(256, 96%, 67%, 0.06) 0px, transparent 50%)',
        // Premium blue -> purple -> pink -> orange brand gradient, used for
        // headline text, primary CTA, and active-nav glow across the app.
        'brand-gradient': 'linear-gradient(90deg, #4F7CFF 0%, #A855F7 45%, #EC4899 75%, #FF6B00 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'spin-slow': 'spin 20s linear infinite',
        'bounce-subtle': 'bounceSuibtle 2s ease-in-out infinite',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'card-reveal': 'cardReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'slide-left': 'slideLeft 0.5s ease-out forwards',
        'slide-right': 'slideRight 0.5s ease-out forwards',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'border-flow': 'borderFlow 4s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255,107,0,0.25), 0 0 40px rgba(255,107,0,0.1)' },
          '50%': { boxShadow: '0 0 30px rgba(255,107,0,0.5), 0 0 60px rgba(255,107,0,0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        bounceSuibtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        cardReveal: {
          '0%': { opacity: '0', transform: 'translateY(30px) scale(0.96)', filter: 'blur(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        borderFlow: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'saffron': '0 0 30px rgba(255, 107, 0, 0.3)',
        'saffron-lg': '0 0 60px rgba(255, 107, 0, 0.4)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.37)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.3)',
        'elevated': '0 20px 60px rgba(0, 0, 0, 0.5)',
        'glow-saffron': '0 0 40px rgba(255,107,0,0.15)',
        'glow-purple': '0 0 40px rgba(139,92,246,0.15)',
        'glow-blue': '0 0 40px rgba(59,130,246,0.15)',
        'glow-brand': '0 0 30px rgba(168,85,247,0.25), 0 0 60px rgba(236,72,153,0.12)',
      },
    },
  },
  plugins: [],
}
