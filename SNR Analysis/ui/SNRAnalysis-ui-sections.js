/*
 * SNRAnalysis-ui-sections.js
 * UI section builders for input/configuration controls
 */

/**
 * Build input section (directory selection and file pattern)
 */
function buildInputSection(dialog) {
   var inputGroupBox = new GroupBox(dialog);
   inputGroupBox.title = "Subframe Selection";
   inputGroupBox.sizer = new VerticalSizer;
   inputGroupBox.sizer.margin = 6;
   inputGroupBox.sizer.spacing = 4;
   
   // Input directory
   var inputDirLabel = new Label(dialog);
   inputDirLabel.text = "Input Directory:";
   inputDirLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   var inputDirEdit = new Edit(dialog);
   inputDirEdit.text = CONFIG.inputDir;
   inputDirEdit.minWidth = 400;
   inputDirEdit.onTextUpdated = function(value) {
      CONFIG.inputDir = value;
   };
   
   var inputDirButton = new ToolButton(dialog);
   inputDirButton.icon = dialog.scaledResource(":/browser/select-file.png");
   inputDirButton.setScaledFixedSize(20, 20);
   inputDirButton.toolTip = "Select directory";
   inputDirButton.onClick = function() {
      var dirDialog = new GetDirectoryDialog();
      dirDialog.caption = "Select Input Directory";
      if (dirDialog.execute()) {
         inputDirEdit.text = dirDialog.directory;
         CONFIG.inputDir = dirDialog.directory;
      }
   };
   
   var inputDirSizer = new HorizontalSizer;
   inputDirSizer.spacing = 4;
   inputDirSizer.add(inputDirLabel);
   inputDirSizer.add(inputDirEdit, 100);
   inputDirSizer.add(inputDirButton);
   
   // File pattern
   var patternLabel = new Label(dialog);
   patternLabel.text = "File Pattern:";
   patternLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   patternLabel.minWidth = 100;
   
   var patternEdit = new Edit(dialog);
   patternEdit.text = CONFIG.filePattern;
   patternEdit.onTextUpdated = function(value) {
      CONFIG.filePattern = value;
   };
   
   var patternSizer = new HorizontalSizer;
   patternSizer.spacing = 4;
   patternSizer.add(patternLabel);
   patternSizer.add(patternEdit, 100);
   
   // Analyze all filters checkbox
   var analyzeAllCheck = new CheckBox(dialog);
   analyzeAllCheck.text = "Analyze all filters separately (groups by FILTER header)";
   analyzeAllCheck.checked = CONFIG.analyzeAllFilters;
   analyzeAllCheck.toolTip = "When enabled, subframes are grouped by FILTER header and analyzed independently";
   analyzeAllCheck.onCheck = function(checked) { CONFIG.analyzeAllFilters = checked; };
   
   inputGroupBox.sizer.add(inputDirSizer);
   inputGroupBox.sizer.add(patternSizer);
   inputGroupBox.sizer.add(analyzeAllCheck);
   
   return inputGroupBox;
}

/**
 * Build ROI mode section
 */
function buildRoiModeSection(dialog) {
   var roiGroupBox = new GroupBox(dialog);
   roiGroupBox.title = "ROI Mode";
   roiGroupBox.sizer = new VerticalSizer;
   roiGroupBox.sizer.margin = 6;
   roiGroupBox.sizer.spacing = 4;
   
   var roiModeLabel = new Label(dialog);
   roiModeLabel.text = "BG/FG Detection:";
   roiModeLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   roiModeLabel.minWidth = 100;
   
   var roiModeCombo = new ComboBox(dialog);
   roiModeCombo.addItem("Manual previews (BG/FG)");
   roiModeCombo.addItem("Auto-detect BG/FG");
   roiModeCombo.currentItem = (CONFIG.roiMode === "auto") ? 1 : 0;
   roiModeCombo.toolTip = "Manual: Create BG/FG previews yourself\\nAuto: Script automatically detects background and faint signal regions";
   
   var tileSizeEdit = new SpinBox(dialog);
   tileSizeEdit.minValue = 32;
   tileSizeEdit.maxValue = 256;
   tileSizeEdit.value = CONFIG.autoRoiTileSize;
   tileSizeEdit.toolTip = "Size of tiles for auto ROI detection (32-256 pixels)";
   tileSizeEdit.enabled = (CONFIG.roiMode === "auto");
   tileSizeEdit.onValueUpdated = function(value) {
      CONFIG.autoRoiTileSize = value;
   };
   
   roiModeCombo.onItemSelected = function(index) {
      CONFIG.roiMode = (index === 1) ? "auto" : "manual";
      tileSizeEdit.enabled = (index === 1);
   };
   
   var roiModeSizer = new HorizontalSizer;
   roiModeSizer.spacing = 4;
   roiModeSizer.add(roiModeLabel);
   roiModeSizer.add(roiModeCombo, 100);
   
   // Tile size for auto mode
   var tileSizeLabel = new Label(dialog);
   tileSizeLabel.text = "Auto Tile Size:";
   tileSizeLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   tileSizeLabel.minWidth = 100;
   
   var tileSizeSizer = new HorizontalSizer;
   tileSizeSizer.spacing = 4;
   tileSizeSizer.add(tileSizeLabel);
   tileSizeSizer.add(tileSizeEdit);
   tileSizeSizer.addStretch();
   
   roiGroupBox.sizer.add(roiModeSizer);
   roiGroupBox.sizer.add(tileSizeSizer);
   
   return roiGroupBox;
}

/**
 * Build depth strategy section
 */
function buildDepthStrategySection(dialog) {
   var depthGroupBox = new GroupBox(dialog);
   depthGroupBox.title = "Integration Depth Strategy";
   depthGroupBox.sizer = new VerticalSizer;
   depthGroupBox.sizer.margin = 6;
   depthGroupBox.sizer.spacing = 4;
   
   var strategyLabel = new Label(dialog);
   strategyLabel.text = "Strategy:";
   strategyLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   strategyLabel.minWidth = 100;
   
   var strategyCombo = new ComboBox(dialog);
   strategyCombo.addItem("Preset OSC (12, 24, 48, 96, 192, 384, 720)");
   strategyCombo.addItem("Doubling (8, 16, 32, 64, ...)");
   strategyCombo.addItem("Fibonacci (8, 13, 21, 34, ...)");
   strategyCombo.addItem("Logarithmic (7-8 exponential steps)");
   strategyCombo.addItem("Custom (specify below)");
   
   // Set current selection
   switch (CONFIG.depthStrategy) {
      case "preset_osc": strategyCombo.currentItem = 0; break;
      case "doubling": strategyCombo.currentItem = 1; break;
      case "fibonacci": strategyCombo.currentItem = 2; break;
      case "logarithmic": strategyCombo.currentItem = 3; break;
      case "custom": strategyCombo.currentItem = 4; break;
   }
   
   var customDepthsEdit = new Edit(dialog);
   customDepthsEdit.text = CONFIG.customDepths;
   customDepthsEdit.toolTip = "Comma-separated list (e.g., 10,20,40,80,160)";
   customDepthsEdit.enabled = (CONFIG.depthStrategy === "custom");
   customDepthsEdit.onTextUpdated = function(value) {
      CONFIG.customDepths = value;
   };
   
   strategyCombo.onItemSelected = function(index) {
      switch (index) {
         case 0: CONFIG.depthStrategy = "preset_osc"; break;
         case 1: CONFIG.depthStrategy = "doubling"; break;
         case 2: CONFIG.depthStrategy = "fibonacci"; break;
         case 3: CONFIG.depthStrategy = "logarithmic"; break;
         case 4: CONFIG.depthStrategy = "custom"; break;
      }
      customDepthsEdit.enabled = (index === 4);
   };
   
   var strategySizer = new HorizontalSizer;
   strategySizer.spacing = 4;
   strategySizer.add(strategyLabel);
   strategySizer.add(strategyCombo, 100);
   
   // Custom depths
   var customLabel = new Label(dialog);
   customLabel.text = "Custom Depths:";
   customLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   customLabel.minWidth = 100;
   
   var customSizer = new HorizontalSizer;
   customSizer.spacing = 4;
   customSizer.add(customLabel);
   customSizer.add(customDepthsEdit, 100);

   // Include full-depth stack
   var fullDepthCheck = new CheckBox(dialog);
   fullDepthCheck.text = "Include full stack (all subframes)";
   fullDepthCheck.toolTip = "Always add a final integration using every available subframe.";
   fullDepthCheck.checked = CONFIG.includeFullDepth;
   fullDepthCheck.onCheck = function(checked) {
      CONFIG.includeFullDepth = checked;
   };
   
   depthGroupBox.sizer.add(strategySizer);
   depthGroupBox.sizer.add(customSizer);
   depthGroupBox.sizer.add(fullDepthCheck);
   
   return depthGroupBox;
}

/**
 * Build processing options section
 */
function buildProcessingSection(dialog) {
   var processingGroupBox = new GroupBox(dialog);
   processingGroupBox.title = "Processing Options";
   processingGroupBox.sizer = new VerticalSizer;
   processingGroupBox.sizer.margin = 6;
   processingGroupBox.sizer.spacing = 4;
   
   // Star removal (required)
   CONFIG.generateStarless = true;

   var starMethodLabel = new Label(dialog);
   starMethodLabel.text = "Star removal (required):";
   starMethodLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   starMethodLabel.minWidth = 180;
   
   var starMethodCombo = new ComboBox(dialog);
   
   // Check which methods are available and add them with status
   var starNetAvailable = isStarRemovalAvailable("StarNet2");
   var sxtAvailable = isStarRemovalAvailable("StarXTerminator");
   
   starMethodCombo.addItem("StarNet2" + (starNetAvailable ? "" : " (Not Installed)"));
   starMethodCombo.addItem("StarXTerminator" + (sxtAvailable ? "" : " (Not Installed)"));
   
   // Select default or first available
   if (CONFIG.starRemovalMethod === "StarNet2" && starNetAvailable) {
      starMethodCombo.currentItem = 0;
   } else if (CONFIG.starRemovalMethod === "StarXTerminator" && sxtAvailable) {
      starMethodCombo.currentItem = 1;
   } else {
      if (starNetAvailable) {
         starMethodCombo.currentItem = 0;
         CONFIG.starRemovalMethod = "StarNet2";
      } else if (sxtAvailable) {
         starMethodCombo.currentItem = 1;
         CONFIG.starRemovalMethod = "StarXTerminator";
      } else {
         starMethodCombo.currentItem = 0;
      }
   }
   
   starMethodCombo.enabled = starNetAvailable || sxtAvailable;
   starMethodCombo.onItemSelected = function(index) {
      CONFIG.starRemovalMethod = (index === 0) ? "StarNet2" : "StarXTerminator";
   };
   
   // Add tooltip if neither is available
   if (!starNetAvailable && !sxtAvailable) {
      starMethodCombo.toolTip = "No star removal tools installed. Install StarNet2 or StarXTerminator from Process > All Processes (required).";
   }
   var starMethodSizer = new HorizontalSizer;
   starMethodSizer.spacing = 4;
   starMethodSizer.addSpacing(20);
   starMethodSizer.add(starMethodLabel);
   starMethodSizer.add(starMethodCombo, 100);

   // Stretch checkbox
   var stretchCheck = new CheckBox(dialog);
   stretchCheck.text = "Apply STF-based stretch to each integration";
   stretchCheck.checked = CONFIG.applyStretch;
   stretchCheck.onCheck = function(checked) {
      CONFIG.applyStretch = checked;
   };
   
   processingGroupBox.sizer.add(starMethodSizer);
   processingGroupBox.sizer.add(stretchCheck);
   
   return processingGroupBox;
}

/**
 * Build output options section
 */
function buildOutputSection(dialog) {
   var outputGroupBox = new GroupBox(dialog);
   outputGroupBox.title = "Output Options";
   outputGroupBox.sizer = new VerticalSizer;
   outputGroupBox.sizer.margin = 6;
   outputGroupBox.sizer.spacing = 4;
   
   // Output directory
   var outputDirLabel = new Label(dialog);
   outputDirLabel.text = "Output Directory:";
   outputDirLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   var outputDirEdit = new Edit(dialog);
   outputDirEdit.text = CONFIG.outputDir;
   outputDirEdit.minWidth = 400;
   outputDirEdit.onTextUpdated = function(value) {
      CONFIG.outputDir = value;
   };
   
   var outputDirButton = new ToolButton(dialog);
   outputDirButton.icon = dialog.scaledResource(":/browser/select-file.png");
   outputDirButton.setScaledFixedSize(20, 20);
   outputDirButton.toolTip = "Select directory";
   outputDirButton.onClick = function() {
      var dirDialog = new GetDirectoryDialog();
      dirDialog.caption = "Select Output Directory";
      if (dirDialog.execute()) {
         outputDirEdit.text = dirDialog.directory;
         CONFIG.outputDir = dirDialog.directory;
      }
   };
   
   var outputDirSizer = new HorizontalSizer;
   outputDirSizer.spacing = 4;
   outputDirSizer.add(outputDirLabel);
   outputDirSizer.add(outputDirEdit, 100);
   outputDirSizer.add(outputDirButton);
   
   // Output format checkboxes
   var csvCheck = new CheckBox(dialog);
   csvCheck.text = "Generate CSV results";
   csvCheck.checked = CONFIG.outputCSV;
   csvCheck.onCheck = function(checked) { CONFIG.outputCSV = checked; };
   
   var jsonCheck = new CheckBox(dialog);
   jsonCheck.text = "Generate JSON results (with metadata)";
   jsonCheck.checked = CONFIG.outputJSON;
   jsonCheck.onCheck = function(checked) { CONFIG.outputJSON = checked; };
   
   var graphCheck = new CheckBox(dialog);
   graphCheck.text = "Generate graph image";
   graphCheck.checked = CONFIG.generateGraph;
   graphCheck.onCheck = function(checked) { CONFIG.generateGraph = checked; };
   
   var insightsCheck = new CheckBox(dialog);
   insightsCheck.text = "Generate insights analysis";
   insightsCheck.checked = CONFIG.generateInsights;
   insightsCheck.onCheck = function(checked) { CONFIG.generateInsights = checked; };
   
   var timingsCheck = new CheckBox(dialog);
   timingsCheck.text = "Log detailed timings";
   timingsCheck.checked = CONFIG.logTimings;
   timingsCheck.onCheck = function(checked) { CONFIG.logTimings = checked; };
   
   outputGroupBox.sizer.add(outputDirSizer);
   outputGroupBox.sizer.add(csvCheck);
   outputGroupBox.sizer.add(jsonCheck);
   outputGroupBox.sizer.add(graphCheck);
   outputGroupBox.sizer.add(insightsCheck);
   outputGroupBox.sizer.add(timingsCheck);
   
   return outputGroupBox;
}
