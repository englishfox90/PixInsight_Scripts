# AstroBin Export — V8 Engine Migration Plan

Target engine: V8 (PixInsight 1.9.4+ "Lockhart")
Baseline version: 3.3.0

---

## Overview

The AstroBin Export script (6 source files) is currently written for the SpiderMonkey engine and has no `#engine` directive, meaning it falls back to the legacy default. Migrating to V8 requires three categories of work: (1) removing the 8 system `#include <pjsr/*.jsh>` directives from the entry point, because all constants are now static class properties; (2) replacing the `__base__` / `prototype = new Dialog` inheritance pattern for two dialog classes (`AstroBinDialog` and `FilterMappingDialog`) with ES6 `class extends Dialog` syntax; and (3) renaming every use of the old `Name_CONSTANT` global-style identifiers (`StdIcon_Information`, `StdButton_Ok`, `TextAlign_*`, `DataType_*`, `ReadTextOptions_*`) to `Name.CONSTANT` dot-notation. There are 44 prototype method assignments across `AstroBin-gui.js` and `AstroBin-gui-methods.js` (30 for `AstroBinDialog`, 14 for `FilterMappingDialog`) that must move into class bodies, and the `ok()` override calls `Dialog.prototype.ok.call(this)` which must become `super.ok()`. The `AstroBin-core.js`, `AstroBin-analysis.js`, `AstroBin-filter-database.js`, and `AstroBin-filters.js` files need only constant renames — no class restructuring. Optional language modernisation (template literals, `const`/`let`, arrow functions in non-event contexts) can be applied during the same pass. Total scope: moderate — the class conversion is the largest single task, but the prototype methods are all straightforward moves.

---

## Files Affected

| File | Engine directive | Remove includes | Class conversion | Constant rename | Super call | Language modernisation |
|---|---|---|---|---|---|---|
| `AstroBin_CSV_Export_v3_Modular.js` | YES — add `#engine v8` | YES — remove 8 `#include <pjsr/*.jsh>` lines | No | No | No | Optional |
| `AstroBin-core.js` | No | No | No | YES — `DataType_*` | No | Optional |
| `AstroBin-gui.js` | No | No | YES — `AstroBinDialog` constructor + 8 prototype methods declared here | YES — `TextAlign_*` | No | Optional |
| `AstroBin-gui-methods.js` | No | No | YES — 22 `AstroBinDialog` methods + `FilterMappingDialog` constructor + 14 `FilterMappingDialog` methods | YES — `StdIcon_*`, `StdButton_*`, `TextAlign_*` | YES — `Dialog.prototype.ok.call(this)` → `super.ok()` | Optional |
| `AstroBin-analysis.js` | No | No | No | No | No | Optional |
| `AstroBin-filters.js` | No | No | No | YES — `ReadTextOptions_*` | No | Optional |
| `AstroBin-filter-database.js` | No | No | No | No | No | No |

---

## Migration Checklist

### `AstroBin_CSV_Export_v3_Modular.js`

- [ ] **Add engine directive** — insert `#engine v8` as the very first line of the file, before `#feature-id`:

  Old (line 11 is currently the first non-comment line):
  ```javascript
  #feature-id    AstroBinExport : PFRAstro > AstroBin Export
  ```
  New:
  ```javascript
  #engine v8
  #feature-id    AstroBinExport : PFRAstro > AstroBin Export
  ```

- [ ] **Add minimum version guard** — insert immediately after the `#feature-icon` line, before the IIFE:
  ```javascript
  CoreApplication.ensureMinimumVersion( 1, 9, 4 );
  ```

- [ ] **Remove `#include <pjsr/Sizer.jsh>`** (line 25) — delete the entire line.

- [ ] **Remove `#include <pjsr/FrameStyle.jsh>`** (line 26) — delete the entire line.

- [ ] **Remove `#include <pjsr/TextAlign.jsh>`** (line 27) — delete the entire line.

- [ ] **Remove `#include <pjsr/StdButton.jsh>`** (line 28) — delete the entire line.

- [ ] **Remove `#include <pjsr/StdIcon.jsh>`** (line 29) — delete the entire line.

- [ ] **Remove `#include <pjsr/Color.jsh>`** (line 30) — delete the entire line.

- [ ] **Remove `#include <pjsr/FontFamily.jsh>`** (line 31) — delete the entire line.

- [ ] **Remove `#include <pjsr/DataType.jsh>`** (line 33) and its preceding comment (line 32) — delete both lines. `DataType_*` constants become `DataType.*` and need no include.

- [ ] **Remove the now-redundant comment** `// Include necessary PJSR libraries for UI functionality` (line 24) — delete it.

- [ ] **Modernise `main()` function** (optional) — change `var dialog =` to `const dialog =` and `var` declarations inside `main()` to `const`/`let`.

---

### `AstroBin-core.js`

- [ ] **Rename `DataType_UInt32`** — replace all 8 occurrences with `DataType.UInt32`. Locations:
  - `loadExportColumnSettings()` line 86: `Settings.read(..., DataType_UInt32)`
  - `loadExportColumnSettings()` line 100: `Settings.read(..., DataType_UInt32)`
  - `saveExportColumnSettings()` lines 127, 130: `Settings.write(..., DataType_UInt32, ...)`
  - `loadPersonalFilterSet()` line 152: `Settings.read(..., DataType_UInt32)`
  - `savePersonalFilterSet()` line 206: `Settings.write(..., DataType_UInt32, ...)`
  - `loadBortleScale()` (none — uses `DataType_String` only)
  - `savePersonalFilterSet()` is called from gui-methods too, but the constant lives in core.

- [ ] **Rename `DataType_String`** — replace all 5 occurrences with `DataType.String`. Locations:
  - `loadPersonalFilterSet()` line 162: `Settings.read(..., DataType_String)`
  - `savePersonalFilterSet()` line 201: `Settings.write(..., DataType_String, ...)`
  - `loadBortleScale()` line 219: `Settings.read(..., DataType_String)`
  - `saveBortleScale()` line 237: `Settings.write(..., DataType_String, ...)`

- [ ] **Optional — modernise `var` to `const`/`let`** throughout the module-level declarations and function bodies.

---

### `AstroBin-gui.js` — Class Conversion (AstroBinDialog constructor + 8 methods)

This file currently defines `AstroBinDialog` as a constructor function plus 8 prototype methods. Convert to an ES6 class.

- [ ] **Replace the constructor function** and `AstroBinDialog.prototype = new Dialog` line. Old pattern (lines 12–44):

  ```javascript
  function AstroBinDialog()
  {
     this.__base__ = Dialog;
     this.__base__();

     this.windowTitle = SCRIPT_NAME + " v" + SCRIPT_VERSION;
     ...
     this.updateUI();
  }

  AstroBinDialog.prototype = new Dialog;
  ```

  New:

  ```javascript
  class AstroBinDialog extends Dialog
  {
     constructor()
     {
        super();

        this.windowTitle = SCRIPT_NAME + " v" + SCRIPT_VERSION;
        ...
        this.updateUI();
     }
  ```

  Note: the class body is intentionally left open here — the 8 prototype methods that follow in the same file become class methods inside this body. The class closing brace `}` goes after the last method in the file (after `createButtonSection`).

- [ ] **Move `AstroBinDialog.prototype.createScriptInfoSection`** into the class body. Old:

  ```javascript
  AstroBinDialog.prototype.createScriptInfoSection = function()
  {
     ...
  };
  ```

  New (inside class body, no `function` keyword):

  ```javascript
  createScriptInfoSection()
  {
     ...
  }
  ```

  Note: inside the constructor, `var self = this` is used at line 107. In V8 class constructors this pattern is still correct for event handler closures — **do not change it to an arrow function**. The `var self = this` declared in the constructor scope is accessible to methods only if those assignments happen inside the constructor. Each `createXxxSection()` method that declares its own `var self = this` for local event handlers is fine as-is.

- [ ] **Move `AstroBinDialog.prototype.createFileSelectionSection`** — same conversion pattern. (Contains its own `var self = this` at line 107 for the `selectDirectoryButton.onClick` closure — leave as-is.)

- [ ] **Move `AstroBinDialog.prototype.createGlobalParametersSection`** — same conversion. (Contains `var self = this` at line 291 for `bortleComboBox.onItemSelected` closure — leave as-is.)

- [ ] **Move `AstroBinDialog.prototype.getUniqueBrands`** — same conversion. No closures.

- [ ] **Move `AstroBinDialog.prototype.updateGlobalParametersFromMetadata`** — same conversion. No closures.

- [ ] **Move `AstroBinDialog.prototype.createImageAnalysisSection`** — same conversion. (Contains a second `var self = this` at line 594 for `imageTreeBox.onNodeUpdated` — leave as-is.)

- [ ] **Move `AstroBinDialog.prototype.createCSVPreviewSection`** — same conversion. (Contains `var self = this` at line 648 for button onClick handlers — leave as-is.)

- [ ] **Move `AstroBinDialog.prototype.createButtonSection`** — same conversion. (Contains `var self = this` at line 692 — leave as-is.) Add the class closing brace `}` after this method.

- [ ] **Rename `TextAlign_Right`** (line 66): `this.copyrightLabel.textAlignment = TextAlign_Right;` → `TextAlignment.Right`

- [ ] **Rename `TextAlign_VertCenter`** — all occurrences in this file:
  - Line 149: `this.excludeLabel.textAlignment = TextAlign_VertCenter;` → `TextAlignment.VertCenter`
  - Line 173: `this.excludeStatusLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;` → `TextAlignment.Left | TextAlignment.VertCenter`
  - Line 203: `darksLabel.textAlignment = TextAlign_VertCenter;` → `TextAlignment.VertCenter`
  - Line 215: `flatsLabel.textAlignment = TextAlign_VertCenter;` → `TextAlignment.VertCenter`
  - Line 227: `flatDarksLabel.textAlignment = TextAlign_VertCenter;` → `TextAlignment.VertCenter`
  - Line 239: `biasLabel.textAlignment = TextAlign_VertCenter;` → `TextAlignment.VertCenter`
  - Line 257: `bortleLabel.textAlignment = TextAlign_VertCenter;` → `TextAlignment.VertCenter`
  - Line 309: `filterBrandLabel.textAlignment = TextAlign_VertCenter;` → `TextAlignment.VertCenter`
  - Line 346: `meanSqmLabel.textAlignment = TextAlign_VertCenter;` → `TextAlignment.VertCenter`
  - Line 368: `meanFwhmLabel.textAlignment = TextAlign_VertCenter;` → `TextAlignment.VertCenter`
  - Line 388: `temperatureLabel.textAlignment = TextAlign_VertCenter;` → `TextAlignment.VertCenter`

- [ ] **Rename `TextAlign_Left`** (line 173, combined with `TextAlign_VertCenter` — already covered above).

---

### `AstroBin-gui-methods.js` — Class Conversion (22 AstroBinDialog methods + FilterMappingDialog class)

This is the largest file and the most mechanical task. Every `AstroBinDialog.prototype.methodName = function()` block becomes a class method. The file also defines the `FilterMappingDialog` constructor and its 14 prototype methods — a second class conversion.

**Strategy:** Because `AstroBinDialog` is opened as a class in `AstroBin-gui.js`, this file's methods must be grafted inside that open class body. The cleanest approach is to restructure so that `AstroBin-gui.js` opens the class and `AstroBin-gui-methods.js` closes it after its last method. Alternatively, keep both files self-contained by closing the class at the end of `AstroBin-gui.js` and reopening it is not valid JavaScript. The recommended approach: **the class definition opens in `AstroBin-gui.js` and closes in `AstroBin-gui-methods.js`**. The `#include "AstroBin-gui.js"` directive runs before `#include "AstroBin-gui-methods.js"` and the engine compiles the whole IIFE as one unit.

- [ ] **Coordinate with `AstroBin-gui.js` change above**: do NOT close the `AstroBinDialog` class in `AstroBin-gui.js` after `createButtonSection`. Instead, leave the class open, and close it with `}` at the end of `AstroBin-gui-methods.js` after the last `AstroBinDialog` method (`calculateTotalIntegrationTime`).

- [ ] **Convert `AstroBinDialog.prototype.scanForFiles`** (line 7). Old:
  ```javascript
  AstroBinDialog.prototype.scanForFiles = function()
  {
     ...
  };
  ```
  New (inside open class body):
  ```javascript
  scanForFiles()
  {
     ...
  }
  ```

- [ ] **Convert `AstroBinDialog.prototype.showExcludePatternHelp`** (line 44) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.analyzeImages`** (line 73) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.populateGlobalParametersFromMetadata`** (line 153) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.resetGlobalParametersUI`** (line 215) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.populateImageTree`** (line 247) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.generateCSV`** (line 305) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.createCSVContent`** (line 357) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.saveCSVFile`** (line 472) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.copyCSVToClipboard`** (line 491) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.showExportColumnsDialog`** (line 501) — same pattern. Note: this method contains a locally-scoped `makeCheck` helper function and `var self = this` for button closures — leave these internal patterns unchanged.

- [ ] **Convert `AstroBinDialog.prototype.updateConfigFromUI`** (line 590) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.updateUI`** (line 603) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.ok`** (line 612) — same pattern. Additionally, the super call must change:

  Old:
  ```javascript
  AstroBinDialog.prototype.ok = function()
  {
     this.updateConfigFromUI();
     saveBortleScale(CONFIG.bortle);
     Dialog.prototype.ok.call(this);
  };
  ```

  New:
  ```javascript
  ok()
  {
     this.updateConfigFromUI();
     saveBortleScale(CONFIG.bortle);
     super.ok();
  }
  ```

- [ ] **Convert `AstroBinDialog.prototype.updateSQMFromBortle`** (line 625) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.bortleToSQM`** (line 642) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.showAbout`** (line 661) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.showFilterMappingDialog`** (line 698) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.showIntegrationSummary`** (line 1417) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.calculateIntegrationStats`** (line 1470) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.formatDuration`** (line 1668) — same pattern.

- [ ] **Convert `AstroBinDialog.prototype.calculateTotalIntegrationTime`** (line 1685) — same pattern. Add the `AstroBinDialog` class closing brace `}` immediately after this method.

- [ ] **Convert `FilterMappingDialog` constructor function** (line 727). Old:

  ```javascript
  function FilterMappingDialog(parentDialog)
  {
     this.__base__ = Dialog;
     this.__base__();

     this.parentDialog = parentDialog;
     this.windowTitle = "Filter Mapping";
     ...
     this.createFilterMappingUI();
     this.populateFilterMappings();
  }

  FilterMappingDialog.prototype = new Dialog;
  ```

  New (placed directly below the `AstroBinDialog` class closing brace):

  ```javascript
  class FilterMappingDialog extends Dialog
  {
     constructor(parentDialog)
     {
        super();

        this.parentDialog = parentDialog;
        this.windowTitle = "Filter Mapping";
        ...
        this.createFilterMappingUI();
        this.populateFilterMappings();
     }
  ```

  Leave the class body open — the 14 prototype methods that follow become class methods inside it.

- [ ] **Convert `FilterMappingDialog.prototype.getUniqueFilters`** (line 748) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.createFilterMappingUI`** (line 764) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.createPersonalFilterRow`** (line 855) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.loadPersonalFilterSetIntoUI`** (line 943) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.savePersonalFilterSet`** (line 966) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.applyPersonalToSession`** (line 979) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.createFilterMappingRow`** (line 1022) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.getUniqueBrands`** (line 1171) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.updateFilterCombo`** (line 1187) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.updateFilterId`** (line 1213) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.validateManualFilterId`** (line 1236) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.populateFilterMappings`** (line 1295) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.selectFilterById`** (line 1324) — move into class body.

- [ ] **Convert `FilterMappingDialog.prototype.saveFilterMappings`** (line 1377) — move into class body. Add the `FilterMappingDialog` class closing brace `}` immediately after this method.

- [ ] **Rename `StdIcon_Information`** — 3 occurrences:
  - Line 69 (`showExcludePatternHelp`): `new MessageBox(msg, "Exclude Pattern Help", StdIcon_Information, StdButton_Ok)` → `StdIcon.Information`, `StdButton.Ok`
  - Line 693 (`showAbout`): `new MessageBox(msg, "About AstroBin CSV Export", StdIcon_Information, StdButton_Ok)` → `StdIcon.Information`, `StdButton.Ok`
  - Line 1462 (`showIntegrationSummary`): `new MessageBox(msg, "Integration Session Summary", StdIcon_Information, StdButton_Ok)` → `StdIcon.Information`, `StdButton.Ok`

- [ ] **Rename `StdButton_Ok`** — same 3 locations as above (covered by the items above).

- [ ] **Rename `TextAlign_Right | TextAlign_VertCenter`** (line 863 in `createPersonalFilterRow`):
  ```javascript
  label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
  ```
  → `TextAlignment.Right | TextAlignment.VertCenter`

- [ ] **Rename `TextAlign_Right | TextAlign_VertCenter`** (line 1045 in `createFilterMappingRow`):
  ```javascript
  filterLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
  ```
  → `TextAlignment.Right | TextAlignment.VertCenter`

- [ ] **Rename `TextAlign_Left | TextAlign_VertCenter`** (line 1088 in `createFilterMappingRow`):
  ```javascript
  filterIdLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
  ```
  → `TextAlignment.Left | TextAlignment.VertCenter`

---

### `AstroBin-filters.js`

- [ ] **Rename `ReadTextOptions_RemoveEmptyLines | ReadTextOptions_TrimLines`** (line 41):

  Old:
  ```javascript
  var lines = File.readLines( workingPath, ReadTextOptions_RemoveEmptyLines | ReadTextOptions_TrimLines );
  ```

  New:
  ```javascript
  var lines = File.readLines( workingPath, ReadTextOption.RemoveEmptyLines | ReadTextOption.TrimLines );
  ```

  > **Verify first**: confirm that `ReadTextOptions` is the correct V8 class name for these flags. The V8 migration guide lists the pattern but does not explicitly enumerate `ReadTextOptions`. If PixInsight 1.9.4 exposes this as `File.ReadTextOptions` or some other namespace, adjust accordingly. If these flags are not available as class properties in V8, the alternative is to pass the numeric values directly (0x01 = TrimLines, 0x02 = RemoveEmptyLines — check PixInsight source or test at runtime).

---

### `AstroBin-analysis.js` — No structural changes required

This file contains only plain functions (`bortleToSQM`, `isExcludedOutputPath`, `classifyImageType`, `analyzeFiles`, `groupKey`, `aggregate`). No `__base__` pattern, no old-style constants, no includes. No mandatory changes.

- [ ] **Optional — modernise `var` to `const`/`let`** in function bodies.
- [ ] **Optional — use template literals** in `Console.writeln` calls.
- [ ] **Optional — use arrow functions** in `.sort()` comparators (already uses inline `function(a,b)` which is fine to leave).

---

### `AstroBin-filter-database.js` — No changes required

This file contains only a data array `ASTROBIN_FILTERS` and two utility functions (`_astrobinValidFilterId`, `suggestFilterId`, `findFilterById`). No constants to rename, no classes to convert. No changes required.

---

## Risk Notes

1. **Split class definition across two files.** The `AstroBinDialog` class body opens in `AstroBin-gui.js` and is intended to close in `AstroBin-gui-methods.js`. This relies on the PJSR `#include` preprocessor concatenating the two files before V8 parses the IIFE — which it does. However, an unclosed `{` in `AstroBin-gui.js` will produce a confusing parse error if the files are ever parsed independently. Add a prominent comment at the top of `AstroBin-gui-methods.js`:
   ```javascript
   // NOTE: AstroBinDialog class body is opened in AstroBin-gui.js.
   // This file continues that class body and closes it after calculateTotalIntegrationTime().
   ```
   And at the end of `AstroBin-gui.js` (after `createButtonSection`, without a closing brace):
   ```javascript
   // AstroBinDialog class body continues in AstroBin-gui-methods.js
   ```

2. **Multiple `var self = this` declarations in the same constructor.** The `AstroBinDialog` constructor calls six `createXxxSection()` methods, each of which declares its own `var self = this` for local closure capture. In the class constructor these are called as `this.createXxxSection()` — the `self` inside each method correctly captures the dialog instance since each method is called with `this` as the receiver. This is fine; do not attempt to hoist a single `const self = this` to the constructor body.

3. **`Dialog.prototype.ok.call(this)` in the `ok()` override.** This must become `super.ok()` in the class body. Leaving it as `Dialog.prototype.ok.call(this)` in a class body will still work in V8, but `super.ok()` is the idiomatic form and avoids a potential `this`-binding edge case if PixInsight's Dialog prototype changes.

4. **`ReadTextOptions_*` constant rename needs runtime verification.** The V8 migration guide confirms the pattern but does not enumerate `ReadTextOptions` by name. This is the only constant category not explicitly documented. Test with a small PJSR snippet in PixInsight's Script Console before committing the rename:
   ```javascript
   Console.writeln(ReadTextOption.RemoveEmptyLines);
   ```
   If this throws, use `File.ReadTextOption.RemoveEmptyLines` or the raw bitmask values.

5. **`filterBrandCombo.onItemSelected` uses `this.itemText(index)` pattern.** In `AstroBin-gui.js` line 332–334, the handler reads `CONFIG.preferredFilterBrand = this.itemText(index)` — `this` inside the handler refers to the ComboBox, not the dialog. This is correct SpiderMonkey-compatible behaviour and works identically in V8 event handlers. Do not change it.

6. **`showExportColumnsDialog` contains a locally-scoped `makeCheck` helper function.** In V8 strict mode, named function declarations inside non-function blocks are still permitted inside function bodies. The `makeCheck` function is defined inside `showExportColumnsDialog` (a function body), so no issue.

7. **Arrow functions already present in `calculateIntegrationStats`.** Lines 1559–1562 already use arrow functions inside `.sort()` and `.map()` calls:
   ```javascript
   stats.exposureTimes = Object.keys(exposures).sort((a,b) => parseFloat(a) - parseFloat(b)).join("s, ") + "s";
   ```
   These are non-event-handler arrow functions and are entirely valid in V8. No changes needed.

8. **`DataType_*` rename is confirmed — verify case of `UInt32`.** The official V8 porting guide code examples confirm `DataType.ByteArray` and `DataType.Uint32` (class-property form), consistent with all other constant renames. The plan uses `DataType.UInt32` (uppercase U to match the legacy `DataType_UInt32`) — but the porting guide example shows `DataType.Uint32` (lowercase u). Before the migration pass, confirm casing with: `Console.writeln(typeof DataType.UInt32);` vs `Console.writeln(typeof DataType.Uint32);` in the Script Console, and use whichever returns `"number"`.

9. **No `Parameters.isViewTarget` check.** The current `main()` only guards against `Parameters.isGlobalTarget`. This is unchanged by V8 migration and does not need to be addressed here.

10. **Version bump recommended after migration.** Once the migration is complete, bump `SCRIPT_VERSION` in `AstroBin-core.js` and `packaging.config.json` to signal that a V8-only build is required. Suggested: `3.4.0`.
