/*
 * SNRAnalysis-ui.js
 * Main dialog UI for configuration
 */

/**
 * Main configuration dialog
 */
function SNRAnalysisDialog() {
   this.__base__ = Dialog;
   this.__base__();
   
   var self = this;
   
   // Load current settings
   loadSettings();
   
   // ===== HEADER SECTION =====
   
   var headerGroupBox = new GroupBox(this);
   headerGroupBox.title = "";
   headerGroupBox.sizer = new VerticalSizer;
   headerGroupBox.sizer.margin = 4;
   headerGroupBox.sizer.spacing = 2;
   headerGroupBox.styleSheet = "QGroupBox { padding-top: 0px; margin-top: 0px; }";
   
   // Title row: Name/version on left, author on right
   var titleSizer = new HorizontalSizer;
   titleSizer.spacing = 4;
   
   var titleLabel = new Label(this);
   titleLabel.text = "SNR vs Integration Time Analysis v1.0.0";
   titleLabel.styleSheet = "QLabel { font-weight: bold; }";
   
   var copyrightLabel = new Label(this);
   copyrightLabel.text = "Paul Fox-Reeks (englishfox90)";
   copyrightLabel.textAlignment = TextAlign_Right;
   
   titleSizer.add(titleLabel);
   titleSizer.addStretch();
   titleSizer.add(copyrightLabel);
   
   // Description
   var descriptionLabel = new Label(this);
   descriptionLabel.text = "Analyze how SNR improves with integration depth to find diminishing returns and optimize your imaging sessions.";
   descriptionLabel.wordWrapping = true;
   descriptionLabel.useRichText = false;
   
   headerGroupBox.sizer.add(titleSizer);
   headerGroupBox.sizer.add(descriptionLabel);
   
   // ===== INFO SECTION =====
   
   var infoGroupBox = new GroupBox(this);
   infoGroupBox.title = "Why Use This Tool?";
   infoGroupBox.sizer = new VerticalSizer;
   infoGroupBox.sizer.margin = 6;
   infoGroupBox.sizer.spacing = 4;
   
   var infoLabel = new Label(this);
   infoLabel.text = 
      "<b>What it does:</b> Integrates your subframes at increasing depths (e.g., 8, 16, 32 subs) and measures SNR at each step.<br/><br/>" +
      "<b>Why it's valuable:</b><br/>" +
      "• <b>Optimize integration time</b> - Discover when additional subs provide minimal SNR improvement<br/>" +
      "• <b>Save imaging time</b> - Know when to stop integrating and move to your next target<br/>" +
      "• <b>Quantify signal gains</b> - See actual SNR improvements vs theoretical √N behavior<br/>" +
      "• <b>Detect bad data</b> - Identify sessions with poor subframes that decrease SNR<br/>" +
      "• <b>Plan future sessions</b> - Determine ideal total exposure for your equipment and conditions<br/><br/>" +
      "<b>Example insights:</b> \"SNR improvements drop below 10% after 90 minutes - diminishing returns beyond this point.\"";
   infoLabel.wordWrapping = true;
   infoLabel.useRichText = true;
   infoLabel.styleSheet = "QLabel { color: #444; }";
   
   infoGroupBox.sizer.add(infoLabel);
   
   // ===== INPUT SECTION =====
   
   var inputGroupBox = new GroupBox(this);
   inputGroupBox.title = "Subframe Selection";
   inputGroupBox.sizer = new VerticalSizer;
   inputGroupBox.sizer.margin = 6;
   inputGroupBox.sizer.spacing = 4;
   
   // Input directory
   var inputDirLabel = new Label(this);
   inputDirLabel.text = "Input Directory:";
   inputDirLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   var inputDirEdit = new Edit(this);
   inputDirEdit.text = CONFIG.inputDir;
   inputDirEdit.minWidth = 400;
   inputDirEdit.onTextUpdated = function(value) {
      CONFIG.inputDir = value;
   };
   
   var inputDirButton = new ToolButton(this);
   inputDirButton.icon = this.scaledResource(":/browser/select-file.png");
   inputDirButton.setScaledFixedSize(20, 20);
   inputDirButton.toolTip = "Select directory";
   inputDirButton.onClick = function() {
      var dialog = new GetDirectoryDialog();
      dialog.caption = "Select Input Directory";
      if (dialog.execute()) {
         inputDirEdit.text = dialog.directory;
         CONFIG.inputDir = dialog.directory;
      }
   };
   
   var inputDirSizer = new HorizontalSizer;
   inputDirSizer.spacing = 4;
   inputDirSizer.add(inputDirLabel);
   inputDirSizer.add(inputDirEdit, 100);
   inputDirSizer.add(inputDirButton);
   
   // File pattern
   var patternLabel = new Label(this);
   patternLabel.text = "File Pattern:";
   patternLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   patternLabel.minWidth = 100;
   
   var patternEdit = new Edit(this);
   patternEdit.text = CONFIG.filePattern;
   patternEdit.onTextUpdated = function(value) {
      CONFIG.filePattern = value;
   };
   
   var patternSizer = new HorizontalSizer;
   patternSizer.spacing = 4;
   patternSizer.add(patternLabel);
   patternSizer.add(patternEdit, 100);
   
   // Analyze all filters checkbox
   var analyzeAllCheck = new CheckBox(this);
   analyzeAllCheck.text = "Analyze all filters separately (groups by FILTER header)";
   analyzeAllCheck.checked = CONFIG.analyzeAllFilters;
   analyzeAllCheck.toolTip = "When enabled, subframes are grouped by FILTER header and analyzed independently";
   analyzeAllCheck.onCheck = function(checked) { CONFIG.analyzeAllFilters = checked; };
   
   inputGroupBox.sizer.add(inputDirSizer);
   inputGroupBox.sizer.add(patternSizer);
   inputGroupBox.sizer.add(analyzeAllCheck);
   
   // ===== ROI MODE SECTION =====
   
   var roiGroupBox = new GroupBox(this);
   roiGroupBox.title = "ROI Mode";
   roiGroupBox.sizer = new VerticalSizer;
   roiGroupBox.sizer.margin = 6;
   roiGroupBox.sizer.spacing = 4;
   
   var roiModeLabel = new Label(this);
   roiModeLabel.text = "BG/FG Detection:";
   roiModeLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   roiModeLabel.minWidth = 100;
   
   var roiModeCombo = new ComboBox(this);
   roiModeCombo.addItem("Manual previews (BG/FG)");
   roiModeCombo.addItem("Auto-detect BG/FG");
   roiModeCombo.currentItem = (CONFIG.roiMode === "auto") ? 1 : 0;
   roiModeCombo.toolTip = "Manual: Create BG/FG previews yourself\\nAuto: Script automatically detects background and faint signal regions";
   roiModeCombo.onItemSelected = function(index) {
      CONFIG.roiMode = (index === 1) ? "auto" : "manual";
      tileSizeEdit.enabled = (index === 1);
   };
   
   var roiModeSizer = new HorizontalSizer;
   roiModeSizer.spacing = 4;
   roiModeSizer.add(roiModeLabel);
   roiModeSizer.add(roiModeCombo, 100);
   
   // Tile size for auto mode
   var tileSizeLabel = new Label(this);
   tileSizeLabel.text = "Auto Tile Size:";
   tileSizeLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   tileSizeLabel.minWidth = 100;
   
   var tileSizeEdit = new SpinBox(this);
   tileSizeEdit.minValue = 32;
   tileSizeEdit.maxValue = 256;
   tileSizeEdit.value = CONFIG.autoRoiTileSize;
   tileSizeEdit.toolTip = "Size of tiles for auto ROI detection (32-256 pixels)";
   tileSizeEdit.enabled = (CONFIG.roiMode === "auto");
   tileSizeEdit.onValueUpdated = function(value) {
      CONFIG.autoRoiTileSize = value;
   };
   
   var tileSizeSizer = new HorizontalSizer;
   tileSizeSizer.spacing = 4;
   tileSizeSizer.add(tileSizeLabel);
   tileSizeSizer.add(tileSizeEdit);
   tileSizeSizer.addStretch();
   
   roiGroupBox.sizer.add(roiModeSizer);
   roiGroupBox.sizer.add(tileSizeSizer);
   
   // ===== DEPTH STRATEGY SECTION =====
   
   var depthGroupBox = new GroupBox(this);
   depthGroupBox.title = "Integration Depth Strategy";
   depthGroupBox.sizer = new VerticalSizer;
   depthGroupBox.sizer.margin = 6;
   depthGroupBox.sizer.spacing = 4;
   
   var strategyLabel = new Label(this);
   strategyLabel.text = "Strategy:";
   strategyLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   strategyLabel.minWidth = 100;
   
   var strategyCombo = new ComboBox(this);
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
   var customLabel = new Label(this);
   customLabel.text = "Custom Depths:";
   customLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   customLabel.minWidth = 100;
   
   var customDepthsEdit = new Edit(this);
   customDepthsEdit.text = CONFIG.customDepths;
   customDepthsEdit.toolTip = "Comma-separated list (e.g., 10,20,40,80,160)";
   customDepthsEdit.enabled = (CONFIG.depthStrategy === "custom");
   customDepthsEdit.onTextUpdated = function(value) {
      CONFIG.customDepths = value;
   };
   
   var customSizer = new HorizontalSizer;
   customSizer.spacing = 4;
   customSizer.add(customLabel);
   customSizer.add(customDepthsEdit, 100);
   
   depthGroupBox.sizer.add(strategySizer);
   depthGroupBox.sizer.add(customSizer);
   
   // ===== PROCESSING OPTIONS =====
   
   var processingGroupBox = new GroupBox(this);
   processingGroupBox.title = "Processing Options";
   processingGroupBox.sizer = new VerticalSizer;
   processingGroupBox.sizer.margin = 6;
   processingGroupBox.sizer.spacing = 4;
   
   // Star removal checkbox
   var starlessCheck = new CheckBox(this);
   starlessCheck.text = "Generate starless stacks";
   starlessCheck.checked = CONFIG.generateStarless;
   starlessCheck.onCheck = function(checked) {
      CONFIG.generateStarless = checked;
      starMethodCombo.enabled = checked;
   };
   
   // Star removal method
   var starMethodLabel = new Label(this);
   starMethodLabel.text = "Method:";
   starMethodLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   starMethodLabel.minWidth = 100;
   
   var starMethodCombo = new ComboBox(this);
   
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
      // Default to first available method
      if (starNetAvailable) {
         starMethodCombo.currentItem = 0;
         CONFIG.starRemovalMethod = "StarNet2";
      } else if (sxtAvailable) {
         starMethodCombo.currentItem = 1;
         CONFIG.starRemovalMethod = "StarXTerminator";
      } else {
         starMethodCombo.currentItem = 0;
         CONFIG.generateStarless = false;  // Disable if nothing available
         starlessCheck.checked = false;
      }
   }
   
   starMethodCombo.enabled = CONFIG.generateStarless;
   starMethodCombo.onItemSelected = function(index) {
      CONFIG.starRemovalMethod = (index === 0) ? "StarNet2" : "StarXTerminator";
   };
   
   // Add tooltip if neither is available
   if (!starNetAvailable && !sxtAvailable) {
      starMethodCombo.toolTip = "No star removal tools installed. Install StarNet2 or StarXTerminator from Process > All Processes.";
   }
   
   var starMethodSizer = new HorizontalSizer;
   starMethodSizer.spacing = 4;
   starMethodSizer.addSpacing(20);
   starMethodSizer.add(starMethodLabel);
   starMethodSizer.add(starMethodCombo, 100);
   
   // Stretch checkbox
   var stretchCheck = new CheckBox(this);
   stretchCheck.text = "Apply STF-based stretch to each integration";
   stretchCheck.checked = CONFIG.applyStretch;
   stretchCheck.onCheck = function(checked) {
      CONFIG.applyStretch = checked;
   };
   
   processingGroupBox.sizer.add(starlessCheck);
   processingGroupBox.sizer.add(starMethodSizer);
   processingGroupBox.sizer.add(stretchCheck);
   
   // ===== OUTPUT OPTIONS =====
   
   var outputGroupBox = new GroupBox(this);
   outputGroupBox.title = "Output Options";
   outputGroupBox.sizer = new VerticalSizer;
   outputGroupBox.sizer.margin = 6;
   outputGroupBox.sizer.spacing = 4;
   
   // Output directory
   var outputDirLabel = new Label(this);
   outputDirLabel.text = "Output Directory:";
   outputDirLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   var outputDirEdit = new Edit(this);
   outputDirEdit.text = CONFIG.outputDir;
   outputDirEdit.minWidth = 400;
   outputDirEdit.onTextUpdated = function(value) {
      CONFIG.outputDir = value;
   };
   
   var outputDirButton = new ToolButton(this);
   outputDirButton.icon = this.scaledResource(":/browser/select-file.png");
   outputDirButton.setScaledFixedSize(20, 20);
   outputDirButton.toolTip = "Select directory";
   outputDirButton.onClick = function() {
      var dialog = new GetDirectoryDialog();
      dialog.caption = "Select Output Directory";
      if (dialog.execute()) {
         outputDirEdit.text = dialog.directory;
         CONFIG.outputDir = dialog.directory;
      }
   };
   
   var outputDirSizer = new HorizontalSizer;
   outputDirSizer.spacing = 4;
   outputDirSizer.add(outputDirLabel);
   outputDirSizer.add(outputDirEdit, 100);
   outputDirSizer.add(outputDirButton);
   
   // Output format checkboxes
   var csvCheck = new CheckBox(this);
   csvCheck.text = "Generate CSV results";
   csvCheck.checked = CONFIG.outputCSV;
   csvCheck.onCheck = function(checked) { CONFIG.outputCSV = checked; };
   
   var jsonCheck = new CheckBox(this);
   jsonCheck.text = "Generate JSON results (with metadata)";
   jsonCheck.checked = CONFIG.outputJSON;
   jsonCheck.onCheck = function(checked) { CONFIG.outputJSON = checked; };
   
   var graphCheck = new CheckBox(this);
   graphCheck.text = "Generate graph image";
   graphCheck.checked = CONFIG.generateGraph;
   graphCheck.onCheck = function(checked) { CONFIG.generateGraph = checked; };
   
   var insightsCheck = new CheckBox(this);
   insightsCheck.text = "Generate insights analysis";
   insightsCheck.checked = CONFIG.generateInsights;
   insightsCheck.onCheck = function(checked) { CONFIG.generateInsights = checked; };
   
   var timingsCheck = new CheckBox(this);
   timingsCheck.text = "Log detailed timings";
   timingsCheck.checked = CONFIG.logTimings;
   timingsCheck.onCheck = function(checked) { CONFIG.logTimings = checked; };
   
   outputGroupBox.sizer.add(outputDirSizer);
   outputGroupBox.sizer.add(csvCheck);
   outputGroupBox.sizer.add(jsonCheck);
   outputGroupBox.sizer.add(graphCheck);
   outputGroupBox.sizer.add(insightsCheck);
   outputGroupBox.sizer.add(timingsCheck);
   
   // ===== BUTTONS =====
   
   var buttonsSizer = new HorizontalSizer;
   buttonsSizer.spacing = 6;
   
   var okButton = new PushButton(this);
   okButton.text = "OK";
   okButton.icon = this.scaledResource(":/icons/ok.png");
   okButton.onClick = function() {
      // Validate inputs
      if (!CONFIG.inputDir || CONFIG.inputDir.trim().length === 0) {
         new MessageBox("Please select an input directory.", "Validation Error", StdIcon_Error, StdButton_Ok).execute();
         return;
      }
      
      if (!CONFIG.outputDir || CONFIG.outputDir.trim().length === 0) {
         new MessageBox("Please select an output directory.", "Validation Error", StdIcon_Error, StdButton_Ok).execute();
         return;
      }
      
      if (CONFIG.depthStrategy === "custom") {
         if (!CONFIG.customDepths || CONFIG.customDepths.trim().length === 0) {
            new MessageBox("Please specify custom depths or choose a different strategy.", "Validation Error", StdIcon_Error, StdButton_Ok).execute();
            return;
         }
      }
      
      // Save settings
      saveSettings();
      
      self.ok();
   };
   
   var cancelButton = new PushButton(this);
   cancelButton.text = "Cancel";
   cancelButton.icon = this.scaledResource(":/icons/cancel.png");
   cancelButton.onClick = function() {
      self.cancel();
   };
   
   buttonsSizer.addStretch();
   buttonsSizer.add(okButton);
   buttonsSizer.add(cancelButton);
   
   // ===== MAIN LAYOUT =====
   
   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   this.sizer.add(headerGroupBox);
   this.sizer.add(infoGroupBox);
   this.sizer.add(inputGroupBox);
   this.sizer.add(roiGroupBox);
   this.sizer.add(depthGroupBox);
   this.sizer.add(processingGroupBox);
   this.sizer.add(outputGroupBox);
   this.sizer.add(buttonsSizer);
   
   this.windowTitle = "SNR vs Integration Time Analysis";
   this.adjustToContents();
   this.setFixedSize();
}

SNRAnalysisDialog.prototype = new Dialog;

/**
 * Show final results summary dialog
 */
function showResultsDialog(results, totalTimeSec, outputDir) {
   var dialog = new Dialog();
   dialog.windowTitle = "SNR Analysis Complete";
   dialog.scaledMinWidth = 800;
   dialog.scaledMinHeight = 900;
   
   // Results summary
   var summaryText = new TextBox(dialog);
   summaryText.readOnly = true;
   summaryText.styleSheet = "font-family: monospace; font-size: 10pt;";
   summaryText.setScaledMinSize(750, 340);
   
   var text = "=== SNR ANALYSIS RESULTS ===\n\n";
   text += "Analyzed " + results.length + " integration depths\n";
   text += "Total runtime: " + formatTime(totalTimeSec) + "\n\n";
   
   text += "Label        N Subs    Total Exp        SNR      \u0394 SNR\n";
   text += "--------------------------------------------------------\n";
   
   for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var deltaSNR = "";
      
      if (i > 0) {
         var delta = ((r.snr - results[i-1].snr) / results[i-1].snr) * 100;
         deltaSNR = (delta >= 0 ? "+" : "") + delta.toFixed(1) + "%";
      }
      
      var line = padRight(r.label, 12) + " " + 
                 padLeft(r.depth.toString(), 6) + "    " +
                 padLeft(formatTime(r.totalExposure), 12) + "  " +
                 padLeft(r.snr.toFixed(2), 6) + "    " +
                 padLeft(deltaSNR, 8) + "\n";
      text += line;
   }
   
   text += "\n=== INSIGHTS ===\n\n";
   
   // Find diminishing returns points
   var thresh10 = -1, thresh5 = -1;
   for (var i = 1; i < results.length; i++) {
      var improvement = ((results[i].snr - results[i-1].snr) / results[i-1].snr) * 100;
      if (improvement < 10 && thresh10 === -1) thresh10 = i;
      if (improvement < 5 && thresh5 === -1) thresh5 = i;
   }
   
   if (thresh10 > 0) {
      text += "\u2022 SNR improvements drop below 10% after " + results[thresh10].label;
      text += " (" + formatTime(results[thresh10].totalExposure) + ")\n";
   }
   
   if (thresh5 > 0) {
      text += "\u2022 SNR improvements drop below 5% after " + results[thresh5].label;
      text += " (" + formatTime(results[thresh5].totalExposure) + ")\n";
   }
   
   text += "\n=== OUTPUT FILES ===\n\n";
   text += "Location: " + outputDir + "\n\n";
   text += "\u2022 snr_results.csv - Full data for spreadsheet analysis\n";
   text += "\u2022 snr_results.json - Structured data with insights\n";
   text += "\u2022 snr_graph.png/jpg - Visual plot of SNR vs time\n";
   text += "\u2022 int_NX.xisf - Integration files for each depth\n";
   
   summaryText.text = text;
   
   // Graph preview using ScrollBox (based on MasterSignature pattern)
   var graphPreview = null;
   var graphPath = outputDir + "/snr_graph.png";
   if (!File.exists(graphPath)) {
      graphPath = outputDir + "/snr_graph.jpg";
   }
   
   if (File.exists(graphPath)) {
      try {
         var bmp = new Bitmap(graphPath);
         
         graphPreview = new ScrollBox(dialog);
         graphPreview.autoScroll = true;
         graphPreview.setScaledMinSize(780, 420);
         graphPreview.setScaledMaxSize(780, 420);
         
         // Calculate scale to fit
         var maxWidth = 760;
         var maxHeight = 400;
         var scale = Math.min(maxWidth / bmp.width, maxHeight / bmp.height, 1.0);
         var scaledWidth = Math.floor(bmp.width * scale);
         var scaledHeight = Math.floor(bmp.height * scale);
         
         graphPreview.viewport.onPaint = function(x0, y0, x1, y1) {
            var g = new Graphics(this);
            g.fillRect(x0, y0, x1, y1, new Brush(0xFFFFFFFF));  // White background
            
            // Center the scaled bitmap in the viewport
            var xOffset = Math.max(0, (this.width - scaledWidth) / 2);
            var yOffset = Math.max(0, (this.height - scaledHeight) / 2);
            
            // Scale and draw
            g.drawScaledBitmap(xOffset, yOffset, xOffset + scaledWidth, yOffset + scaledHeight, bmp);
            g.end();
         };
         
         console.writeln("Graph preview loaded: " + graphPath + " (scaled to " + scaledWidth + "x" + scaledHeight + ")");
      } catch (e) {
         console.warningln("Graph preview failed: " + e.message);
         graphPreview = null;
      }
   }
   
   // Buttons
   var buttonSizer = new HorizontalSizer;
   buttonSizer.spacing = 6;
   buttonSizer.addStretch();
   
   var okButton = new PushButton(dialog);
   okButton.text = "OK";
   okButton.icon = dialog.scaledResource(":/icons/ok.png");
   okButton.onClick = function() {
      dialog.ok();
   };
   buttonSizer.add(okButton);
   
   // Layout
   dialog.sizer = new VerticalSizer;
   dialog.sizer.margin = 8;
   dialog.sizer.spacing = 6;
   dialog.sizer.add(summaryText);
   if (graphPreview) {
      dialog.sizer.add(graphPreview);
   }
   dialog.sizer.add(buttonSizer);
   
   dialog.execute();
}

/**
 * Show multi-filter results dialog with tabs for each filter
 * @param {Array} allFilterResults - Array of {filterName, results, rois, insights, totalTime, graphPath}
 * @param {string} outputDir - Output directory
 */
function showMultiFilterResultsDialog(allFilterResults, outputDir) {
   // If single filter, use original dialog
   if (allFilterResults.length === 1) {
      var fr = allFilterResults[0];
      showResultsDialog(fr.results, fr.totalTime, outputDir);
      return;
   }
   
   // Multi-filter tabbed dialog
   var dialog = new Dialog();
   dialog.windowTitle = "SNR Analysis Complete - Multiple Filters";
   
   var tabBox = new TabBox(dialog);
   
   // Create a tab for each filter
   for (var i = 0; i < allFilterResults.length; i++) {
      var fr = allFilterResults[i];
      var tabPage = new Control(dialog);
      tabPage.sizer = new VerticalSizer;
      tabPage.sizer.margin = 8;
      tabPage.sizer.spacing = 6;
      
      // Summary text
      var summaryText = new TextBox(tabPage);
      summaryText.readOnly = true;
      summaryText.styleSheet = "QTextEdit { font-family: 'Courier New', monospace; font-size: 10pt; }";
      summaryText.setScaledMinSize(750, 340);
      
      var summaryContent = "";
      summaryContent += "SNR Analysis Results - " + fr.filterName + "\n";
      summaryContent += "=".repeat(80) + "\n\n";
      
      summaryContent += "Output Directory: " + outputDir + "\n";
      summaryContent += "Total Runtime: " + formatTime(fr.totalTime) + "\n";
      summaryContent += "Depths Analyzed: " + fr.results.length + "\n\n";
      
      summaryContent += padRight("Label", 12) + padRight("N Subs", 10) + padRight("Total Exp", 15) + 
                       padRight("SNR", 10) + padRight("Int Time", 12) + "Star/Stretch\n";
      summaryContent += "-".repeat(80) + "\n";
      
      for (var j = 0; j < fr.results.length; j++) {
         var r = fr.results[j];
         var totalExpStr = formatTime(r.totalExposure);
         var intTimeStr = r.integrationTime.toFixed(1) + "s";
         var starStretchStr = r.starRemovalTime.toFixed(1) + "s / " + r.stretchTime.toFixed(1) + "s";
         
         summaryContent += padRight(r.label, 12) + 
                          padRight(r.depth.toString(), 10) + 
                          padRight(totalExpStr, 15) + 
                          padRight(r.snr.toFixed(2), 10) + 
                          padRight(intTimeStr, 12) + 
                          starStretchStr + "\n";
      }
      
      // Add insights if available
      if (fr.insights) {
         summaryContent += "\n" + "=".repeat(80) + "\n";
         summaryContent += "INSIGHTS\n";
         summaryContent += "=".repeat(80) + "\n\n";
         
         if (fr.insights.scalingExponent !== undefined) {
            summaryContent += "Scaling Exponent: " + fr.insights.scalingExponent.toFixed(3) + 
                            " (ideal √N = 0.500)\n";
         }
         
         if (fr.insights.diminishingReturns10pct) {
            summaryContent += "Diminishing Returns (< 10% gain): " + fr.insights.diminishingReturns10pct + "\n";
         }
         
         if (fr.insights.diminishingReturns5pct) {
            summaryContent += "Diminishing Returns (< 5% gain): " + fr.insights.diminishingReturns5pct + "\n";
         }
         
         if (fr.insights.recommendedRange) {
            summaryContent += "Recommended Range: " + 
                            formatTime(fr.insights.recommendedRange.minExposure) + " - " +
                            formatTime(fr.insights.recommendedRange.maxExposure) + "\n";
         }
         
         // Future projections if available
         if (fr.insights.needsMoreData && fr.insights.projectedGains) {
            summaryContent += "\nADDITIONAL INTEGRATION RECOMMENDED:\n";
            var proj = fr.insights.projectedGains;
            
            summaryContent += "Current: " + proj.currentDepth + " subs, SNR = " + proj.currentSNR.toFixed(2) + "\n";
            summaryContent += "Doubling integration (" + formatTime(proj.projection2x.totalTime) + " total):\n";
            summaryContent += "  → Projected SNR: " + proj.projection2x.snr.toFixed(2) + 
                            " (+" + proj.projection2x.gain.toFixed(1) + "% gain)\n";
            summaryContent += "  → Additional time needed: " + formatTime(proj.projection2x.additionalTime) + "\n";
            
            summaryContent += "Tripling integration (" + formatTime(proj.projection3x.totalTime) + " total):\n";
            summaryContent += "  → Projected SNR: " + proj.projection3x.snr.toFixed(2) + 
                            " (+" + proj.projection3x.gain.toFixed(1) + "% gain)\n";
            summaryContent += "  → Additional time needed: " + formatTime(proj.projection3x.additionalTime) + "\n";
         } else if (!fr.insights.needsMoreData) {
            summaryContent += "\nINTEGRATION STATUS:\n";
            summaryContent += "Diminishing returns reached - additional integration may not be cost-effective\n";
         }
         
         if (fr.insights.anomalies && fr.insights.anomalies.length > 0) {
            summaryContent += "\nAnomalies Detected:\n";
            for (var k = 0; k < fr.insights.anomalies.length; k++) {
               summaryContent += "  - " + fr.insights.anomalies[k] + "\n";
            }
         }
      }
      
      summaryText.text = summaryContent;
      tabPage.sizer.add(summaryText);
      
      // Graph preview
      console.writeln("Filter " + fr.filterName + " - graphPath: " + (fr.graphPath ? fr.graphPath : "NULL"));
      if (fr.graphPath) {
         console.writeln("  File.exists(" + fr.graphPath + "): " + File.exists(fr.graphPath));
      }
      
      if (fr.graphPath && File.exists(fr.graphPath)) {
         try {
            var graphGroupBox = new GroupBox(tabPage);
            graphGroupBox.title = "Graph Preview";
            graphGroupBox.sizer = new VerticalSizer;
            graphGroupBox.sizer.margin = 6;
            graphGroupBox.sizer.spacing = 4;
            
            var scrollBox = new ScrollBox(graphGroupBox);
            scrollBox.setScaledMinSize(780, 420);
            scrollBox.autoScroll = true;
            scrollBox.tracking = true;
            scrollBox.cursor = new Cursor(StdCursor_Arrow);
            
            // Load bitmap
            var bmp = new Bitmap(fr.graphPath);
            
            // Calculate scale to fit
            var maxWidth = 760;
            var maxHeight = 400;
            var scale = Math.min(maxWidth / bmp.width, maxHeight / bmp.height, 1.0);
            var scaledWidth = Math.floor(bmp.width * scale);
            var scaledHeight = Math.floor(bmp.height * scale);
            
            console.writeln("Graph preview (" + fr.filterName + "): " + bmp.width + "x" + bmp.height + 
                           " scaled to " + scaledWidth + "x" + scaledHeight);
            
            scrollBox.viewport.onPaint = function(x, y, w, h) {
               var g = new Graphics(this);
               g.fillRect(0, 0, this.width, this.height, new Brush(0xFF000000));
               
               var xOffset = Math.max(0, (maxWidth - scaledWidth) / 2);
               var yOffset = Math.max(0, (maxHeight - scaledHeight) / 2);
               
               g.drawScaledBitmap(xOffset, yOffset, xOffset + scaledWidth, yOffset + scaledHeight, bmp);
               g.end();
            };
            
            graphGroupBox.sizer.add(scrollBox);
            tabPage.sizer.add(graphGroupBox);
            console.writeln("Graph preview added to tab for " + fr.filterName);
         } catch (e) {
            console.warningln("Failed to load graph for " + fr.filterName + ": " + e.message);
         }
      } else {
         console.writeln("Skipping graph preview for " + fr.filterName + " - no valid path");
      }
      
      tabBox.addPage(tabPage, fr.filterName);
   }
   
   // OK button
   var okButton = new PushButton(dialog);
   okButton.text = "OK";
   okButton.icon = dialog.scaledResource(":/icons/ok.png");
   okButton.onClick = function() {
      dialog.ok();
   };
   
   var buttonsSizer = new HorizontalSizer;
   buttonsSizer.addStretch();
   buttonsSizer.add(okButton);
   
   // Main layout
   dialog.sizer = new VerticalSizer;
   dialog.sizer.margin = 8;
   dialog.sizer.spacing = 6;
   dialog.sizer.add(tabBox, 100);
   dialog.sizer.add(buttonsSizer);
   
   dialog.adjustToContents();
   dialog.setScaledMinHeight(900);
   dialog.execute();
}

// Helper functions for text padding
function padRight(str, len) {
   str = str.toString();
   while (str.length < len) str += " ";
   return str;
}

function padLeft(str, len) {
   str = str.toString();
   while (str.length < len) str = " " + str;
   return str;
}

