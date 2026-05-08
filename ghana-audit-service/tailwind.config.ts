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
        // Ghana Flag Colors — via CSS variable bridge
        'ghana-red': 'rgb(var(--tw-ghana-red) / <alpha-value>)',
        'ghana-gold': 'rgb(var(--tw-ghana-gold) / <alpha-value>)',
        'ghana-green': 'rgb(var(--tw-ghana-green) / <alpha-value>)',

        // Primary (Green)
        primary: {
          DEFAULT: 'rgb(var(--tw-primary) / <alpha-value>)',
          dark: 'rgb(var(--tw-primary-dark) / <alpha-value>)',
          light: 'rgb(var(--tw-primary-light) / <alpha-value>)',
        },

        // Secondary (Red)
        secondary: {
          DEFAULT: 'rgb(var(--tw-secondary) / <alpha-value>)',
          dark: 'rgb(var(--tw-secondary-dark) / <alpha-value>)',
          light: 'rgb(var(--tw-secondary-light) / <alpha-value>)',
        },

        // Accent (Gold)
        accent: {
          DEFAULT: 'rgb(var(--tw-accent) / <alpha-value>)',
          dark: 'rgb(var(--tw-accent-dark) / <alpha-value>)',
          light: 'rgb(var(--tw-accent-light) / <alpha-value>)',
        },

        // Functional Colors
        success: {
          DEFAULT: 'rgb(var(--tw-success) / <alpha-value>)',
          light: 'rgb(var(--tw-success-light) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--tw-warning) / <alpha-value>)',
          light: 'rgb(var(--tw-warning-light) / <alpha-value>)',
        },
        error: {
          DEFAULT: 'rgb(var(--tw-error) / <alpha-value>)',
          light: 'rgb(var(--tw-error-light) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--tw-info) / <alpha-value>)',
          light: 'rgb(var(--tw-info-light) / <alpha-value>)',
        },

        // Gray scale
        gray: {
          50: 'rgb(var(--tw-gray-50) / <alpha-value>)',
          100: 'rgb(var(--tw-gray-100) / <alpha-value>)',
          200: 'rgb(var(--tw-gray-200) / <alpha-value>)',
          300: 'rgb(var(--tw-gray-300) / <alpha-value>)',
          400: 'rgb(var(--tw-gray-400) / <alpha-value>)',
          500: 'rgb(var(--tw-gray-500) / <alpha-value>)',
          600: 'rgb(var(--tw-gray-600) / <alpha-value>)',
          700: 'rgb(var(--tw-gray-700) / <alpha-value>)',
          800: 'rgb(var(--tw-gray-800) / <alpha-value>)',
          900: 'rgb(var(--tw-gray-900) / <alpha-value>)',
        },
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
            '--tw-prose-body': 'rgb(var(--tw-gray-700))',
            '--tw-prose-headings': 'rgb(var(--tw-gray-900))',
            '--tw-prose-lead': 'rgb(var(--tw-gray-600))',
            '--tw-prose-links': 'rgb(var(--tw-primary))',
            '--tw-prose-bold': 'rgb(var(--tw-gray-900))',
            '--tw-prose-counters': 'rgb(var(--tw-primary))',
            '--tw-prose-bullets': 'rgb(var(--tw-primary))',
            '--tw-prose-hr': 'rgb(var(--tw-gray-200))',
            '--tw-prose-quotes': 'rgb(var(--tw-gray-900))',
            '--tw-prose-quote-borders': 'rgb(var(--tw-primary))',
            '--tw-prose-captions': 'rgb(var(--tw-gray-500))',
            '--tw-prose-code': 'rgb(var(--tw-gray-900))',
            '--tw-prose-pre-code': 'rgb(var(--tw-gray-200))',
            '--tw-prose-pre-bg': 'rgb(var(--tw-gray-800))',
            '--tw-prose-th-borders': 'rgb(var(--tw-gray-300))',
            '--tw-prose-td-borders': 'rgb(var(--tw-gray-200))',
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
            a: {
              color: 'rgb(var(--tw-primary))',
              textDecoration: 'none',
              fontWeight: '500',
              '&:hover': {
                color: 'rgb(var(--tw-primary-dark))',
                textDecoration: 'underline'
              }
            },
            p: {
              marginTop: '1.25em',
              marginBottom: '1.25em'
            },
            'ul > li': {
              paddingLeft: '0.375em'
            },
            'ol > li': {
              paddingLeft: '0.375em'
            },
            blockquote: {
              fontStyle: 'italic',
              borderLeftColor: 'rgb(var(--tw-primary))',
              borderLeftWidth: '4px'
            }
          }
        },
        invert: {
          css: {
            '--tw-prose-body': 'rgb(var(--tw-gray-300))',
            '--tw-prose-headings': '#ffffff',
            '--tw-prose-lead': 'rgb(var(--tw-gray-400))',
            '--tw-prose-links': 'rgb(var(--tw-primary-light))',
            '--tw-prose-bold': '#ffffff',
            '--tw-prose-counters': 'rgb(var(--tw-primary-light))',
            '--tw-prose-bullets': 'rgb(var(--tw-primary-light))',
            '--tw-prose-hr': 'rgb(var(--tw-gray-700))',
            '--tw-prose-quotes': 'rgb(var(--tw-gray-100))',
            '--tw-prose-quote-borders': 'rgb(var(--tw-primary-light))',
            '--tw-prose-captions': 'rgb(var(--tw-gray-400))',
            '--tw-prose-code': '#ffffff',
            '--tw-prose-pre-code': 'rgb(var(--tw-gray-200))',
            '--tw-prose-pre-bg': 'rgb(var(--tw-gray-900))',
            '--tw-prose-th-borders': 'rgb(var(--tw-gray-600))',
            '--tw-prose-td-borders': 'rgb(var(--tw-gray-700))',
            a: {
              color: 'rgb(var(--tw-primary-light))',
              '&:hover': {
                color: 'rgb(var(--tw-primary))'
              }
            }
          }
        }
      }
    }
  },
  plugins: [typography]
} satisfies Config
