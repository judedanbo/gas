import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  darkMode: 'class',
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue'
  ],
  theme: {
    extend: {
      // Ghana Government Color Palette
      colors: {
        // Ghana Flag Colors
        'ghana-red': '#CE1126',
        'ghana-gold': '#FCD116',
        'ghana-green': '#006B3F',

        // Primary (Green)
        primary: {
          DEFAULT: '#006B3F',
          dark: '#004D2C',
          light: '#008B52'
        },

        // Secondary (Red)
        secondary: {
          DEFAULT: '#CE1126',
          dark: '#A50E1F',
          light: '#E51D33'
        },

        // Accent (Gold)
        accent: {
          DEFAULT: '#FCD116',
          dark: '#D4AD00',
          light: '#FFE14D'
        },

        // Functional Colors
        success: {
          DEFAULT: '#2E7D32',
          light: '#4CAF50'
        },
        warning: {
          DEFAULT: '#F57C00',
          light: '#FF9800'
        },
        error: {
          DEFAULT: '#C62828',
          light: '#EF5350'
        },
        info: {
          DEFAULT: '#1565C0',
          light: '#2196F3'
        }
      },

      // Typography
      fontFamily: {
        sans: [
          'Open Sans',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ],
        heading: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
      },

      fontSize: {
        // Base sizes (static)
        xs: ['0.75rem', { lineHeight: '1rem' }], // 12px
        sm: ['0.875rem', { lineHeight: '1.25rem' }], // 14px
        base: ['1rem', { lineHeight: '1.5rem' }], // 16px
        lg: ['1.125rem', { lineHeight: '1.75rem' }], // 18px
        xl: ['1.25rem', { lineHeight: '1.75rem' }], // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
        '5xl': ['3rem', { lineHeight: '1.1' }], // 48px - improved line height
        '6xl': ['3.75rem', { lineHeight: '1.1' }], // 60px - improved line height
        '7xl': ['4.5rem', { lineHeight: '1.05' }], // 72px
        '8xl': ['6rem', { lineHeight: '1' }], // 96px

        // Fluid display sizes (responsive without breakpoints)
        'display-2xl': [
          'clamp(2rem, 4vw + 0.75rem, 3.5rem)',
          { lineHeight: '1.1', letterSpacing: '-0.025em' }
        ],
        'display-xl': [
          'clamp(1.75rem, 3vw + 0.75rem, 2.75rem)',
          { lineHeight: '1.15', letterSpacing: '-0.02em' }
        ],
        'display-lg': [
          'clamp(1.5rem, 2.5vw + 0.5rem, 2.25rem)',
          { lineHeight: '1.2', letterSpacing: '-0.015em' }
        ],
        'display-md': [
          'clamp(1.25rem, 2vw + 0.5rem, 1.75rem)',
          { lineHeight: '1.25', letterSpacing: '-0.01em' }
        ],
        'display-sm': ['clamp(1.125rem, 1.5vw + 0.5rem, 1.5rem)', { lineHeight: '1.3' }]
      },

      // Letter spacing for visual hierarchy
      letterSpacing: {
        tightest: '-0.05em',
        tighter: '-0.025em',
        tight: '-0.015em',
        normal: '0',
        wide: '0.025em',
        wider: '0.05em',
        widest: '0.1em'
      },

      // Spacing (extends default Tailwind scale)
      spacing: {
        '18': '4.5rem', // 72px
        '22': '5.5rem', // 88px
        section: '3rem', // 48px - py-12
        'section-lg': '4rem', // 64px - py-16
        'section-xl': '5rem' // 80px - py-20
      },

      // Container
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1.5rem',
          lg: '2rem'
        }
      },

      // Border Radius
      borderRadius: {
        sm: '0.125rem', // 2px
        md: '0.375rem', // 6px
        lg: '0.5rem', // 8px
        xl: '0.75rem', // 12px
        '2xl': '1rem' // 16px
      },

      // Box Shadows
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      },

      // Z-Index
      zIndex: {
        dropdown: '100',
        sticky: '200',
        fixed: '300',
        'modal-backdrop': '400',
        modal: '500',
        popover: '600',
        tooltip: '700'
      },

      // Transitions
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '350ms'
      },

      // Custom heights
      height: {
        header: '80px',
        'header-mobile': '64px'
      },

      // Max Width for containers
      maxWidth: {
        'container-sm': '640px',
        'container-md': '768px',
        'container-lg': '1024px',
        'container-xl': '1280px',
        'container-2xl': '1536px',
        // Optimal reading widths
        'prose-xs': '45ch',
        'prose-sm': '55ch',
        prose: '65ch',
        'prose-lg': '75ch',
        'prose-xl': '85ch'
      },

      // Typography plugin customization
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#374151', // gray-700
            '--tw-prose-headings': '#111827', // gray-900
            '--tw-prose-lead': '#4b5563', // gray-600
            '--tw-prose-links': '#006B3F', // primary
            '--tw-prose-bold': '#111827', // gray-900
            '--tw-prose-counters': '#006B3F', // primary
            '--tw-prose-bullets': '#006B3F', // primary
            '--tw-prose-hr': '#e5e7eb', // gray-200
            '--tw-prose-quotes': '#111827', // gray-900
            '--tw-prose-quote-borders': '#006B3F', // primary
            '--tw-prose-captions': '#6b7280', // gray-500
            '--tw-prose-code': '#111827', // gray-900
            '--tw-prose-pre-code': '#e5e7eb', // gray-200
            '--tw-prose-pre-bg': '#1f2937', // gray-800
            '--tw-prose-th-borders': '#d1d5db', // gray-300
            '--tw-prose-td-borders': '#e5e7eb', // gray-200
            // Custom heading styles with Plus Jakarta Sans
            h1: {
              fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
              fontWeight: '700',
              letterSpacing: '-0.025em'
            },
            h2: {
              fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
              fontWeight: '700',
              letterSpacing: '-0.015em',
              marginTop: '2em',
              marginBottom: '1em'
            },
            h3: {
              fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
              fontWeight: '400',
              marginTop: '1.6em',
              marginBottom: '0.6em'
            },
            h4: {
              fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
              fontWeight: '600',
              marginTop: '1.5em',
              marginBottom: '0.5em'
            },
            // Better link styling
            a: {
              color: '#006B3F',
              textDecoration: 'none',
              fontWeight: '500',
              '&:hover': {
                color: '#004D2C',
                textDecoration: 'underline'
              }
            },
            // Better paragraph spacing
            p: {
              marginTop: '1.25em',
              marginBottom: '1.25em'
            },
            // Better list styling
            'ul > li': {
              paddingLeft: '0.375em'
            },
            'ol > li': {
              paddingLeft: '0.375em'
            },
            // Better blockquote styling
            blockquote: {
              fontStyle: 'italic',
              borderLeftColor: '#006B3F',
              borderLeftWidth: '4px'
            }
          }
        },
        // Dark mode variant
        invert: {
          css: {
            '--tw-prose-body': '#d1d5db', // gray-300
            '--tw-prose-headings': '#ffffff', // white
            '--tw-prose-lead': '#9ca3af', // gray-400
            '--tw-prose-links': '#008B52', // primary-light
            '--tw-prose-bold': '#ffffff', // white
            '--tw-prose-counters': '#008B52', // primary-light
            '--tw-prose-bullets': '#008B52', // primary-light
            '--tw-prose-hr': '#374151', // gray-700
            '--tw-prose-quotes': '#f3f4f6', // gray-100
            '--tw-prose-quote-borders': '#008B52', // primary-light
            '--tw-prose-captions': '#9ca3af', // gray-400
            '--tw-prose-code': '#ffffff', // white
            '--tw-prose-pre-code': '#e5e7eb', // gray-200
            '--tw-prose-pre-bg': '#111827', // gray-900
            '--tw-prose-th-borders': '#4b5563', // gray-600
            '--tw-prose-td-borders': '#374151', // gray-700
            a: {
              color: '#008B52',
              '&:hover': {
                color: '#006B3F'
              }
            }
          }
        }
      }
    }
  },
  plugins: [typography]
} satisfies Config
