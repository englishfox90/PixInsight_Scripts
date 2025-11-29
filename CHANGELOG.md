# Changelog - AstroBin Export

All notable changes to the AstroBin Export package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-29

### Added
- Initial PixInsight Update Repository package release
- Automated build system with `npm run build:astrobin`
- updates.xri manifest file for PixInsight integration
- Comprehensive documentation in `docs/` directory
- Quick reference guide for users and developers

### Package Contents
- AstroBin_CSV_Export_v3_Modular.js (main script)
- AstroBin-core.js (core utilities)
- AstroBin-filter-database.js (200+ filter database)
- AstroBin-analysis.js (FITS analysis)
- AstroBin-gui.js (GUI components)
- AstroBin-gui-methods.js (GUI methods)
- astrobin_filters.csv (legacy CSV data)

### Features (from v3 Modular)
- Automatic FITS header analysis
- 200+ filters across 22+ manufacturers
- Personal LRGB + SHO filter set support
- Filter ID auto-suggestion with precedence
- Selectable/persistent CSV columns
- Improved SQM derivation with correct formula
- Raw frame filtering (excludes masters/calibrated/integrations)
- Manual filter ID entry support
- Bortle scale integration
- Integration summary statistics

### Installation Methods
- PixInsight Update Repository (recommended)
- Manual installation (traditional method)

### Notes
- First official release as PixInsight package
- Maintains backward compatibility with manual installation
- Archive folder excluded from package distribution

---

## Template for Future Releases

## [Unreleased]

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security updates

---

## Version Guidelines

**MAJOR.MINOR.PATCH (X.Y.Z)**

- **MAJOR** - Incompatible API changes or major feature overhauls
- **MINOR** - New functionality in a backward-compatible manner
- **PATCH** - Backward-compatible bug fixes

### Examples:
- `1.0.0` → `1.0.1` - Bug fix
- `1.0.1` → `1.1.0` - New feature added
- `1.1.0` → `2.0.0` - Breaking changes

### Updating Version

When releasing a new version:

1. Update this CHANGELOG.md with changes
2. Run build with new version:
   ```powershell
   npm run build:astrobin -- --version=X.Y.Z
   ```
3. Commit changes:
   ```powershell
   git add .
   git commit -m "Release AstroBin Export vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```

---

[1.0.0]: https://github.com/englishfox90/PixInsight_Scripts/releases/tag/v1.0.0
