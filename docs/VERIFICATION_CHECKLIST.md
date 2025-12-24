# PixInsight Scripts - Verification & Testing Checklist

**Date:** 2025-12-23  
**Version:** Post-Hygiene Patches (v3.2.4 / v1.6.6)  
**Purpose:** Verify that global state isolation patches resolved script interference issues

---

## Quick Verification (5 minutes)

### Test 1: Basic Script Functionality
```
✅ Step 1: Launch PixInsight (clean start)
✅ Step 2: Script → Feature Scripts → AstroBin Export
✅ Step 3: Verify dialog opens with all GroupBox borders visible
✅ Step 4: Close dialog (Cancel)
✅ Step 5: Script → Feature Scripts → SNR Analysis
✅ Step 6: Verify dialog opens with all GroupBox borders visible
✅ Step 7: Close dialog (Cancel)
```

**Expected Result:** Both dialogs display correctly with no visual corruption

---

### Test 2: WBPP Interference (Critical)
```
BASELINE TEST (Before running our scripts):
✅ Step 1: Launch PixInsight (clean start)
✅ Step 2: Script → Weighted Batch Preprocessing (WBPP)
✅ Step 3: Verify all GroupBox sections have visible borders
✅ Step 4: Screenshot for comparison
✅ Step 5: Close WBPP

INTERFERENCE TEST (After running our scripts):
✅ Step 6: Script → Feature Scripts → AstroBin Export
✅ Step 7: Select a directory, scan files, close dialog
✅ Step 8: Script → Feature Scripts → SNR Analysis
✅ Step 9: Browse input/output dirs, close dialog
✅ Step 10: **WITHOUT restarting PixInsight:** Script → Weighted Batch Preprocessing
✅ Step 11: CHECK: Are GroupBox borders still visible?
✅ Step 12: Compare with baseline screenshot

REVERSE ORDER TEST (Ensure no order-dependence):
✅ Step 13: Restart PixInsight
✅ Step 14: Run SNR Analysis first, then AstroBin Export
✅ Step 15: Open WBPP
✅ Step 16: Verify borders intact
```

**Expected Result:** WBPP UI remains intact regardless of script execution order

---

## Detailed Functional Tests (15 minutes)

### Test 3: AstroBin Export Workflow
```
✅ 1. Open AstroBin Export
✅ 2. Select test directory with FITS/XISF files
✅ 3. Verify file count updates
✅ 4. Click "Analyze Files"
✅ 5. Verify metadata extraction works
✅ 6. Check CSV preview populates
✅ 7. Enter global parameters (Darks: 20, Flats: 30, etc.)
✅ 8. Adjust filter IDs if needed
✅ 9. Click "Export CSV"
✅ 10. Verify file saved successfully
✅ 11. Open CSV in text editor/Excel
✅ 12. Verify format matches AstroBin requirements
```

**Expected Result:** No errors, CSV exports correctly

---

### Test 4: SNR Analysis Workflow (Shortened)
```
✅ 1. Open SNR Analysis
✅ 2. Select input directory (calibrated/registered subframes)
✅ 3. Select output directory
✅ 4. Choose "Range Mask" ROI mode
✅ 5. Select "Preset OSC" depth strategy
✅ 6. Verify StarNet2 or StarXTerminator available
✅ 7. Click OK
✅ 8. Progress dialog should appear
✅ 9. **Manual step:** Define ROIs if prompted (or let auto mode run)
✅ 10. Wait for integration depth #1 to complete
✅ 11. Click Cancel (no need to run full analysis for test)
✅ 12. Verify no errors logged
```

**Expected Result:** Script initializes correctly, integrations start successfully

---

### Test 5: Settings Persistence
```
AstroBin Export:
✅ 1. Open AstroBin Export
✅ 2. Set Bortle scale to "7"
✅ 3. Set Darks to "25"
✅ 4. Close dialog (Cancel)
✅ 5. Reopen AstroBin Export
✅ 6. Verify Bortle still shows "7"
✅ 7. Verify Darks still shows "25"

SNR Analysis:
✅ 8. Open SNR Analysis
✅ 9. Set ROI Mode to "Auto"
✅ 10. Set Depth Strategy to "Fibonacci"
✅ 11. Close dialog (Cancel)
✅ 12. Reopen SNR Analysis
✅ 13. Verify ROI Mode shows "Auto"
✅ 14. Verify Depth Strategy shows "Fibonacci"
```

**Expected Result:** Settings persist across invocations

---

## Developer Tests (Advanced)

### Test 6: Global Leak Detection (Manual Console Check)

**Note:** Since we added `"use strict"` mode, accidental globals will now throw errors instead of silently polluting.

```javascript
// Open Script → Script Console in PixInsight
// Paste the following:

// Capture global state before
var globalsBefore = [];
for (var key in this) {
   if (this.hasOwnProperty(key)) {
      globalsBefore.push(key);
   }
}

console.writeln("Globals before: " + globalsBefore.length);

// Now run AstroBin Export via Feature Scripts
// After it closes, paste this:

var globalsAfter = [];
for (var key in this) {
   if (this.hasOwnProperty(key)) {
      globalsAfter.push(key);
   }
}

var leaks = globalsAfter.filter(function(k) { 
   return globalsBefore.indexOf(k) === -1; 
});

console.writeln("Globals after: " + globalsAfter.length);
console.writeln("New globals: " + leaks.length);
if (leaks.length > 0) {
   console.warningln("LEAKED: " + leaks.join(", "));
} else {
   console.writeln("✅ No unexpected global leaks!");
}
```

**Expected Result:** Should only show expected globals (CONFIG, ASTROBIN_FILTERS, helper functions)

---

### Test 7: UI Component Integrity

```javascript
// In PixInsight Script Console, after opening AstroBin Export dialog:

// Check GroupBox properties (run after dialog is open)
var dialog = /* reference to AstroBinDialog instance - manual inspection */

// Verify fileSelectionGroupBox has required properties
console.writeln("fileSelectionGroupBox title: '" + 
   dialog.fileSelectionGroupBox.title + "'");  // Should be "Image Files"
console.writeln("fileSelectionGroupBox has sizer: " + 
   (dialog.fileSelectionGroupBox.sizer !== undefined));  // Should be true

// Verify globalParametersGroupBox
console.writeln("globalParametersGroupBox title: '" + 
   dialog.globalParametersGroupBox.title + "'");  // Should be "Global Acquisition Parameters"
```

**Expected Result:** All GroupBox controls have correct titles and sizers

---

## Regression Tests (Ensure No Behavior Changes)

### Test 8: AstroBin Export - Filter Suggestion
```
✅ 1. Use test FITS files with FILTER keywords: "Lum", "Ha", "OIII", "Red"
✅ 2. Run analysis
✅ 3. Verify filter IDs auto-suggested correctly:
      - "Lum" → Luminance filter ID
      - "Ha" → H-alpha filter ID
      - "OIII" → O-III filter ID
      - "Red" → Red filter ID
```

**Expected Result:** Same filter matching behavior as v3.2.3

---

### Test 9: SNR Analysis - Integration Depths
```
✅ 1. Use 32 subframes
✅ 2. Select "Preset OSC" strategy
✅ 3. Expected depths: 1, 2, 4, 8, 16, 32 (6 integrations)
✅ 4. Verify Console output matches expected depths
```

**Expected Result:** Same depth planning as v1.6.5

---

## Known Issues & Limitations

### Issue 1: CONFIG Objects Remain Global
**Status:** ACCEPTED (Required by PJSR #include architecture)  
**Mitigation:** Wrapped in IIFE at entry point to isolate main() function
**Risk:** LOW - CONFIG is intentionally shared across modules

### Issue 2: Helper Functions Remain Global
**Status:** ACCEPTED (Called from multiple #include'd modules)  
**Mitigation:** Documented in hygiene comments  
**Risk:** LOW - Functions use unique prefixes, unlikely to collide

### Issue 3: No True Module System
**Status:** PJSR Limitation  
**Mitigation:** Best-effort isolation via IIFE + "use strict"  
**Risk:** MEDIUM - Future scripts must follow same patterns

---

## Rollback Procedure

If patches cause issues:

### Rollback Patch 1.2/1.3 (IIFE Wrappers)
```bash
cd "d:\Astrophotography\PixInsight Files\PixInsight Custom Scripts"

# Remove IIFE wrapper from AstroBin Export
git checkout HEAD~1 -- "AstroBin Export/AstroBin_CSV_Export_v3_Modular.js"

# Remove IIFE wrapper from SNR Analysis
git checkout HEAD~1 -- "SNR Analysis/SNRAnalysis_Main.js"

# Revert version numbers
git checkout HEAD~1 -- "packaging.config.json"
git checkout HEAD~1 -- "AstroBin Export/AstroBin-core.js"
git checkout HEAD~1 -- "SNR Analysis/core/SNRAnalysis-core.js"
```

### Rollback Patch 3.1 (Hygiene Comments)
```bash
# Comments are documentation-only; no functional impact
# Can leave in place or remove via:
git checkout HEAD~1 -- "AstroBin Export/AstroBin-core.js"
git checkout HEAD~1 -- "SNR Analysis/core/SNRAnalysis-core.js"
```

---

## Success Metrics

### Must Pass (P0):
- [x] AstroBin Export dialog loads without errors
- [x] SNR Analysis dialog loads without errors
- [x] WBPP GroupBox borders remain intact after running our scripts
- [x] Settings persist correctly
- [x] CSV export works
- [x] SNR integration starts successfully

### Should Pass (P1):
- [x] No console errors or warnings
- [x] Scripts work in any order (AstroBin first, SNR first, interleaved)
- [x] No unexpected global variables leaked
- [x] Filter suggestion logic unchanged
- [x] Depth planning logic unchanged

### Nice to Have (P2):
- [ ] Performance unchanged (IIFE overhead negligible)
- [ ] Memory usage unchanged
- [ ] Script load time unchanged

---

## Sign-Off Checklist

Before releasing to production:

```
Development:
✅ All critical patches implemented
✅ Version numbers updated
✅ Hygiene comments added

Testing:
✅ Quick verification passed (Test 1-2)
✅ Detailed functional tests passed (Test 3-5)
✅ WBPP interference resolved (Test 2)
✅ No regressions detected (Test 8-9)

Documentation:
✅ AUDIT_REPORT.md created
✅ PATCH_PLAN.md created
✅ VERIFICATION_CHECKLIST.md created
✅ packaging.config.json updated

Build:
[ ] npm run build:packages executed
[ ] ZIP files generated in updates/
[ ] updates.xri manifest regenerated
[ ] SHA1 hashes verified

Release:
[ ] Git commit: "Release v3.2.4 / v1.6.6 - Script hygiene improvements"
[ ] Git tag: v3.2.4 and v1.6.6
[ ] Push to GitHub main branch
[ ] Push tags
[ ] Update README.md with changelog
```

---

## Post-Release Monitoring

**Week 1:**
- Monitor GitHub issues for bug reports
- Check PixInsight forums for user feedback
- Watch for WBPP interference reports

**Week 2:**
- Gather usage statistics (if available)
- Consider additional isolation measures if needed

**Week 4:**
- Review effectiveness of hygiene patterns
- Document lessons learned
- Update developer guidelines

---

## Contact & Support

**Issues:** GitHub Issues (link in README)  
**Documentation:** docs/AUDIT_REPORT.md, docs/PATCH_PLAN.md  
**Developer:** Paul Fox-Reeks (englishfox90)

---

**END OF VERIFICATION CHECKLIST**
