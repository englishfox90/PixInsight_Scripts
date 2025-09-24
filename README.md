﻿# PixInsight Custom Scripts

A collection of custom PixInsight JavaScript (PJSR) scripts for astrophotography workflow enhancement.

## 📁 Repository Structure

```
├── AstroBin Export/          # AstroBin CSV export tools
├── Signature/                # Image signature and export tools
└── .gitignore                # Git ignore rules
```

---

## 🌟 AstroBin Export Tools

Located in `AstroBin Export/` directory.

### Main Script: `AstroBin_CSV_Export_v3_Modular.js`

**Purpose:** Generates CSV files compatible with AstroBin's bulk acquisition upload feature.

#### ✅ Key Features:
- **Automatic FITS Header Analysis**: Extracts exposure data, filters, telescope info, and more
 - **Comprehensive Filter Database**: 200+ filters across 22 manufacturers including:
   - Antlia (incl. EDGE & Ultra 2.5nm series), Askar ColorMagic, Astrodon, Astronomik, Baader (CMOS), Chroma, Optolong (L-eNhance / L-eXtreme), IDAS (NB, LPS), Altair, ZWO, SVBony, Vaonis/Vespera, Omega, TS-Optics, and more
   - Dual / tri / quad band coverage (ALP-T, Triband, Duo, Quad, NBZ, etc.)
 - **Personal LRGB + SHO Filter Set**: Define and persist your own preferred filter IDs for L, R, G, B, Ha, OIII, SII; auto‑applied when brand preference is set to `Auto`.
 - **Filter Name Column (UI)**: Displays resolved `Brand + Display Name` alongside raw FITS filter and editable Filter ID for clarity.
 - **Filter ID Auto‑Suggestion with Precedence**: Personal set → Preferred Brand match → Keyword fallback.
 - **Selectable / Persistent CSV Columns**: Choose which data columns to populate (headers always present for AstroBin compatibility). Choices persist between sessions.
 - **Improved SQM Derivation**: Correct luminosity conversion using `SQM = 14.18 − 2.5*log10(lux)` with clamping (15.0–22.2). Priority: direct SQM FITS header → LUX conversion → Bortle estimate → blank.
 - **Raw Frame Filtering**: Automatically excludes masters, calibrated, and integration outputs—only counts true LIGHT subframes.
 - **Manual Filter ID Entry**: For filters not in database - paste AstroBin URLs or enter IDs directly.
 - **Bortle Scale Integration**: Dropdown with descriptive ranges for accurate sky quality selection.
 - **Integration Summary**: Detailed per‑session statistics and environmental aggregation.

#### 🔧 Setup Requirements:
1. **Calibrated Images**: Works best with WBPP-calibrated or similar processed files
2. **FITS Headers**: Requires proper FITS metadata for automatic detection

#### 📊 Generated CSV Format:
Compatible with AstroBin's bulk upload expecting columns:
- `subject`, `description`, `data_source`, `locations`, `acquisition_type`
- `advanced_settings`, `deep_sky_acquisitions`, `solar_system_acquisitions`

#### 🎯 Workflow:
1. Load script in PixInsight
2. Select directory containing processed FITS files
3. (Optional) Click **Map Filters** to:
  - Review auto‑mapped filters
  - Enter missing IDs or paste AstroBin filter URLs
  - Define / Save your **Personal Filter Set** (LRGB + Ha/OIII/SII)
4. Set Bortle scale & environmental parameters (SQM auto‑fills from FITS / LUX / Bortle where possible)
5. (Optional) Use **Columns...** to toggle which CSV columns get populated
6. Generate CSV and upload to AstroBin

#### ⚠️ Important Notes:
- **Manual Filter Entry**: If your filter isn't in the database, select "Manual Entry" and paste the AstroBin filter URL (e.g., `https://app.astrobin.com/equipment/explorer/filter/4359/`) or enter the ID directly
- **Bortle Scale**: Choose the most accurate sky quality rating for your location
- **File Organization**: Keep processed files in organized directories for best results
- **Backup**: Always backup your original FITS files before processing
 - **Raw Frame Logic**: Only true LIGHT subframes are tallied—files whose paths or `IMAGETYP` suggest masters, calibrations, or integrations are ignored to prevent double counting.
 - **Filter Name vs Filter**: `Filter` shows the literal FITS header; `Filter Name` is the resolved database display string for readability.

---

### 🧪 Personal Filter Set (LRGB + SHO)

Use this when you mix brands (e.g., Baader LRGB + Antlia 3nm SHO) but want consistent auto‑mapping.

1. Run an analysis and open **Map Filters**.
2. In the Personal Filter Set section enter the AstroBin IDs (or pick from already mapped rows).
3. Click **Save Personal Set** (persists via PixInsight Settings).
4. Ensure **Filter Brand** is set to `Auto` (top of main dialog) so precedence is:
  - Personal set match (substring heuristics: `lum|lumin|l`, `red`, `green`, `blue`, `ha|h-alpha|halpha`, `oiii|o3|oxygen`, `sii|s2|sulfur|sulphur`)
  - Preferred brand keyword match (if brand not Auto)
  - First keyword fallback in database
5. Re‑run or refresh (**Analyze Images**) to see mappings applied.

You can click **Apply Personal Set** inside the mapping dialog to force remap without a full re‑analysis.

---

### 🗂️ Selectable CSV Column Population

Use **Columns...** to toggle which fields are populated. Headers always remain so AstroBin bulk import format is stable. `number` and `duration` are enforced populated (required by AstroBin).

Stored per user via PixInsight Settings (UInt32 flags) so your choices persist between sessions.

---

### 🌌 SQM & Environmental Logic

Priority for SQM:
1. Direct FITS SQM header
2. FITS LUX header converted with `SQM = 14.18 − 2.5 * log10(lux)` (clamped 15.0–22.2)
3. Bortle selection estimated midpoint
4. Left blank

FWHM & ambient temperature lock (disabled in UI) if reliably extracted from FITS session metadata.

---

### 🧹 Raw Frame Filtering Rules

Excluded automatically (case‑insensitive path or type checks):
`master`, `calibrated`, `integration`, `fastIntegration` and any `IMAGETYP` containing `master` or `integrat`. This prevents counting the same exposure metadata multiple times.

---

### 🆕 Recent Enhancements (2025‑09‑23)
| Feature | Summary |
|---------|---------|
| Filter Name column | Adds readable brand + display name next to raw FITS filter & editable ID |
| Personal Filter Set | Persist LRGB + SHO preferred IDs and auto‑apply when brand=Auto |
| Column selection & persistence | Choose which columns are populated; stored in Settings |
| Correct SQM formula | Proper LUX → SQM conversion & fallback hierarchy |
| Raw frame filtering | Excludes masters/calibrated/integration outputs |
| Expanded database | Added EDGE, Ultra narrow, Triband, V‑Pro, NBZ, extra Baader CMOS, etc. |

---

---

## 🖼️ MasterSignature Plugin

Located in `Signature/` directory.

### Main Script: `MasterSignature.js`

**Purpose:** Adds professional signature blocks and logos to processed astrophotography images.

#### ✅ Key Features:
- **Two-Line Signature Format**: 
  - Line 1: `[Object Name] | exposed [integration time] ([exposure]s x [frames])`
  - Line 2: `[Date] | [Location]`
- **Automatic FITS Integration**: Auto-populates from image headers when available
- **Logo Overlay**: Custom logo placement in bottom-right corner
- **Live Preview**: Real-time preview with zoom and pan capabilities
- **Professional Typography**: Uses Space Grotesk font for clean, modern appearance

#### 🔧 Setup Requirements:
1. **Logo File**: Place your `logo.png` in the `Signature/` directory
2. **Font**: `Space.ttf` font file should be in `Signature/lib/font/` directory
3. **Active Image**: Must have an image window open in PixInsight

#### 📝 FITS Header Mapping:
The script automatically reads these FITS keywords:
- `OBJECT` / `SUBJECT` → Object name
- `CATALOG` → Catalog designation  
- `EXPTIME` → Exposure time per frame
- `FRAMES` / `NFRAMES` → Number of frames
- `DATE-OBS` → Observation date (converts to MM/DD/YYYY format)
- `OBSERVER` / `LOCATN` / `SITE` → Location information

#### 🎨 Customization Options:
- **Font Selection**: Multiple font families available
- **Font Size**: Adjustable pixel size (auto-calculated as 10% of image height)
- **Margin Control**: Adjustable border spacing
- **Logo Toggle**: Enable/disable logo overlay
- **Manual Override**: Edit any auto-populated field

#### 🖥️ User Interface:
- **Left Panel**: Configuration controls and data entry
- **Right Panel**: Live preview with zoom controls
- **Mouse Support**: Wheel zoom, click-and-drag scrolling
- **Real-time Updates**: Preview updates as you modify settings

#### ⚠️ Important Notes:
- **Logo Requirements**: PNG format recommended, reasonable size (script will preserve aspect ratio)
- **Font Size**: Default is 10% of image height - adjust as needed for your image dimensions
- **FITS Headers**: Clean, well-structured FITS headers provide the best auto-population results
- **Preview Performance**: Large images may take a moment to render in preview
- **Integration Calculation**: Automatically calculates and formats total integration time

#### 🔄 Workflow:
1. Open processed image in PixInsight
2. Run MasterSignature script
3. Review auto-populated fields, edit as needed
4. Adjust font size and positioning
5. Preview result in real-time
6. Apply signature to image

---

## 🛠️ Installation

1. **Download**: Clone or download this repository
2. **PixInsight Integration**: 
   - Copy scripts to your PixInsight scripts directory, or
   - Use "Add Scripts Directory" in PixInsight to point to this folder
3. **Dependencies**: Ensure all supporting files (CSV databases, fonts, logos) are in place
4. **Permissions**: Verify PixInsight has read/write access to the script directories

## 📋 Prerequisites

- **PixInsight 1.8+**: Scripts require modern PJSR features
- **FITS Images**: Properly formatted FITS files with metadata
- **File Organization**: Keep supporting files in their respective directories

## 🐛 Troubleshooting

### AstroBin Export:
- **No Analysis Data**: Ensure FITS files have proper headers and are in selected directory
- **Filter Not Found**: Use "Manual Entry" option in Filter Mapping Dialog
 - **Unexpected Filter ID**: Check if personal filter set is overriding (brand set to Auto); adjust or clear personal set if needed
 - **Missing Filter Name**: Ensure a valid Filter ID is present; edit the ID cell and it will refresh the name column

### MasterSignature:
- **Font Issues**: Ensure `Space.ttf` is in `lib/font/` directory
- **Logo Not Showing**: Verify `logo.png` exists in `Signature/` directory  
- **Preview Problems**: Try refreshing preview or restarting script

---


*Scripts developed for astrophotography workflow optimization with PixInsight*
