# Multi-Project Build System

## Overview

This repository uses a configuration-driven build system that can manage and package multiple PixInsight tools in a single update repository. The system is designed to be:

- **Simple**: Single configuration file controls everything
- **Flexible**: Easy to add new projects
- **Maintainable**: Clear separation between code and build config
- **Safe**: Doesn't modify source files, only creates packages

## Architecture

### Components

1. **`packaging.config.json`** - Central configuration file
   - Defines all projects in the repository
   - Controls which projects are ready for distribution
   - Specifies version numbers and metadata
   - Lists files to include/exclude

2. **`tools/build-packages.mjs`** - Main build script
   - Reads configuration
   - Builds ZIP packages for ready projects
   - Generates unified `updates.xri` manifest
   - Handles cleanup and validation

3. **`updates/`** directory - Output location
   - Contains all generated ZIP packages
   - Contains `updates.xri` manifest file
   - Served directly by GitHub for PixInsight

## Configuration File Structure

### Top Level

```json
{
  "repository": {
    "name": "PixInsight Custom Scripts",
    "description": "Repository description",
    "minPixInsightVersion": "1.8.0"
  },
  "projects": {
    // Project definitions here
  }
}
```

### Project Definition

Each project in the `projects` object has this structure:

```json
"ProjectKey": {
  "ready": true,                    // Whether to include in build
  "name": "Display Name",           // Human-readable name
  "sourceDir": "Source Folder",     // Where source files are located
  "zipNamePrefix": "PackageName",   // Base name for ZIP file
  "version": "1.0.0",               // Semantic version
  "piScriptRoot": "src/scripts/...", // Path inside ZIP for scripts
  "piResourceRoot": "rsc/...",      // Path inside ZIP for resources
  "description": "Brief desc...",   // Package description
  "features": [                     // List of key features
    "Feature 1",
    "Feature 2"
  ],
  "files": {
    "scripts": [                    // JavaScript files to include
      "main.js",
      "module.js"
    ],
    "resources": [                  // Resource files to include
      "data.csv",
      "icons/icon.png"
    ],
    "exclude": [                    // Directories to exclude
      "archive",
      "tests"
    ]
  }
}
```

## Build Process

### What Happens When You Run `npm run build:packages`

1. **Configuration Loading**
   - Reads `packaging.config.json`
   - Validates structure
   - Identifies ready projects

2. **For Each Ready Project**
   - Creates temporary staging directory
   - Copies script files to `<tempDir>/<piScriptRoot>/`
   - Copies resource files to `<tempDir>/<piResourceRoot>/`
   - Creates ZIP with name: `<zipNamePrefix>-<version>-<YYYYMMDD>.zip`
   - Calculates SHA1 hash and file size
   - Stores package metadata

3. **Manifest Generation**
   - Generates `updates.xri` from scratch
   - Includes one `<package>` entry per ready project
   - Uses metadata calculated in step 2

4. **Cleanup**
   - Removes old package ZIPs (keeps only latest)
   - Deletes temporary directories
   - Reports build summary

## Adding a New Project

### Step 1: Add Configuration

Edit `packaging.config.json` and add a new entry:

```json
"MyNewTool": {
  "ready": false,
  "name": "My New Tool",
  "sourceDir": "MyNewTool",
  "zipNamePrefix": "MyNewTool",
  "version": "0.1.0",
  "piScriptRoot": "src/scripts/MyNewTool",
  "piResourceRoot": "rsc/MyNewTool",
  "description": "Description of what the tool does",
  "features": [
    "Feature 1",
    "Feature 2"
  ],
  "files": {
    "scripts": [
      "MyNewTool.js"
    ],
    "resources": [],
    "exclude": ["archive", "tests"]
  }
}
```

### Step 2: Develop and Test

- Create your tool in the `sourceDir` folder
- Test manually by loading in PixInsight
- When stable and ready, proceed to step 3

### Step 3: Mark as Ready

```json
"MyNewTool": {
  "ready": true,  // Changed from false
  ...
}
```

### Step 4: Build and Release

```powershell
npm run build:packages
git add packaging.config.json updates/
git commit -m "Add MyNewTool to update repository"
git tag -a v0.1.0-mynewtool -m "Initial release of MyNewTool"
git push origin main --tags
```

## Version Management

### Project Versioning

Each project has independent versioning:

```json
"AstroBinExport": {
  "version": "1.0.0",  // Can be updated independently
  ...
},
"Signature": {
  "version": "0.1.0",  // Different version
  ...
}
```

### Updating a Version

1. Edit `packaging.config.json`:
   ```json
   "version": "1.1.0"  // Changed from 1.0.0
   ```

2. Build:
   ```powershell
   npm run build:packages
   ```

3. New ZIP will be created:
   - Old: `ProjectName-1.0.0-20251129.zip`
   - New: `ProjectName-1.1.0-20251129.zip`

4. `updates.xri` automatically updated with new package info

## File Inclusion Logic

### Scripts

All files listed in `files.scripts` are copied from `sourceDir` to `piScriptRoot`:

```json
"files": {
  "scripts": [
    "main.js",           // Copied to: src/scripts/ProjectName/main.js
    "lib/module.js"      // Copied to: src/scripts/ProjectName/lib/module.js
  ]
}
```

### Resources

All files listed in `files.resources` are copied from `sourceDir` to `piResourceRoot`:

```json
"files": {
  "resources": [
    "data.csv",          // Copied to: rsc/ProjectName/data.csv
    "icons/logo.png"     // Copied to: rsc/ProjectName/logo.png (basename only)
  ]
}
```

### Exclusions

Directories listed in `files.exclude` are never included, even if referenced:

```json
"files": {
  "exclude": ["archive", "tests", ".git"]
}
```

## PixInsight Integration

### How PixInsight Uses the Packages

1. User adds repository URL to PixInsight
2. PixInsight fetches `updates.xri`
3. PixInsight parses `<package>` entries
4. User selects packages to install
5. PixInsight downloads ZIP files
6. PixInsight extracts to its scripts directory
7. Scripts become available in PixInsight menu

### Directory Structure Inside ZIP

```
src/
  scripts/
    ProjectName/
      main.js
      module.js

rsc/
  ProjectName/
    data.csv
    icons/
      logo.png
```

This structure matches PixInsight's expected layout.

## Troubleshooting

### Build Fails with "File not found"

**Problem:** Source file listed in config doesn't exist

**Solution:**
- Check `sourceDir` path is correct
- Verify file names match exactly (case-sensitive)
- Ensure files listed in `files.scripts` and `files.resources` exist

### No Packages Built

**Problem:** All projects have `"ready": false`

**Solution:**
- Set at least one project to `"ready": true`
- Verify JSON is valid (no syntax errors)

### Old Packages Not Removed

**Problem:** Multiple versions of same package in `updates/`

**Solution:**
- This is actually normal - old ZIPs are kept for reference
- Only the latest is referenced in `updates.xri`
- Manually delete old ZIPs if needed

### PixInsight Doesn't See Updates

**Problem:** Repository added but no updates shown

**Solution:**
- Verify repository URL ends with `/updates/`
- Check `updates.xri` is valid XML
- Ensure GitHub serves files correctly (use raw URL)
- Try "Check for Updates" button in PixInsight

## Best Practices

### Version Numbers

- Use semantic versioning: `MAJOR.MINOR.PATCH`
- Increment PATCH for bug fixes
- Increment MINOR for new features
- Increment MAJOR for breaking changes

### Feature Descriptions

- Keep features list concise (3-8 items)
- Focus on user-visible benefits
- Use action-oriented language

### File Organization

- Keep source directories clean
- Use `exclude` for test/archive files
- Group related scripts together

### Testing

- Test manually before marking `ready: true`
- Build and inspect ZIP before pushing
- Test installation from repository URL

## Migration from Old Build System

### Before (Single Project)

```powershell
npm run build:astrobin -- --version=1.0.0
```

### After (Multi Project)

1. Projects defined in `packaging.config.json`
2. Single command builds everything:
   ```powershell
   npm run build:packages
   ```
3. No version flag needed (read from config)

### Benefits

- ✅ One command for all projects
- ✅ Centralized configuration
- ✅ Consistent versioning
- ✅ Easier to add new tools
- ✅ Single `updates.xri` for repository

## Future Enhancements

Potential improvements:

- [ ] Automatic version detection from script headers
- [ ] Changelog generation from git commits
- [ ] GitHub Actions integration for CI/CD
- [ ] Package validation/linting
- [ ] Dependency management between projects
- [ ] Multiple repository support (dev/stable)
