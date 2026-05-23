# Master Signature — V8 Migration Plan

## Overview

`MasterSignature.js` is a single-file, ~1,478-line script currently running in legacy SpiderMonkey mode. It has no `#engine` directive, no IIFE wrapper, and no `"use strict"` — it executes entirely in global scope. The migration requires six categories of work: (1) adding the engine directive and IIFE wrapper, (2) removing five system `#include` directives, (3) converting two constructor functions that use the `__base__` / `prototype = new` inheritance pattern into ES6 `class` declarations, (4) replacing fifteen occurrences of old `Name_CONSTANT` globals with their `Name.CONSTANT` class-property equivalents, (5) fixing thirty-five occurrences of lowercase `console.` calls that currently silently fail at runtime, and (6) converting three arrow-function event handlers back to regular `function()` callbacks with a `self` reference. The two existing `var self`-style aliases (`thisDlg` and `dlg`) inside `DrawSignatureDialog` are already correct patterns and survive the refactor without change. The `let zoomFactor` on line 1322 and `let i` in `getFITSKeyword` are already valid ES6 — leave them. Total scope is moderate: roughly 50 targeted line changes across a single file. Nothing needs to move between files.

---

## Migration Checklist

### 1 — Engine directive and IIFE wrapper

- [ ] **Add `#engine v8` as the very first line**, before `#feature-id`:
  ```js
  // BEFORE (line 1):
  #feature-id    MasterSignature : PFRAstro > Master Signature

  // AFTER:
  #engine v8
  #feature-id    MasterSignature : PFRAstro > Master Signature
  ```

- [ ] **Wrap the entire script body in an IIFE with `"use strict"`**. The IIFE opens immediately after the last preprocessor directive block (after the `#define VERSION` and `#define TITLE` lines, before the `var logoDir` declaration) and closes after the final `main();` call and the trailing `getFITSKeyword` function. Structure:
  ```js
  // After the #define lines:
  (function() {
  "use strict";

  // ... entire script body (var logoDir through getFITSKeyword) ...

  })();
  ```

- [ ] **Add `CoreApplication.ensureMinimumVersion(1, 9, 4);`** inside the IIFE, immediately after `"use strict";` and before `var logoDir`.

---

### 2 — Remove system `#include` directives

Remove all five of the following lines (lines 10–14 in the current file):

- [ ] Remove `#include <pjsr/Sizer.jsh>`
- [ ] Remove `#include <pjsr/FrameStyle.jsh>`
- [ ] Remove `#include <pjsr/TextAlign.jsh>`
- [ ] Remove `#include <pjsr/StdButton.jsh>`
- [ ] Remove `#include <pjsr/StdIcon.jsh>`

No replacement lines are needed — all constants these provided are now static class properties in V8.

---

### 3 — Replace `Name_CONSTANT` globals with class-property equivalents

All occurrences are in `DrawSignatureDialog` or `DrawSignaturePreviewControl`. Replace every instance as listed:

**`FrameStyle_Box` → `FrameStyle.Box`** (1 occurrence, line 566):
- [ ] `this.helpLabel.frameStyle = FrameStyle_Box;` → `this.helpLabel.frameStyle = FrameStyle.Box;`

**`TextAlign_Right|TextAlign_VertCenter` → `TextAlignment.Right|TextAlignment.VertCenter`** (13 occurrences):
- [ ] Line 585: `this.targetImage_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 604: `this.fontFace_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 634: `this.fontSize_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 667: `this.margin_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 702: `this.textOpacity_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 731: `this.logoOpacity_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 822: `this.catalog_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 831: `this.subject_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 851: `this.integrationMode_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 901: `this.exposure_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 913: `this.frames_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 940: `this.directIntegration_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 1097: `this.date_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`
- [ ] Line 1112: `this.location_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;`

  All become: `... = TextAlignment.Right|TextAlignment.VertCenter;`

**`StdCursor_ClosedHand` → `StdCursor.ClosedHand`** (1 occurrence, line 1368):
- [ ] `this.cursor = new Cursor(StdCursor_ClosedHand);` → `this.cursor = new Cursor(StdCursor.ClosedHand);`

**`StdCursor_OpenHand` → `StdCursor.OpenHand`** (1 occurrence, line 1385):
- [ ] `this.cursor = new Cursor(StdCursor_OpenHand);` → `this.cursor = new Cursor(StdCursor.OpenHand);`

**`StdIcon_Error` → `StdIcon.Error`** (2 occurrences, lines 1441 and 1457):
- [ ] Line 1441: `(#TITLE + " Script"), StdIcon_Error, StdButton_Ok );`
- [ ] Line 1457: `(#TITLE + " Script"), StdIcon_Error, StdButton_Ok );`

  Both become: `(#TITLE + " Script"), StdIcon.Error, StdButton.Ok );`

**`StdButton_Ok` → `StdButton.Ok`** (2 occurrences, same lines as above — handled by the replacements above).

---

### 4 — Convert `__base__` inheritance to ES6 `class` syntax

#### 4a — `DrawSignatureDialog` (lines 553–1275)

- [ ] **Replace the constructor function signature and `__base__` calls:**
  ```js
  // BEFORE (lines 553–556):
  function DrawSignatureDialog()
  {
     this.__base__ = Dialog;
     this.__base__();

  // AFTER:
  class DrawSignatureDialog extends Dialog {
     constructor() {
        super();
  ```

- [ ] **Close the constructor body and close the class** in place of the old closing brace on line 1274, then **delete the prototype assignment** on line 1275:
  ```js
  // BEFORE (lines 1273–1275):
     this.setFixedSize();
  }
  DrawSignatureDialog.prototype = new Dialog;

  // AFTER:
     this.setFixedSize();
     }  // end constructor
  }      // end class DrawSignatureDialog
  ```

  Note: `DrawSignatureDialog` has no prototype methods — all behaviour is assigned inside the constructor body. No method hoisting is required.

#### 4b — `DrawSignaturePreviewControl` (lines 1277–1415)

- [ ] **Replace the constructor function signature and `__base__` calls:**
  ```js
  // BEFORE (lines 1277–1279):
  function DrawSignaturePreviewControl(parent) {
     this.__base__ = ScrollBox;
     this.__base__(parent);

  // AFTER:
  class DrawSignaturePreviewControl extends ScrollBox {
     constructor(parent) {
        super(parent);
  ```

- [ ] **Close the constructor body and close the class** in place of the old closing brace on line 1414, then **delete the prototype assignment** on line 1415:
  ```js
  // BEFORE (lines 1413–1415):
     this.initScrollBars();
  }
  DrawSignaturePreviewControl.prototype = new ScrollBox;

  // AFTER:
     this.initScrollBars();
     }  // end constructor
  }      // end class DrawSignaturePreviewControl
  ```

  Note: `DrawSignaturePreviewControl` also has no prototype methods — all methods (`getImage`, `doUpdateImage`, `initScrollBars`, `zoomIn`, `zoomOut`) and all viewport event handlers are assigned inside the constructor. They remain as `this.methodName = function() {}` assignments inside `constructor()` — they do **not** need to move into the class body as proper methods.

---

### 5 — Fix `console` → `Console` (convention, not a breaking change)

**Context:** The official PixInsight V8 porting guide itself uses lowercase `console.show()` and `console.writeln()` in its code examples, confirming that V8 aliases `console` to `Console`. This means the existing lowercase calls in `MasterSignature.js` will **not crash** in V8 — the script will run as-is. However, lowercase `console` is not the documented PixInsight API and should be standardised.

There are 35 occurrences of `console.writeln`, `console.warningln`, `console.criticalln`, and `console.hide`. Replace with the canonical uppercase form:

- [ ] Global find-and-replace: `console.writeln(` → `Console.writeln(`  
  _(~28 occurrences including `#ifdef __DEBUG__` blocks)_
- [ ] Global find-and-replace: `console.warningln(` → `Console.warningln(`  
  _(~4 occurrences)_
- [ ] Global find-and-replace: `console.criticalln(` → `Console.criticalln(`  
  _(~5 occurrences across `draw()`, `updatePreview()`, logo-load catch blocks)_
- [ ] Global find-and-replace: `console.hide()` → `Console.hide()`  
  _(1 occurrence in `main()`, line 1433)_

  Use case-sensitive replace only. There are no existing `Console.` calls in the file to accidentally double-replace.

  > **Priority:** Do this in the same pass as the other changes for a clean script, but if time is short, skip it — the script will function correctly either way in V8.

---

### 6 — Convert arrow-function event handlers to regular `function()` with `self`

Three event handlers use arrow functions inside `DrawSignatureDialog.constructor()`. Because arrow functions capture `this` lexically from the surrounding constructor, they appear to work — but only because they are inside the constructor where `this` is the dialog. After the class conversion `this` inside the constructor is still the dialog, so this pattern will continue to work. However, the PJSR event-handler contract passes the **control itself** as `this` inside the callback. Arrow functions bypass this entirely. The safe, correct, and future-proof fix is to convert them.

At the top of the `DrawSignatureDialog` constructor (inside `constructor()`, before the first `new Label`), `const self = this;` must already be declared. If it is not there after the class conversion, add it. Then convert:

- [ ] **`refreshPreview_Button.onClick`** (line 809):
  ```js
  // BEFORE:
  this.refreshPreview_Button.onClick = () => {
     this.updatePreview();
  };

  // AFTER:
  this.refreshPreview_Button.onClick = function() {
     self.updatePreview();
  };
  ```

- [ ] **`zoomInButton.onClick`** (line 1136):
  ```js
  // BEFORE:
  this.zoomInButton.onClick = () => {
     this.previewControl.zoomIn();
  };

  // AFTER:
  this.zoomInButton.onClick = function() {
     self.previewControl.zoomIn();
  };
  ```

- [ ] **`zoomOutButton.onClick`** (line 1144):
  ```js
  // BEFORE:
  this.zoomOutButton.onClick = () => {
     this.previewControl.zoomOut();
  };

  // AFTER:
  this.zoomOutButton.onClick = function() {
     self.previewControl.zoomOut();
  };
  ```

- [ ] **Declare `const self = this;`** at the very top of `DrawSignatureDialog.constructor()`, before any control is created. The existing `var thisDlg = this;` (line 698) and `var dlg = this;` (line 846) are separate aliases used in specific closure scopes and should be left in place exactly where they are.

---

### 7 — Language cleanup (optional but recommended)

These are cosmetic improvements consistent with V8 best practice. They are low-risk but not strictly required for the engine upgrade to work:

- [ ] Replace `var engine = new DrawSignatureEngine;` with `const engine = new DrawSignatureEngine();`
- [ ] Replace `var logoDir = ...` with `const logoDir = ...`
- [ ] Replace `var emWidth = ...` and `var labelWidth1 = ...` in the constructor with `const`
- [ ] Replace loop variables in `DrawSignatureEngine` methods that use `var i` / `var totalSeconds` with `let` / `const` where appropriate

---

## Files Affected

| File | Changes Required |
|------|-----------------|
| `Signature/MasterSignature.js` | All changes — engine directive, IIFE wrapper, remove 5 `#include` lines, 2 class conversions, 18 constant replacements, 35 `console` → `Console` fixes, 3 arrow-function handler conversions, `const self` declaration |

No other files are affected. The script is single-file with no siblings.

---

## Risk Notes

### High priority — verify carefully

**Viewport event handler preservation in `DrawSignaturePreviewControl`**
The five handlers (`onMouseWheel`, `onMousePress`, `onMouseMove`, `onMouseRelease`, `onResize`, `onPaint`) are assigned to `this.viewport` — a child control exposed by `ScrollBox`, not directly to `this`. They use `var parent = this.parent;` inside the handler body to climb back up to the `DrawSignaturePreviewControl` instance. This pattern must be preserved exactly. When converting `DrawSignaturePreviewControl` to a `class`, do **not** move these assignments into class-body methods — leave them as `this.viewport.onXxx = function(...) { var parent = this.parent; ... };` inside `constructor()`. The `this.parent` chain (`viewport.parent` === `DrawSignaturePreviewControl` instance) relies on the Qt object-parent relationship, which is unaffected by the class conversion.

**`let zoomFactor` on line 1322 shadows `this.zoomFactor`**
Inside `initScrollBars`, `let zoomFactor = this.zoomFactor;` creates a local read-only snapshot before the scroll calculations. This is intentional (avoids repeated property lookups) and is already valid ES6. Do not remove it. After the class conversion, verify the scroll range calculation still reads `zoomFactor` (the local) not `this.zoomFactor` in the two `setHorizontalScrollRange` / `setVerticalScrollRange` calls immediately below it.

**`targetImage_ViewList.onViewSelected` is assigned twice**
The handler is first assigned on line 592 (inside the control setup block), then overwritten on line 1243 (after `updatePreview` is defined). The second assignment calls `this.updatePreview()` but `this` inside that handler is the `ViewList` control, not the dialog. After the class conversion the `self` variable declared at the top of the constructor will be in scope, so change line 1243's handler to use `self.updatePreview()`:
```js
// Line 1243 — BEFORE:
this.targetImage_ViewList.onViewSelected = function(view) {
   engine.targetView = view;
   this.updatePreview();   // BUG: 'this' is the ViewList, not the dialog
};

// AFTER:
this.targetImage_ViewList.onViewSelected = function(view) {
   engine.targetView = view;
   self.updatePreview();   // correct: 'self' is the dialog
};
```
This is a pre-existing latent bug that the migration is a good opportunity to fix.

**`DrawSignatureEngine` is a plain constructor function — do not convert it to a `class`**
It does not inherit from any PJSR type and all its methods are assigned as `this.methodName = function()` inside the constructor. It works correctly as-is in V8. Converting it to a class would be purely cosmetic and risks introducing `this`-binding regressions in its many internal cross-method calls. Leave it as a constructor function.

**`getFITSKeyword` is defined after `main()` is called**
At line 1472, `getFITSKeyword` is defined after `main()` on line 1470 has already run. This works in the current global-scope execution because `DrawSignatureEngine.initialize()` (which calls `getFITSKeyword`) is called during `new DrawSignatureEngine` construction on line 547 — and at that point `getFITSKeyword` is not yet declared. This is a pre-existing hoisting bug: function declarations hoist in JavaScript but function expressions do not. The script works because `getFITSKeyword` is a **function declaration** (`function getFITSKeyword(...) {}`), so it is hoisted to the top of the current scope. Inside an IIFE with `"use strict"`, hoisting still works for function declarations — this bug will not regress. However, consider moving `getFITSKeyword` to before `DrawSignatureEngine` as a clean-up step.

**`console.hide()` in `main()` under `#ifndef __DEBUG__`**
Line 1433: `console.hide();` — this is inside a `#ifndef __DEBUG__` block and must become `Console.hide();`. The preprocessor runs before V8, so the `#ifndef` guard is evaluated correctly regardless of the engine change.

**Mixed `var thisDlg` and `var dlg` aliases**
Two separate `self`-style aliases exist inside `DrawSignatureDialog`: `var thisDlg = this` (line 698, used for the slider/spinbox cross-update callbacks in the opacity section) and `var dlg = this` (line 846, used for the integration mode controls and filter row callbacks). Both are declared in different parts of the constructor body. After the class conversion, `const self = this` will be added at the very top of the constructor. The existing `thisDlg` and `dlg` aliases must remain in place — do not attempt to consolidate them into `self`, as some callbacks they are used in are deep inside closure chains (e.g., `createFilterRow` creates inner closures that close over `dlg`). Removing `thisDlg`/`dlg` would require auditing every callback that uses them, which is out of scope for this migration.
