# Contributing to Codemode Standalone

Thank you for your interest in contributing! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

---

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes**:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes**:
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

---

## Getting Started

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git
- TypeScript knowledge
- Familiarity with the codebase (read [ARCHITECTURE.md](./ARCHITECTURE.md))

### Setup Development Environment

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/codemode-standalone.git
cd codemode-standalone

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/codemode-standalone.git

# Install dependencies
npm install

# Build the project
npm run build

# Run examples to verify
npm run example:basic
```

### Create a Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-number-description
```

---

## Development Process

### 1. Find or Create an Issue

- Check existing issues first
- For bugs: Create issue with reproduction steps
- For features: Discuss in issue before implementing
- For docs: PRs welcome without prior issue

### 2. Implement Your Changes

Follow the [Coding Standards](#coding-standards) section.

### 3. Test Your Changes

```bash
# Run your code
npm run example:basic

# Test specific functionality
npx tsx your-test-file.ts

# Check TypeScript types
npx tsc --noEmit
```

### 4. Document Your Changes

- Update relevant documentation
- Add JSDoc comments to new functions
- Update CHANGELOG.md
- Add examples if needed

### 5. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with clear message
git commit -m "feat: add new feature X"
```

See [Commit Message Format](#commit-message-format).

### 6. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create PR on GitHub
# Fill out the PR template
```

---

## Coding Standards

### TypeScript Style

```typescript
// ✅ Good: Clear types and documentation
/**
 * Executes a tool by name with given arguments
 * @param name - Tool name to execute
 * @param args - Arguments for the tool
 * @returns Promise resolving to tool result
 * @throws Error if tool not found
 */
async function executeTool<T = any>(
  name: string,
  args: unknown
): Promise<T> {
  // Implementation
}

// ❌ Bad: No types, no docs
async function executeTool(name, args) {
  // Implementation
}
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| **Classes** | PascalCase | `CodemodeEngine` |
| **Interfaces** | PascalCase | `SecurityPolicy` |
| **Functions** | camelCase | `executeTool` |
| **Variables** | camelCase | `toolRegistry` |
| **Constants** | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT` |
| **Private members** | _camelCase | `_internalState` |
| **Files** | PascalCase | `ToolRegistry.ts` |

### Code Organization

```typescript
// File structure:
// 1. Imports (external then internal)
import { z } from "zod";
import type { Tool } from "../types/index.js";

// 2. Type definitions
interface LocalType {
  // ...
}

// 3. Constants
const DEFAULT_VALUE = 100;

// 4. Main class/function
export class MyClass {
  // Public properties first
  public name: string;
  
  // Private properties
  private _internal: any;
  
  // Constructor
  constructor() {}
  
  // Public methods
  public publicMethod() {}
  
  // Private methods
  private privateMethod() {}
}

// 5. Helper functions (if any)
function helperFunction() {}
```

### Error Handling

```typescript
// ✅ Good: Specific error types
class ToolNotFoundError extends Error {
  constructor(toolName: string) {
    super(`Tool '${toolName}' not found`);
    this.name = 'ToolNotFoundError';
  }
}

// ✅ Good: Clear error messages
if (!tool) {
  throw new ToolNotFoundError(toolName);
}

// ❌ Bad: Generic errors
if (!tool) {
  throw new Error("error");
}
```

### Comments

```typescript
// ✅ Good: Explain why, not what
// Calculate hash to avoid duplicate processing
const hash = calculateHash(data);

// ❌ Bad: Stating the obvious
// Set x to 5
const x = 5;

// ✅ Good: Document complex logic
/**
 * Uses a two-phase commit to ensure atomicity:
 * 1. Validate all tools exist
 * 2. Execute all tools in order
 * If any step fails, rollback is performed
 */
async function executeToolChain() {}
```

---

## Testing

### Current State

The project doesn't have a formal test suite yet. When adding tests:

### Testing Framework (Future)

```bash
# Install testing dependencies
npm install --save-dev vitest @vitest/ui

# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../src/core/ToolRegistry';

describe('ToolRegistry', () => {
  describe('registerTool', () => {
    it('should register a new tool', () => {
      const registry = new ToolRegistry();
      const tool = createMockTool();
      
      registry.registerTool('test', tool);
      
      expect(registry.hasTool('test')).toBe(true);
    });
    
    it('should throw when registering duplicate', () => {
      const registry = new ToolRegistry();
      const tool = createMockTool();
      
      registry.registerTool('test', tool);
      
      expect(() => {
        registry.registerTool('test', tool);
      }).toThrow('already registered');
    });
  });
});
```

### Manual Testing

Until automated tests exist:

1. Run all examples
2. Test your specific changes
3. Test edge cases
4. Test error conditions

```bash
# Test examples
npm run example:basic
npm run example:mcp
npm run example:advanced

# Test your changes
npx tsx test-my-feature.ts
```

---

## Documentation

### What Needs Documentation

- **New features**: Add to README.md and relevant docs
- **API changes**: Update API_REFERENCE.md
- **Breaking changes**: Highlight in CHANGELOG.md
- **Configuration**: Update relevant config docs
- **Examples**: Add to examples/ if substantial

### Documentation Style

```markdown
## Section Title

Brief introduction to the section.

### Subsection

Explanation with examples:

```typescript
// Code example with comments
const example = "value";
```

**Key points**:
- Point 1
- Point 2

See [Related Doc](./link.md) for more details.
```

### JSDoc Style

```typescript
/**
 * Brief one-line description
 * 
 * Longer description if needed. Explain:
 * - What the function does
 * - When to use it
 * - Any important caveats
 * 
 * @param name - Parameter description
 * @param options - Optional parameter description
 * @returns Description of return value
 * @throws Error description if applicable
 * 
 * @example
 * ```typescript
 * const result = myFunction('test', { option: true });
 * console.log(result);
 * ```
 */
export function myFunction(
  name: string,
  options?: Options
): Result {
  // Implementation
}
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Examples added/updated if needed
- [ ] Manual testing completed
- [ ] CHANGELOG.md updated

### PR Title Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): brief description

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation only
- style: Code style changes (formatting, etc.)
- refactor: Code refactoring
- perf: Performance improvements
- test: Adding tests
- chore: Maintenance tasks

Examples:
feat(core): add result caching to CodemodeEngine
fix(execution): handle timeout correctly in isolate
docs(api): add examples for ToolRegistry
refactor(mcp): simplify client connection logic
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Motivation
Why is this change needed?

## Changes
- Change 1
- Change 2

## Testing
How was this tested?

## Breaking Changes
List any breaking changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Self-reviewed
- [ ] Tested manually
```

### Review Process

1. **Automated Checks**: (future) Linting, type checking
2. **Manual Review**: Maintainer reviews code
3. **Feedback**: Address review comments
4. **Approval**: At least one approval needed
5. **Merge**: Maintainer merges PR

### After Your PR is Merged

- Delete your branch (local and remote)
- Update your main branch
- Celebrate! 🎉

---

## Release Process

For maintainers:

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **Major** (x.0.0): Breaking changes
- **Minor** (0.x.0): New features, backwards compatible
- **Patch** (0.0.x): Bug fixes, backwards compatible

### Release Steps

1. **Update Version**:
```bash
npm version major|minor|patch
```

2. **Update CHANGELOG.md**:
```markdown
## [1.2.0] - 2024-01-15

### Added
- New feature X

### Changed
- Improved feature Y

### Fixed
- Bug Z
```

3. **Create Git Tag**:
```bash
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

4. **Publish** (if npm package):
```bash
npm publish
```

5. **Create GitHub Release**:
- Go to GitHub releases
- Create new release from tag
- Copy CHANGELOG entry
- Publish release

---

## Commit Message Format

### Structure

```
type(scope): subject

body

footer
```

### Examples

```
feat(core): add caching to type generation

Implements LRU cache for generated type definitions to improve
performance on subsequent executions with same tools.

Closes #123
```

```
fix(execution): prevent memory leak in isolate cleanup

The isolate was not being properly disposed when execution threw
an error, causing memory accumulation over time.

Fixes #456
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation
- **style**: Formatting, missing semicolons, etc.
- **refactor**: Code restructuring
- **perf**: Performance improvement
- **test**: Adding tests
- **chore**: Maintenance

### Scopes

- **core**: Core functionality
- **execution**: Execution system
- **mcp**: MCP integration
- **security**: Security features
- **docs**: Documentation
- **build**: Build system
- **ci**: CI configuration

---

## Recognition

Contributors will be:

- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Acknowledged in documentation

---

## Questions?

- Read existing documentation
- Check closed issues/PRs
- Ask in discussions
- Contact maintainers

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing! 🙌






