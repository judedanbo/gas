# Ghana Audit Service Website

Official website of the Ghana Audit Service - the constitutional body mandated to audit all public accounts and report to Parliament on the management and use of public resources.

## Features

- **Audit Reports**: Access to Auditor-General reports (Central Government, MDAs, MMDAs, etc.)
- **Publications**: Press statements, guidelines, AMIS manuals, PFM strategies, and applicable laws
- **Media Centre**: News articles and photo gallery
- **Careers**: Job vacancies and recruitment information
- **Contact**: Regional office locations and contact details
- **CitizensEye**: Citizen engagement platform integration
- **Multilingual**: English and Akan (Twi) language support
- **Accessibility**: WCAG 2.1 AA compliant with skip links, ARIA labels, and keyboard navigation
- **PWA**: Installable as a Progressive Web App with offline support
- **Dark Mode**: System-aware dark mode support

## Tech Stack

- **Framework**: [Nuxt 3](https://nuxt.com/) with Vue 3 Composition API
- **Styling**: [TailwindCSS](https://tailwindcss.com/) with custom Ghana government color palette
- **TypeScript**: Strict mode enabled
- **i18n**: [@nuxtjs/i18n](https://i18n.nuxtjs.org/) for English/Akan localization
- **Images**: [@nuxt/image](https://image.nuxt.com/) for optimization
- **Icons**: [@nuxt/icon](https://nuxt.com/modules/icon) with Heroicons
- **Database**: SQLite with [Drizzle ORM](https://orm.drizzle.team/)
- **Testing**: [Vitest](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (e2e)

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ghana-audit-service/website.git
   cd website
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The site will be available at `http://localhost:3000`

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run generate     # Generate static site
npm run preview      # Preview production build

npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run format       # Format code with Prettier
npm run format:check # Check code formatting

npm run typecheck    # Run TypeScript type checking

npm run test         # Run unit tests in watch mode
npm run test:run     # Run unit tests once
npm run test:coverage # Run tests with coverage
npm run test:e2e     # Run end-to-end tests
npm run test:e2e:ui  # Run e2e tests with UI

npm run db:generate  # Generate database migrations
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Drizzle Studio
```

## Project Structure

```
ghana-audit-service/
├── assets/css/          # Global CSS and Tailwind config
├── components/          # Vue components
│   ├── ui/              # Reusable base components
│   ├── common/          # Layout components (Header, Footer, Nav)
│   ├── home/            # Homepage sections
│   ├── reports/         # Report listing and cards
│   ├── publications/    # Publication components
│   ├── media/           # News and gallery components
│   ├── careers/         # Job listing components
│   └── search/          # Search functionality
├── composables/         # Vue composables
├── i18n/locales/        # Translation files (en.json, ak.json)
├── layouts/             # Page layouts
├── pages/               # File-based routing
├── public/              # Static assets
├── server/
│   ├── api/             # API routes
│   ├── database/        # Database schema and migrations
│   └── utils/           # Server utilities and mock data
├── tests/               # Unit tests
├── e2e/                 # End-to-end tests
└── types/               # TypeScript type definitions
```

## Environment Variables

See `.env.example` for all available environment variables:

| Variable | Description |
|----------|-------------|
| `NUXT_PUBLIC_SITE_URL` | Production site URL |
| `NUXT_PUBLIC_SITE_NAME` | Site name for SEO |
| `NUXT_PUBLIC_CONTACT_EMAIL` | Contact email address |
| `NUXT_PUBLIC_CONTACT_PHONE` | Contact phone number |
| `NUXT_API_SECRET` | Server-side API secret |

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is the property of the Ghana Audit Service. All rights reserved.

## Contact

- **Website**: [https://audit.gov.gh](https://audit.gov.gh)
- **Email**: info@audit.gov.gh
- **Phone**: +233 (302) 664929
- **Address**: Ministries Block 'O', 1 Old Race Course Drive, Accra
