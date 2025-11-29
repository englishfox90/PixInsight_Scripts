# AstroBin Export Tool - Structure Documentation

## Overview

The AstroBin Export tool is a modular PixInsight script that generates CSV files compatible with AstroBin's bulk acquisition upload feature. This document describes the file structure and dependencies.

## Active Runtime Files

The following files are required for the AstroBin Export tool to function:

### Main Entry Point
- **AstroBin_CSV_Export_v3_Modular.js** - Main script file that PixInsight executes
  - Registers as feature ID: `AstroBinExport : PFRAstro > AstroBin Export`
  - Coordinates all modules and launches the main dialog

### Core Modules (all required at runtime)
- **AstroBin-core.js** - Core data structures and utilities
- **AstroBin-filter-database.js** - Filter database with 200+ filters from 22+ manufacturers
- **AstroBin-analysis.js** - FITS file analysis and metadata extraction
- **AstroBin-gui.js** - Main GUI dialog construction
- **AstroBin-gui-methods.js** - GUI helper methods and event handlers

### Data Files
- **astrobin_filters.csv** - CSV filter database (legacy, kept for reference but not actively loaded by v3)

## Excluded from Package

### Archive Directory
The `archive/` subdirectory contains older versions and experimental code:
- astro_bin_acquisitions_csv_builder_from_wbpp_calibrated_pjsr.js
- astro_bin_acquisitions_csv_builder_from_wbpp_calibrated_v2.js
- AstroBin_CSV_Export_Enhanced_v2.1_fixed.js
- AstroBin_CSV_Export_Enhanced_v2.1.js
- AstroBin_CSV_Export_Enhanced_v3.0.js
- AstroBin_CSV_Export_Simple.js
- astrobin_csv_export_tool.js
- AstroBin_CSV_Export_v2.1_Modular.js
- AstroBin_CSV_Export_v2.js
- astrobin_export_enhanced.js
- AstroBin-filter-database-cleaned.js

**These files are NOT included in the PixInsight package distribution.**

## Module Dependencies

The main script (`AstroBin_CSV_Export_v3_Modular.js`) includes the following PJSR libraries:
```javascript
#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/Color.jsh>
#include <pjsr/FontFamily.jsh>
#include <pjsr/DataType.jsh>
```

And includes these local modules:
```javascript
#include "AstroBin-core.js"
#include "AstroBin-filter-database.js"
#include "AstroBin-analysis.js"
#include "AstroBin-gui.js"
#include "AstroBin-gui-methods.js"
```

## Package Layout for Distribution

When packaged for PixInsight Update Repository, files are organized as:

```
src/scripts/AstroBin/
├── AstroBin_CSV_Export_v3_Modular.js
├── AstroBin-core.js
├── AstroBin-filter-database.js
├── AstroBin-analysis.js
├── AstroBin-gui.js
└── AstroBin-gui-methods.js

rsc/AstroBin/
└── astrobin_filters.csv
```

This structure:
- Groups all JavaScript files under `src/scripts/AstroBin/` so PixInsight can find the includes
- Places the CSV data file under `rsc/AstroBin/` for resource data
- Maintains relative include paths from the main script

## Version Information

Current version: **v3.0** (Modular)
- Last major update: September 23, 2025
- Features: 200+ filter database, personal filter sets, selectable CSV columns, correct SQM formula, raw frame filtering

## Key Features

- Automatic FITS header analysis
- Comprehensive filter database (200+ filters across 22 manufacturers)
- Personal LRGB + SHO filter set support
- Filter ID auto-suggestion with precedence
- Selectable/persistent CSV columns
- Improved SQM derivation
- Raw frame filtering (excludes masters/calibrated/integrations)
- Manual filter ID entry support
- Bortle scale integration
- Integration summary statistics

## Manual Installation

For users who prefer manual installation (not using PixInsight Update Repository):

1. Copy the entire `AstroBin Export/` directory to your preferred location
2. In PixInsight, go to `Script → Feature Scripts...`
3. Click `Add` and navigate to `AstroBin_CSV_Export_v3_Modular.js`
4. The script will appear under `PFRAstro > AstroBin Export` menu

## Notes

- The main script uses relative `#include` statements, so all module files must be in the same directory
- The CSV file is legacy but kept for potential future use or reference
- Archive files are maintained in the repository for historical purposes but should not be distributed
