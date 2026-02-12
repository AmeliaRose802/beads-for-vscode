# Beads UI - VS Code Extension

A VS Code extension providing a user interface for the beads (bd) command-line issue tracker.

## Features

- 🎯 Quick action buttons for common bd commands
- 💻 Custom command input for any bd command
- 📊 Real-time output display
- 🎨 Integrates with VS Code theme
- 📂 Automatically uses your workspace directory
- ⚡ Lightweight sidebar integration

## Installation

## Usage

1. Open a workspace/folder that contains a bd-initialized project
2. Click the Beads icon (🔮) in the Activity Bar
3. Use the quick action buttons or enter custom bd commands

### Quick Actions

- **📋 List**: View all issues (`bd list`)
- **✅ Ready**: Show ready work (`bd ready`)
- **🚫 Blocked**: Display blocked issues (`bd blocked`)
- **📊 Stats**: Show project statistics (`bd stats`)
- **ℹ️ Info**: View database information (`bd info`)
- **➕ Create**: Create a new issue (sets up the create command)

### Custom Commands

Enter any bd command in the input field:
- `list --state open`
- `show 1`
- `update 1 --state in-progress`
- `close 1`
- `create --title "New feature"`

Press Enter or click the ▶ button to execute.

## Requirements

- VS Code 1.75.0 or higher
- The `bd` command-line tool must be installed and available in your PATH
  - Install from: https://github.com/steveyegge/beads
  - If not installed, you'll see an error message with installation instructions
- A bd-initialized workspace (run `bd init` in your project directory)

## Commands

- **Beads: Open UI** - Opens the Beads sidebar panel

## Development

To work on this extension:

1. Open the folder in VS Code
2. Run `npm install` to install dependencies (also installs git hooks)
3. Press `F5` to launch Extension Development Host
4. Make changes to `extension.js`
5. Reload the Extension Development Host window to test changes

### Pre-commit Hooks

This project uses **husky** to enforce code quality on every commit. Hooks are installed automatically when you run `npm install`.

The following validations run before each commit and **must all pass**:

| Check | Requirement |
|-------|-------------|
| **Lint** | Zero ESLint warnings or errors |
| **File length** | All source files ≤ 500 lines |
| **No skipped tests** | No `.skip()`, `.only()`, `xit()`, etc. |
| **Type annotations** | JSDoc on all exported functions |
| **Test coverage** | ≥ 80% line/branch/function coverage |

If any check fails, the commit is blocked with a clear error message.

```bash
# Run the pre-commit checks manually
npm run pre-commit

# Run tests with coverage report
npm run test:coverage
```

### Testing

This extension includes comprehensive test coverage with 50+ tests:

```bash
# Run all tests (lint + integration tests)
npm test

# Run lint only
npm run lint

# Run unit tests
npm run test:unit

# Run with coverage
npm run test:coverage
```

**Test Coverage:**
- ✅ Extension activation & deactivation
- ✅ Command execution & error handling
- ✅ Webview provider initialization
- ✅ Message passing between extension and webview
- ✅ Environment variable configuration
- ✅ Security validations
- ✅ Integration with VS Code APIs
- ✅ JSON parsing & form command building
- ✅ AI suggestion response parsing
- ✅ Pre-commit hook configuration

For detailed testing documentation, see [TESTING.md](./TESTING.md).

## License

MIT
