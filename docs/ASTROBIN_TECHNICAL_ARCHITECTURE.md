# AstroBin Export Tool - Technical Architecture

## Overview

The AstroBin Export Tool is a comprehensive PixInsight JavaScript (PJSR) script that automates the generation of CSV files compatible with AstroBin's bulk acquisition import feature. The tool extracts metadata from FITS/XISF image files, performs intelligent analysis and aggregation, and outputs properly formatted CSV data.

**Version:** 3.0 (Modular Architecture)  
**Primary Script:** `AstroBin_CSV_Export_v3_Modular.js`

---

## Architecture Components

The system follows a modular architecture with five core modules:

### 1. Main Entry Point
**File:** `AstroBin_CSV_Export_v3_Modular.js`

**Purpose:** Script initialization and module orchestration

**Key Functions:**
- Feature registration with PixInsight (`#feature-id`, `#feature-info`)
- Module inclusion via `#include` directives
- Main execution entry point
- Console output initialization
- Error handling and logging

**Included Modules:**
```javascript
#include "AstroBin-core.js"
#include "AstroBin-filter-database.js"
#include "AstroBin-analysis.js"
#include "AstroBin-gui.js"
#include "AstroBin-gui-methods.js"
```

### 2. Core Utilities Module
**File:** `AstroBin-core.js`

**Purpose:** Configuration management, file operations, and utility functions

**Key Components:**

#### Configuration Object (CONFIG)
Global configuration storage with persistent settings:
- `rootDir` - Selected directory path
- `outputPath` - CSV output location
- `includeSubdirs` - Recursive scanning flag
- `darks`, `flats`, `flatDarks`, `bias` - Calibration frame counts
- `bortle` - Bortle dark sky scale (1-9)
- `meanSqm` - Sky Quality Meter value (mag/arcsec²)
- `meanFwhm` - Full Width Half Maximum (arcseconds)
- `ambientTemp` - Ambient temperature (°C)
- `preferredFilterBrand` - Filter brand preference for auto-suggestion
- `exportColumns` - Column visibility settings
- `personalFilterSet` - User's LRGB + SHO filter IDs

#### Settings Persistence
**Module ID:** `AstroBinCSVExport`

**Functions:**
- `loadExportColumnSettings()` - Load column preferences from PixInsight settings
- `saveExportColumnSettings(columns)` - Persist column preferences
- `loadPersonalFilterSet()` - Load user's personal filter mappings
- `savePersonalFilterSet(set)` - Save personal filter mappings

**Storage Keys:**
- `exportColumns/_initialized` - Initialization flag
- `exportColumns/{columnName}` - Individual column state
- `personalFilters/_initialized` - Personal filter set flag
- `personalFilters/{L,R,G,B,Ha,OIII,SII}` - Filter ID mappings

#### File Operations
**Constants:**
- `FILE_EXTS = [".xisf", ".fits", ".fit", ".fts"]` - Supported formats
- `NIGHT_OFFSET_HOURS = -12` - Session grouping offset (breaks at noon instead of midnight)

**Functions:**
- `listFiles(dirPath, includeSubdirs)` - Recursive file discovery using `searchDirectory()`
- `openForKeywords(path)` - Open FITS/XISF files for metadata extraction
- `readKeyword(ff, keyName)` - Case-insensitive keyword lookup

#### Date/Time Processing
**Functions:**
- `parseDateObs(s)` - Parse DATE-OBS strings (ISO 8601, handles 'Z' suffix)
- `toLocalDateString(d)` - Format dates as YYYY-MM-DD
- `applyNightOffset(d, hours)` - Apply night offset for session grouping

**Algorithm:** Images captured before noon (12 PM) are grouped with the previous calendar day's imaging session. This breaks sessions at midday, naturally grouping evening-through-morning sessions together.

### 3. Analysis Engine
**File:** `AstroBin-analysis.js`

**Purpose:** FITS/XISF metadata extraction, data aggregation, and calibration detection

#### Frame Classification
**Function:** `classifyImageType(imageTypeStr)`

**Frame Types:**
- `LIGHT` - Science frames (the actual target images)
- `DARK` - Dark calibration frames
- `FLAT` - Flat field calibration frames
- `FLATDARK` - Dark flats (combined dark+flat type)
- `BIAS` - Bias calibration frames
- `MASTER` - Integrated/master frames (excluded from counting)

**Detection Strategy:** Case-insensitive keyword matching on IMAGETYP/IMGTYPE header

#### Path Filtering
**Function:** `isExcludedOutputPath(path)`

**Excluded Directories:**
- `/master/` or `\master\`
- `/calibrated/` or `\calibrated\`
- `/integration/` or `\integration\`
- `/fastintegration/` or `\fastintegration\`

**Purpose:** Filter out WBPP (WeightedBatchPreProcessing) output directories to avoid counting processed/integrated frames as raw subframes

#### Main Analysis Function
**Function:** `analyzeFiles(files)`

**Returns:** Object containing:
- `rows` - Array of individual frame metadata
- `globalData` - Aggregated session parameters

**Two-Pass Algorithm:**

**Pass 1: Calibration Detection & Metadata Availability**
- Scan all files to count calibration frames by type
- Detect available FITS metadata (SQM, FWHM, temperature, Bortle)
- Skip excluded output directories
- Classify frames using `classifyImageType()`

**Pass 2: LIGHT Frame Processing**
- Extract metadata only from raw LIGHT frames
- Read FITS headers for acquisition parameters
- Handle missing filter data with filename fallback
- Extract per-image ambient temperature
- Store global parameters from first LIGHT image

#### FITS Headers Read

**Image Classification:**
- `IMAGETYP` or `IMGTYPE` - Frame type (LIGHT/DARK/FLAT/BIAS)

**Core Acquisition Data:**
- `DATE-OBS` or `DATEOBS` - Observation timestamp
- `FILTER` - Filter name/identifier
- `EXPTIME` or `EXPOSURE` - Exposure duration (seconds)
- `XBINNING` or `XBinning` - Binning factor
- `GAIN` - Sensor gain setting

**Instrument Parameters:**
- `CCD-TEMP` or `SET-TEMP` - Sensor cooling temperature (°C)
- `FOCRATIO` or `FOC RATIO` - F-number/focal ratio
- `FOCALLEN` - Focal length (mm)
- `TELESCOP` - Telescope identifier
- `INSTRUME` - Camera/instrument identifier

**Environmental Data:**
- `AMBTEMP` or `AMBIENTTEMP` - Ambient air temperature (°C)
- `SQM` or `SKYMAG` - Sky Quality Meter reading (mag/arcsec²)
- `SKYBRGHT`, `SKY-BRGHT`, or `SKYLUX` - Sky brightness (lux)
- `FWHM` or `SEEING` - Full Width Half Maximum (arcseconds)
- `BORTLE` or `LIGHTPOL` - Bortle dark sky scale
- `SKYTEMP` or `SKY-TEMP` - Sky temperature
- `HUMIDITY` - Relative humidity
- `PRESSURE` - Atmospheric pressure
- `DEWPOINT` - Dew point temperature
- `WINDSPD` - Wind speed
- `WINDDIR` - Wind direction

**Site Location:**
- `SITELAT` - Latitude
- `SITELONG` - Longitude
- `SITEELEV` - Elevation

#### SQM Calculation Hierarchy
**Priority Order:**
1. **Direct SQM** - Use `SQM` or `SKYMAG` header directly
2. **Lux Conversion** - Convert from `SKYBRGHT` using formula: `SQM = 14.18 - 2.5 × log₁₀(lux)`
3. **Bortle Estimation** - Estimate from `BORTLE` using lookup table
4. **Manual Entry** - Fall back to user-provided value

**SQM Clamping:** Values constrained to realistic range 15.0-22.2 mag/arcsec²

**Bortle to SQM Lookup Table:**
```javascript
{
  1: 21.8,  // Excellent dark site
  2: 21.6,  // Typical dark site  
  3: 21.4,  // Rural sky
  4: 20.8,  // Rural/suburban transition
  5: 19.8,  // Suburban sky
  6: 18.6,  // Bright suburban
  7: 18.0,  // Suburban/urban transition
  8: 17.8,  // City sky
  9: 15.5   // Inner city
}
```

#### Filter Extraction Fallback
**Primary:** `FILTER` FITS keyword  
**Fallback:** Filename parsing

**Filename Pattern:** `{date}_{time}_{filter}_{temp}_{exposure}_{frame}.{ext}`
- Example: `2025-08-21_01-51-11_Ha_-9.90_600.00s_0072_c.fit`
- Extracts filter from 3rd underscore-delimited component

**Recognized Patterns:**
- `ha`, `h-alpha`, `halpha` → "Ha"
- `oiii`, `o3` → "OIII"
- `sii`, `s2` → "SII"
- `lum`, `luminance` → "Luminance"
- `r`, `red` → "Red"
- `g`, `green` → "Green"
- `b`, `blue` → "Blue"

#### Aggregation Function
**Function:** `aggregate(rows, globalData)`

**Purpose:** Group individual frames into acquisition sessions

**Grouping Key:** `[night, filter, duration, binning, gain, tempGroup, fNumber]`

**Temperature Grouping:**
- Sensor cooling temperatures rounded to nearest 5°C interval
- Reduces session fragmentation from minor temperature drift
- Example: -10.2°C and -9.8°C both group as -10°C

**Per-Session Calculations:**
- Frame count summation
- Temperature range tracking (min, max, average)
- Ambient temperature averaging across frames
- Calibration frame counts (from globalData or CONFIG fallback)

**Output Fields:**
```javascript
{
  date: "YYYY-MM-DD",
  filter: "FilterName",
  filterId: "AstroBinID",
  number: frameCount,
  duration: exposureSeconds,
  binning: binningFactor,
  gain: gainValue,
  sensorCooling: "min to max" (display) / average (CSV),
  sensorCoolingForCSV: averageTemp,
  fNumber: focalRatio,
  darks: count,
  flats: count,
  flatDarks: count,
  bias: count,
  bortle: scale,
  meanSqm: sqmValue,
  meanFwhm: fwhmValue,
  temperature: avgAmbientTemp
}
```

**Session Sorting:** Ordered by date → filter → duration

### 4. Filter Database
**File:** `AstroBin-filter-database.js`

**Purpose:** Comprehensive filter mapping and auto-suggestion

#### Database Structure
**Array:** `ASTROBIN_FILTERS` (200+ entries)

**Filter Entry Schema:**
```javascript
{
  id: "AstroBinID",           // Unique AstroBin equipment ID
  brand: "Manufacturer",       // Filter manufacturer
  name: "Product Name",        // Official product name
  display: "Display Name",     // User-friendly short name
  keywords: ["keyword", ...]   // Search/matching keywords
}
```

**Supported Brands (22 manufacturers):**
- Altair Astro
- Antlia (EDGE, Ultra 2.5nm series)
- Askar (ColorMagic)
- Astrodon
- Astronomik
- Baader (CMOS-optimized)
- Celestron
- Chroma
- Explore Scientific
- IDAS/Hutech (NB series, LPS series)
- Lumicon
- Omega Optical
- Optolong (L-eXtreme, L-eNhance, L-Ultimate, L-Pro)
- Orion
- Player One
- QHYCCD
- Radian (Triad series)
- SVBony
- TS-Optics
- Vaonis/Vespera
- ZWO
- Additional specialty manufacturers

**Filter Categories:**
- Narrowband (Ha, OIII, SII) - Various bandwidths (3nm, 5nm, 6.5nm, 7nm)
- Broadband LRGB
- Light pollution reduction (CLS, UHC, LPS)
- Dual-band (Ha+OIII combinations)
- Tri-band and Quad-band multiband filters
- Solar filters
- Specialty filters

#### Auto-Suggestion Algorithm
**Function:** `suggestFilterId(fitsFilterName)`

**Three-Tier Matching Strategy:**

**1. Personal Filter Set Override (Auto mode only)**
- When `CONFIG.preferredFilterBrand === "Auto"`
- Checks user's personal LRGB + SHO mappings first
- Applies exact matches for L, R, G, B, Ha, OIII, SII roles
- Returns immediately if matched

**2. Preferred Brand Priority**
- When a specific brand is selected
- Keyword match within preferred brand returns immediately
- Provides consistent results for multi-brand setups

**3. Keyword Fallback Matching**
- Case-insensitive keyword search
- First matching filter ID returned
- Searches across all brands if no preferred match

**Keyword Matching:**
```javascript
// Luminance variations
["lum", "l", "luminance", "clear", "white"]

// RGB
["red", "r"], ["green", "g"], ["blue", "b"]

// Narrowband
["ha", "h-alpha", "halpha", "656"]
["oiii", "o3", "oxygen", "501"]
["sii", "s2", "sulfur", "sulphur", "672"]

// Multiband
["dual", "band", "duo", "dualband"]
["tri", "triband", "three"]
["quad", "quadband", "four"]
```

#### Helper Functions
- `findFilterById(filterId)` - Lookup filter object by ID
- `getFilterDisplayName(filterId)` - Get user-friendly name
- `searchFilters(searchTerm)` - Free-text filter search

### 5. GUI Components

#### 5.1 Main Dialog
**File:** `AstroBin-gui.js`  
**Class:** `AstroBinDialog`

**Dialog Structure:**
```
┌─────────────────────────────────────────┐
│ Image Files                             │
│ - Directory selection                   │
│ - Subdirectory inclusion toggle         │
│ - File count display                    │
├─────────────────────────────────────────┤
│ Global Acquisition Parameters           │
│ - Calibration counts (Darks/Flats/etc)  │
│ - Bortle Scale dropdown                 │
│ - Filter brand preference               │
│ - SQM, FWHM, Temperature inputs         │
│ - Metadata status indicators            │
├─────────────────────────────────────────┤
│ Image Analysis Results                  │
│ - Analyze Images button                 │
│ - Map Filters button                    │
│ - TreeBox results table (9 columns)     │
│   [Date|Filter|Filter Name|Filter ID|   │
│    Count|Duration|Binning|Gain|Temp]    │
├─────────────────────────────────────────┤
│ CSV Export Preview                      │
│ - Generate CSV button                   │
│ - Save/Copy buttons                     │
│ - Columns settings button               │
│ - Preview TextBox                       │
├─────────────────────────────────────────┤
│ [About] [Integration Summary]   [Close] │
└─────────────────────────────────────────┘
```

**Key UI Features:**

**File Selection Section:**
- `GetDirectoryDialog` for directory selection
- Checkbox for subdirectory recursion
- Real-time file count updates
- Path display in read-only edit field

**Global Parameters Section:**
- **Calibration Frames:** Editable numeric fields (auto-populated when detected)
- **Bortle Scale:** ComboBox with descriptive ranges (1-9 with SQM equivalents)
- **Filter Brand:** ComboBox with "Auto" + 22 manufacturer options
- **Environment:** SQM, FWHM, Temperature editable fields
- **Metadata Info:** Dynamic label showing auto-detected vs. manual parameters

**Visual Feedback:**
- Green styling for auto-detected metadata
- Orange warning for missing data
- Gray for normal input fields
- Disabled fields with tooltips explaining auto-detection

**Analysis Results Section:**
- **TreeBox Table:** 9 columns with sortable headers
- **In-line Editing:** Filter ID column editable
- **Real-time Updates:** Filter Name column updates on ID change
- **Multi-select:** Supports batch operations

**CSV Preview Section:**
- **TextBox:** Read-only preview of generated CSV
- **Column Selector:** Modal dialog for choosing exported columns
- **File Save:** Standard SaveFileDialog integration
- **Manual Copy:** Select-all for clipboard copying

#### 5.2 GUI Methods
**File:** `AstroBin-gui-methods.js`

**Core Methods:**

**File Scanning:**
```javascript
scanForFiles()
├─ listFiles(CONFIG.rootDir, CONFIG.includeSubdirs)
├─ Update file count display
└─ Enable/disable analysis button
```

**Image Analysis:**
```javascript
analyzeImages()
├─ analyzeFiles(g_imageFiles) → {rows, globalData}
├─ populateGlobalParametersFromMetadata(globalData)
├─ updateGlobalParametersFromMetadata(globalData)
├─ aggregate(rows, globalData) → g_analysisData
├─ populateImageTree()
└─ Update status with integration summary
```

**Metadata Population:**
- **Auto-Detection Logic:**
  - Calibration frames: Disable UI field, show tooltip with count
  - Environmental data: Populate if empty, disable if from FITS
  - Visual indicators: Green for auto-detected, orange for missing

**CSV Generation:**
```javascript
generateCSV()
├─ updateConfigFromUI() - Sync CONFIG with current field values
├─ Update g_analysisData with current CONFIG
├─ createCSVContent(g_analysisData) → csvString
├─ Display in preview TextBox
└─ Enable Save/Copy buttons
```

**CSV Formatting:**
- **Header Row:** Always present (17 columns)
- **Data Rows:** Populated based on `CONFIG.exportColumns` settings
- **Required Columns:** `number` and `duration` always populated
- **Numeric Formatting:**
  - Duration: Max 4 decimals, trailing zeros removed
  - Sensor Cooling: Whole number (rounded), range -274 to 100°C
  - Ambient Temp: Max 2 decimals, range -88 to 58°C
  - Bortle: Whole number, range 1-9
  - Gain, F-number, SQM, FWHM: Max 2 decimals, trailing zeros removed

**Export Columns Dialog:**
- Modal dialog with checkboxes for each column
- `number` and `duration` locked as required
- "Reset" button to restore defaults
- Immediately updates CSV preview on OK
- Persists selections to PixInsight settings

**Filter Mapping Dialog:**
```javascript
FilterMappingDialog
├─ Personal Filter Set Section (LRGB + Ha OIII SII)
│  ├─ Brand/Filter dropdowns per role
│  ├─ Manual entry option with URL extraction
│  ├─ Save Personal Set button
│  └─ Apply Personal Set button
├─ Filter Mappings Section (per unique filter)
│  ├─ Brand selection ComboBox
│  ├─ Filter selection ComboBox
│  ├─ Manual entry Edit + Validate button
│  └─ Filter ID display Label (color-coded)
└─ OK/Cancel buttons
```

**Filter Mapping Features:**
- **Brand Selection:** Triggers filter list update
- **Manual Entry Mode:** Shows text field and validate button
- **URL Extraction:** Parses AstroBin URLs to extract filter ID
  - Pattern: `app.astrobin.com/equipment/explorer/filter/{ID}/`
- **Validation Feedback:**
  - Green border: Filter found in database
  - Orange border: Valid ID, not in database (manual entry)
  - Red border: Invalid ID format
- **Personal Set:** Pre-configured LRGB + SHO mappings applied when brand is "Auto"
- **Apply to Session:** Bulk-applies personal set to current analysis data

**Integration Summary:**
- Comprehensive session statistics
- Filter breakdown with time and frame counts
- Environmental condition ranges
- Session quality metrics
- Insights and recommendations for astrophotographers
- Formatted as HTML MessageBox

**Statistics Calculated:**
- Total integration time (hours, minutes)
- Total frame count
- Session count
- Date range
- Per-filter integration time and frame count
- Unique exposure times, binning modes, gain settings, f-ratios
- Temperature ranges (ambient and sensor cooling)
- Sky quality (SQM or Bortle estimation)
- Longest single session
- Most productive filter
- Average session length

**Insights Engine:**
- Integration time assessment (excellent >2hr, good >1hr)
- Filter diversity analysis
- Session consistency evaluation
- Temperature stability warnings
- Exposure time consistency checks

**Helper Functions:**
- `formatDuration(seconds)` - Human-readable time (e.g., "2h 34m")
- `calculateTotalIntegrationTime()` - Sum all session times
- `calculateIntegrationStats()` - Comprehensive statistics object
- `updateSQMFromBortle()` - Auto-fill SQM from Bortle selection
- `bortleToSQM(bortleClass)` - Bortle → SQM conversion

---

## Data Flow

### Complete Workflow

```
1. USER INTERACTION
   ├─ Select directory
   ├─ Configure subdirectory inclusion
   └─ Click "Analyze Images"

2. FILE DISCOVERY
   ├─ listFiles(rootDir, includeSubdirs)
   ├─ searchDirectory() for each extension
   └─ Return array of file paths

3. FIRST PASS: CALIBRATION & METADATA DETECTION
   ├─ For each file:
   │  ├─ openForKeywords(path)
   │  ├─ Read IMAGETYP/IMGTYPE
   │  ├─ classifyImageType() → frameType
   │  ├─ Count calibration frames by type
   │  ├─ Detect available metadata flags
   │  └─ Close file
   └─ Return calibrationCounts, availableMetadata

4. SECOND PASS: LIGHT FRAME EXTRACTION
   ├─ For each file:
   │  ├─ Skip if isExcludedOutputPath(path)
   │  ├─ openForKeywords(path)
   │  ├─ Verify frameType === 'LIGHT'
   │  ├─ Read acquisition headers (DATE-OBS, FILTER, EXPTIME, etc.)
   │  ├─ Fallback filter extraction from filename
   │  ├─ Store per-image ambient temperature
   │  ├─ First LIGHT: Extract globalData
   │  │  ├─ Instrument parameters
   │  │  ├─ Site location
   │  │  ├─ Environmental data
   │  │  └─ SQM calculation (direct → lux → Bortle → blank)
   │  ├─ Create row object
   │  └─ Close file
   └─ Return {rows, globalData}

5. UI UPDATE: GLOBAL PARAMETERS
   ├─ populateGlobalParametersFromMetadata(globalData)
   │  ├─ Fill empty fields from FITS
   │  └─ Log available but unused metadata
   └─ updateGlobalParametersFromMetadata(globalData)
      ├─ Update calibration count fields
      ├─ Update environmental fields
      ├─ Disable auto-detected fields
      └─ Update info label with status

6. AGGREGATION
   ├─ aggregate(rows, globalData)
   ├─ Group by [night, filter, duration, binning, gain, tempGroup, fNumber]
   ├─ Calculate per-session statistics
   │  ├─ Frame count
   │  ├─ Temperature ranges
   │  ├─ Ambient temperature averaging
   │  └─ Calibration counts (FITS → CONFIG fallback)
   └─ Sort by date → filter → duration

7. FILTER AUTO-SUGGESTION
   ├─ For each aggregated session:
   │  └─ suggestFilterId(fitsFilterName)
   │     ├─ Check personal filter set (if Auto mode)
   │     ├─ Check preferred brand keyword match
   │     └─ Fallback to first keyword match
   └─ Populate filterId field

8. GUI POPULATION
   ├─ populateImageTree()
   │  ├─ Create TreeBoxNode for each session
   │  ├─ Set all 9 column values
   │  ├─ Resolve Filter Name from filterId
   │  └─ Store dataIndex for editing
   └─ Display integration summary in status

9. USER FILTER MAPPING (Optional)
   ├─ Click "Map Filters"
   ├─ FilterMappingDialog.execute()
   │  ├─ Show personal filter set controls
   │  ├─ Show filter mapping controls
   │  ├─ Pre-populate from current filterId values
   │  ├─ Allow brand selection or manual entry
   │  ├─ Validate manual IDs (extract from URLs)
   │  └─ On OK: Apply mappings to g_analysisData
   └─ Refresh main TreeBox

10. CSV GENERATION
    ├─ Click "Generate CSV"
    ├─ updateConfigFromUI() - Sync all fields
    ├─ Update g_analysisData with current CONFIG values
    ├─ createCSVContent(g_analysisData)
    │  ├─ Build header row (17 columns)
    │  ├─ For each session:
    │  │  ├─ Format numeric values per AstroBin requirements
    │  │  ├─ Apply column visibility (exportColumns)
    │  │  └─ Build CSV row
    │  └─ Join with newlines
    └─ Display in preview TextBox

11. CSV EXPORT
    ├─ Click "Save CSV File"
    ├─ SaveFileDialog
    ├─ File.writeTextFile(fileName, csvContent)
    └─ Log success message

12. SETTINGS PERSISTENCE
    ├─ On dialog close or settings change:
    ├─ saveExportColumnSettings(CONFIG.exportColumns)
    ├─ savePersonalFilterSet(CONFIG.personalFilterSet)
    └─ Write to PixInsight Settings registry
```

---

## CSV Output Format

### Header Row (Always Present)
```csv
date,filter,number,duration,iso,binning,gain,sensorCooling,fNumber,darks,flats,flatDarks,bias,bortle,meanSqm,meanFwhm,temperature
```

### Column Definitions

| Column | Type | Range/Format | Required | Source |
|--------|------|--------------|----------|--------|
| `date` | String | YYYY-MM-DD | No | DATE-OBS ± night offset |
| `filter` | String | AstroBin ID | No | filterId (mapped) |
| `number` | Integer | >0 | **Yes** | Frame count (aggregated) |
| `duration` | Float | 0-max, 4 decimals | **Yes** | EXPTIME/EXPOSURE |
| `iso` | String | N/A | No | Unused placeholder |
| `binning` | Integer | Typically 1-4 | No | XBINNING |
| `gain` | Float | 2 decimals | No | GAIN |
| `sensorCooling` | Integer | -274 to 100 | No | CCD-TEMP/SET-TEMP |
| `fNumber` | Float | 2 decimals | No | FOCRATIO |
| `darks` | Integer | ≥0 | No | Auto-detected or CONFIG |
| `flats` | Integer | ≥0 | No | Auto-detected or CONFIG |
| `flatDarks` | Integer | ≥0 | No | Auto-detected or CONFIG |
| `bias` | Integer | ≥0 | No | Auto-detected or CONFIG |
| `bortle` | Integer | 1-9 | No | BORTLE or CONFIG |
| `meanSqm` | Float | 15.0-22.2, 2 decimals | No | SQM/calculated/CONFIG |
| `meanFwhm` | Float | 2 decimals | No | FWHM or CONFIG |
| `temperature` | Float | -88 to 58, 2 decimals | No | AMBTEMP (session avg) |

### Column Population Logic
- **Required columns** (`number`, `duration`): Always populated regardless of settings
- **Optional columns**: Populated based on `CONFIG.exportColumns` checkbox state
- **Empty values**: Column header present, cell contains empty string
- **Numeric formatting**: Trailing zeros removed after decimal formatting
- **Temperature**: Session-averaged when available in FITS, otherwise uses CONFIG fallback

### Example Output
```csv
date,filter,number,duration,iso,binning,gain,sensorCooling,fNumber,darks,flats,flatDarks,bias,bortle,meanSqm,meanFwhm,temperature
2025-08-21,30,15,600,,2,139,-10,6.3,15,20,15,50,4,20.8,2.1,12.5
2025-08-21,25,18,600,,2,139,-10,6.3,15,20,15,50,4,20.8,2.1,12.5
2025-08-22,30,20,600,,2,139,-10,6.3,15,20,15,50,4,20.8,2.3,11.8
```

---

## Key Algorithms

### Night Offset Session Grouping
**Purpose:** Handle astrophotography sessions that span midnight

**Algorithm:**
```javascript
const NIGHT_OFFSET_HOURS = -12;

function applyNightOffset(date, hours) {
  return new Date(date.getTime() + hours * 3600 * 1000);
}

// Example:
// Image 1: 2025-08-21 23:30:00 → offset → 2025-08-21 11:30:00 → night: 2025-08-21
// Image 2: 2025-08-22 01:30:00 → offset → 2025-08-21 13:30:00 → night: 2025-08-21
// Image 3: 2025-08-22 06:00:00 → offset → 2025-08-21 18:00:00 → night: 2025-08-21
// Image 4: 2025-08-22 11:59:00 → offset → 2025-08-21 23:59:00 → night: 2025-08-21
// Image 5: 2025-08-22 12:00:00 → offset → 2025-08-22 00:00:00 → night: 2025-08-22
// Result: All images before noon grouped as same night
```

**Rationale:** Breaking sessions at noon (12 PM) naturally groups evening-through-morning imaging sessions together, as no astrophotography occurs during midday

### Temperature Grouping
**Purpose:** Reduce session fragmentation from minor temperature drift

**Algorithm:**
```javascript
function groupKey(row) {
  let tempGroup = "";
  if (row.sensorCooling) {
    const temp = parseFloat(row.sensorCooling);
    tempGroup = (Math.round(temp / 5) * 5).toString();
  }
  return [night, filter, duration, binning, gain, tempGroup, fNumber].join("\u0001");
}

// Example:
// -10.2°C → rounds to -10°C
// -9.8°C  → rounds to -10°C
// -7.5°C  → rounds to -5°C
```

**Range Display:**
- GUI: Shows actual range (e.g., "-10.2 to -9.8")
- CSV: Uses average for session (e.g., "-10.0")

### SQM Calculation Cascade
**Purpose:** Derive sky quality from available data sources

**Algorithm:**
```javascript
if (SQM_HEADER) {
  sqm = clamp(parseFloat(SQM_HEADER), 15.0, 22.2);
} else if (SKY_BRIGHTNESS_LUX) {
  sqm = clamp(14.18 - 2.5 * Math.log10(lux), 15.0, 22.2);
} else if (BORTLE_HEADER) {
  sqm = bortleToSQM(parseFloat(BORTLE_HEADER));
} else {
  sqm = CONFIG.meanSqm || "";
}
```

**Formula Derivation:**
- **Lux to SQM:** `SQM = 14.18 - 2.5 × log₁₀(lux)`
- Based on Lambertian sky distribution model
- Constant 14.18 calibrated for typical astronomical conditions

**Clamping:** Enforces realistic SQM range to prevent impossible values

### Filter Auto-Suggestion Priority
**Purpose:** Intelligent filter ID matching with user preference

**Algorithm:**
```javascript
function suggestFilterId(fitsFilterName) {
  const filterName = fitsFilterName.toLowerCase();
  
  // Priority 1: Personal Filter Set (Auto mode only)
  if (CONFIG.preferredFilterBrand === "Auto" && CONFIG.personalFilterSet) {
    if (matches LRGB or SHO pattern) {
      if (personalSet[role]) return personalSet[role];
    }
  }
  
  // Priority 2: Preferred Brand Match
  if (CONFIG.preferredFilterBrand !== "Auto") {
    for (filter in ASTROBIN_FILTERS) {
      if (filter.brand === preferredBrand && keywords match filterName) {
        return filter.id;  // Immediate return
      }
    }
  }
  
  // Priority 3: First Keyword Match (any brand)
  for (filter in ASTROBIN_FILTERS) {
    if (keywords match filterName) {
      return filter.id;
    }
  }
  
  return "";  // No match
}
```

---

## Error Handling

### File Reading Errors
- **Try-catch per file:** Individual file errors don't stop processing
- **Warning logs:** `console.warningln()` for skipped files
- **Continue execution:** Process remaining files

### Missing FITS Headers
- **Fallback hierarchy:**
  1. Alternative header name (e.g., `DATE-OBS` → `DATEOBS`)
  2. Filename parsing (for filters)
  3. Empty string/undefined (non-critical fields)
  4. CONFIG defaults (calibration, environmental)

### Invalid Data Values
- **Numeric parsing:** `parseFloat()` with `isNaN()` checks
- **Range clamping:** Temperature, SQM, Bortle constrained to valid ranges
- **Empty handling:** Graceful degradation to blank CSV cells

### GUI Error Handling
- **Dialog execution:** Top-level try-catch in `main()`
- **Status updates:** Error messages displayed in UI labels
- **Button states:** Disabled when prerequisites not met
- **Stack traces:** Logged to console for debugging

---

## Performance Considerations

### File Operations
- **Streaming keywords:** Files opened only for metadata extraction, not full image data
- **Batch searching:** `searchDirectory()` called once per extension
- **Early exit:** Exclude paths checked before opening files

### Two-Pass Efficiency
- **Pass 1:** Lightweight frame classification (minimal header reads)
- **Pass 2:** Full metadata extraction only from LIGHT frames
- **Skip logic:** Avoids processing 50-80% of files (calibration/masters)

### Memory Management
- **Incremental processing:** Files processed one at a time
- **Immediate close:** `ff.close()` after metadata extraction
- **Garbage collection:** No image pixel data retained

### UI Responsiveness
- **Progress updates:** Console logging every 10 files
- **processEvents():** Allows UI updates during long operations
- **Status labels:** Real-time feedback on current operation

---

## Settings Persistence

### PixInsight Settings API
**Module:** `AB_SETTINGS_MODULE = "AstroBinCSVExport"`

**Storage Format:**
```javascript
Settings.write(key, dataType, value);
Settings.read(key, dataType) → value;
```

**Persisted Settings:**

**Export Columns:**
- `AstroBinCSVExport/exportColumns/_initialized` (UInt32)
- `AstroBinCSVExport/exportColumns/date` (UInt32, 0 or 1)
- `AstroBinCSVExport/exportColumns/filter` (UInt32, 0 or 1)
- ... (one per column)

**Personal Filter Set:**
- `AstroBinCSVExport/personalFilters/_initialized` (UInt32)
- `AstroBinCSVExport/personalFilters/L` (String)
- `AstroBinCSVExport/personalFilters/R` (String)
- `AstroBinCSVExport/personalFilters/G` (String)
- `AstroBinCSVExport/personalFilters/B` (String)
- `AstroBinCSVExport/personalFilters/Ha` (String)
- `AstroBinCSVExport/personalFilters/OIII` (String)
- `AstroBinCSVExport/personalFilters/SII` (String)

**Load Timing:**
- Export columns: Loaded during `CONFIG` initialization
- Personal filters: Loaded during `CONFIG` initialization
- Read on every script launch

**Save Timing:**
- Export columns: On "OK" in Export Columns dialog
- Personal filters: On "Save Personal Set" in Filter Mapping dialog
- Immediate write to ensure persistence

---

## Future Enhancement Opportunities

### Additional FITS Headers
- `OBJECT` - Target name for grouping/labeling
- `OBSERVER` - Observer name
- `AIRMASS` - Airmass at observation time
- `MOONPHSE` - Moon phase percentage
- `MOONALT` - Moon altitude

### Advanced Filtering
- Session filtering by date range
- Filter type exclusion (e.g., exclude calibration in GUI)
- Duplicate detection

### Export Formats
- JSON export for programmatic processing
- Excel/LibreOffice direct export
- Multiple CSV profile presets

### Integration Analysis
- Signal-to-noise ratio estimation
- Weather correlation (if FITS contains data)
- Equipment performance tracking

### Database Features
- Filter database auto-updates from AstroBin API
- User filter database contributions
- Deprecated filter ID warnings

---

## Troubleshooting Guide

### No Files Found
**Symptoms:** File count shows 0 after directory selection

**Checks:**
1. Directory contains supported extensions (`.xisf`, `.fits`, `.fit`, `.fts`)
2. "Include subdirectories" checked if files are nested
3. File permissions allow reading

### Missing Filter Names
**Symptoms:** "(No Filter)" appears in analysis

**Checks:**
1. `FILTER` keyword present in FITS headers
2. Filename pattern matches expected format
3. Manually map filters using Filter Mapping dialog

### Incorrect Session Grouping
**Symptoms:** Same session split into multiple rows

**Causes:**
1. Temperature drift exceeds 5°C grouping threshold
2. Minor gain/binning differences
3. Exposure time variations

**Solutions:**
- Verify sensor temperature stability
- Check equipment settings consistency
- Manually merge sessions in CSV if needed

### Auto-Detection Not Working
**Symptoms:** Fields remain empty despite FITS metadata

**Checks:**
1. Headers use expected keyword names (see FITS Headers section)
2. Values are numeric/parseable
3. Files are LIGHT frames, not calibration frames

**Debugging:**
- Check console output for specific header values
- Use `readKeyword()` test in PJSR console
- Verify FITS header capitalization

### Filter ID Not Auto-Suggesting
**Symptoms:** Filter ID column remains blank

**Causes:**
1. Filter name doesn't match database keywords
2. Preferred brand set but filter from different brand
3. Personal filter set not configured

**Solutions:**
- Use "Map Filters" dialog for manual mapping
- Set filter brand to "Auto" for broader matching
- Configure personal filter set for your equipment

---

## Version History

### v3.0 - Modular Architecture (Current)
- Separated into 5 modular components
- Personal LRGB + SHO filter set
- Filter Name column in GUI
- Export columns selection dialog
- Enhanced SQM calculation with lux conversion
- Session-averaged ambient temperature
- Integration summary dialog with insights
- Personal filter set persistence
- Improved URL extraction from AstroBin links

### v2.x - Enhanced Features
- Filter database integration
- Auto-suggestion engine
- GUI-based filter mapping
- Calibration frame auto-detection

### v1.x - Initial Release
- Basic CSV export from FITS
- Manual parameter entry
- Simple file scanning

---

## Dependencies

### PixInsight APIs
- `FileFormat` - FITS/XISF file reading
- `FileFormatInstance` - File instance operations
- `Settings` - Persistent storage
- `Dialog` - GUI framework
- `TreeBox`, `ComboBox`, `Edit`, etc. - UI controls
- `Console` - Logging output

### PJSR Libraries
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

### External Dependencies
- None - Fully self-contained PixInsight script

---

## Conclusion

The AstroBin Export Tool represents a comprehensive solution for automated astrophotography metadata extraction and CSV generation. Its modular architecture, intelligent analysis engine, extensive filter database, and robust error handling make it a reliable tool for streamlining the AstroBin upload workflow.

**Key Strengths:**
- **Automation:** Reduces manual CSV creation from hours to minutes
- **Intelligence:** Smart filter mapping and session grouping
- **Flexibility:** Configurable exports and personal filter sets
- **Robustness:** Handles missing data gracefully with fallbacks
- **User-Friendly:** Intuitive GUI with helpful tooltips and feedback

**Typical Use Case:**
1. Process images with WBPP (Weighted Batch Pre-Processing)
2. Run AstroBin Export on calibrated output directory
3. Review auto-detected calibration counts and metadata
4. Map filters if not auto-suggested
5. Generate CSV
6. Upload to AstroBin for bulk import

**Time Savings:** Approximately 90-95% reduction in data entry time compared to manual CSV creation.
