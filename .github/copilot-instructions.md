# PixInsight Scripts - AI Agent Instructions

## Project Overview

This is a **PixInsight JavaScript (PJSR)** repository containing custom scripts for astrophotography workflow automation. Projects are distributed via PixInsight's built-in update repository system.

**Key Projects:**
- **AstroBin Export** (`AstroBin Export/`) - CSV generator for AstroBin bulk uploads, with FITS analysis and 200+ filter database
- **Master Signature** (`Signature/`) - Image signature overlay tool (experimental, not in distribution)

## How AI Tools Should Behave in This Repository

When modifying or extending this codebase, AI agents must:

- **Extend existing modules** whenever possible instead of creating new files
- **Use `#include` directives** for module imports (NOT ES6 `import` or Node.js `require`)
- **Keep each file under 500 lines** - split into focused modules if needed
- **Do not modify build tooling** (`tools/build-packages.mjs`, `package.json`) unless explicitly requested
- **Do not touch `updates.xri`** or built ZIP files - these are auto-generated
- **Use PixInsight logging** via `console.writeln()` for debugging (not `console.log()`)
- **Maintain directory structure** - all modules for a script must be in the same folder
- **Follow PJSR guidelines** - avoid external libraries, use PixInsight's built-in APIs
- **Test Settings persistence** - always verify `Settings.lastReadOK` after `Settings.read()`
- **Update version numbers** in both the module's `SCRIPT_VERSION` constant and `packaging.config.json`

## Architecture: PJSR Modular Scripts

### PJSR-Specific Patterns

**Module System**: PJSR uses `#include` preprocessor directives (NOT ES6 imports)
```javascript
#include <pjsr/Sizer.jsh>           // Standard PJSR library
#include "AstroBin-core.js"         // Relative path for local modules
```

**Feature Registration**: Scripts declare themselves to PixInsight via preprocessor directives
```javascript
#feature-id    AstroBinExport : PFRAstro > AstroBin Export
#feature-info  Description text goes here
```

**File Organization**: Main scripts `#include` modular components. All included files must be in the same directory or use relative paths. The build system preserves this structure.

### AstroBin Export Module Structure

**Main entry point:** `AstroBin_CSV_Export_v3_Modular.js` - orchestrates modules and registers with PixInsight
**Core modules:**
- `AstroBin-core.js` - CONFIG object, file operations, Settings persistence via `Settings.read/write`
- `AstroBin-filter-database.js` - 200+ filter definitions with brand/keyword matching
- `AstroBin-analysis.js` - FITS/XISF metadata extraction, session grouping, frame classification
- `AstroBin-gui.js` - Main dialog UI construction
- `AstroBin-gui-methods.js` - Event handlers and UI logic

**Critical Detail**: The `CONFIG` global object in `AstroBin-core.js` is shared state across all modules. It stores user preferences and is persisted via PixInsight's Settings API (module ID: `AstroBinCSVExport`).

**Settings Persistence Pattern:**
```javascript
Settings.write(AB_SETTINGS_MODULE + "/key", DataType_UInt32, value);
var val = Settings.read(AB_SETTINGS_MODULE + "/key", DataType_UInt32);
if (Settings.lastReadOK) { /* use val */ }
```

**Night Session Algorithm**: Images captured before noon are grouped with previous calendar date using `NIGHT_OFFSET_HOURS = -12`. This groups evening-to-morning sessions together.

## Build & Release System

**Configuration-Driven Multi-Project Builder**

**Primary config:** `packaging.config.json` - single source of truth for all projects
- `projects.*.ready: true` = include in distribution build
- `projects.*.version` = semantic version (update here to release)
- `projects.*.files.scripts/resources` = what to package
- `projects.*.piScriptRoot/piResourceRoot` = internal ZIP paths for PixInsight

**Build command:** `npm run build:packages` 
1. Reads `packaging.config.json`
2. Creates ZIPs for all `"ready": true` projects
3. Generates `updates/updates.xri` manifest with SHA1 hashes
4. Cleans up temp files
5. Output: `updates/<ProjectName>-<version>-<YYYYMMDD>.zip`

**Release workflow:**
```powershell
# 1. Update version in packaging.config.json
# 2. Build packages
npm run build:packages
# 3. Commit and tag
git add packaging.config.json updates/
git commit -m "Release AstroBin Export v3.2.0"
git tag -a v3.2.0 -m "Release notes"
git push origin main --tags
```

**Installation URL users add in PixInsight:**
```
https://raw.githubusercontent.com/englishfox90/PixInsight_Scripts/main/updates/
```

## Development Patterns

### Adding New Features to AstroBin Export

1. **Modify the appropriate module** (`-core.js`, `-analysis.js`, `-gui.js`, etc.) based on functionality
2. **Update version** in both `AstroBin-core.js` (`SCRIPT_VERSION`) and `packaging.config.json`
3. **Test in PixInsight** - scripts load via Script → Feature Scripts or direct execution
4. **Use console output** for debugging: `console.writeln("message")`

### Personal Filter Set Feature

Users can define LRGB + SHO filter IDs that override brand matching when `CONFIG.preferredFilterBrand = "Auto"`. 

**Precedence hierarchy:**
1. Personal filter set (substring match: "lum" → L, "ha|h-alpha" → Ha, etc.)
2. Preferred brand keyword match
3. First database keyword fallback

**Implementation:** `AstroBin-analysis.js` function `suggestFilterID()` applies precedence logic

### Column Selection System

`CONFIG.exportColumns` (object of boolean flags) controls which CSV columns populate. Headers always present for AstroBin format stability. `number` and `duration` are enforced populated (required by AstroBin).

Persisted via Settings API with flag versioning (`EXPORT_COLUMNS_VERSION`).

### FITS Metadata Extraction

**File reading pattern:**
```javascript
var ff = openForKeywords(filePath);  // Returns FileFormat object
if (ff) {
  var value = readKeyword(ff, "EXPTIME");  // Case-insensitive
  ff.close();
}
```

**Supported formats:** `.xisf`, `.fits`, `.fit`, `.fts` (constant: `FILE_EXTS`)

**Frame classification:** `classifyImageType()` excludes masters/calibrated/integration files from raw frame counts by checking paths and `IMAGETYP` keyword.

## Testing & Debugging

**Console Testing in PixInsight:**
- Open Script → Script Console
- Paste and execute PJSR code directly
- Use `console.writeln()` for output
- Test file operations, keyword reading, etc.

**Common Issues:**
- **"File not found" on `#include`**: All modules must be in same directory as main script
- **Settings not persisting**: Check `Settings.lastReadOK` after `read()` calls
- **Filter not found**: Personal filter set may be overriding; check `CONFIG.personalFilterSet`

## Documentation

- `docs/ASTROBIN_TECHNICAL_ARCHITECTURE.md` - comprehensive technical reference (1000+ lines)
- `docs/BUILD_SYSTEM.md` - build process deep dive
- `docs/QUICK_REFERENCE.md` - user-facing guide
- `README.md` - installation and usage for end users

## Multi-Project Layout & New Tools

This repository hosts **multiple PJSR tools**, not just AstroBin Export. Each tool follows the same modular pattern.

### Structure for New Tools

Each project should:
- **Live in its own directory** at the repository root (e.g., `SNR Analysis/`, `Plate Solver/`)
- **Follow the modular pattern** with a main entry point and supporting modules
- **Have a unique `#feature-id`** for PixInsight registration (e.g., `SNRAnalysis : PFRAstro > SNR Analysis`)
- **Use its own CONFIG object** and Settings module ID to avoid conflicts
- **Be added to `packaging.config.json`** with `"ready": true` when ready for distribution

### Versioning & Packaging

- Each project has independent version numbers in `packaging.config.json`
- Set `"ready": true` to include in builds, `false` to exclude
- The build system creates separate ZIP packages per project
- All projects share the same `updates.xri` manifest

### Where New Folders Go

- **Scripts**: Root level (e.g., `AstroBin Export/`, `NewTool/`)
- **Supporting files**: Inside each project folder (fonts, logos, databases)
- **Shared PJSR libraries**: `PJSR/include/pjsr/` (standard library, usually don't modify)
- **Documentation**: `docs/` (tool-specific or general)
- **Build tools**: `tools/` (don't create new tools here without explicit request)

## New Project Template

To create a new PJSR tool, follow this checklist:

1. **Create folder** at repository root: `<ProjectName>/`
2. **Create main script**: `<ProjectName>/<ProjectName>_Main.js` with:
   - `#feature-id <ProjectKey> : PFRAstro > <Display Name>`
   - `#feature-info` description
   - `#include` directives for modules
3. **Create core module**: `<ProjectName>/<ProjectName>-core.js` with:
   - `SCRIPT_VERSION` constant
   - `CONFIG` global object for settings
   - Unique Settings module ID (e.g., `var SETTINGS_MODULE = "<ProjectKey>Settings";`)
4. **Create additional modules** as needed:
   - `<ProjectName>-analysis.js` - data processing logic
   - `<ProjectName>-gui.js` - UI construction
   - `<ProjectName>-gui-methods.js` - event handlers
5. **Add to `packaging.config.json`**:
   ```json
   "ProjectKey": {
     "ready": false,
     "name": "Display Name",
     "sourceDir": "ProjectName",
     "version": "0.1.0",
     ...
   }
   ```
6. **Keep all `#include` paths relative** to the main script
7. **Use the Settings API** with your unique module ID for persistence
8. **Follow the logging pattern**: `console.writeln()` for output
9. **Test via Script → Feature Scripts** in PixInsight
10. **Document** in `README.md` and optionally in `docs/`

## Shared CONFIG Pattern for New Tools

New tools should follow the AstroBin Export pattern for settings persistence but with **unique module IDs**.

**Example for a new SNR Analysis tool:**

```javascript
// In SNRAnalysis-core.js
var SCRIPT_VERSION = "1.0.0";
var SNR_SETTINGS_MODULE = "SNRAnalysisSettings";  // Unique ID

var CONFIG = {
  inputDir: "",
  threshold: 10.0,
  outputFormat: "CSV"
};

function loadSettings() {
  Settings.beginReadMode();
  var dir = Settings.read(SNR_SETTINGS_MODULE + "/inputDir", DataType_String);
  if (Settings.lastReadOK) CONFIG.inputDir = dir;
  
  var thresh = Settings.read(SNR_SETTINGS_MODULE + "/threshold", DataType_Double);
  if (Settings.lastReadOK) CONFIG.threshold = thresh;
  Settings.endReadMode();
}

function saveSettings() {
  Settings.write(SNR_SETTINGS_MODULE + "/inputDir", DataType_String, CONFIG.inputDir);
  Settings.write(SNR_SETTINGS_MODULE + "/threshold", DataType_Double, CONFIG.threshold);
}
```

**Key points:**
- Use a unique module ID to avoid conflicts with other tools
- Always check `Settings.lastReadOK` after reading
- Wrap reads in `beginReadMode()`/`endReadMode()` for efficiency
- Match `DataType_*` to the value type (see `#include <pjsr/DataType.jsh>`)

## Testing New Scripts

Follow these guidelines when testing PJSR scripts:

- **Load scripts via Script → Feature Scripts** in PixInsight for proper registration
- **Use `console.writeln()`** for debugging output (appears in Script Console)
- **Avoid blocking alerts** - prefer console output over `MessageBox.information()`
- **Test Settings persistence**:
  - Run script, change settings, close
  - Reopen script and verify settings restored
  - Check for `Settings.lastReadOK` failures
- **Test with real FITS/XISF files** from your astrophotography workflow
- **Test error cases**: missing files, invalid paths, malformed FITS headers
- **Use Script → Script Console** for quick PJSR code testing without full UI

## Critical Constraints

- **No BOM in XRI**: `updates.xri` must be pure UTF-8 (no Byte Order Mark) or PixInsight rejects it
- **SHA1 validation**: Build script auto-calculates; never manually edit ZIPs or `updates.xri`
- **Relative includes**: PJSR `#include` paths are relative to main script location
- **Global scope**: PJSR doesn't have module isolation - use unique variable names to avoid conflicts
- **Case-sensitive FITS keywords**: Use `readKeyword()` helper for case-insensitive lookup
- **File co-location**: All `#include`d modules must be in the same directory as the main script
