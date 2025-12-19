---
trigger: always_on
---

# AGENTS.md

## Project Overview

This project is a Next.js, React, Monaco Editor & TypeScript application that provides a modern, user-friendly interface for interacting with the SmallC programming language. It includes features such as code editing, compilation, and deployment.

## Technical Stack

- Framework: Next.js
- Language: TypeScript
- Styling: Tailwind CSS
- UI Components: shadcn-ui
- State Management: Zustand
- API Client: Axios
- Linting & Formatting: gts (ESLint, Prettier)
- Package Manager: bun
- Code Editor: Monaco Editor

## Development Guidelines

### Prerequisites

- Node.js >=v20.0.0
- bun >=v1.1.10
- git >=v2.41.0
- TypeScript >=v5.6.3

### Development Philosophy
- Write clean, maintainable, and scalable code
- Use Zustand for state management
- Use Axios for API client
- Use gts for linting and formatting
- Use bun for package management
- Use Monaco Editor for code editing

### Code style
- TypeScript strict mode
- Single quotes, no semicolons
- Always use strict equality (===) instead of loose equality (==)
- Limit line length to 100 characters

## Naming Conventions

### General Rules
- PascalCase for: Components, Type definitions, Interfaces
- kebab-case for: Directory names (e.g., components/auth-wizard), File names (e.g., user-profile.tsx)
- camelCase for: Variables, Functions, Methods, Hooks, Properties, Props
- UPPERCASE for: Environment variables, Constants, Global configurations

### Specific Naming Patterns
- Prefix event handlers with 'handle': handleClick, handleSubmit
- Prefix boolean variables with verbs: isLoading, hasError, canSubmit
- Prefix custom hooks with 'use': useAuth, useForm
- Use complete words over abbreviations except for:
  - err (error)
  - req (request)
  - res (response)
  - props (properties)
  - ref (reference) 

## Next.js Best Practices

### Core Concepts
- Utilize App Router for routing
- Implement proper metadata management
- Use proper caching strategies
- Implement proper error boundaries

### Components and Features
- Use Next.js built-in components:
  - Image component for optimized images
  - Link component for client-side navigation
  - Script component for external scripts
  - Head component for metadata
- Implement proper loading states
- Use proper data fetching methods

### Server Components
- Default to Server Components
- Use URL query parameters for data fetching and server state management
- Use 'use client' directive only when necessary:
  - Event listeners
  - Browser APIs, eg: window, document, localStorage, etc.
  - State management
  - Client-side-only libraries
  - Lifecycle of Reactive Effects, eg: useEffect, etc.

## Testing Strategy

### Unit Testing
- Use Jest and React Testing Library for reliable and efficient testing of React components
- Ensure test coverage for critical features
- Write thorough unit tests to validate individual functions and components
- Follow patterns like Arrange-Act-Assert to ensure clarity and consistency in tests
- Mock external dependencies and API calls to isolate unit tests

### Integration Testing
- Focus on user workflows to ensure app functionality
- Set up and tear down test environments properly to maintain test independence
- Use snapshot testing selectively to catch unintended UI changes without over-relying on it
- Leverage testing utilities (e.g., screen in RTL) for cleaner and more readable tests

## UI and Styling

### Component Libraries
- Use Shadcn UI for consistent, accessible component design
- Integrate Radix UI primitives for customizable, accessible UI elements
- Apply composition patterns to create modular, reusable components

### Styling Guidelines
- Use Tailwind CSS for utility-first, maintainable styling
- Design with responsive principles for flexibility across devices
- Implement dark mode using CSS variables or Tailwind's dark mode features
- Ensure color contrast ratios meet accessibility standards for readability
- Maintain consistent spacing values to establish visual harmony
- Define CSS variables for theme colors and spacing to support easy theming and maintainability


## Common Issues

### Issue 1: Hydration Mismatch Errors
Solution:

Ensure server and client render the same content
Use useEffect for client-only code
Use dynamic imports with ssr: false for client-only components
Check for differences in date/time formatting between server and client

### Issue 2: Performance Issues with Large Lists
Solution:

Implement virtualization for large datasets
Use pagination or infinite scrolling
Optimize re-renders with React.memo and useMemo
Consider server-side filtering and sorting

### Issue 3: TypeScript Type Errors in Production Build
Solution:

Enable strict mode in TypeScript configuration
Fix all type errors before deployment
Use proper type definitions for third-party libraries
Implement proper error boundaries for runtime type issues


## Reference Resources

- [Next.js Official Documentation](https://nextjs.org/docs)
- [React Official Documentation](https://react.dev/reference/react)
- [TypeScript Official Documentation](https://www.typescriptlang.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Shadcn UI Documentation](https://ui.shadcn.com/docs)
- [React Hook Form Documentation](https://react-hook-form.com/docs)
- [Zustand Documentation](https://zustand.docs.pmnd.rs/)
- [React Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/)