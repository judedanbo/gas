# Contributing to Ghana Audit Service Website

Thank you for your interest in contributing to the Ghana Audit Service website. This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and professional environment. This is a government website project, and all contributions should reflect the standards expected of public service.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`
5. Make your changes
6. Run tests and linting before committing
7. Submit a pull request

## Development Setup

See the [README.md](README.md) for detailed setup instructions.

## Branch Naming Conventions

Use descriptive branch names with the following prefixes:

- `feature/` - New features (e.g., `feature/add-search-filters`)
- `fix/` - Bug fixes (e.g., `fix/mobile-nav-overflow`)
- `refactor/` - Code refactoring (e.g., `refactor/report-card-component`)
- `docs/` - Documentation changes (e.g., `docs/update-readme`)
- `test/` - Adding or updating tests (e.g., `test/add-api-tests`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

## Commit Message Format

Follow the conventional commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring without feature changes
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(reports): add filter by fiscal year

fix(i18n): correct Akan translation for navigation items

docs(readme): add database setup instructions
```

## Pull Request Process

1. **Before submitting:**
   - Ensure all tests pass: `npm run test:run`
   - Run linting: `npm run lint`
   - Check formatting: `npm run format:check`
   - Run type checking: `npm run typecheck`

2. **PR requirements:**
   - Clear title describing the change
   - Description explaining what and why
   - Reference any related issues
   - Screenshots for UI changes
   - All CI checks passing

3. **Review process:**
   - At least one approval required
   - Address all review comments
   - Keep PRs focused and reasonably sized

## Code Style Guidelines

### General

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Keep components focused and single-purpose
- Use composables for shared logic

### Vue Components

- Use `<script setup lang="ts">` syntax
- Props should be typed using `defineProps<T>()`
- Emit events using `defineEmits<T>()`
- Component names use PascalCase

### CSS/Tailwind

- Use Tailwind utility classes
- Custom styles go in `assets/css/`
- Follow the Ghana government color palette defined in `tailwind.config.ts`

### File Organization

- Components in `components/` organized by domain
- Composables in `composables/`
- Types in `types/index.ts`
- API routes in `server/api/`

## Testing Requirements

### Unit Tests

- Test composables and utility functions
- Test component logic where applicable
- Use Vitest and Vue Test Utils
- Aim for meaningful coverage, not 100%

### E2E Tests

- Test critical user journeys
- Test accessibility requirements
- Use Playwright

### Running Tests

```bash
npm run test:run      # Unit tests
npm run test:coverage # With coverage report
npm run test:e2e      # End-to-end tests
```

## Accessibility Guidelines

This is a government website and must be accessible to all users:

- Follow WCAG 2.1 AA standards
- Use semantic HTML elements
- Include proper ARIA labels
- Ensure keyboard navigation works
- Test with screen readers
- Maintain sufficient color contrast

## Internationalization

When adding or modifying text:

1. Add translations to both `i18n/locales/en.json` and `i18n/locales/ak.json`
2. Use the `$t()` function or `useI18n()` composable
3. Keep translation keys organized by section

## Questions?

For questions about contributing, please contact the development team or open an issue for discussion.
