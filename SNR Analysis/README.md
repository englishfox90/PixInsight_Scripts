# SNR vs Integration Time Analysis Tool

A production-ready PixInsight PJSR script that analyzes how Signal-to-Noise Ratio (SNR) improves with integration depth. This tool helps astrophotographers determine optimal integration times by measuring SNR improvements across multiple partial integrations.

## Features

- ✅ **Multi-Filter Support**: Auto-group by FILTER header with per-filter tabs
- ✅ **Multiple Depth Strategies**: OSC preset, doubling, Fibonacci, logarithmic, or custom sequences
- ✅ **Full-Depth Reference**: Creates complete integration for ROI selection
- ✅ **Automatic & Manual ROI Modes**: Auto tile-based BG/FG detection with progressive relaxation; manual BG/FG previews supported
- ✅ **Star Removal Required**: Enforces starless stacks via StarNet2 or StarXTerminator for consistent SNR
- ✅ **Optional Stretching**: STF-based histogram transform per depth
- ✅ **Comprehensive Output**: CSV, JSON with metadata, graph image + preview
- ✅ **Automated Insights**: Diminishing returns detection, scaling exponent, recommended ranges

### Option A: PixInsight Update Repository (Recommended - when available)

1. Open PixInsight → `Resources → Updates → Manage Repositories...`
2. Add repository URL: `https://raw.githubusercontent.com/englishfox90/PixInsight_Scripts/main/updates/`
3. Check for updates and install SNR Analysis package
4. Find under `Script → PFRAstro → SNR Analysis`

### Option B: Manual Installation

1. Clone or download this repository
2. Navigate to `SNR Analysis/` folder
3. Copy all `.js` files to your preferred location
4. In PixInsight: `Script → Feature Scripts...` → Add → select `SNRAnalysis_Main.js`

**Required Files:**
- `SNRAnalysis_Main.js` (main entry point)
- `SNRAnalysis-core.js`
- `SNRAnalysis-ui.js`
- `SNRAnalysis-progress.js` (WBPP-style progress monitor)
- `SNRAnalysis-subframe-scanner.js`
- `SNRAnalysis-depth-planner.js`
- `SNRAnalysis-integrator.js`
- `SNRAnalysis-star-removal.js`
- `SNRAnalysis-stretch.js`
- `SNRAnalysis-snr.js`
- `SNRAnalysis-roi-auto.js` (automatic ROI detection)
- `SNRAnalysis-graph.js`
- `SNRAnalysis-insights.js`
- `SNRAnalysis-output.js`

## Usage

### Workflow

1. **Prepare Subframes**
   - Calibrate and register your subframes (e.g., using WBPP)
   - Organize in a directory (can include multiple filters)

2. **Configure Analysis**
   - Select input directory containing calibrated subs
   - Enable "Analyze all filters separately" to auto-group by FILTER header
   - **Choose ROI Mode**:
     - **Auto**: Script automatically detects background and faint signal regions using tile-based analysis
     - **Manual**: Traditional workflow where you create BG/FG previews manually
   - Choose depth strategy (e.g., OSC preset: 12, 24, 48, 96, 192, 384, 720)
  - Star removal is enforced; optionally enable stretch
   - Select output directory

3. **Define ROIs**
   - Script creates full-depth reference master for each filter (tracked in progress monitor)
   
   **Auto Mode (Recommended)**:
   - Script automatically analyzes the reference master using tile-based detection
   - Finds background tiles (low median, low noise)
   - Finds foreground tiles (faint signal above background, avoiding bright stars)
   - Uses progressive relaxation for low-contrast targets (2.5σ → 2.0σ → 1.5σ → 1.0σ thresholds)
   - Creates BG and FG previews automatically
   - If auto-detection fails, falls back to manual mode with helpful error message
   - Configure tile size in UI (default: 96 pixels)
   
   **Manual Mode**:
   - If ROI previews don't exist, script will prompt you:
     - Keep the reference master window open
     - Create two previews using `Preview → New Preview` (or Ctrl+N on selection):
       - `BG` - Background region (dark sky area)
       - `FG` - Foreground region (faint signal area)
     - Re-run the script
   - If multi-filter mode is enabled, you'll define ROIs for each filter independently
   - If previews exist, analysis continues automatically

4. **Monitor Execution**
   - WBPP-style progress dialog shows real-time status
   - Each step displays: status icon, progress %, details, elapsed time
   - Steps include: scanning, reference creation, ROI validation, each depth integration
   - Cancel button available to abort safely

5. **Execute Analysis**
   - Script processes each filter group, then each depth automatically
   - Integrates first N subs for each depth
   - Optionally removes stars and applies stretch
   - Measures SNR in defined ROIs
   - All operations tracked with detailed timing per filter

6. **Review Results**
   - Interactive results dialog with:
     - **Tabbed interface** for multi-filter (one tab per filter)
     - Formatted summary text with all metrics
     - Live graph preview (scaled to fit)
     - Insights and recommendations per filter
   - Console summary of all depths
   - Per-filter output files:
     - `snr_results_<filter>.csv` - Tabular data
     - `snr_results_<filter>.json` - Full metadata + insights
     - `snr_graph_<filter>.png` - Visual plot (1000×600)
   - Insights text (diminishing returns, recommendations)

### Depth Strategies

| Strategy | Description | Example Output |
|----------|-------------|----------------|
| **Preset OSC** | Standard OSC depths | 12, 24, 48, 96, 192, 384, 720 |
| **Doubling** | Powers of 2 | 8, 16, 32, 64, 128, 256, ... |
| **Fibonacci** | Fibonacci sequence | 8, 13, 21, 34, 55, 89, ... |
| **Logarithmic** | Exponentially spaced | 8, 14, 25, 44, 78, 137, ... (7-8 steps) |
| **Custom** | User-specified | e.g., 10, 20, 40, 80, 160 |

### Output Files

**snr_results.csv**
```csv
label,nSubs,totalExposure_s,intTime_s,starRemovalTime_s,stretchTime_s,bgMean,bgSigma,fgMean,snr
N12,12,3600.0,45.23,0.00,0.00,0.00012345,0.00023456,0.00001234,9.01
N24,24,7200.0,52.18,0.00,0.00,0.00012340,0.00032145,0.00001120,12.74
...
```

**snr_results.json** (includes full metadata, settings, ROI coordinates, insights)

**snr_graph.png** (1000×600 plot of SNR vs integration time with scaled preview in results dialog)

### Insights Example

```
SNR ANALYSIS INSIGHTS
=====================

• SNR improvements drop below 10% after N192 (57.6h)
• SNR improvements drop below 5% after N384 (115.2h)
• Recommended integration range: 38.4h - 57.6h (90-95% of max SNR)
• Scaling exponent: 0.48 (close to ideal √N behavior)

ANOMALIES DETECTED:
  - N720: SNR decreased by 3.2% - possible bad subs
```

## Configuration Options

### Input
- **Input Directory**: Folder containing calibrated subframes
- **File Pattern**: File extensions to scan (default: `*.xisf;*.fits`)
- **Analyze All Filters**: Group subframes by FILTER header for independent analysis

### ROI Mode
- **BG/FG Detection**:
  - **Manual**: Create BG/FG previews yourself (traditional workflow)
  - **Auto**: Script automatically detects regions using tile-based analysis
- **Auto Tile Size**: Size of tiles for auto-detection (32-256 pixels, default: 96)
  - Larger tiles: More stable statistics, less granular
  - Smaller tiles: More precise region selection, may be noisier

### Depth Strategy

### Depth Strategy
- **Preset OSC**: 12, 24, 48, 96, 192, 384, 720 (optimized for OSC imaging)
- **Doubling**: Powers of 2 (8, 16, 32, 64, ...)
- **Fibonacci**: Fibonacci sequence (8, 13, 21, 34, ...)
- **Logarithmic**: Exponentially spaced (7-8 steps)
- **Custom**: User-defined comma-separated list

### Processing
- **Generate Starless**: Create star-removed versions for SNR measurement
  - StarNet2 or StarXTerminator
- **Apply Stretch**: Apply STF-based stretch to each integration

### Output
- **CSV Results**: Tabular format for spreadsheet analysis
- **JSON Results**: Full metadata, settings, insights
- **Graph Image**: Visual plot (XISF + optional PNG)
- **Generate Insights**: Automated analysis and recommendations
- **Log Timings**: Detailed timing breakdown

## Requirements

- PixInsight 1.8+
- Calibrated and registered subframes with FITS headers:
  - `EXPTIME` or `EXPOSURE`
  - `DATE-OBS` (optional, used for sorting)
  - `FILTER` (optional, for filtering)
- Optional: StarNet2 or StarXTerminator (if using star removal)

## Interpreting Results

### SNR Formula
```
SNR = (FG_mean - BG_mean) / BG_sigma   // measured on starless stacks
```
- Higher SNR = better signal detection
- Ideal scaling: SNR ∝ √N (exponent ≈ 0.5)

### Diminishing Returns
- **<10% improvement**: Modest gains, consider cost/benefit
- **<5% improvement**: Significant diminishing returns
- **Negative improvement**: Possible bad subs or systematic issues

### Recommended Range
- Tool identifies 90-95% of maximum SNR threshold
- Balances SNR gains vs. integration time investment

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No subframes found | Check file pattern and directory path |
| Auto ROI detection fails | Try manual mode or adjust tile size; low-contrast targets may need manual ROI selection |
| Missing ROI previews (manual) | Script will keep reference master open and prompt you to create `BG` and `FG` previews, then re-run |
| Star removal fails | Ensure StarNet2/StarXTerminator is installed via Process → All Processes |
| Integration errors | Verify subs are calibrated and properly formatted |
| Scaling exponent <<0.5 | Investigate systematic issues (tracking, calibration) |
| SNR decreases | Identify and exclude bad subframes |
| Progress monitor stuck | Check console for errors, use Cancel button if needed |

## Technical Details

### Module Architecture
- **SNRAnalysis_Main.js**: Entry point, orchestration with progress tracking
- **-core.js**: Configuration, Settings persistence (including ROI mode)
- **-ui.js**: Dialog interface with header, info section, ROI mode controls, results preview
- **-progress.js**: Custom progress monitor with Control+Label progress bar
- **-subframe-scanner.js**: File discovery, metadata extraction
- **-depth-planner.js**: Depth sequence generation
- **-integrator.js**: ImageIntegration wrapper
- **-star-removal.js**: StarNet2/StarXTerminator interface with version-safe window detection
- **-stretch.js**: STF → HistogramTransformation
- **-snr.js**: ROI extraction, SNR calculation, preview workflow, manual prompts
- **-roi-auto.js**: Automatic ROI detection with tile-based analysis and progressive relaxation
- **-graph.js**: Plot generation with VectorGraphics → Bitmap
- **-insights.js**: Analysis and recommendations
- **-output.js**: CSV/JSON writing

### Auto ROI Detection Algorithm
1. **Tile the image**: Divide into non-overlapping regions (configurable size)
2. **Measure statistics**: Calculate median, sigma, max per tile
3. **Estimate background**: 25th percentile of tile medians
4. **Select BG tile**: Closest to background, low noise, no bright stars
5. **Select FG tile**: Progressive relaxation with 4 passes:
   - **Conservative** (2.5σ threshold, 4.0σ noise limit)
   - **Moderate** (2.0σ threshold, 5.0σ noise limit)
   - **Relaxed** (1.5σ threshold, 6.0σ noise limit)
   - **Aggressive** (1.0σ threshold, 8.0σ noise limit)
6. **Create previews**: Automatically generate BG/FG previews for analysis
7. **Fallback**: If detection fails, switches to manual mode with contextual error message

### Settings Persistence
Settings are stored via PixInsight's Settings API (module ID: `SNRAnalysisSettings`) and persist between sessions.

## License

MIT License - see repository root for details

## Version

**1.0.0** - Initial production release

---

*Developed for the PixInsight astrophotography workflow*
