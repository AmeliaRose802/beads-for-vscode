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

### From Source (Development)

1. Open this folder in VS Code
2. Press `F5` to launch a new VS Code window with the extension loaded

### Manual Installation

1. Copy this entire folder to your VS Code extensions directory:
   - **Windows**: `%USERPROFILE%\.vscode\extensions\`
   - **macOS/Linux**: `~/.vscode/extensions/`
2. Restart VS Code
3. The Beads icon will appear in the Activity Bar

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
- A bd-initialized workspace (run `bd init` in your project directory)

## Commands

- **Beads: Open UI** - Opens the Beads sidebar panel

## Development

To work on this extension:

1. Open the folder in VS Code
2. Run `npm install` to install dependencies
3. Press `F5` to launch Extension Development Host
4. Make changes to `extension.js`
5. Reload the Extension Development Host window to test changes

### Testing

This extension includes comprehensive test coverage with 30+ tests:

```bash
# Run all tests (lint + integration tests)
npm test

# Run lint only
npm run lint

# Run unit tests
npm run test:unit
```

**Test Coverage:**
- ✅ Extension activation & deactivation
- ✅ Command execution & error handling
- ✅ Webview provider initialization
- ✅ Message passing between extension and webview
- ✅ Environment variable configuration
- ✅ Security validations
- ✅ Integration with VS Code APIs

For detailed testing documentation, see [TESTING.md](./TESTING.md).

## License

MIT
