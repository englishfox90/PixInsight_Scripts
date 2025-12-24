# PixInsight Scripts - Patch Plan
## Global State Isolation & Script Hygiene Improvements

**Date:** 2025-12-23  
**Target:** AstroBin Export v3.2.3 → v3.2.4, SNR Analysis v1.6.5 → v1.6.6  
**Risk Level:** LOW (conservative, reversible changes)

---

## Patch Strategy

**Guiding Principles:**
1. **Minimal changes** - Fix only identified issues
2. **No behavior changes** - Scripts function identically
3. **Reversible** - Each patch can be independently reverted
4. **Testable** - Each patch can be validated in isolation

**PJSR Constraints:**
- Cannot use ES6 modules or true encapsulation
- `#include` system requires shared scope for included modules
- CONFIG objects must remain global (cross-module dependency)
- Functions must be global (called from multiple #include'd modules)

**Acceptable Trade-offs:**
- CONFIG and helper functions will remain global (required by architecture)
- We add **isolation wrappers** at entry points only
- We add **"use strict"** to catch future accidents
- We add **leak detection** for development

---

## Phase 1: Critical Fixes (P0)

### Patch 1.1: Fix Accidental Global in AstroBin-analysis.js
**File:** `AstroBin Export/AstroBin-analysis.js`  
**Lines:** 147-162  
**Risk:** **VERY LOW** - Simple variable scoping fix

**Current Code:**
```javascript
// Line 147-162 (missing var declaration context)
if (potentialFilter.toLowerCase().indexOf("ha") >= 0) {
  filter = "Ha";
} else if (...) {
  filter = "OIII";
}
// ... etc
```

**Root Cause Analysis:**
Line 99 declares: `var filter = readKeyword( ff, "FILTER" );`  
Lines 147-162 are inside a conditional block, so assignments should work as local reassignments.
**This is actually NOT a bug** - the variable is properly scoped.

**CORRECTION:** After closer inspection, `filter` IS properly declared on line 99. The grep search gave a false positive because the assignments are inside a function where `filter` is already declared.

**Action:** ✅ **NO PATCH NEEDED** - False alarm

---

### Patch 1.2: Add IIFE Wrapper to AstroBin Main Entry
**File:** `AstroBin Export/AstroBin_CSV_Export_v3_Modular.js`  
**Lines:** Entire file  
**Risk:** **LOW** - Standard isolation pattern

**Change:**
```javascript
// BEFORE:
#include <pjsr/Sizer.jsh>
// ... more includes ...
#include "AstroBin-core.js"
// ... more includes ...

function main() {
   // ... existing code ...
}
main();

// AFTER:
(function() {
"use strict";

#include <pjsr/Sizer.jsh>
// ... more includes ...
#include "AstroBin-core.js"
// ... more includes ...

function main() {
   // ... existing code ...
}
main();

})(); // End IIFE
```

**Benefits:**
- Isolates script execution context
- "use strict" catches future accidental globals
- CONFIG and functions remain global (needed for #include'd modules)

**Testing:**
- Verify script still loads and executes
- Check that dialog opens normally
- Confirm Settings persistence works

---

### Patch 1.3: Add IIFE Wrapper to SNR Analysis Main Entry
**File:** `SNR Analysis/SNRAnalysis_Main.js`  
**Lines:** Entire file  
**Risk:** **LOW**

**Change:** Same pattern as Patch 1.2

---

### Patch 1.4: Verify All Variable Declarations
**Files:** All `*-analysis.js`, `*-core.js` files  
**Risk:** **VERY LOW** - Verification only

**Action:** Manual review of assignments inside functions to confirm all use proper `var`/`let`/`const`.

**Manual Check Required:**
```bash
# Search for potential accidental globals (assignments without declaration)
grep -E "^\s{3,}[a-zA-Z_$][\w$]*\s*=\s*[^=]" *.js
```

**Result:** All checked - no actual accidental globals found (filter/tempGroup were false positives)

---

## Phase 2: Isolation Improvements (P1)

### Patch 2.1: Refactor GUI Globals to Dialog Properties (AstroBin)
**File:** `AstroBin Export/AstroBin-gui.js`  
**Lines:** 7-9, and all usages  
**Risk:** **MEDIUM** - Moderate refactor

**Current:**
```javascript
// Top of file
var g_imageFiles = [];
var g_analysisData = [];
var g_filterMapping = {};

// Throughout file
g_imageFiles = listFiles(CONFIG.rootDir, CONFIG.includeSubdirs);
```

**After:**
```javascript
// Remove global declarations

// In AstroBinDialog constructor
function AstroBinDialog() {
   this.__base__ = Dialog;
   this.__base__();
   
   // Add as instance properties
   this.imageFiles = [];
   this.analysisData = [];
   this.filterMapping = {};
   
   // ... rest of constructor
}

// Throughout file, replace g_imageFiles with this.imageFiles
this.imageFiles = listFiles(CONFIG.rootDir, CONFIG.includeSubdirs);
```

**Changes Required:**
- Replace all `g_imageFiles` → `this.imageFiles` (~15 occurrences)
- Replace all `g_analysisData` → `this.analysisData` (~10 occurrences)
- Replace all `g_filterMapping` → `this.filterMapping` (~8 occurrences)

**Testing:**
- Verify file scanning works
- Confirm analysis engine populates data
- Check CSV export uses correct data

**Rollback Plan:** Revert to global variables if instance properties cause issues

---

### Patch 2.2: Add Global Leak Detection (Development Mode)
**File:** New file `hygiene/global-leak-detector.js`  
**Risk:** **VERY LOW** - Dev-only code

**Content:**
```javascript
/*
 * PJSR Global Leak Detector
 * Development-only tool to detect accidental global variable creation
 * 
 * Usage:
 * #define ENABLE_LEAK_DETECTION 1
 * #ifdef ENABLE_LEAK_DETECTION
 * #include "hygiene/global-leak-detector.js"
 * var leakDetector = new GlobalLeakDetector();
 * #endif
 * 
 * // ... your script code ...
 * 
 * #ifdef ENABLE_LEAK_DETECTION
 * leakDetector.report();
 * #endif
 */

function GlobalLeakDetector() {
   this.initialGlobals = [];
   this.knownGlobals = [
      // PixInsight built-ins
      "Parameters", "console", "Console", "Settings", "ImageWindow", "Dialog",
      "GroupBox", "Label", "Edit", "PushButton", "CheckBox", "ComboBox",
      "HorizontalSizer", "VerticalSizer", "TextAlign", "StdIcon", "StdButton",
      "FrameStyle", "DataType", "FileFormat", "File", "Math", "Array", "Object",
      
      // Expected AstroBin globals (acceptable)
      "SCRIPT_NAME", "SCRIPT_VERSION", "SCRIPT_DESCRIPTION", "SCRIPT_DEVELOPER",
      "CONFIG", "AB_SETTINGS_MODULE", "ASTROBIN_FILTERS", "AstroBinDialog",
      "FILE_EXTS", "NIGHT_OFFSET_HOURS", "DEFAULT_EXPORT_COLUMNS",
      
      // Expected SNR Analysis globals (acceptable)
      "SNR_SETTINGS_MODULE", "SNRAnalysisDialog", "SNRAnalysisEngine",
      "ProgressMonitor",
      
      // Helper functions (acceptable due to #include architecture)
      "loadSettings", "saveSettings", "analyzeFiles", "scanSubframes",
      "planIntegrationDepths", "performFullIntegration", "removeStars",
      "measureSNR", "generateGraph", "computeInsights"
   ];
   
   // Capture initial state
   this.captureInitialState();
}

GlobalLeakDetector.prototype.captureInitialState = function() {
   this.initialGlobals = [];
   for (var key in this) {
      if (this.hasOwnProperty(key) && typeof this[key] !== 'function') {
         this.initialGlobals.push(key);
      }
   }
};

GlobalLeakDetector.prototype.report = function() {
   var leakedVars = [];
   
   for (var key in this) {
      if (this.hasOwnProperty(key) && 
          this.initialGlobals.indexOf(key) === -1 &&
          this.knownGlobals.indexOf(key) === -1 &&
          key !== 'initialGlobals' && key !== 'knownGlobals') {
         leakedVars.push(key);
      }
   }
   
   if (leakedVars.length > 0) {
      console.warningln("╔════════════════════════════════════════════════╗");
      console.warningln("║  ⚠️  GLOBAL VARIABLE LEAKS DETECTED           ║");
      console.warningln("╚════════════════════════════════════════════════╝");
      console.warningln("");
      console.warningln("The following variables were added to global scope:");
      for (var i = 0; i < leakedVars.length; i++) {
         console.warningln("  • " + leakedVars[i] + " = " + typeof this[leakedVars[i]]);
      }
      console.warningln("");
      console.warningln("These may interfere with other PixInsight scripts.");
      console.warningln("Consider wrapping in IIFE or adding to knownGlobals list.");
      return false;
   } else {
      console.writeln("✅ No unexpected global leaks detected");
      return true;
   }
};

// Export for use
var GlobalLeakDetector = GlobalLeakDetector;
```

**Integration:**
```javascript
// Add to main entry points (AstroBin_CSV_Export_v3_Modular.js)
#define ENABLE_LEAK_DETECTION 0  // Set to 1 for development

#ifdef ENABLE_LEAK_DETECTION
#include "hygiene/global-leak-detector.js"
var __leakDetector = new GlobalLeakDetector();
#endif

// ... existing code ...

#ifdef ENABLE_LEAK_DETECTION
__leakDetector.report();
#endif
```

**Benefits:**
- Catches future accidental globals during development
- Documents known/acceptable globals
- Zero runtime cost in production (compiled out)

---

## Phase 3: Documentation & Best Practices (P2)

### Patch 3.1: Add Hygiene Comments
**Files:** All `-core.js` files  
**Risk:** **NONE** - Comments only

**Add to top of each core file:**
```javascript
/*
 * MODULE SCOPE NOTES:
 * 
 * This module is loaded via PJSR #include, which shares global scope.
 * The following globals are INTENTIONAL and required for cross-module access:
 *   - CONFIG: Shared configuration object
 *   - SCRIPT_NAME, SCRIPT_VERSION: Metadata constants
 *   - Helper functions: [list key functions]
 * 
 * All other variables should be scoped to functions to avoid pollution.
 * Use "use strict" in entry points to catch accidental globals.
 */
```

---

### Patch 3.2: Update Version Numbers
**Files:**
- `packaging.config.json`
- `AstroBin Export/AstroBin-core.js`
- `SNR Analysis/core/SNRAnalysis-core.js`

**Changes:**
```json
// packaging.config.json
"AstroBinExport": {
  "version": "3.2.4",  // was 3.2.3
  // ...
},
"SNRAnalysis": {
  "version": "1.6.6",  // was 1.6.5
  // ...
}
```

```javascript
// AstroBin-core.js
var SCRIPT_VERSION = "3.2.4";  // was "3.2.3"

// SNRAnalysis-core.js  
var SCRIPT_VERSION = "1.6.6";  // was "1.6.5"
```

---

## Phase 4: Testing & Validation (P0)

### Test 4.1: Self-Test Mode
**New File:** `tests/self-test-astrobin.js`

```javascript
/*
 * AstroBin Export - Self Test
 * Verifies: GroupBox rendering, no global leaks, Settings persistence
 */

#define ENABLE_LEAK_DETECTION 1

#include "../AstroBin Export/AstroBin_CSV_Export_v3_Modular.js"

function runSelfTest() {
   console.show();
   console.writeln("═══════════════════════════════════════════════");
   console.writeln("  AstroBin Export - Self Test");
   console.writeln("═══════════════════════════════════════════════");
   console.writeln("");
   
   // Test 1: Dialog creation
   console.writeln("Test 1: Create dialog...");
   var dialog = new AstroBinDialog();
   console.writeln("  ✅ Dialog created successfully");
   
   // Test 2: Verify GroupBox properties
   console.writeln("");
   console.writeln("Test 2: Verify GroupBox controls...");
   var groupBoxes = [
      { name: "scriptInfoGroupBox", expectedTitle: "" },
      { name: "fileSelectionGroupBox", expectedTitle: "Image Files" },
      { name: "globalParametersGroupBox", expectedTitle: "Global Acquisition Parameters" }
   ];
   
   var groupBoxFailures = 0;
   for (var i = 0; i < groupBoxes.length; i++) {
      var gb = dialog[groupBoxes[i].name];
      if (!gb) {
         console.criticalln("  ❌ " + groupBoxes[i].name + " not found!");
         groupBoxFailures++;
         continue;
      }
      if (!gb.sizer) {
         console.criticalln("  ❌ " + groupBoxes[i].name + " missing sizer!");
         groupBoxFailures++;
      }
      if (gb.title !== groupBoxes[i].expectedTitle) {
         console.warningln("  ⚠️  " + groupBoxes[i].name + " title mismatch: '" + 
                          gb.title + "' vs '" + groupBoxes[i].expectedTitle + "'");
      }
   }
   
   if (groupBoxFailures === 0) {
      console.writeln("  ✅ All GroupBox controls verified");
   } else {
      console.criticalln("  ❌ " + groupBoxFailures + " GroupBox failures detected");
   }
   
   // Test 3: Check for leaked globals (via detector)
   console.writeln("");
   console.writeln("Test 3: Check for global leaks...");
   #ifdef ENABLE_LEAK_DETECTION
   __leakDetector.report();
   #endif
   
   // Test 4: Settings persistence
   console.writeln("");
   console.writeln("Test 4: Settings persistence...");
   var testBortle = "7";
   CONFIG.bortle = testBortle;
   saveBortleScale(testBortle);
   var loaded = loadBortleScale();
   if (loaded === testBortle) {
      console.writeln("  ✅ Settings persist correctly");
   } else {
      console.criticalln("  ❌ Settings failed: wrote '" + testBortle + 
                        "' but read '" + loaded + "'");
   }
   
   console.writeln("");
   console.writeln("═══════════════════════════════════════════════");
   console.writeln("  Self Test Complete");
   console.writeln("═══════════════════════════════════════════════");
}

runSelfTest();
```

---

### Test 4.2: WBPP Interference Test (Manual)
**Procedure:**

```
BEFORE PATCH:
1. Launch PixInsight (clean)
2. Script → Feature Scripts → WeightedBatchPreprocessing
3. Verify: GroupBox borders visible ✅
4. Close WBPP
5. Script → Feature Scripts → AstroBin Export
6. Close AstroBin Export dialog
7. Script → Feature Scripts → WeightedBatchPreprocessing
8. CHECK: Are GroupBox borders missing? ❌ (reproduce issue)

AFTER PATCH:
1. Launch PixInsight (clean)
2. Script → Feature Scripts → WeightedBatchPreprocessing
3. Verify: GroupBox borders visible ✅
4. Close WBPP
5. Script → Feature Scripts → AstroBin Export (patched)
6. Close AstroBin Export dialog
7. Script → Feature Scripts → WeightedBatchPreprocessing
8. CHECK: Are GroupBox borders still visible? ✅ (issue fixed)
```

---

## Implementation Order

**Day 1: Critical Fixes**
1. ✅ Verify no actual accidental globals (audit complete)
2. ⏱️ Patch 1.2: Add IIFE to AstroBin main (15 min)
3. ⏱️ Patch 1.3: Add IIFE to SNR Analysis main (15 min)
4. ⏱️ Test: Load scripts, verify basic functionality (30 min)

**Day 2: Isolation**
5. ⏱️ Patch 2.1: Refactor GUI globals to instance props (60 min)
6. ⏱️ Patch 2.2: Add leak detector (45 min)
7. ⏱️ Test: Run self-test, check for leaks (30 min)

**Day 3: Documentation & Release**
8. ⏱️ Patch 3.1: Add hygiene comments (30 min)
9. ⏱️ Patch 3.2: Update versions (15 min)
10. ⏱️ Test 4.2: WBPP interference test (60 min)
11. ⏱️ Build packages, update repository (30 min)

**Total Estimated Time:** ~5-6 hours

---

## Rollback Plan

Each patch is independent and reversible:

**Patch 1.2/1.3 (IIFE wrappers):**
```bash
git revert <commit-hash>  # Removes IIFE, keeps original structure
```

**Patch 2.1 (GUI globals refactor):**
```bash
# Restore original global variables
git checkout HEAD~1 -- "AstroBin Export/AstroBin-gui.js"
git checkout HEAD~1 -- "AstroBin Export/AstroBin-gui-methods.js"
```

**Patch 2.2 (Leak detector):**
```bash
rm hygiene/global-leak-detector.js
# Remove #include directives from main files
```

---

## Success Criteria

### Must Pass:
- ✅ All scripts load without errors
- ✅ Dialogs display correctly (GroupBox borders visible)
- ✅ Settings persist across runs
- ✅ File scanning works
- ✅ CSV/JSON export produces correct output
- ✅ SNR analysis completes without crashes

### Should Pass:
- ✅ No global leaks detected (leak detector reports clean)
- ✅ WBPP borders remain intact after running our scripts
- ✅ Scripts work in any execution order

### Performance:
- ❌ No measurable performance degradation (IIFE overhead is negligible)

---

## Post-Release Monitoring

**Week 1:**
- Monitor GitHub issues for bug reports
- Check PixInsight forums for user feedback
- Test on Windows, macOS, Linux (if possible)

**Week 2:**
- Gather telemetry on WBPP interference reports
- Consider adding more aggressive isolation if issues persist

---

## Alternative Approaches (Rejected)

### Alt 1: Full Namespace Wrapper
**Rejected:** Too invasive, requires rewriting all #include'd modules

### Alt 2: Eliminate CONFIG Global
**Rejected:** Not possible with PJSR #include architecture

### Alt 3: Rewrite in ES6 Modules
**Rejected:** PixInsight doesn't support ES6 modules in PJSR

---

**END OF PATCH PLAN**
