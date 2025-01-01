# Checkbox Examples

A collection of checkbox implementations using different frameworks and approaches.

## Features

- Parent/child checkbox relationships
- Multiple implementation examples:
  - Pure JavaScript
  - Alpine.js
  - More coming soon...
- Syntax highlighted code examples
- Collapsible code sections

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

## Project Structure

```
src/
├── components/
│   ├── alpine/
│   │   ├── alpine.astro        # Implementation
│   │   └── alpineContainer     # Display wrapper
│   ├── vanilla/
│   │   ├── vanilla.astro       # Implementation
│   │   └── vanillaContainer    # Display wrapper
│   └── CodeBlock.astro        # Code display
└── pages/
    └── index.astro           # Main page
```