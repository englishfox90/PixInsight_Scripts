# AstroBin Export - PixInsight Update Repository Package

## ✅ Implementation Complete

This document summarizes the successful implementation of PixInsight Update Repository support for the AstroBin Export tool.

## What Was Implemented

### 1. Documentation
- **`docs/ASTROBIN_STRUCTURE.md`** - Detailed documentation of file structure and dependencies
- **`docs/QUICK_REFERENCE.md`** - Quick reference guide for users and developers

### 2. Build Infrastructure
- **`package.json`** - NPM configuration with build script
- **`tools/build-astrobin-package.mjs`** - Automated build script that:
  - Creates proper PixInsight directory structure
  - Copies all required files
  - Generates ZIP package
  - Calculates SHA1 hash
  - Updates `updates.xri` with metadata
  - Cleans up temporary files

### 3. Update Repository
- **`updates/`** directory containing:
  - `updates.xri` - PixInsight repository manifest
  - `AstroBinExport-1.0.0-20251129.zip` - Initial package release

### 4. Updated Documentation
- **`README.md`** - Enhanced with:
  - Clear installation options (Update Repository vs Manual)
  - Repository URL for PixInsight
  - Developer guide with release process
  - Build troubleshooting

### 5. Configuration Updates
- **`.gitignore`** - Excludes `build/` and `node_modules/`

## Package Details

**Current Version:** 1.0.0  
**Release Date:** 2025-11-29  
**Package Size:** 46.84 KB  
**SHA1 Hash:** 0d8c35fd33ddd9081c050a3fc3b61394e11addaf

### Files Included

**Scripts (src/scripts/AstroBin/):**
1. AstroBin_CSV_Export_v3_Modular.js (main entry point)
2. AstroBin-core.js
3. AstroBin-filter-database.js
4. AstroBin-analysis.js
5. AstroBin-gui.js
6. AstroBin-gui-methods.js

**Resources (rsc/AstroBin/):**
1. astrobin_filters.csv

### Files Excluded
- `archive/` subdirectory (contains old versions)

## Installation URLs

### For PixInsight Update Repository
```
https://raw.githubusercontent.com/englishfox90/PixInsight_Scripts/main/updates/
```

**Note:** Update the GitHub username if different when pushing to your repository.

## Verification Results

✅ Package structure verified:
- All JavaScript files in `src/scripts/AstroBin/`
- CSV file in `rsc/AstroBin/`
- Relative #include statements work correctly
- No archive files included

✅ updates.xri validated:
- Correct SHA1 hash
- Correct file size
- Proper XML structure
- All required metadata present

## How to Use

### For End Users
1. Add repository URL in PixInsight
2. Check for updates
3. Install AstroBin Export
4. Access via `Script → PFRAstro → AstroBin Export`

### For Developers
```powershell
# Build new package
npm run build:astrobin

# Build with specific version
npm run build:astrobin -- --version=1.1.0

# Commit and push
git add updates/
git commit -m "Release AstroBin Export v1.0.0"
git push origin main
```

## Compatibility

### With Manual Installation
- ✅ Original `AstroBin Export/` folder remains unchanged
- ✅ Users can still manually install by copying files
- ✅ No breaking changes to existing workflows

### With PixInsight
- ✅ Minimum version: PixInsight 1.8.0+
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Proper feature registration: `AstroBinExport : PFRAstro > AstroBin Export`

## Future Enhancements

Potential improvements for future releases:

1. **Multiple Tool Packages**
   - BlinkPlus package
   - Pixel Perfect Review package
   - MasterSignature package

2. **Automated Versioning**
   - Read version from script header
   - Automatic version bumping

3. **CI/CD Integration**
   - GitHub Actions for automated builds
   - Automatic package generation on tag/release

4. **Enhanced Testing**
   - Automated package validation
   - Integration tests with PixInsight

## Notes

- Only AstroBin Export is currently packaged (as requested)
- Other tools (BlinkPlus, Pixel Perfect Review, PJSR, Signature) remain manual-install only
- Build script is cross-platform compatible (uses PowerShell for ZIP creation on Windows)
- Package structure follows PixInsight conventions

## Success Criteria Met

✅ Manual installation still works  
✅ Update repository package created  
✅ Build automation implemented  
✅ Documentation complete  
✅ updates.xri properly configured  
✅ Package structure verified  
✅ No breaking changes to existing functionality

## Contact & Support

For issues with the build process or package installation, refer to:
- `docs/ASTROBIN_STRUCTURE.md` for technical details
- `docs/QUICK_REFERENCE.md` for quick instructions
- README.md "Developer Guide" section for build process
