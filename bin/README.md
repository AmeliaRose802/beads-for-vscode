# Bundled Beads Binaries

This directory contains platform-specific beads (`bd`) binaries that are bundled with the VS Code extension.

## Directory Structure

```
bin/
├── win32/
│   └── bd.exe          # Windows binary
├── darwin/
│   └── bd              # macOS binary
├── linux/
│   └── bd              # Linux binary
└── README.md
```

## Adding Binaries

To bundle beads with the extension:

1. Download or build the `bd` binary for each platform
2. Place binaries in their respective platform directories:
   - Windows: `bin/win32/bd.exe`
   - macOS: `bin/darwin/bd`
   - Linux: `bin/linux/bd`
3. Make binaries executable (macOS/Linux):
   ```bash
   chmod +x bin/darwin/bd
   chmod +x bin/linux/bd
   ```

## How It Works

The extension will:
1. Check if a bundled binary exists for the current platform
2. Use the bundled binary if found
3. Fall back to system `bd` command if no bundled binary exists

This provides an out-of-the-box experience while still supporting users who have `bd` installed system-wide.

## Getting Beads Binaries

- Official releases: https://github.com/steveyegge/beads/releases
- Build from source: https://github.com/steveyegge/beads

## Note

Binaries are not included in the repository by default to keep the repo size small. They should be added during the build/packaging process for distribution.
