# Contributing to HiveMind 🐝

感谢你有兴趣参与 HiveMind 项目！我们欢迎各种形式的贡献。

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

---

## 🤝 Code of Conduct

Be respectful, inclusive, and collaborative. We value:

- Constructive feedback
- Open communication
- Respect for all contributors
- Focus on what's best for the project

---

## 🚀 How to Contribute

### Reporting Bugs

Before reporting a bug, please:

1. Search existing issues to avoid duplicates
2. Check if the bug is already fixed in the latest version
3. Gather information:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Node version, OS, etc.)
   - Relevant logs or error messages

Use the [Bug Report](https://github.com/Churchillhuang/hivemind/issues/new?template=bug_report.md) template.

### Suggesting Features

Before submitting a feature request:

1. Check if the feature already exists or is planned
2. Consider the scope - is it a new feature or enhancement?
3. Explain the use case and why it's valuable

Use the [Feature Request](https://github.com/Churchillhuang/hivemind/issues/new?template=feature_request.md) template.

### Code Contributions

For code changes:

1. Find an issue to work on or propose one
2. Comment to claim the issue (avoid duplicate work)
3. Create your feature branch
4. Develop and test
5. Open a Pull Request

---

## 🛠️ Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- OpenClaw (for integration testing)

### Install Dependencies

```bash
git clone https://github.com/Churchillhuang/hivemind.git
cd hivemind
npm install
```

### Build Project

```bash
npm run build
```

### Run Tests

```bash
# All tests
npm test

# Or use the CLI (after installation)
hivemind test
```

### Development Mode

```bash
npm run dev
```

---

## 📤 Submitting Changes

### Pull Request Process

1. **Create a branch**

   ```bash
   git checkout -b feature/amazing-feature
   # or
   git checkout -b fix/critical-bug
   ```

2. **Make your changes**

   - Write clean, well-commented code
   - Follow coding standards (see below)
   - Update documentation as needed
   - Add/update tests

3. **Test your changes**

   ```bash
   npm run build
   npm test
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   # or
   git commit -m "fix: resolve critical bug"
   ```

   Use conventional commits:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting, etc.)
   - `refactor:` Code refactoring
   - `test:` Test changes
   - `chore:` Maintenance tasks

5. **Push and create PR**

   ```bash
   git push origin feature/amazing-feature
   ```

   Then create a Pull Request on GitHub.

### Pull Request Checklist

Before submitting, ensure:

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation is updated
- [ ] Commit messages are clear
- [ ] PR description explains what and why
- [ ] No unrelated changes

---

## 📐 Coding Standards

### TypeScript Guidelines

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable/function names
- Add JSDoc comments for public APIs
- Keep functions focused and small

### Code Style

```typescript
// ✅ Good - clear and self-documenting
const calculateSuccessRate = (tasks: Task[]): number => {
  const succeeded = tasks.filter(t => t.success).length;
  return succeeded / tasks.length;
};

// ❌ Bad - vague and unclear
const calc = (t) => {
  const x = t.filter(y => y.z).length;
  return x / t.length;
};
```

### File Organization

- One class/component per file
- Logical folder structure
- Separate concerns (core, hive, events, examples)
- Export only what's necessary

---

## 🧪 Testing

### Test Structure

```
examples/
├── integration-test-complete.ts    # Full integration test
├── emergence-observation-test.ts   # Emergence features
└── self-optimization-test.ts       # Optimization features
```

### Writing Tests

```typescript
// Write clear test descriptions
test("should calculate success rate correctly", () => {
  const tasks = [
    { success: true },
    { success: false },
    { success: true }
  ];

  const rate = calculateSuccessRate(tasks);

  expect(rate).toBe(0.67);
});
```

### Test Coverage

- Aim for high coverage on core components
- Test both happy path and edge cases
- Include integration tests for workflows

---

## 📚 Documentation

### Code Comments

- Comment on *why*, not *what*
- Keep comments up to date
- Avoid obvious comments

### API Documentation

- Document public APIs with JSDoc
- Include examples for complex usage
- Document parameters and return types

### README Updates

- Add new features to README
- Update usage examples
- Keep performance stats current

---

## 🎯 Focus Areas

We're currently interested in:

1. **Emergence Enhancement** - Improve self-awareness and intentionality
2. **Performance** - Further optimize token usage and cost
3. **Tooling** - Better debugging and monitoring tools
4. **Documentation** - Complete API reference and guides
5. **Testing** - Expand test coverage

---

## 🤖 AI-Assisted Contributions

We welcome contributions made with AI tools! Just be transparent:

- Mark AI-assisted in PR description
- Note testing level (untested / lightly / fully tested)
- Understand what the code does
- Include prompts/session logs if helpful

---

## 📞 Getting Help

- **GitHub Issues:** For bugs and feature requests
- **Discussions:** For questions and ideas
- **Discord:** (if available) Real-time help

---

## 🙏 Thank You

Every contribution helps make HiveMind better. Thank you for your time and effort!

---

**Built with 🧵 and 🦞**
