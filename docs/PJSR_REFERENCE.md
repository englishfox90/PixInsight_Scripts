# PJSR (PixInsight JavaScript Runtime) Comprehensive Reference

## Table of Contents
1. [Runtime Overview](#1-runtime-overview)
2. [Script Feature Directives](#2-script-feature-directives)
3. [Include Libraries](#3-include-libraries)
4. [Script Structure Patterns](#4-script-structure-patterns)
5. [Console API](#5-console-api)
6. [Settings API (Persistent Storage)](#6-settings-api)
7. [Parameters API](#7-parameters-api)
8. [File I/O](#8-file-io)
9. [Image File Formats (FileFormat / FileFormatInstance)](#9-image-file-formats)
10. [ImageWindow and View API](#10-imagewindow-and-view-api)
11. [Image Object API](#11-image-object-api)
12. [UI Widgets (Qt-based)](#12-ui-widgets)
13. [Sizer / Layout System](#13-sizer-layout-system)
14. [Process Objects (Image Processing from Scripts)](#14-process-objects)
15. [Graphics and Drawing](#15-graphics-and-drawing)
16. [Utility Globals](#16-utility-globals)
17. [FITS Keywords](#17-fits-keywords)
18. [Timer](#18-timer)
19. [Cursor](#19-cursor)
20. [Quirks, Limitations, and Gotchas](#20-quirks-limitations-and-gotchas)

---

## 1. Runtime Overview

- **Language**: ECMAScript 5.1 (ES5). No `let`, `const`, arrow functions, template literals, `class`, `Promise`, `async/await`, destructuring, `for...of`, `Map`, `Set`, or any ES6+ features.
- **No Node.js APIs**: No `require()`, `module.exports`, `process`, `Buffer`, `__dirname`, `__filename`.
- **No Browser APIs**: No `window`, `document`, `DOM`, `XMLHttpRequest`, `fetch`, `setTimeout` (use `Timer` instead), `localStorage` (use `Settings` instead).
- **Module system**: `#include` directives (C-preprocessor style). All included files share global scope.
- **String methods**: `.endsWith()`, `.startsWith()`, `.includes()`, `.trim()` ARE available (PixInsight extends the runtime).
- **JSON**: `JSON.parse()` and `JSON.stringify()` are available.
- **Date**: Standard `Date` object is available.
- **Math extensions**: `Math.range(value, min, max)` clamps a value. `Math.mtf(midtones, value)` applies midtones transfer function.
- **format()**: Global `format()` function works like C `sprintf()` - e.g. `format("%.6f", value)`.
- **Regex**: Full regex support including `.match()`, `.replace()`, `.search()`, `.split()`.

---

## 2. Script Feature Directives

Placed at the top of the main entry-point `.js` file (before any code):

```javascript
#feature-id    ScriptName : Category > Display Name
// Category hierarchy uses " > " separator
// Examples:
//   MyScript : PFRAstro > My Script
//   Multichannel Synthesis > SHO-AIP

#feature-info  Short description of the script. Supports HTML: \
               <br/> for line breaks. Use \ for line continuation. \
               Copyright &copy; 2025 Author Name

#feature-icon  @script_icons_dir/MyIcon.svg
// Can also use .xpm or .png files
// @script_icons_dir resolves to the script's directory
```

**Preprocessor directives** (C-style):
```javascript
#define CONSTANT_NAME value
#define DEBUG false

#ifndef __MY_MODULE_JS
#define __MY_MODULE_JS
// ... module content (include guard)
#endif
```

---

## 3. Include Libraries

### System includes (angle brackets):
```javascript
#include <pjsr/Sizer.jsh>           // VerticalSizer, HorizontalSizer
#include <pjsr/FrameStyle.jsh>      // FrameStyle_Box, FrameStyle_Flat, etc.
#include <pjsr/TextAlign.jsh>       // TextAlign_Left, TextAlign_Right, TextAlign_Center, TextAlign_VertCenter
#include <pjsr/StdButton.jsh>       // StdButton_Ok, StdButton_Cancel, StdButton_Yes, StdButton_No
#include <pjsr/StdIcon.jsh>         // StdIcon_Information, StdIcon_Warning, StdIcon_Error, StdIcon_Question
#include <pjsr/StdCursor.jsh>       // StdCursor_Arrow, StdCursor_ArrowWait, StdCursor_Checkmark, StdCursor_Crossmark, StdCursor_Wait
#include <pjsr/Color.jsh>           // Color constants and helpers
#include <pjsr/FontFamily.jsh>      // FontFamily_Default, FontFamily_SansSerif, FontFamily_Serif, FontFamily_Monospace, etc.
#include <pjsr/DataType.jsh>        // DataType_Boolean, DataType_Int32, DataType_UInt32, DataType_Double, DataType_String, DataType_ByteArray
#include <pjsr/UndoFlag.jsh>        // UndoFlag_DefaultMode, UndoFlag_NoSwapFile
#include <pjsr/NumericControl.jsh>  // NumericControl composite widget
#include <pjsr/SectionBar.jsh>      // SectionBar collapsible sections
#include <pjsr/ColorComboBox.jsh>   // ColorComboBox widget
#include <pjsr/Interpolation.jsh>   // Interpolation algorithm constants
#include <pjsr/SampleType.jsh>      // SampleType_Integer, SampleType_Real
#include <pjsr/ColorSpace.jsh>      // ColorSpace_Gray, ColorSpace_RGB
#include <pjsr/ButtonCodes.jsh>     // Mouse button and keyboard modifier codes
#include <pjsr/MorphOp.jsh>         // Morphological operation constants
```

### Local includes (quotes):
```javascript
#include "MyModule.js"              // Relative to current file
#include "subfolder/MyModule.js"    // Relative path supported
```

---

## 4. Script Structure Patterns

### Standard entry-point pattern:
```javascript
#feature-id    MyScript : Category > My Script
#feature-info  Description here.
#feature-icon  @script_icons_dir/Icon.svg

(function() {
"use strict";

#include <pjsr/Sizer.jsh>
#include <pjsr/DataType.jsh>
// ... other includes

#include "MyScript-core.js"
#include "MyScript-gui.js"

function main() {
   if (Parameters.isGlobalTarget) {
      Console.criticalln("This script should not run in global context.");
      return;
   }
   Console.show();
   Console.writeln("Starting...");

   var dialog = new MyDialog();
   dialog.execute();
}

main();

})(); // End IIFE
```

### Dialog class pattern (prototype-based OOP):
```javascript
function MyDialog() {
   this.__base__ = Dialog;
   this.__base__();

   this.windowTitle = "My Script v1.0";
   this.scaledMinWidth = 600;
   this.scaledMinHeight = 400;

   // Create widgets here...

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   // Add widgets to sizer...

   // Optional:
   this.adjustToContents();
   this.setFixedSize();
}

MyDialog.prototype = new Dialog;

// Add methods to prototype:
MyDialog.prototype.myMethod = function() { /* ... */ };
```

---

## 5. Console API

The `Console` object (capital C) provides console output. There is also a lowercase `console` alias.

```javascript
Console.show();                     // Show the Process Console window
Console.hide();                     // Hide the Process Console window
Console.clear();                    // Clear console output
Console.flush();                    // Flush output buffer

Console.write("text");              // Write without newline
Console.writeln("text");            // Write with newline
Console.warningln("text");          // Yellow/orange warning message (prefixed with ** Warning:)
Console.criticalln("text");         // Red error message (prefixed with *** Error:)
Console.noteln("text");             // Green success/note message

// Rich text formatting (HTML-like tags):
Console.writeln("<end><cbr/><br/><b>Bold text</b>");
Console.writeln(format("Value: %.6f", 3.14159));

// Lowercase alias also works:
console.writeln("text");
console.warningln("warning");
console.show();
console.hide();
```

---

## 6. Settings API

Persistent key/value storage that survives PixInsight restarts. Uses hierarchical key paths.

### DataType constants (from `<pjsr/DataType.jsh>`):
```
DataType_Boolean    - true/false
DataType_Int8       - 8-bit signed integer
DataType_UInt8      - 8-bit unsigned integer
DataType_Int16      - 16-bit signed integer
DataType_UInt16     - 16-bit unsigned integer
DataType_Int32      - 32-bit signed integer
DataType_UInt32     - 32-bit unsigned integer
DataType_Int64      - 64-bit signed integer
DataType_UInt64     - 64-bit unsigned integer
DataType_Float      - 32-bit float (alias: DataType_Real32)
DataType_Double     - 64-bit double (alias: DataType_Real64)
DataType_String     - String value
DataType_ByteArray  - Raw byte array
```

### Reading:
```javascript
var value = Settings.read("ModuleName/keyPath", DataType_String);
if (Settings.lastReadOK) {
   // value is valid
} else {
   // key not found or type mismatch - use default
}

// Hierarchical keys are conventional:
Settings.read("MyScript/inputDir", DataType_String);
Settings.read("MyScript/options/recursive", DataType_Boolean);
Settings.read("MyScript/version", DataType_UInt32);
Settings.read("MyScript/threshold", DataType_Double);
```

### Writing:
```javascript
Settings.write("ModuleName/keyPath", DataType_String, "value");
Settings.write("ModuleName/options/recursive", DataType_Boolean, true);
Settings.write("ModuleName/version", DataType_UInt32, 1);
Settings.write("ModuleName/threshold", DataType_Double, 0.75);
```

### Removing:
```javascript
Settings.remove("ModuleName/keyPath");
```

### Pattern: Versioned initialization check:
```javascript
var SETTINGS_VERSION = 1;
var init = Settings.read("MyModule/_initialized", DataType_UInt32);
var initialized = Settings.lastReadOK && (init === SETTINGS_VERSION);
if (!initialized) {
   // First run or version mismatch - use defaults
}
// On save:
Settings.write("MyModule/_initialized", DataType_UInt32, SETTINGS_VERSION);
```

---

## 7. Parameters API

For scripts that act as process targets (can be dropped on images). NOT used by most dialog-based scripts.

```javascript
Parameters.isGlobalTarget   // Boolean: true if executed in global context
Parameters.isViewTarget     // Boolean: true if executed on a view

// Read parameters (when script is a process instance):
if (Parameters.has("paramName")) {
   var value = Parameters.getString("paramName");
   var num   = Parameters.getReal("paramName");
   var int   = Parameters.getInteger("paramName");
   var bool  = Parameters.getBoolean("paramName");
}

// Store parameters (for process icon creation):
Parameters.set("paramName", value);
```

---

## 8. File I/O

### File class (for text/binary file operations):
```javascript
var f = new File();

// Writing:
f.createForWriting("/path/to/file.txt");
f.outText("some text");             // Write text (no newline)
f.outTextLn("line of text");        // Write text with newline
f.close();

// Reading:
f.openForReading("/path/to/file.txt");
var content = f.read(DataType_ByteArray, f.size);
f.close();

// File exists check:
File.exists("/path/to/file.txt");           // true/false

// Directory operations:
File.directoryExists("/path/to/dir");       // true/false
File.createDirectory("/path/to/dir", true); // true = create parents recursively

// Path utilities:
File.extractName("/path/to/file.fits");      // "file" (no extension, no directory)
File.extractExtension("/path/to/file.fits"); // ".fits" (includes the dot)
File.extractDrive("/path/to/file.fits");     // Drive component
File.extractDirectory("/path/to/file.fits"); // Directory component
File.appendToName("/path/file.fits", "_suffix"); // "/path/file_suffix.fits"
File.changeExtension("/path/file.fits", ".xisf"); // "/path/file.xisf"
File.fullPath("/relative/path");             // Resolves to absolute path

// File size:
File.size("/path/to/file.fits");             // Returns size in bytes
```

### searchDirectory (global function):
```javascript
// Search for files matching a pattern
var files = searchDirectory("/path/to/dir/*.fits", false); // false = non-recursive
var files = searchDirectory("/path/to/dir/*.xisf", true);  // true = recursive

// Pattern: search multiple extensions
var allFiles = [];
var exts = [".xisf", ".fits", ".fit", ".fts"];
for (var i = 0; i < exts.length; i++) {
   var pattern = dirPath + "/*" + exts[i];
   allFiles = allFiles.concat(searchDirectory(pattern, recursive));
}
```

### GetDirectoryDialog:
```javascript
var gdd = new GetDirectoryDialog();
gdd.caption = "Select Directory";
gdd.initialPath = "/initial/path";    // Optional starting directory
if (gdd.execute()) {
   var selectedDir = gdd.directory;   // User's selection
}
```

### SaveFileDialog:
```javascript
var sfd = new SaveFileDialog();
sfd.caption = "Save CSV File";
sfd.initialPath = "/suggested/path/file.csv";
sfd.overwritePrompt = true;
sfd.filters = [["CSV Files", "*.csv"], ["All Files", "*"]];
if (sfd.execute()) {
   var savePath = sfd.fileName;
}
```

### OpenFileDialog:
```javascript
var ofd = new OpenFileDialog();
ofd.caption = "Open Image File";
ofd.initialPath = "/initial/path";
ofd.multipleSelections = false;
ofd.filters = [["FITS Files", "*.fits;*.fit"], ["XISF Files", "*.xisf"], ["All Files", "*"]];
if (ofd.execute()) {
   var filePath = ofd.fileName;       // Single selection
   // var files = ofd.fileNames;      // Multiple selections (when multipleSelections = true)
}
```

---

## 9. Image File Formats

### FileFormat / FileFormatInstance (for reading FITS/XISF metadata without loading images):
```javascript
// Open a file just to read keywords (lightweight, no pixel data loaded):
function openForKeywords(path) {
   var ext = File.extractExtension(path).toLowerCase();
   var fmtId = (ext === ".xisf") ? "XISF" : "FITS";
   var fmt = new FileFormat(fmtId, false, true);  // (id, canWrite, canRead)
   if (fmt.isNull) throw new Error("No reader for: " + path);
   var f = new FileFormatInstance(fmt);
   if (f.isNull) throw new Error("Cannot create instance: " + path);
   if (!f.open(path, "verbosity 0"))             // "verbosity 0" = silent
      throw new Error("Open failed: " + path);
   return f;
}

// Read keywords from FileFormatInstance:
var ff = openForKeywords("/path/to/image.fits");
var keywords = ff.keywords;   // Array of FITSKeyword objects
for (var i = 0; i < keywords.length; i++) {
   var name  = keywords[i].name;           // e.g. "FILTER"
   var value = keywords[i].value;          // Raw value with quotes
   var stripped = keywords[i].strippedValue; // Value without quotes
   var comment = keywords[i].comment;       // FITS comment
}
ff.close();

// Helper to read a specific keyword:
function readKeyword(ff, keyName) {
   var k = ff.keywords;
   var up = keyName.toUpperCase();
   for (var i = 0; i < k.length; i++)
      if (k[i].name.toUpperCase() === up)
         return k[i].strippedValue;
   return undefined;
}
```

### FileFormat properties:
```javascript
var fmt = new FileFormat("FITS", false, true);
fmt.isNull           // Boolean
fmt.name             // Format name string
fmt.canStoreKeywords // Boolean
fmt.canStoreICCProfiles // Boolean
fmt.canStoreResolution  // Boolean
fmt.canStoreProperties  // Boolean
```

### FileFormatInstance additional methods:
```javascript
var ffi = new FileFormatInstance(fmt);
ffi.open(filePath, hints);     // hints: "verbosity 0", etc.
ffi.keywords;                  // Array of FITSKeyword objects
ffi.close();
```

---

## 10. ImageWindow and View API

### Creating ImageWindows:
```javascript
// Open existing file:
var windows = ImageWindow.open("/path/to/image.fits");
// Returns array of ImageWindow objects (usually 1 element)
var w = windows[0];

// Create new empty window:
var w = new ImageWindow(
   width,              // Integer: width in pixels
   height,             // Integer: height in pixels
   numberOfChannels,   // Integer: 1 (grayscale) or 3 (RGB)
   bitsPerSample,      // Integer: 8, 16, 32, or 64
   isFloat,            // Boolean: true for floating point samples
   isColor,            // Boolean: true for RGB
   "window_id"         // String: unique identifier
);

// Example: 32-bit float RGB:
var w = new ImageWindow(1000, 600, 3, 32, true, true, "my_image");
// Example: 32-bit float grayscale:
var w = new ImageWindow(1000, 600, 1, 32, true, false, "my_mask");
```

### ImageWindow properties and methods:
```javascript
w.mainView              // The main View object
w.currentView           // Currently active view (main or preview)
w.isNull                // Boolean
w.keywords              // Array of FITSKeyword (read/write)

// Display control:
w.show();
w.hide();
w.bringToFront();
w.zoomToFit();
w.zoomToOptimalFit();
w.fitWindow();
w.forceClose();         // Close without save prompt

// Window geometry:
w.bounds                // Rectangle {x0, y0, x1, y1}
w.zoomFactor            // Number (read/write)
w.viewportPosition      // Point (read/write)

// Previews:
w.previews              // Array of View objects (preview views)
w.previews.length       // Number of previews
w.createPreview(x0, y0, x1, y1)  // Returns new preview View
w.deletePreview(preview)          // Delete a preview
w.previewRect(preview)            // Get preview bounds: {x0, y0, x1, y1}

// Static methods:
ImageWindow.activeWindow           // Currently active window (may be null)
ImageWindow.windows                // Array of all open windows
ImageWindow.windowById("id")       // Find window by ID string
ImageWindow.open("/path/file.xisf") // Open file, returns array
```

### View properties and methods:
```javascript
var view = w.mainView;
view.id                    // String: view identifier (read/write)
view.fullId                // String: full path identifier
view.image                 // Image object (pixel data)
view.stf                   // ScreenTransferFunction array (read-only)

// Undo-protected pixel modification:
view.beginProcess(UndoFlag_NoSwapFile);  // Or UndoFlag_DefaultMode
// ... modify view.image here ...
view.endProcess();

// Property access (XISF properties, computed stats):
var median = view.computeOrFetchProperty("Median");   // Returns Vector
var mad    = view.computeOrFetchProperty("MAD");       // Returns Vector
// These return Vector objects with .at(channel) method and .mul(scalar) method
```

---

## 11. Image Object API

Access via `view.image`. The Image object provides direct pixel data access and statistics.

```javascript
var image = view.image;

// Properties:
image.width              // Integer
image.height             // Integer
image.numberOfChannels   // Integer (1 or 3 typically)
image.isColor            // Boolean
image.colorSpace         // ColorSpace_Gray or ColorSpace_RGB
image.bitsPerSample      // Integer
image.sampleType         // SampleType_Integer or SampleType_Real
image.isNull             // Boolean

// Channel selection (for per-channel operations):
image.selectedChannel = 0;   // Select channel (0=R/Gray, 1=G, 2=B)
image.resetSelections();     // Reset all selections

// Statistics (operates on selected channel):
image.median()           // Median value (0..1)
image.mean()             // Mean value
image.avgDev()           // Average deviation
image.MAD()              // Median Absolute Deviation
image.stdDev()           // Standard deviation
image.minimum()          // Minimum pixel value
image.maximum()          // Maximum pixel value

// Pixel access:
image.sample(x, y, channel)           // Read pixel value at (x,y) for channel
image.setSample(value, x, y, channel) // Write pixel value

// Image operations:
image.fill(value);                     // Fill with constant value (0..1)
image.assign(otherImage);              // Copy from another image
image.apply(otherImage, operation);    // Apply operation with another image

// Image constructor (standalone, not in a window):
var img = new Image(width, height, numberOfChannels, colorSpace, bitsPerSample, sampleType);
```

---

## 12. UI Widgets

All widgets take a parent (typically `this` inside a Dialog constructor) as the first argument.

### Dialog
```javascript
function MyDialog() {
   this.__base__ = Dialog;
   this.__base__();

   this.windowTitle = "Title";
   this.scaledMinWidth = 600;
   this.scaledMinHeight = 400;

   // Set sizer for layout
   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
}
MyDialog.prototype = new Dialog;

// Dialog methods:
dialog.execute();            // Show modal, returns StdButton_Ok or StdButton_Cancel
dialog.ok();                 // Close with OK result
dialog.cancel();             // Close with Cancel result
dialog.show();               // Show non-modal
dialog.hide();               // Hide
dialog.adjustToContents();   // Resize to fit contents
dialog.setFixedSize();       // Prevent user resizing
dialog.scaledResource(":/icons/ok.png");  // Get scaled platform icon path

// Dialog events:
dialog.onKeyPress = function(keyCode, modifiers) { return false; };
```

### MessageBox
```javascript
var msgBox = new MessageBox(
   "Message text here",           // message
   "Title",                       // title
   StdIcon_Information,           // icon: StdIcon_Information, StdIcon_Warning, StdIcon_Error, StdIcon_Question
   StdButton_Ok,                  // button1
   StdButton_Cancel               // button2 (optional)
);
var result = msgBox.execute();     // Returns which button was clicked

// Quick patterns:
// Yes/No question:
var msg = new MessageBox("Are you sure?", "Confirm", StdIcon_Question, StdButton_Yes, StdButton_No);
if (msg.execute() === StdButton_Yes) { /* proceed */ }

// Error message:
new MessageBox("Something failed: " + error, "Error", StdIcon_Error, StdButton_Ok).execute();
```

### Label
```javascript
var label = new Label(parent);
label.text = "Label text";
label.textAlignment = TextAlign_Left | TextAlign_VertCenter;
label.minWidth = 100;
label.minHeight = 20;
label.wordWrapping = true;          // Enable word wrap
label.useRichText = true;           // Enable HTML in text
label.frameStyle = FrameStyle_Box;  // Add border
label.margin = 6;                   // Padding inside frame
label.styleSheet = "QLabel { color: #666; font-weight: bold; font-size: 9pt; }";
label.backgroundColor = 0xFF4CAF50; // ARGB color
```

### Edit (single-line text input)
```javascript
var edit = new Edit(parent);
edit.text = "initial value";
edit.readOnly = true;               // Make read-only
edit.minWidth = 200;
edit.setFixedWidth(80);             // Fixed width
edit.toolTip = "Helpful tooltip text";
edit.enabled = true;                // Enable/disable

// Events:
edit.onTextUpdated = function(text) { /* text changed */ };
edit.onEditCompleted = function() { /* user pressed Enter or left field */ };
edit.onGetFocus = function() { /* field received focus */ };
edit.onLoseFocus = function() { /* field lost focus */ };
```

### TextBox (multi-line text area)
```javascript
var textBox = new TextBox(parent);
textBox.text = "multi\nline\ntext";
textBox.readOnly = true;
textBox.setMinHeight(120);
textBox.setScaledMinSize(950, 415);
textBox.styleSheet = "font-family: monospace; font-size: 10pt;";
textBox.cursorPosition = 0;         // Scroll to top
```

### PushButton
```javascript
var button = new PushButton(parent);
button.text = "Click Me";
button.toolTip = "Button description";
button.enabled = true;
button.defaultButton = true;        // Activated on Enter key
button.icon = dialog.scaledResource(":/icons/ok.png");  // Add icon
button.cursor = new Cursor(StdCursor_Checkmark);

button.onClick = function() {
   // Handle click
};
```

### ToolButton (small icon button)
```javascript
var toolBtn = new ToolButton(parent);
toolBtn.icon = dialog.scaledResource(":/browser/select-file.png");
toolBtn.setScaledFixedSize(20, 20);
toolBtn.toolTip = "Browse...";
toolBtn.onClick = function() { /* ... */ };
```

### CheckBox
```javascript
var checkBox = new CheckBox(parent);
checkBox.text = "Enable feature";
checkBox.checked = true;
checkBox.toolTip = "Description";
checkBox.enabled = true;
checkBox.tristate = false;          // For three-state checkboxes

checkBox.onCheck = function(checked) {
   // checked is Boolean
};
```

### ComboBox (dropdown)
```javascript
var combo = new ComboBox(parent);
combo.editEnabled = false;          // true = user can type custom text
combo.setFixedWidth(200);
combo.toolTip = "Select an option";

// Add items:
combo.addItem("Option 1");
combo.addItem("Option 2");
combo.addItem("Option 3");

// Access items:
combo.numberOfItems;                // Number of items
combo.currentItem;                  // Selected index (0-based, read/write)
combo.itemText(index);              // Get text of item at index

// Editable combo:
combo.editEnabled = true;
combo.editText = "custom text";     // Get/set the edit field text

// Events:
combo.onItemSelected = function(index) {
   var text = combo.itemText(index);
};
combo.onEditTextUpdated = function() {
   var text = combo.editText;
};

// Manipulation:
combo.clear();                      // Remove all items
combo.removeItem(index);            // Remove specific item
combo.insertItem(index, "text");    // Insert at position
```

### SpinBox (integer spinner)
```javascript
var spin = new SpinBox(parent);
spin.minValue = 0;
spin.maxValue = 100;
spin.value = 50;                    // Current value (integer)
spin.setFixedWidth(50);
spin.toolTip = "Value description";

spin.onValueUpdated = function(value) {
   // value is integer
};
```

### Slider
```javascript
var slider = new Slider(parent);
slider.minValue = 0;
slider.maxValue = 100;
slider.value = 50;
slider.setFixedWidth(120);
slider.toolTip = "Slider description";

slider.onValueUpdated = function(value) {
   // value is integer
};
```

### NumericControl (composite: label + slider + edit)
Requires: `#include <pjsr/NumericControl.jsh>`

```javascript
var nc = new NumericControl(parent);
nc.label.text = "Parameter:";
nc.label.minWidth = labelWidth;
nc.real = true;                     // true = floating point, false = integer
nc.setRange(0, 1);                  // Min/max value range
nc.slider.setRange(0, 1000);        // Slider step granularity
nc.slider.minWidth = 250;           // Slider visual width
nc.setPrecision(2);                 // Decimal places displayed
nc.setValue(0.50);                  // Set current value
nc.toolTip = "Parameter description";

nc.onValueUpdated = function(value) {
   // value is the new numeric value
};
```

### TreeBox (table/tree widget)
```javascript
var tree = new TreeBox(parent);
tree.alternateRowColor = true;       // Striped rows
tree.headerVisible = true;           // Show column headers
tree.numberOfColumns = 5;            // Set number of columns
tree.rootDecoration = false;         // Hide expand/collapse arrows
tree.multipleSelection = false;      // true for multi-select
tree.editEnabled = true;             // Allow inline editing
tree.setMinSize(800, 600);           // Minimum size
tree.setScaledMinHeight(300);        // Minimum height

// Column configuration:
tree.setHeaderText(0, "Column Name");
tree.setHeaderAlignment(0, TextAlign_Center);
tree.setColumnWidth(0, 150);         // Width in pixels

// Add rows:
var node = new TreeBoxNode(tree);    // Add to tree
node.setText(0, "Cell text");        // Set text for column 0
node.setText(1, "Cell text");
node.checkable = true;               // Show checkbox
node.checked = false;
// Store custom data:
node.myCustomProperty = "anything";  // You can attach arbitrary properties

// Access:
tree.numberOfChildren;               // Row count
tree.child(index);                   // Get node at index
tree.selectedNodes;                  // Array of selected TreeBoxNode objects
tree.currentNode;                    // Currently focused node

// Manipulation:
tree.clear();                        // Remove all rows
tree.remove(index);                  // Remove row at index

// Events:
tree.onNodeUpdated = function(node, column) {
   // Called when a cell is edited
   var newText = node.text(column);
};
tree.onNodeDoubleClicked = function(node, column) { /* ... */ };
tree.onNodeSelectionUpdated = function() {
   var selected = tree.selectedNodes;
};
tree.onKeyPress = function(keyCode, modifiers) {
   return false; // return true to consume the key event
};
```

### TreeBoxNode properties:
```javascript
var node = new TreeBoxNode(tree);
// Or: new TreeBoxNode(parentNode); for child nodes (tree hierarchy)

node.setText(column, "text");
node.text(column);                   // Get text
node.setIcon(column, iconBitmap);
node.setTextColor(column, 0xFFFF0000); // Red text (ARGB)
node.setBackgroundColor(column, 0xFFFFFFE0); // Light yellow bg
node.setFont(column, new Font("Helvetica", 10));
node.setAlignment(column, TextAlign_Center);
node.checkable = true;
node.checked = false;
node.enabled = true;
node.selected = true;
node.expanded = true;                // For tree nodes with children
```

### GroupBox
```javascript
var gb = new GroupBox(parent);
gb.title = "Section Title";
gb.sizer = new VerticalSizer;       // Must assign a sizer
gb.sizer.margin = 6;
gb.sizer.spacing = 4;
gb.styleSheet = "QGroupBox { padding-top: 0px; margin-top: 0px; }";

// Add widgets to gb.sizer
gb.sizer.add(someWidget);
```

### ViewList (dropdown of open ImageWindows)
```javascript
var viewList = new ViewList(parent);
viewList.getAll();                   // Populate with all open views
viewList.currentView = someView;     // Pre-select a view
viewList.minWidth = 300;
viewList.toolTip = "Select an image";

viewList.onViewSelected = function(view) {
   // view is the selected View object
};
```

### Control (generic base widget)
```javascript
var ctrl = new Control(parent);
ctrl.setScaledFixedHeight(25);
ctrl.backgroundColor = 0xFFE0E0E0;
ctrl.sizer = new HorizontalSizer;

// Custom painting:
ctrl.onPaint = function(x0, y0, x1, y1) {
   var g = new VectorGraphics(this);
   g.antialiasing = true;
   // ... draw ...
   g.end();
};

ctrl.repaint();                      // Request repaint
```

---

## 13. Sizer / Layout System

```javascript
// Requires: #include <pjsr/Sizer.jsh>

// Vertical layout:
var vs = new VerticalSizer;
vs.margin = 8;          // Outer margin in pixels
vs.spacing = 6;         // Space between children
vs.add(widget);          // Add widget (natural size)
vs.add(widget, 100);     // Add with stretch factor (takes available space)
vs.addStretch();         // Add expandable space
vs.addSpacing(12);       // Add fixed space

// Horizontal layout:
var hs = new HorizontalSizer;
hs.margin = 0;
hs.spacing = 4;
hs.add(label);
hs.add(edit, 100);       // Edit takes remaining space
hs.add(button);
hs.addStretch();

// Assign to dialog/groupbox:
this.sizer = new VerticalSizer;
groupBox.sizer = new VerticalSizer;

// Nesting pattern:
var mainSizer = new VerticalSizer;
var row1 = new HorizontalSizer;
row1.add(label1);
row1.add(edit1, 100);
mainSizer.add(row1);
mainSizer.add(treeBox, 100);  // Tree takes vertical space
mainSizer.add(buttonRow);
this.sizer = mainSizer;
```

---

## 14. Process Objects

PixInsight processes can be instantiated and executed from scripts. Each process is a class.

### Common execution patterns:
```javascript
// Execute on a view (applies to the target image):
var P = new HistogramTransformation();
// ... configure parameters ...
P.executeOn(view, false);       // false = no undo swap file

// Execute globally (generates new images):
var P = new ImageIntegration();
// ... configure parameters ...
var success = P.executeGlobal();

// Execute on a view with undo:
view.beginProcess(UndoFlag_NoSwapFile);
P.executeOn(view);
view.endProcess();
```

### ScreenTransferFunction (STF - non-destructive display stretch):
```javascript
var stf = new ScreenTransferFunction();
// STF array: [R, G, B, L/Alpha], each is [c0, c1, m, r0, r1]
// c0 = shadows clip, c1 = highlights clip, m = midtones, r0 = output low, r1 = output high
stf.STF = [
   [c0, 1, m, 0, 1],    // Red
   [c0, 1, m, 0, 1],    // Green
   [c0, 1, m, 0, 1],    // Blue
   [0, 1, 0.5, 0, 1]    // Alpha (identity)
];
stf.executeOn(view);     // Non-destructive: only changes display
```

### HistogramTransformation (permanent stretch):
```javascript
var HT = new HistogramTransformation();
// H array: [R, G, B, Alpha], each is [midtones, shadows, highlights, outputLow, outputHigh]
HT.H = [
   [m, c0, c1, 0, 1],   // Red (note: order differs from STF!)
   [m, c0, c1, 0, 1],   // Green
   [m, c0, c1, 0, 1],   // Blue
   [0, 0.5, 1, 0, 1]    // Alpha (identity)
];
HT.executeOn(view, false);  // false = no swap file
```

### PixelMath:
```javascript
var P = new PixelMath();
P.expression = "$T * 0.5";            // Expression for R (or all if single)
P.expression1 = "";                    // G channel expression (empty = use expression)
P.expression2 = "";                    // B channel expression
P.useSingleExpression = true;          // Apply same expression to all channels
P.createNewImage = false;              // true = create new window, false = modify target
P.newImageId = "result";               // ID for new image
P.newImageWidth = 0;                   // 0 = same as target
P.newImageHeight = 0;
P.newImageColorSpace = PixelMath.prototype.SameAsTarget;  // Or .RGB, .Gray
P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
P.rescale = false;
P.truncate = true;
P.truncateLower = 0;
P.truncateUpper = 1;
P.generateOutput = true;

// Expressions can reference:
// $T = target image
// $T[0], $T[1], $T[2] = individual channels
// ImageId = reference another open image by its view ID
// K1, K2 = named constants in symbols
P.symbols = "K1=0.5, K2=0.3";         // Define symbol values

P.executeOn(view);
// Or for global (create new image): P.executeGlobal();
```

### ImageIntegration:
```javascript
var P = new ImageIntegration();
P.images = [
   [true, "/path/to/sub1.xisf", "", ""],   // [enabled, path, drizzlePath, localNormPath]
   [true, "/path/to/sub2.xisf", "", ""],
   [true, "/path/to/sub3.xisf", "", ""]
];
P.combination = ImageIntegration.prototype.Average;        // or .Median, .Minimum, .Maximum
P.normalization = ImageIntegration.prototype.AdditiveWithScaling; // or .Multiplicative, .AdditiveWithScaling, .NoNormalization
P.weightMode = ImageIntegration.prototype.DontCare;        // or .ExposureTime, .Noise, .SNR, .KeywordWeight
P.weightKeyword = "";
P.weightScale = ImageIntegration.prototype.WeightScale_IKSS;

// Rejection algorithms:
P.rejection = ImageIntegration.prototype.PercentileClip;   // or .SigmaClip, .WinsorizedSigmaClip, .LinearFit, .ESD, .NoRejection
P.rejectionNormalization = ImageIntegration.prototype.Scale;
P.minMaxLow = 1;
P.minMaxHigh = 1;
P.pcClipLow = 0.27;
P.pcClipHigh = 0.13;
P.sigmaLow = 4.00;
P.sigmaHigh = 3.00;
P.linearFitLow = 5.00;
P.linearFitHigh = 2.50;

// Range clipping:
P.rangeClipLow = false;
P.rangeLow = 0.0;
P.rangeClipHigh = false;
P.rangeHigh = 0.98;

// Output:
P.generate64BitResult = false;
P.generateRejectionMaps = false;
P.generateIntegratedImage = true;
P.generateDrizzleData = false;
P.closePreviousImages = false;

var result = P.executeGlobal();
```

### Invert:
```javascript
var P = new Invert();
P.executeOn(view);
```

### SCNR (Subtractive Chromatic Noise Reduction):
```javascript
var P = new SCNR();
P.amount = 1.00;
P.protectionMethod = SCNR.prototype.AverageNeutral;  // or .MaximumNeutral, .AdditiveMask, .MaximumMask
P.colorToRemove = SCNR.prototype.Green;              // or .Red, .Blue
P.preserveLightness = true;
P.executeOn(view);
```

### LRGBCombination:
```javascript
var P = new LRGBCombination();
P.channelL = [true,  "luminance_view_id"]; // [enabled, viewId]
P.channelR = [false, ""];
P.channelG = [false, ""];
P.channelB = [false, ""];
P.executeOn(view);
```

### MorphologicalTransformation:
```javascript
var M = new MorphologicalTransformation();
M.operator = MorphologicalTransformation.prototype.Erosion;   // or .Dilation, .Opening, .Closing, .Median
M.interlacingDistance = 1;
M.lowThreshold = 0.0;
M.highThreshold = 0.0;
M.numberOfIterations = 1;
M.amount = 1.0;
M.selectionPoint = 0.5;
// Structure element (kernel):
M.structureName = "";
M.structureSize = 3;
M.structureWayTable = [  // 3x3 box kernel example
   1, 1, 1,
   1, 1, 1,
   1, 1, 1
];
M.executeOn(view);
```

### StarNet / StarXTerminator:
```javascript
// StarNet2 (if installed):
var P = new StarNet();
P.stride = StarNet.prototype.Stride_128;   // or Stride_64, Stride_256
P.mask = true;                              // Generate star mask
P.executeOn(view);

// StarXTerminator (if installed - version-safe):
var P = new StarXTerminator();
// Properties vary by version - check with hasOwnProperty():
if (P.hasOwnProperty("linear")) P.linear = true;
if (P.hasOwnProperty("createStarlessImage")) P.createStarlessImage = true;
P.executeOn(view);
```

### Checking if a process is available:
```javascript
function isProcessAvailable(processName) {
   try {
      if (processName === "StarNet2") { new StarNet(); return true; }
      if (processName === "StarXTerminator") { new StarXTerminator(); return true; }
   } catch (e) { return false; }
   return false;
}
```

---

## 15. Graphics and Drawing

### Bitmap:
```javascript
var bmp = new Bitmap(width, height);
bmp.fill(0xFFFFFFFF);               // Fill with ARGB color (white)

// Load from file:
var bmp = new Bitmap("/path/to/image.png");
bmp.width;                           // Read-only
bmp.height;                          // Read-only
```

### VectorGraphics (draw on Bitmap):
```javascript
var g = new VectorGraphics(bmp);
g.antialiasing = true;
g.textAntialiasing = true;

// Pen (for lines and outlines):
g.pen = new Pen(0xFF0000FF, 2);      // (ARGB color, width)
// Or: g.pen = new Pen(color, width, style)

// Brush (for fills):
g.brush = new Brush(0x80FF0000);     // Semi-transparent red

// Font:
g.font = new Font("Helvetica", 12);  // (face, size)
// Font families: "Helvetica", "Times", "Courier", "SansSerif", "Serif", "Monospace"
var textWidth = g.font.width("text"); // Measure text width

// Drawing operations:
g.drawLine(x0, y0, x1, y1);
g.drawRect(x0, y0, x1, y1);
g.fillRect(x0, y0, x1, y1);         // Uses current brush
g.drawCircle(cx, cy, radius);
g.fillCircle(cx, cy, radius);
g.drawText(x, y, "text");            // Draw text at position
g.drawTextRect(x0, y0, x1, y1, "text", alignment); // Draw text within rect

g.end();                              // Finalize drawing

// Save bitmap to file:
bmp.save("/path/to/output.png", "PNG");
```

### VectorGraphics on Control (for custom painting):
```javascript
ctrl.onPaint = function(x0, y0, x1, y1) {
   var g = new VectorGraphics(this);
   g.antialiasing = true;
   g.pen = new Pen(0xFF000000, 1);
   g.drawLine(0, 0, 100, 100);
   g.end();
};
```

---

## 16. Utility Globals

### processEvents()
Essential for keeping the UI responsive during long operations:
```javascript
processEvents();    // Process pending UI events
// Call periodically in loops to prevent UI freeze
// Example:
for (var i = 0; i < files.length; i++) {
   // ... process file ...
   if (i % 10 === 0) processEvents();
}
```

### format() (sprintf-like):
```javascript
format("Value: %.6f", 3.14159);       // "Value: 3.141590"
format("Count: %d", 42);              // "Count: 42"
format("Name: %s", "test");           // "Name: test"
format("%04d", 7);                     // "0007"
```

### Math extensions:
```javascript
Math.range(value, min, max);           // Clamp value to [min, max]
Math.mtf(midtones, value);            // Midtones transfer function
// Returns: MTF(midtones, value) used for STF/HT calculations
```

### FITSKeyword constructor:
```javascript
var kw = new FITSKeyword("KEYNAME", "value", "comment");
kw.name;            // String
kw.value;           // String (raw, may include quotes)
kw.strippedValue;   // String (quotes removed)
kw.comment;         // String
kw.isNull;          // Boolean
```

### Clipboard:
```javascript
// Not a standard PJSR global - some scripts use platform-specific workarounds
// If available: requires platform detection
```

---

## 17. FITS Keywords

### Common FITS keywords used in astrophotography:
```
IMAGETYP / IMGTYPE  - Frame type: "Light Frame", "Dark Frame", "Flat Frame", "Bias Frame"
FRAMETYPE           - Alternative frame type keyword
DATE-OBS / DATEOBS  - Observation date/time (ISO 8601: "2025-03-21T04:41:04.873")
FILTER              - Filter name (e.g., "Ha", "OIII", "L", "Red")
EXPTIME / EXPOSURE  - Exposure time in seconds
XBINNING / YBINNING - Binning factor
GAIN / EGAIN        - Camera gain
OFFSET              - Camera offset
CCD-TEMP / SET-TEMP - Sensor temperature (Celsius)
AMBTEMP / AMBIENTTEMP - Ambient temperature
FOCALLEN            - Focal length (mm)
TELESCOP            - Telescope name
INSTRUME            - Instrument/camera name
OBJECT              - Target object name
RA / DEC            - Right ascension / Declination
SITELAT / SITELONG  - Site latitude / longitude
SITEELEV            - Site elevation (meters)
AIRMASS             - Airmass value
SQM / SKYMAG        - Sky quality meter reading
SKYBRGHT / SKY-BRGHT - Sky brightness
FWHM / SEEING       - Seeing measurement
BORTLE / LIGHTPOL   - Light pollution scale
HUMIDITY            - Humidity percentage
PRESSURE            - Atmospheric pressure
DEWPOINT            - Dew point temperature
WINDSPD             - Wind speed
SKYTEMP             - Sky temperature
NIMAGES             - Number of integrated images
```

### Reading keywords from ImageWindow:
```javascript
var keywords = imageWindow.keywords;  // Array of FITSKeyword
for (var i = 0; i < keywords.length; i++) {
   if (keywords[i].name.toUpperCase() === "FILTER") {
      return keywords[i].strippedValue;
   }
}
```

### Writing keywords to ImageWindow:
```javascript
var keywords = imageWindow.keywords;
// Add new keyword:
keywords.push(new FITSKeyword("KEYNAME", "value", "comment"));
// Write back:
imageWindow.keywords = keywords;
```

---

## 18. Timer

```javascript
var timer = new Timer();
timer.interval = 0.5;          // Interval in seconds (supports decimals)
timer.periodic = true;          // true = repeats, false = one-shot
timer.onTimeout = function() {
   // Called when timer fires
   processEvents();             // Keep UI responsive
};
timer.start();
// ...
timer.stop();
```

---

## 19. Cursor

```javascript
// Set cursor on a widget or dialog:
this.cursor = new Cursor(StdCursor_ArrowWait);

// Standard cursors (from <pjsr/StdCursor.jsh>):
StdCursor_Arrow            // Normal arrow
StdCursor_ArrowWait        // Arrow with hourglass
StdCursor_Wait             // Hourglass/spinner
StdCursor_Crossmark        // X mark
StdCursor_Checkmark        // Checkmark
StdCursor_Cross            // Crosshair
StdCursor_NoCursor         // Hidden cursor
```

---

## 20. Quirks, Limitations, and Gotchas

### Language limitations (ES5 only):
- **No `let` or `const`** - use `var` everywhere
- **No arrow functions** - use `function() {}`
- **No template literals** - use string concatenation: `"text " + value + " more"`
- **No destructuring** - no `var {a, b} = obj;` or `var [x, y] = arr;`
- **No `class` keyword** - use prototype-based OOP (see Dialog pattern above)
- **No `Promise`, `async/await`** - everything is synchronous
- **No `for...of`** - use `for (var i = 0; i < arr.length; i++)`
- **No `Map`, `Set`, `WeakMap`, `WeakSet`** - use plain objects and arrays
- **No `Symbol`**, no `Proxy`, no `Reflect`
- **No spread operator** (`...`), no rest parameters
- **No default parameter values** - use `param = param || defaultValue;`
- **No `Object.keys()`, `Object.values()`, `Object.entries()`** in some builds - use `for (var key in obj)` with `hasOwnProperty`
- **No `Array.isArray()`** in some builds - use `instanceof Array`
- **`.forEach()`, `.map()`, `.filter()`, `.reduce()`** ARE available (ES5 array methods)

### PJSR-specific gotchas:
- **`#include` shares global scope** - all variables in included files are global. Use IIFE + `"use strict"` to catch accidental globals.
- **`processEvents()` is essential** - call it periodically in long loops or the UI freezes and PixInsight may become unresponsive.
- **`Console` vs `console`** - both work, but `Console` (capital C) is the canonical PJSR object. Some scripts use lowercase.
- **No `setTimeout`/`setInterval`** - use `Timer` object instead.
- **Dialog.execute() is modal** - blocks until dialog is closed. Use `Dialog.show()` for non-modal.
- **`view.beginProcess()` / `view.endProcess()`** - MUST wrap any pixel modifications. Forgetting these causes undo system corruption.
- **`UndoFlag_NoSwapFile`** - use this for temporary/preview images to avoid unnecessary disk I/O.
- **`ImageWindow.open()` returns an array** - always index `[0]` even for single files.
- **`forceClose()` vs close()** - `forceClose()` skips the "save changes?" dialog. Use for temporary windows.
- **Settings are persistent across sessions** - stored in PixInsight's internal database, not in files.
- **`Settings.lastReadOK`** - MUST check this after every `Settings.read()` call. The return value is undefined if the key doesn't exist.
- **`searchDirectory()` returns full paths** - including the drive letter on Windows.
- **File paths** - PixInsight normalizes to forward slashes internally, but Windows paths with backslashes usually work too.
- **StyleSheet** - uses Qt stylesheet syntax (CSS-like): `"QLabel { color: #666; font-weight: bold; }"`.
- **`scaledMinWidth` / `scaledMinHeight`** - use these on Dialog for DPI-aware sizing.
- **`setFixedWidth(n)` / `setFixedHeight(n)`** - pixel values, not scaled.
- **`setScaledFixedWidth(n)` / `setScaledFixedHeight(n)`** - DPI-scaled values.
- **ComboBox is 0-indexed** - `currentItem = 0` is the first item.
- **TreeBox columns are 0-indexed** - `setText(0, "text")` sets the first column.
- **`node.text(column)`** - function call with parentheses (not a property).
- **PixelMath expressions** - `$T` refers to the target image. Use view IDs to reference other images.
- **Process parameter access** - use `Process.prototype.ConstantName` for enum values (e.g., `ImageIntegration.prototype.Average`).
- **`format()` is global** - not `String.format()` or `console.format()`.
- **Colors are ARGB** - `0xFFRRGGBB` format. Alpha is the high byte. `0xFF000000` = opaque black.
- **`Math.mtf(m, x)`** - midtones transfer function. `m` is the midtones balance (0-1), `x` is the input value. Used extensively in STF calculations.
- **Script icons** - SVG is preferred. Can also use XPM (embedded) or PNG.
- **`#feature-id` format** - `ScriptId : Category > Display Name`. The category determines menu placement.
- **Error stack traces** - `error.stack` may or may not be available. Always wrap in try/catch with `(e.stack || "No stack trace")`.
- **Performance** - PJSR is single-threaded. Heavy image processing should use process objects (they use native C++ internally) rather than pixel-by-pixel JavaScript loops.
- **Memory** - Large images consume significant memory. Close temporary ImageWindows with `forceClose()` when done.
- **`with` statement** - Works in ES5 strict mode is NOT compatible with `with`. Some older scripts use it (`with(this.control) { ... }`). Avoid in strict-mode code.

### Common PixInsight resource paths:
```javascript
dialog.scaledResource(":/icons/ok.png");
dialog.scaledResource(":/icons/cancel.png");
dialog.scaledResource(":/browser/select-file.png");
// These are built-in platform resources
```

---

## Appendix: Complete Include Library Quick Reference

| Include File | Provides |
|---|---|
| `<pjsr/Sizer.jsh>` | `VerticalSizer`, `HorizontalSizer` |
| `<pjsr/FrameStyle.jsh>` | `FrameStyle_Box`, `FrameStyle_Flat`, `FrameStyle_Styled`, `FrameStyle_Sunken`, `FrameStyle_Raised` |
| `<pjsr/TextAlign.jsh>` | `TextAlign_Left`, `TextAlign_Right`, `TextAlign_Center`, `TextAlign_VertCenter`, `TextAlign_HorzCenter` |
| `<pjsr/StdButton.jsh>` | `StdButton_Ok`, `StdButton_Cancel`, `StdButton_Yes`, `StdButton_No`, `StdButton_Abort`, `StdButton_Retry`, `StdButton_Ignore` |
| `<pjsr/StdIcon.jsh>` | `StdIcon_Information`, `StdIcon_Warning`, `StdIcon_Error`, `StdIcon_Question` |
| `<pjsr/StdCursor.jsh>` | `StdCursor_Arrow`, `StdCursor_ArrowWait`, `StdCursor_Wait`, `StdCursor_Cross`, `StdCursor_Checkmark`, `StdCursor_Crossmark`, `StdCursor_NoCursor` |
| `<pjsr/Color.jsh>` | Color utility functions and constants |
| `<pjsr/FontFamily.jsh>` | `FontFamily_Default`, `FontFamily_SansSerif`, `FontFamily_Serif`, `FontFamily_Script`, `FontFamily_Monospace`, `FontFamily_Decorative`, `FontFamily_Symbol` |
| `<pjsr/DataType.jsh>` | `DataType_Boolean`, `DataType_Int8/16/32/64`, `DataType_UInt8/16/32/64`, `DataType_Float`, `DataType_Double`, `DataType_String`, `DataType_ByteArray` |
| `<pjsr/UndoFlag.jsh>` | `UndoFlag_DefaultMode`, `UndoFlag_NoSwapFile` |
| `<pjsr/NumericControl.jsh>` | `NumericControl` composite widget class |
| `<pjsr/SectionBar.jsh>` | `SectionBar` collapsible section widget |
| `<pjsr/ColorComboBox.jsh>` | `ColorComboBox` color picker dropdown |
| `<pjsr/Interpolation.jsh>` | Interpolation algorithm constants for resize/transform |
| `<pjsr/SampleType.jsh>` | `SampleType_Integer`, `SampleType_Real` |
| `<pjsr/ColorSpace.jsh>` | `ColorSpace_Gray`, `ColorSpace_RGB`, `ColorSpace_CIELab`, etc. |
| `<pjsr/ButtonCodes.jsh>` | Mouse button codes, keyboard modifier flags |
| `<pjsr/MorphOp.jsh>` | Morphological operation constants |

---

## Appendix: Process Object Quick Reference

| Process Class | Use | Execution |
|---|---|---|
| `ScreenTransferFunction` | Non-destructive display stretch | `executeOn(view)` |
| `HistogramTransformation` | Permanent histogram stretch | `executeOn(view, false)` |
| `PixelMath` | Mathematical pixel operations | `executeOn(view)` or `executeGlobal()` |
| `ImageIntegration` | Stack multiple images | `executeGlobal()` |
| `Invert` | Invert image | `executeOn(view)` |
| `SCNR` | Remove chromatic noise | `executeOn(view)` |
| `LRGBCombination` | Combine luminance with RGB | `executeOn(view)` |
| `MorphologicalTransformation` | Erosion, dilation, opening, closing | `executeOn(view)` |
| `StarNet` | StarNet2 star removal | `executeOn(view)` |
| `StarXTerminator` | StarXTerminator star removal | `executeOn(view)` |
| `Convolution` | Convolution/blurring | `executeOn(view)` |
| `MultiscaleMedianTransform` | Multiscale noise reduction | `executeOn(view)` |
| `ATrousWaveletTransform` | Wavelet denoising | `executeOn(view)` |
| `BackgroundNeutralization` | Neutralize background color | `executeOn(view)` |
| `ColorCalibration` | Calibrate colors | `executeOn(view)` |
| `AutoHistogram` | Automatic histogram stretch | `executeOn(view)` |
| `CurvesTransformation` | Curves adjustment | `executeOn(view)` |
| `ColorSaturation` | Adjust color saturation | `executeOn(view)` |
| `ChannelExtraction` | Split RGB into channels | `executeGlobal()` |
| `ChannelCombination` | Merge channels into RGB | `executeOn(view)` |
| `StarAlignment` | Align images to reference | `executeGlobal()` |
| `ImageCalibration` | Dark/flat/bias calibration | `executeGlobal()` |
| `SubframeSelector` | Evaluate subframe quality | `executeGlobal()` |
| `DynamicCrop` | Crop image | `executeOn(view)` |
| `Resample` | Resize image | `executeOn(view)` |
| `Rotation` | Rotate image | `executeOn(view)` |
| `IntegerResample` | Integer factor resampling | `executeOn(view)` |

Each process has its own parameters accessible as properties. Use the Process Console in PixInsight to discover parameters: run a process with desired settings through the GUI, then check the console output or use "Script > Process > Export as Script" to see the PJSR code.
