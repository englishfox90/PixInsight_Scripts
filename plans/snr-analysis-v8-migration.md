# SNR Analysis — V8 Engine Migration Plan

## Overview

The SNR Analysis project (v1.6.6) is currently a SpiderMonkey-era script with no `#engine` directive,
11 system `#include` directives in the entry point, and a mix of old-style patterns spread across 11
source files. The migration involves four categories of work: (1) adding the engine directive and
removing system includes, (2) converting the single `__base__`-pattern dialog in `SNRAnalysis-ui.js`
to ES6 `class` syntax, (3) replacing `Name_CONSTANT` globals with `Name.CONSTANT` class properties in
6 files, and (4) dropping `.prototype.` from process class enum access in 3 files. There is also one
critical functional change: `VectorGraphics` is removed in V8 and must be replaced with `Graphics` in
`SNRAnalysis-graph.js`. Two extra system `#include` directives exist inside included files
(`SNRAnalysis-progress.js` and `SNRAnalysis-roi-auto.js`) that must also be removed. The total scope
is moderate — roughly 50 targeted line changes across 9 files.

---

## Migration Checklist

### File 1: `SNRAnalysis_Main.js` (entry point)

- [ ] Add `#engine v8` as the very first line of the file, before `#feature-id`.

  ```
  // ADD as line 1:
  #engine v8
  ```

- [ ] Add `CoreApplication.ensureMinimumVersion(1, 9, 4);` immediately after the `#engine v8` line
  (before or after `#feature-id` — placing it after all `#feature-*` directives but before the IIFE
  is fine).

- [ ] Remove all 11 system `#include` directives (lines 26–36). Keep all `#include "path/file.js"`
  user-module includes untouched.

  Lines to delete:
  ```javascript
  #include <pjsr/Sizer.jsh>
  #include <pjsr/FrameStyle.jsh>
  #include <pjsr/TextAlign.jsh>
  #include <pjsr/StdButton.jsh>
  #include <pjsr/StdIcon.jsh>
  #include <pjsr/StdCursor.jsh>
  #include <pjsr/Color.jsh>
  #include <pjsr/FontFamily.jsh>
  #include <pjsr/DataType.jsh>
  #include <pjsr/UndoFlag.jsh>
  #include <pjsr/MorphOp.jsh>
  ```

- [ ] Replace `StdIcon_Information` and `StdButton_Ok` constants in `SNRAnalysisEngine.execute()`
  at line 1222:

  Old:
  ```javascript
  new MessageBox(msg, "Create ROI Previews", StdIcon_Information, StdButton_Ok).execute();
  ```
  New:
  ```javascript
  new MessageBox(msg, "Create ROI Previews", StdIcon.Information, StdButton.Ok).execute();
  ```

---

### File 2: `ui/SNRAnalysis-ui.js`

- [ ] Convert the `SNRAnalysisDialog` constructor from `__base__` pattern to ES6 `class`:

  Old (entire file body):
  ```javascript
  function SNRAnalysisDialog() {
     this.__base__ = Dialog;
     this.__base__();
     
     var self = this;
     // ...
  }
  SNRAnalysisDialog.prototype = new Dialog;
  ```
  New:
  ```javascript
  class SNRAnalysisDialog extends Dialog {
     constructor() {
        super();
        
        const self = this;
        // ... (rest of constructor body unchanged)
     }
  }
  ```

  Notes:
  - Delete the `SNRAnalysisDialog.prototype = new Dialog;` line at the end of the file.
  - Change `var self = this;` to `const self = this;`.
  - There are no prototype methods on `SNRAnalysisDialog` — the entire class body is the
    constructor, so no method migration is needed.

- [ ] Replace all old-style constants in the `okButton.onClick` handler (lines 37–64):

  Old:
  ```javascript
  new MessageBox("Please select an input directory.", "Validation Error", StdIcon_Error, StdButton_Ok).execute();
  ```
  New:
  ```javascript
  new MessageBox("Please select an input directory.", "Validation Error", StdIcon.Error, StdButton.Ok).execute();
  ```
  Apply the same replacement to all four `MessageBox` calls in this function that reference
  `StdIcon_Error` and `StdButton_Ok`.

---

### File 3: `ui/SNRAnalysis-progress.js`

- [ ] Remove the `#include` guard and system includes at the top of the file (lines 7–14):

  Delete:
  ```javascript
  #ifndef __SNR_ANALYSIS_PROGRESS_JS
  #define __SNR_ANALYSIS_PROGRESS_JS
  
  #include <pjsr/Sizer.jsh>
  #include <pjsr/FrameStyle.jsh>
  #include <pjsr/TextAlign.jsh>
  #include <pjsr/StdButton.jsh>
  #include <pjsr/StdIcon.jsh>
  ```

- [ ] Remove the closing `#endif` guard at the bottom of the file (line 318):

  Delete:
  ```javascript
  #endif // __SNR_ANALYSIS_PROGRESS_JS
  ```

- [ ] Replace `TextAlign_Left | TextAlign_VertCenter` with `TextAlignment.Left | TextAlignment.VertCenter`
  at line 54:

  Old:
  ```javascript
  this.statusLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
  ```
  New:
  ```javascript
  this.statusLabel.textAlignment = TextAlignment.Left | TextAlignment.VertCenter;
  ```

- [ ] Replace `TextAlign_Center | TextAlign_VertCenter` with `TextAlignment.Center | TextAlignment.VertCenter`
  at line 64:

  Old:
  ```javascript
  this.progressBarFill.textAlignment = TextAlign_Center | TextAlign_VertCenter;
  ```
  New:
  ```javascript
  this.progressBarFill.textAlignment = TextAlignment.Center | TextAlignment.VertCenter;
  ```

- [ ] Replace `TextAlign_Left | TextAlign_VertCenter` with `TextAlignment.Left | TextAlignment.VertCenter`
  at line 96:

  Old:
  ```javascript
  this.elapsedLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
  ```
  New:
  ```javascript
  this.elapsedLabel.textAlignment = TextAlignment.Left | TextAlignment.VertCenter;
  ```

---

### File 4: `ui/SNRAnalysis-ui-header.js`

- [ ] Replace `TextAlign_Right` with `TextAlignment.Right` (line 27):

  Old:
  ```javascript
  copyrightLabel.textAlignment = TextAlign_Right;
  ```
  New:
  ```javascript
  copyrightLabel.textAlignment = TextAlignment.Right;
  ```

---

### File 5: `ui/SNRAnalysis-ui-sections.js`

- [ ] Replace all `TextAlign_Left | TextAlign_VertCenter` with `TextAlignment.Left | TextAlignment.VertCenter`
  (appears at lines 26, 57, 101, 165, 195, 241, 280, 326, 404 — 9 occurrences). Do a global
  find-and-replace within this file.

---

### File 6: `ui/SNRAnalysis-results-dialog.js`

- [ ] Replace `TextAlign_Left | TextAlign_VertCenter` with `TextAlignment.Left | TextAlignment.VertCenter`
  (lines 117 and 403 — 2 occurrences).

---

### File 7: `ui/SNRAnalysis-stack-preview.js`

- [ ] Replace `TextAlign_Left | TextAlign_VertCenter` with `TextAlignment.Left | TextAlignment.VertCenter`
  (lines 90 and 98 — 2 occurrences).

- [ ] Replace `TextAlign_Center | TextAlign_VertCenter` with `TextAlignment.Center | TextAlignment.VertCenter`
  (line 161).

- [ ] Replace `StdCursor_Arrow` with `StdCursor.Arrow` (line 117):

  Old:
  ```javascript
  previewBox.cursor = new Cursor(StdCursor_Arrow);
  ```
  New:
  ```javascript
  previewBox.cursor = new Cursor(StdCursor.Arrow);
  ```

---

### File 8: `processing/SNRAnalysis-snr.js`

- [ ] Replace `StdIcon_Question`, `StdButton_Yes`, `StdButton_No` in `promptForROIs()` (lines 99–104):

  Old:
  ```javascript
  var confirmMsg = new MessageBox(
     "Found existing ROI previews" + filterLabel + ":\n\n" +
     ...
     StdIcon_Question,
     StdButton_Yes,
     StdButton_No
  );
  
  if (confirmMsg.execute() === StdButton_Yes) {
  ```
  New:
  ```javascript
  var confirmMsg = new MessageBox(
     "Found existing ROI previews" + filterLabel + ":\n\n" +
     ...
     StdIcon.Question,
     StdButton.Yes,
     StdButton.No
  );
  
  if (confirmMsg.execute() === StdButton.Yes) {
  ```

- [ ] Replace `StdIcon_Information`, `StdButton_Ok`, `StdButton_Cancel` in `promptForROIs()`
  (lines 147–154):

  Old:
  ```javascript
  var msg = new MessageBox(
     msgText,
     "Create ROI Previews",
     StdIcon_Information,
     StdButton_Ok,
     StdButton_Cancel
  );
  
  if (msg.execute() !== StdButton_Ok) {
  ```
  New:
  ```javascript
  var msg = new MessageBox(
     msgText,
     "Create ROI Previews",
     StdIcon.Information,
     StdButton.Ok,
     StdButton.Cancel
  );
  
  if (msg.execute() !== StdButton.Ok) {
  ```

- [ ] Replace `UndoFlag_NoSwapFile` with `UndoFlag.NoSwapFile` (lines 236 and 305):

  Old:
  ```javascript
  scaledWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
  ```
  New:
  ```javascript
  scaledWindow.mainView.beginProcess(UndoFlag.NoSwapFile);
  ```
  (Two occurrences — apply to both.)

- [ ] Replace `PixelMath.prototype.SameAsTarget` with `PixelMath.SameAsTarget` (lines 336–337):

  Old:
  ```javascript
  P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
  P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
  ```
  New:
  ```javascript
  P.newImageColorSpace = PixelMath.SameAsTarget;
  P.newImageSampleFormat = PixelMath.SameAsTarget;
  ```

---

### File 9: `processing/SNRAnalysis-integrator.js`

- [ ] Replace `UndoFlag_NoSwapFile` with `UndoFlag.NoSwapFile` (line 231):

  Old:
  ```javascript
  newWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
  ```
  New:
  ```javascript
  newWindow.mainView.beginProcess(UndoFlag.NoSwapFile);
  ```

- [ ] Replace all `ImageIntegration.prototype.Average` with `ImageIntegration.Average`
  (lines 95 and 291 — 2 occurrences).

- [ ] Replace all `ImageIntegration.prototype.AdditiveWithScaling` with
  `ImageIntegration.AdditiveWithScaling` (lines 96 and 292).

- [ ] Replace all `ImageIntegration.prototype.DontCare` with `ImageIntegration.DontCare`
  (lines 97 and 293).

- [ ] Replace all `ImageIntegration.prototype.WeightScale_IKSS` with
  `ImageIntegration.WeightScale_IKSS` (lines 99 and 295).

- [ ] Replace all `ImageIntegration.prototype.Scale` with `ImageIntegration.Scale`
  (lines 104 and 300 — the `rejectionNormalization` assignments).

- [ ] Replace all `ImageIntegration.prototype.PercentileClip` with
  `ImageIntegration.PercentileClip` (lines 178, 181, 192).

- [ ] Replace all `ImageIntegration.prototype.WinsorizedSigmaClip` with
  `ImageIntegration.WinsorizedSigmaClip` (lines 184, 193, 201).

- [ ] Replace all `ImageIntegration.prototype.LinearFit` with `ImageIntegration.LinearFit`
  (lines 187, 194).

- [ ] Replace `ImageIntegration.prototype.Rejection_ESD` with `ImageIntegration.Rejection_ESD`
  (line 195 — also used in the guard condition, replace both occurrences on that line):

  Old:
  ```javascript
  if (algo === "ESD" && ImageIntegration.prototype.Rejection_ESD) {
     return ImageIntegration.prototype.Rejection_ESD;
  }
  ```
  New:
  ```javascript
  if (algo === "ESD" && ImageIntegration.Rejection_ESD) {
     return ImageIntegration.Rejection_ESD;
  }
  ```

---

### File 10: `processing/SNRAnalysis-star-removal.js`

- [ ] Replace `StarNet.prototype.Stride_128` with `StarNet.Stride_128` (lines 240–241):

  Old:
  ```javascript
  if (StarNet.prototype.Stride_128 !== undefined) {
     P.stride = StarNet.prototype.Stride_128;
  ```
  New:
  ```javascript
  if (StarNet.Stride_128 !== undefined) {
     P.stride = StarNet.Stride_128;
  ```

---

### File 11: `analysis/SNRAnalysis-roi-auto.js`

- [ ] Remove the system `#include` at the top of the file (line 6):

  Delete:
  ```javascript
  #include <pjsr/ImageOp.jsh>
  ```

  Note: `ImageOp` constants are not actually used anywhere in this file — the include was
  vestigial. Verify with a search for `ImageOp_` within the file before deleting.

---

### File 12: `analysis/SNRAnalysis-roi-rangemask.js`

- [ ] Replace `UndoFlag_NoSwapFile` with `UndoFlag.NoSwapFile` (lines 358, 381, 494, 592, 789 —
  5 occurrences). Do a global find-and-replace within this file.

- [ ] Replace `MorphOp_Dilation` with `MorphologicalOp.Dilation` (lines 387, 499 — 2 occurrences).

- [ ] Replace `MorphOp_Erosion` with `MorphologicalOp.Erosion` (lines 400, 597 — 2 occurrences).

- [ ] Replace `Convolution.prototype.Parametric` with `Convolution.Parametric` (line 364):

  Old:
  ```javascript
  G.mode = Convolution.prototype.Parametric;
  ```
  New:
  ```javascript
  G.mode = Convolution.Parametric;
  ```

---

### File 13: `analysis/SNRAnalysis-graph.js` — CRITICAL

- [ ] Remove the two system `#include` directives at the top of the file (lines 6–7):

  Delete:
  ```javascript
  #include <pjsr/ColorSpace.jsh>
  #include <pjsr/SampleType.jsh>
  ```

- [ ] **Replace `VectorGraphics` with `Graphics`** — `VectorGraphics` is removed in V8. There are
  two instantiation sites in this file (lines 41 and 295):

  Old:
  ```javascript
  var g = new VectorGraphics(bmp);
  ```
  New:
  ```javascript
  var g = new Graphics(bmp);
  ```

  Apply to both occurrences. The drawing API (`g.drawLine`, `g.drawText`, `g.fillRect`, etc.) is
  identical between the two classes, so no other changes are needed. The property
  `g.antialiasing = true;` (line 42) remains valid on `Graphics`.

---

### File 14: `core/SNRAnalysis-core.js`

- [ ] **Rename `DataType_*` — use class-property form with confirmed casing:**
  - `DataType_UInt32` → `DataType.Uint32` (**lowercase u** in Uint — `DataType.UInt32` is undefined)
  - `DataType_String` → `DataType.String` (confirmed working)
  - `DataType_Double` → `DataType.Double`
  - `DataType_Boolean` → `DataType.Boolean`

  The old `DataType_*` globals throw ReferenceError in V8. `DataType.String` confirmed working.
  `DataType.Uint32` (lowercase u) matches the porting guide.

---

## Files Affected — Summary Table

| File | Engine Directive | Remove Includes | Class Conversion | Constant Rename (`Name_X` → `Name.X`) | Prototype Drop (`.prototype.Enum`) | Language Modernisation |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `SNRAnalysis_Main.js` | Yes | Yes (11 system) | No | `StdIcon_Information`, `StdButton_Ok` | No | Optional |
| `ui/SNRAnalysis-ui.js` | No | No | Yes (`SNRAnalysisDialog`) | `StdIcon_Error`, `StdButton_Ok` (×4) | No | `var self` → `const self` |
| `ui/SNRAnalysis-progress.js` | No | Yes (5 system + guards) | No | `TextAlign_*` (×3) | No | Optional |
| `ui/SNRAnalysis-ui-header.js` | No | No | No | `TextAlign_Right` | No | No |
| `ui/SNRAnalysis-ui-sections.js` | No | No | No | `TextAlign_Left`, `TextAlign_VertCenter` (×9) | No | Optional |
| `ui/SNRAnalysis-results-dialog.js` | No | No | No | `TextAlign_Left`, `TextAlign_VertCenter` (×2) | No | No |
| `ui/SNRAnalysis-stack-preview.js` | No | No | No | `TextAlign_*` (×3), `StdCursor_Arrow` | No | No |
| `processing/SNRAnalysis-snr.js` | No | No | No | `StdIcon_*`, `StdButton_*`, `UndoFlag_NoSwapFile` | `PixelMath.prototype.SameAsTarget` (×2) | Optional |
| `processing/SNRAnalysis-integrator.js` | No | No | No | `UndoFlag_NoSwapFile` | `ImageIntegration.prototype.*` (×14) | Optional |
| `processing/SNRAnalysis-star-removal.js` | No | No | No | No | `StarNet.prototype.Stride_128` (×2) | Optional |
| `analysis/SNRAnalysis-roi-auto.js` | No | Yes (1 system) | No | No | No | No |
| `analysis/SNRAnalysis-roi-rangemask.js` | No | No | No | `UndoFlag_NoSwapFile` (×5), `MorphOp_*` (×4) | `Convolution.prototype.Parametric` | Optional |
| `analysis/SNRAnalysis-graph.js` | No | Yes (2 system) | No | No | No | Replace `VectorGraphics` with `Graphics` |
| `core/SNRAnalysis-core.js` | No | No | No | `DataType_*` (×4+) | No | Optional |
| `analysis/SNRAnalysis-insights.js` | No | No | No | No | No | No |
| `analysis/SNRAnalysis-output.js` | No | No | No | No | No | No |
| `utils/SNRAnalysis-subframe-scanner.js` | No | No | No | No | No | No |

---

## Risk Notes

1. **`VectorGraphics` removal is a breaking change.** `VectorGraphics` does not exist in V8 and
   calling `new VectorGraphics(bmp)` will throw an exception at runtime, crashing graph generation
   silently (caught by the surrounding try/catch). After replacing with `Graphics`, the anti-aliasing
   toggle (`g.antialiasing = true`) remains valid. Visual output quality may differ slightly
   (Graphics uses the same underlying rasteriser; VectorGraphics was the old alias), but the graphs
   will render correctly.

2. **`DataType_*` constants ARE renamed in V8 — confirmed casing.** The old globals throw
   ReferenceError. Use class-property form: `DataType.String` (confirmed working),
   `DataType.Uint32` (lowercase u — `DataType.UInt32` with capital U is undefined),
   `DataType.Double`, `DataType.Boolean`.

3. **`PixelMath.SameAsTarget` — verify name.** The `SameAsTarget` constant is used for
   `newImageColorSpace` and `newImageSampleFormat`. Confirm the exact V8 class-property name via
   the PixInsight 1.9.4 release notes or by running `Console.writeln(JSON.stringify(PixelMath))`
   in the script console. If the property is not found at class level, the safe fallback is to
   use the integer literal (`0`) that `SameAsTarget` maps to.

4. **`StarNet.Stride_128` — verify availability.** The existing code already guards with
   `if (StarNet.Stride_128 !== undefined)` after the rename, so a missing constant will fall
   through to the numeric fallback `P.stride = 128`. No breakage risk, but confirm the constant
   exists on the V8-era `StarNet` class.

5. **`ImageIntegration.Rejection_ESD` — may not exist.** The existing code guards this with
   `if (ImageIntegration.Rejection_ESD)` which means it is safe to drop. The ESD algorithm
   constant may have a different name in newer PixInsight versions. The guard preserves
   backward-compatible behaviour.

6. **`#include` guards in `SNRAnalysis-progress.js`.** The file uses `#ifndef` / `#define` /
   `#endif` preprocessor guards. These are valid PJSR preprocessor directives and will continue
   to work in V8. However, since the included file list is being cleaned up and these guards are
   the only preprocessor directives remaining, they can optionally be removed to clean up the file.
   They do not cause errors if left in place.

7. **`SNRAnalysisDialog` class declaration vs. persistent runtime.** The script uses `#engine v8`
   (isolated runtime, destroyed after each execution) rather than `#engine v8-private` (persistent),
   so the ES6 `class SNRAnalysisDialog extends Dialog` declaration is safe and will not trigger
   "already declared" errors across multiple runs.

8. **Test the ROI confirmation dialog.** The `StdButton_Yes` / `StdButton_No` rename in
   `promptForROIs()` affects a return-value comparison (`confirmMsg.execute() === StdButton_Yes`).
   After renaming to `StdButton.Yes`, verify the comparison still works — `execute()` returns the
   numeric value of the button constant, which does not change. The comparison is correct as long
   as both sides of `===` use the same source (the class property).

9. **No `let`/`const` adoption is required.** Language modernisation (`var` → `const`/`let`,
   template literals) is optional and listed as such. Do not apply language modernisation and
   functional changes in the same pass — complete all breaking fixes first, then optionally
   modernise in a follow-up pass.

10. **`packaging.config.json` version bump.** After all changes are made and tested, bump
    `SCRIPT_VERSION` in `core/SNRAnalysis-core.js` and update `packaging.config.json` to match,
    then run `npm run build:packages` to produce the updated distribution package.
