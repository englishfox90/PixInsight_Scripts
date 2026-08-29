/*
 * AstroBin CSV Export - GUI Methods
 * Dialog method implementations and event handlers
 */

// NOTE: AstroBinDialog class body is opened in AstroBin-gui.js.
// This file continues that class body and closes it after calculateTotalIntegrationTime().

// Method implementations
scanForFiles()
{
   if (!CONFIG.rootDir) return;

   try {
      Console.writeln("Scanning directory: " + CONFIG.rootDir);
      g_imageFiles = listFiles(CONFIG.rootDir, CONFIG.includeSubdirs);
      this.fileCountLabel.text = "Files found: " + g_imageFiles.length;
      this.analysisStatusLabel.text = "Ready to analyze " + g_imageFiles.length + " files";

      // Validate and preview exclude pattern
      if (CONFIG.excludePattern && CONFIG.excludePattern.trim().length > 0) {
         try {
            var re = new RegExp(CONFIG.excludePattern.trim(), "i");
            var matchCount = 0;
            for (var i = 0; i < g_imageFiles.length; i++) {
               if (re.test(g_imageFiles[i])) matchCount++;
            }
            this.excludeStatusLabel.text = matchCount + " file(s) will be excluded";
            this.excludeStatusLabel.styleSheet = matchCount > 0
               ? "QLabel { color: #CC6600; font-size: 9pt; }"
               : "QLabel { color: #666; font-size: 9pt; }";
         } catch (e) {
            this.excludeStatusLabel.text = "Invalid regex";
            this.excludeStatusLabel.styleSheet = "QLabel { color: red; font-size: 9pt; }";
         }
      } else {
         this.excludeStatusLabel.text = "";
      }

      this.updateUI();
   } catch (e) {
      Console.criticalln("Error scanning files: " + e);
      this.fileCountLabel.text = "Error scanning files";
   }
}

showExcludePatternHelp()
{
   var msg =
      "<b>Exclude Pattern Help</b><br><br>" +
      "Regex matched against each file's full path (<b>case-insensitive</b>). " +
      "Use <tt>|</tt> to combine multiple patterns (OR).<br><br>" +

      "<table cellpadding='2' cellspacing='0'>" +
      "<tr><td><tt>DARK</tt></td><td>&nbsp;Paths containing DARK</td></tr>" +
      "<tr><td><tt>DARK|FLAT|BIAS</tt></td><td>&nbsp;Calibration frame folders</td></tr>" +
      "<tr><td><tt>reject|bad_night</tt></td><td>&nbsp;Rejected frames or a bad session</td></tr>" +
      "<tr><td><tt>master|calibrated</tt></td><td>&nbsp;Processed/master output folders</td></tr>" +
      "<tr><td><tt>_preview</tt></td><td>&nbsp;Files with _preview in the name</td></tr>" +
      "<tr><td><tt>_c\\.xisf$</tt></td><td>&nbsp;Files ending in _c.xisf</td></tr>" +
      "<tr><td><tt>2025-01-15</tt></td><td>&nbsp;A specific date folder</td></tr>" +
      "</table><br>" +

      "<b>Regex basics:</b> " +
      "<tt>.</tt> = any char, " +
      "<tt>\\.</tt> = literal dot, " +
      "<tt>$</tt> = end of path, " +
      "<tt>( )</tt> = grouping<br><br>" +

      "<i>Leave empty to include all files. Applied on Analyze Images.</i>";

   var msgBox = new MessageBox(msg, "Exclude Pattern Help", StdIcon.Information, StdButton.Ok);
   msgBox.execute();
}

analyzeImages()
{
   if (g_imageFiles.length === 0) {
      Console.warningln("No files to analyze. Please select a directory first.");
      return;
   }
   
   this.analyzeButton.enabled = false;
   // Disable downstream actions for the duration of the run so they can't be
   // clicked against the previous run's stale g_analysisData (re-enabled in finally).
   this.mapFiltersButton.enabled = false;
   this.generateCSVButton.enabled = false;
   this.summaryButton.enabled = false;
   this.analysisStatusLabel.text = "Analyzing " + g_imageFiles.length + " files...";

   // Reset UI controls to enabled state for new analysis
   this.resetGlobalParametersUI();
   
   CoreApplication.processEvents();
   
   try {
      // Filter mappings are now handled by the JavaScript database
      Console.writeln("Using JavaScript filter database...");
      this.analysisStatusLabel.text = "Using filter database...";
      CoreApplication.processEvents();
      
      // Analyze files with progress updates
      Console.writeln("Analyzing image files...");
      this.analysisStatusLabel.text = "Extracting metadata from images...";
      CoreApplication.processEvents();
      
      try {
         var result = analyzeFiles(g_imageFiles);
         Console.writeln("File analysis completed");
         var rows = result.rows;
         var globalData = result.globalData;
         
         // Populate global parameters from the first image if they're empty
         Console.writeln("Populating global parameters...");
         this.populateGlobalParametersFromMetadata(globalData);
         
         // Update UI to reflect available metadata and disable auto-detected fields
         this.updateGlobalParametersFromMetadata(globalData);
         
      } catch (e) {
         Console.criticalln("Error during file analysis: " + e);
         throw e;
      }
      
      // Aggregate data
      Console.writeln("Aggregating data...");
      this.analysisStatusLabel.text = "Grouping acquisition sessions...";
      CoreApplication.processEvents();
      
      try {
         g_analysisData = aggregate(rows, globalData);
         Console.writeln("Data aggregation completed");
      } catch (e) {
         Console.criticalln("Error during data aggregation: " + e);
         throw e;
      }
      
      Console.writeln("Populating results table...");
      this.analysisStatusLabel.text = "Updating display...";
      CoreApplication.processEvents();
      
      this.populateImageTree();
      
      // Calculate total integration time for display
      var totalIntegrationTime = this.calculateTotalIntegrationTime();
      var integrationText = totalIntegrationTime > 0 ? " (Total integration: " + this.formatDuration(totalIntegrationTime) + ")" : "";
      
      this.analysisStatusLabel.text = "Analysis complete: " + g_analysisData.length + " unique sessions found" + integrationText;
      
   } catch (e) {
      Console.criticalln("Error during analysis: " + e);
      Console.criticalln("Stack trace: " + (e.stack || "No stack trace available"));
      this.analysisStatusLabel.text = "Analysis failed: " + e;
   } finally {
      this.analyzeButton.enabled = true;
      this.updateUI();
      this.refreshChart(); // keep the Visualize tab in sync with the new data
   }
}

// Method to populate global parameters from image metadata
populateGlobalParametersFromMetadata(globalData)
{
   if (!globalData) return;
   
   // Only populate if the field is currently empty or default
   if (globalData.ambientTemp !== undefined && (!this.temperatureEdit.text || this.temperatureEdit.text === CONFIG.ambientTemp)) {
      var temp = Math.round(globalData.ambientTemp * 10) / 10; // Round to 1 decimal
      this.temperatureEdit.text = temp.toString();
      CONFIG.ambientTemp = temp.toString();
      Console.writeln("Populated ambient temperature: " + temp + "°C");
   }
   
   // Try to estimate SQM from sky brightness if available (never over a manual value)
   if (globalData.skyBrightness !== undefined && CONFIG.sqmSource !== "user" && CONFIG.sqmSource !== "cleared" &&
       (!this.meanSqmEdit.text || this.meanSqmEdit.text === CONFIG.meanSqm)) {
      // Sky brightness is typically in [lux], need to convert to mag/arcsec²
      // This is a rough approximation: SQM ≈ -2.5 * log10(skyBrightness) + constant
      // For more accurate conversion, this would need calibration
      var estimatedSqm = Math.round((21.0 - Math.log10(Math.max(globalData.skyBrightness, 0.001)) * 2.5) * 10) / 10;
      if (estimatedSqm > 15 && estimatedSqm < 23) { // Reasonable SQM range
         this.meanSqmEdit.text = estimatedSqm.toString();
         CONFIG.meanSqm = estimatedSqm.toString();
         CONFIG.sqmSource = "fits";
         Console.writeln("Estimated SQM from sky brightness: " + estimatedSqm + " mag/arcsec²");
      }
   }
   
   // Log other available metadata for future enhancement or manual entry
   if (globalData.focalLength !== undefined) {
      Console.writeln("Available focal length: " + globalData.focalLength + "mm");
   }
   if (globalData.telescope) {
      Console.writeln("Available telescope: " + globalData.telescope);
   }
   if (globalData.instrument) {
      Console.writeln("Available instrument: " + globalData.instrument);
   }
   if (globalData.siteLatitude !== undefined) {
      Console.writeln("Available site latitude: " + globalData.siteLatitude.toFixed(4) + "°");
   }
   if (globalData.siteLongitude !== undefined) {
      Console.writeln("Available site longitude: " + globalData.siteLongitude.toFixed(4) + "°");
   }
   if (globalData.siteElevation !== undefined) {
      Console.writeln("Available site elevation: " + globalData.siteElevation + "m");
   }
   if (globalData.humidity !== undefined) {
      Console.writeln("Available humidity: " + globalData.humidity + "%");
   }
   if (globalData.pressure !== undefined) {
      Console.writeln("Available air pressure: " + globalData.pressure + " hPa");
   }
   if (globalData.dewPoint !== undefined) {
      Console.writeln("Available dew point: " + globalData.dewPoint + "°C");
   }
   if (globalData.windSpeed !== undefined) {
      Console.writeln("Available wind speed: " + globalData.windSpeed + " km/h");
   }
   if (globalData.skyTemp !== undefined) {
      Console.writeln("Available sky temperature: " + globalData.skyTemp + "°C");
   }
}

// Forget every manual override of an auto-detected field. Called when the user picks a
// different root directory: overrides belong to the project they were entered for, not
// to the dialog. Deliberately NOT called from resetGlobalParametersUI(), which runs on
// every analysis and would undo the overrides on the very next re-analyse.
resetParameterOverrides()
{
   CONFIG.sqmSource = "none";
   CONFIG.bortleUserSet = false;
   CONFIG.fwhmUserSet = false;
   CONFIG.ambientTempUserSet = false;
   CONFIG.calibrationUserSet = { darks: false, flats: false, flatDarks: false, bias: false };
}

// Reset global parameters UI to enabled state for new analysis
resetGlobalParametersUI()
{
   // Nothing disables these controls any more - auto-detection fills them in and
   // leaves them editable - so there is nothing to re-enable here.

   // Drop the "auto-detected from N frames" tooltips, but keep telling the user the
   // counts are theirs to change - the scan only sees what is under the chosen directory
   var calibrationTip = "Auto-filled from the frames found in the scanned directory.\n" +
                        "Editable: type your own count to override it.";
   this.darksEdit.toolTip = calibrationTip;
   this.flatsEdit.toolTip = calibrationTip;
   this.flatDarksEdit.toolTip = calibrationTip;
   this.biasEdit.toolTip = calibrationTip;
   this.bortleComboBox.toolTip = "Bortle Dark-Sky Scale - only the number (1-9) is exported.\n" +
                                 "Editable: a class found in the FITS headers is only a starting point.";
   // Keep helpful tooltips for SQM, FWHM, and Temperature
   this.meanSqmEdit.toolTip = "Sky Quality Meter reading in mag/arcsec². Range: 16-22 (higher = darker skies)\n" +
                              "Urban: 16-18, Suburban: 18-20, Rural: 20-21, Dark site: 21-22\n" +
                              "Type your own value to override FITS metadata, or clear it to omit SQM from the CSV.";
   this.meanFwhmEdit.toolTip = "Full Width Half Maximum in arcseconds. Measures seeing quality.\n" +
                               "Excellent: <1.5\", Good: 1.5-2.5\", Average: 2.5-3.5\", Poor: >3.5\"\n" +
                               "Measure star FWHM in PixInsight with DynamicPSF or similar tools";
   this.temperatureEdit.toolTip = "Ambient air temperature in Celsius. Used as fallback if not available in FITS.\n" +
                                  "Per-session temperatures from FITS take precedence when available.";
   
   // Reset info label
   this.metadataInfoLabel.text = "Analyzing images to detect available metadata...";
   this.metadataInfoLabel.styleSheet = "QLabel { color: #666; font-size: 9pt; }";
}

populateImageTree()
{
   this.imageTreeBox.clear();
   
   for (var i = 0; i < g_analysisData.length; i++) {
      var data = g_analysisData[i];
      var node = new TreeBoxNode(this.imageTreeBox);
      
      node.setText(0, String(data.date || "N/A"));
      node.setText(1, String(data.filter || "(No Filter)"));  // Show original FITS filter name
      
      // Only auto-suggest if no filter ID is already set (preserve manual mappings)
      if (!data.filterId || data.filterId === "") {
        var suggestedId = suggestFilterId(data.filter);
        if (suggestedId) {
          data.filterId = suggestedId;
        }
      }
      
      // Column 2: Resolved Filter Name (Brand + Display) from filterId if available
      var resolvedName = "";
      if (data.filterId) {
         try {
            var f = findFilterById(data.filterId);
            if (f) {
               var disp = f.display || f.name || data.filterId;
               if (disp.toLowerCase().indexOf(f.brand.toLowerCase()) === 0) {
                  resolvedName = disp; // already includes brand prefix
               } else {
                  resolvedName = f.brand + " " + disp;
               }
            }
         } catch (e) {
            Console.warningln("Lookup failed for filterId " + data.filterId + ": " + e);
         }
      }
      node.setText(2, resolvedName);
      node.setText(3, String(data.filterId || ""));
      node.setText(4, String(data.number || "0"));
      node.setText(5, data.duration ? String(data.duration) + "s" : "N/A");
      node.setText(6, String(data.binning || "N/A"));
      node.setText(7, String(data.gain || "N/A"));
      node.setText(8, data.sensorCooling ? String(data.sensorCooling) : "N/A");

      // Visual indication of excluded rows
      if (data.excluded) {
         for (var col = 0; col < 9; col++) {
            node.setTextColor(col, 0xFF999999);
         }
      }

      // Store data index for editing
      node.dataIndex = i;
   }

   this.updateUI();
}

generateCSV()
{
   if (g_analysisData.length === 0) {
      Console.warningln("No data to export. Please analyze images first.");
      return;
   }
   
   try {
      // Update config with current UI values BEFORE generating CSV
      this.updateConfigFromUI();
      Console.writeln("Updated CONFIG from current UI values");
      
      // Update the existing aggregated data with current CONFIG values
      // This allows users to change global parameters without re-analyzing
      for (var i = 0; i < g_analysisData.length; i++) {
         var item = g_analysisData[i];
         
         // Always use current CONFIG values for calibration counts (user may have updated them)
         item.darks = CONFIG.darks;
         item.flats = CONFIG.flats;
         item.flatDarks = CONFIG.flatDarks;
         item.bias = CONFIG.bias;
         
         // Always use current CONFIG values for environmental parameters (user may have updated them)
         item.bortle = CONFIG.bortle;
         item.meanSqm = CONFIG.meanSqm;
         item.meanFwhm = CONFIG.meanFwhm;
         
         // For temperature: use FITS session average if available, otherwise use current CONFIG
         // (Temperature is calculated per-session from FITS, only use CONFIG as fallback)
         if (!item.temperature || item.temperature === "" || item.temperature === "0") {
            item.temperature = CONFIG.ambientTemp;
         }
      }
      
      // Update the display to show current values
      this.populateImageTree();
      
   // Generate CSV content with updated data
   var csvContent = this.createCSVContent(g_analysisData);
      this.csvPreviewTextBox.text = csvContent;
      
      this.saveCSVButton.enabled = true;
      this.copyCSVButton.enabled = true;
      
      Console.noteln("CSV content generated successfully with current global parameters");
      Console.noteln("Temperature and numeric values formatted according to AstroBin CSV requirements");
   } catch (e) {
      Console.criticalln("Error generating CSV: " + e);
   }
}

createCSVContent(data)
{
   var lines = [];
   
   // Header
   var header = [
      "date","filter","number","duration",
      "iso","binning","gain","sensorCooling","fNumber",
      "darks","flats","flatDarks","bias","bortle","meanSqm","meanFwhm","temperature"
   ].join(",");
   lines.push(header);
   
   // Column population map (headers always present; unchecked columns produce empty values)
   var cols = CONFIG.exportColumns || {};
   // Safety: required columns enforced
   cols.number = true; cols.duration = true;

   // Data rows
   for (var i = 0; i < data.length; i++) {
      var a = data[i];
      // Skip excluded filters
      if (a.excluded) continue;
      var durationStr = "";
      if (a.duration !== '') {
        durationStr = Number(a.duration).toFixed(4);
        if (durationStr === "0.0000") durationStr = "0.0000";
        else {
          // Remove trailing zeros
          while (durationStr.endsWith("0") && durationStr.indexOf(".") !== -1) {
            durationStr = durationStr.substring(0, durationStr.length - 1);
          }
          if (durationStr.endsWith(".")) durationStr = durationStr.substring(0, durationStr.length - 1);
        }
      }
      
      // Format temperatures according to AstroBin CSV requirements
      var sensorCoolingStr = "";
      if (a.sensorCoolingForCSV || a.sensorCooling) {
         // Sensor cooling must be whole number (no decimals)
         // Range: -274 to 100 degrees Celsius
         var sensorTemp = parseFloat(a.sensorCoolingForCSV || a.sensorCooling);
         sensorTemp = Math.max(-274, Math.min(100, sensorTemp)); // Clamp to valid range
         sensorCoolingStr = Math.round(sensorTemp).toString();
      }
      
      var ambientTempStr = "";
      if (a.temperature) {
         // Ambient temperature can have up to 2 decimals
         // Range: -88 to 58 degrees Celsius
         var ambientTemp = parseFloat(a.temperature);
         ambientTemp = Math.max(-88, Math.min(58, ambientTemp)); // Clamp to valid range
         ambientTempStr = ambientTemp.toFixed(2);
         // Remove trailing zeros
         ambientTempStr = ambientTempStr.replace(/\.?0+$/, '');
      }
      
      // Bortle must be whole number (1-9)
      var bortleStr = "";
      if (a.bortle) {
         var bortleVal = parseFloat(a.bortle);
         bortleVal = Math.max(1, Math.min(9, bortleVal)); // Clamp to valid range
         bortleStr = Math.round(bortleVal).toString();
      }
      
      // Format other numeric fields according to AstroBin requirements
      var gainStr = "";
      if (a.gain) {
         var gainVal = parseFloat(a.gain);
         gainStr = gainVal.toFixed(2).replace(/\.?0+$/, '');
      }
      
      var fNumberStr = "";
      if (a.fNumber) {
         var fNumberVal = parseFloat(a.fNumber);
         fNumberStr = fNumberVal.toFixed(2).replace(/\.?0+$/, '');
      }
      
      var sqmStr = "";
      if (a.meanSqm) {
         var sqmVal = parseFloat(a.meanSqm);
         sqmStr = sqmVal.toFixed(2).replace(/\.?0+$/, '');
      }
      
      var fwhmStr = "";
      if (a.meanFwhm) {
         var fwhmVal = parseFloat(a.meanFwhm);
         fwhmStr = fwhmVal.toFixed(2).replace(/\.?0+$/, '');
      }
      
      // Build row honoring column population settings
      var row = [
         cols.date ? a.date : "",
         cols.filter ? a.filterId : "",
         /* required */ a.number,
         /* required */ durationStr,
         cols.iso ? "" : "",
         cols.binning ? a.binning : "",
         cols.gain ? gainStr : "",
         cols.sensorCooling ? sensorCoolingStr : "",
         cols.fNumber ? fNumberStr : "",
         cols.darks ? a.darks : "",
         cols.flats ? a.flats : "",
         cols.flatDarks ? a.flatDarks : "",
         cols.bias ? a.bias : "",
         cols.bortle ? bortleStr : "",
         cols.meanSqm ? sqmStr : "",
         cols.meanFwhm ? fwhmStr : "",
         cols.temperature ? ambientTempStr : ""
      ].join(",");
      lines.push(row);
   }
   
   return lines.join("\n");
}

saveCSVFile()
{
   if (!this.csvPreviewTextBox.text) return;
   
   var sfd = new SaveFileDialog;
   sfd.caption = "Save AstroBin CSV File";
   sfd.overwritePrompt = true;
   sfd.filters = [["CSV Files", "*.csv"], ["All Files", "*"]];
   
   if (sfd.execute()) {
      try {
         File.writeTextFile(sfd.fileName, this.csvPreviewTextBox.text);
         Console.noteln("CSV saved to: " + sfd.fileName);
      } catch (e) {
         Console.criticalln("Error saving CSV file: " + e);
      }
   }
}

copyCSVToClipboard()
{
   if (!this.csvPreviewTextBox.text) return;
   
   // Note: PixInsight doesn't have direct clipboard access, so we show a message
   Console.noteln("CSV content is in the preview box. Please select all text and copy manually.");
   this.csvPreviewTextBox.selectAll();
}

   // Modal: Export Columns selection
   showExportColumnsDialog()
   {
      var dlg = new Dialog(this);
      dlg.windowTitle = "Export Columns";
      dlg.scaledMinWidth = 380;
      dlg.scaledMinHeight = 300;
      dlg.sizer = new VerticalSizer;
      dlg.sizer.margin = 8; dlg.sizer.spacing = 6;

      var desc = new Label(dlg);
      desc.text = "Choose which columns should be populated in the CSV.\nHeaders remain, unchecked columns output empty cells.";
      desc.wordWrapping = true;
      dlg.sizer.add(desc);

      var grid = new VerticalSizer; grid.spacing = 2;
      var current = CONFIG.exportColumns || DEFAULT_EXPORT_COLUMNS;

      function makeCheck(text, key, disabled) {
         var cb = new CheckBox(dlg);
         cb.text = text;
         cb.checked = !!current[key];
         if (disabled) { cb.checked = true; cb.enabled = false; }
         cb.onCheck = function(v){ /* no-op live */ };
         cb.__key__ = key;
         cb.__required__ = !!disabled;
         return cb;
      }

      var checks = [];
      checks.push(makeCheck("Date", "date"));
      checks.push(makeCheck("Filter ID", "filter"));
      checks.push(makeCheck("Number (required)", "number", true));
      checks.push(makeCheck("Duration (required)", "duration", true));
      checks.push(makeCheck("ISO (unused placeholder)", "iso"));
      checks.push(makeCheck("Binning", "binning"));
      checks.push(makeCheck("Gain", "gain"));
      checks.push(makeCheck("Sensor Cooling", "sensorCooling"));
      checks.push(makeCheck("F/Number", "fNumber"));
      checks.push(makeCheck("Darks", "darks"));
      checks.push(makeCheck("Flats", "flats"));
      checks.push(makeCheck("Flat Darks", "flatDarks"));
      checks.push(makeCheck("Bias", "bias"));
      checks.push(makeCheck("Bortle", "bortle"));
      checks.push(makeCheck("Mean SQM", "meanSqm"));
      checks.push(makeCheck("Mean FWHM", "meanFwhm"));
      checks.push(makeCheck("Ambient Temperature", "temperature"));

      for (var i = 0; i < checks.length; i++) grid.add(checks[i]);
      dlg.sizer.add(grid, 100);

      var btns = new HorizontalSizer; btns.spacing = 6;
      var resetBtn = new PushButton(dlg); resetBtn.text = "Reset"; resetBtn.toolTip = "Restore defaults";
      var okBtn = new PushButton(dlg); okBtn.text = "OK"; okBtn.defaultButton = true;
      var cancelBtn = new PushButton(dlg); cancelBtn.text = "Cancel";
      btns.addStretch(); btns.add(resetBtn); btns.add(okBtn); btns.add(cancelBtn);
      dlg.sizer.add(btns);

      var self = this;
      resetBtn.onClick = function(){
         for (var i=0;i<checks.length;i++) {
            var c = checks[i];
            var defVal = DEFAULT_EXPORT_COLUMNS[c.__key__];
            c.checked = c.__required__ ? true : !!defVal;
         }
      };
      okBtn.onClick = function(){
         var map = {};
         for (var i=0;i<checks.length;i++) map[checks[i].__key__] = !!checks[i].checked;
         // Enforce required
         map.number = true; map.duration = true;
         // Persist
         CONFIG.exportColumns = map;
         try {
            saveExportColumnSettings(map);
         } catch (e) {
            Console.criticalln("[AstroBin] Failed to save export columns: " + e);
         }
         // Refresh CSV preview if present
         if (self.csvPreviewTextBox.text && self.csvPreviewTextBox.text.length > 0) {
            var csv = self.createCSVContent(g_analysisData);
            self.csvPreviewTextBox.text = csv;
         }
         dlg.ok();
      };
      cancelBtn.onClick = function(){ dlg.cancel(); };

      dlg.execute();
   }

updateConfigFromUI()
{
   CONFIG.darks = this.darksEdit.text;
   CONFIG.flats = this.flatsEdit.text;
   CONFIG.flatDarks = this.flatDarksEdit.text;
   CONFIG.bias = this.biasEdit.text;
   CONFIG.bortle = (this.bortleComboBox.currentItem + 1).toString(); // Get numeric value (1-9) from ComboBox
   CONFIG.meanSqm = this.meanSqmEdit.text;
   // A field emptied after it held a value is a deliberate "don't export SQM" and must
   // stay empty. A field that was never filled in stays "none", so picking a Bortle
   // class can still estimate one - this runs on Generate CSV / Summary / OK, none of
   // which say anything about the user's intent for SQM.
   if (CONFIG.sqmSource !== "none" && CONFIG.meanSqm.trim() === "") CONFIG.sqmSource = "cleared";
   CONFIG.meanFwhm = this.meanFwhmEdit.text;
   CONFIG.ambientTemp = this.temperatureEdit.text;
   CONFIG.preferredFilterBrand = this.filterBrandCombo.itemText(this.filterBrandCombo.currentItem);
}

updateUI()
{
   this.analyzeButton.enabled = (g_imageFiles.length > 0);
   this.mapFiltersButton.enabled = (g_analysisData.length > 0);
   this.generateCSVButton.enabled = (g_analysisData.length > 0);
   this.summaryButton.enabled = (g_analysisData.length > 0);
}

// Override ok() to save Bortle setting when dialog closes
ok()
{
   // Update CONFIG from UI before saving
   this.updateConfigFromUI();
   
   // Save Bortle scale to settings
   saveBortleScale(CONFIG.bortle);
   
   // Call parent Dialog.ok() to close dialog
   super.ok();
}

// Convert Bortle Scale to SQM estimate
updateSQMFromBortle()
{
   var bortleValue = parseFloat(CONFIG.bortle);
   if (isNaN(bortleValue) || bortleValue < 1 || bortleValue > 9) {
      return; // Invalid Bortle value
   }
   
   // Never overwrite a value the user typed, a field the user deliberately emptied,
   // or a genuine SQM reading taken from the FITS headers
   if (CONFIG.sqmSource === "user" || CONFIG.sqmSource === "cleared" || CONFIG.sqmSource === "fits") {
      return;
   }
   
   // Fill in (or refresh) the Bortle-derived estimate while the field is still ours
   if (CONFIG.meanSqm === "" || CONFIG.meanSqm === "0" || CONFIG.sqmSource === "bortle") {
      var estimatedSQM = this.bortleToSQM(bortleValue);
      CONFIG.meanSqm = estimatedSQM.toFixed(1);
      this.meanSqmEdit.text = CONFIG.meanSqm;
      CONFIG.sqmSource = "bortle";
      Console.writeln("Estimated SQM " + CONFIG.meanSqm + " mag/arcsec² from Bortle Class " + bortleValue);
   }
}

// Bortle to SQM conversion lookup
bortleToSQM(bortleClass)
{
   // Based on typical Bortle-SQM relationships
   var sqmValues = {
      1: 21.8,  // Excellent dark site
      2: 21.6,  // Typical dark site  
      3: 21.4,  // Rural sky
      4: 20.8,  // Rural/suburban transition
      5: 19.8,  // Suburban sky
      6: 18.6,  // Bright suburban
      7: 18.0,  // Suburban/urban transition
      8: 17.8,  // City sky
      9: 15.5   // Inner city
   };
   
   var roundedClass = Math.round(bortleClass);
   return sqmValues[roundedClass] || 19.0; // Default fallback
}

showAbout()
{
   var msg = "<b>AstroBin CSV Export v" + SCRIPT_VERSION + "</b><br><br>" +
             "Enhanced tool for generating CSV files compatible with AstroBin's acquisition data import.<br><br>" +
             "<b>Features:</b><br>" +
             "• Automatic metadata extraction from FITS/XISF files<br>" +
             "• Calibration frame auto-detection<br>" +
             "• Session-specific ambient temperature averaging<br>" +
             "• Smart filter mapping with brand preferences<br>" +
             "• Interactive GUI for data review and editing<br>" +
             "• Comprehensive integration summary with insights<br>" +
             "• Full AstroBin CSV format compliance with proper field formatting<br><br>" +
             "<b>Parameter Guidance:</b><br>" +
             "• <b>SQM (Optional):</b> Sky Quality Meter in mag/arcsec²<br>" +
             "&nbsp;&nbsp;Auto-converts sky brightness (lux) from FITS to proper SQM<br>" +
             "&nbsp;&nbsp;Auto-estimates from Bortle Scale when SQM unavailable<br>" +
             "&nbsp;&nbsp;Get data: Bortle Scale (easiest!), SQM apps, hardware devices<br>" +
             "&nbsp;&nbsp;Apps: 'Sky Quality Meter', 'Loss of the Night' (free)<br>" +
             "&nbsp;&nbsp;Hardware: Unihedron SQM-L devices (~$200)<br>" +
             "• <b>FWHM (Optional):</b> Full Width Half Maximum in arcseconds<br>" +
             "&nbsp;&nbsp;Measure: PixInsight → Process → Image Analysis → DynamicPSF<br>" +
             "&nbsp;&nbsp;Click unsaturated stars, read FWHM value, average results<br>" +
             "&nbsp;&nbsp;Can leave blank if no suitable stars or tools available<br>" +
             "• <b>Temperature:</b> Per-session averages from FITS when available<br>" +
             "• <b>Note:</b> SQM and FWHM are optional for AstroBin CSV import<br><br>" +
             "<b>Usage:</b><br>" +
             "1. Select directory containing calibrated image files<br>" +
             "2. Set global acquisition parameters (auto-detected when possible)<br>" +
             "3. Analyze images to extract metadata and count calibration frames<br>" +
             "4. Map filters to AstroBin IDs and generate CSV<br><br>" +
             "Supports FITS and XISF image formats.";
             
   var msgBox = new MessageBox(msg, "About AstroBin CSV Export", StdIcon.Information, StdButton.Ok);
   msgBox.execute();
}

// Filter Mapping Dialog
showFilterMappingDialog()
{
   if (g_analysisData.length === 0) {
      Console.warningln("No analysis data available. Please analyze images first.");
      return;
   }
   
   Console.writeln("Opening filter mapping dialog...");
   
   // Create filter mapping dialog
   try {
      var filterDialog = new FilterMappingDialog(this);
      Console.writeln("Filter mapping dialog created successfully");
      
      // Execute the dialog and update the main tree if OK was pressed
      var result = filterDialog.execute();
      Console.writeln("Dialog result: " + result);
      if (result === 1) { // 1 = OK button pressed
         // Update the Filter ID column in the main tree and g_analysisData
         this.populateImageTree();
         Console.writeln("Filter mapping updated successfully");
      }
   } catch (e) {
      Console.criticalln("Error creating or executing filter mapping dialog: " + e);
      Console.criticalln("Stack trace: " + (e.stack || "No stack trace available"));
   }
}

// Integration Summary Dialog
showIntegrationSummary()
{
   if (g_analysisData.length === 0) {
      return;
   }

   // Pull the latest UI values into CONFIG so the summary reflects edits made
   // since the dialog opened (calibration counts, SQM, Bortle) rather than the
   // values captured the last time the dialog was saved/opened.
   this.updateConfigFromUI();

   try {
      // Calculate summary statistics
      var stats = this.calculateIntegrationStats();

      // High-level totals card. Per-filter / per-night / per-exposure breakdowns
      // now live as interactive charts on the Visualize tab.
      var msg = "<b>🌟 Integration Summary</b><br><br>" +

                "<b>📊 Totals:</b><br>" +
                "• Total integration: " + this.formatDuration(stats.totalIntegrationTime) + "<br>" +
                "• Frames captured: " + stats.totalImages + "<br>" +
                "• Sessions: " + stats.sessionCount + "<br>" +
                "• Date range: " + (stats.dateRange || "—") + "<br>" +
                "• Most productive filter: " + (stats.mostProductiveFilter || "—") + "<br>" +
                "• Sky quality: " + stats.skyQuality + "<br><br>" +

                "<b>🎯 Calibration Ready:</b><br>" +
                "• Darks: " + (CONFIG.darks || "Not set") +
                " &nbsp; Flats: " + (CONFIG.flats || "Not set") +
                " &nbsp; Bias: " + (CONFIG.bias || "Not set") + "<br>";

      if (stats.unmappedFilters && stats.unmappedFilters.length > 0) {
         msg += "<br><b>⚠ " + stats.unmappedFilters.length + " filter" +
                (stats.unmappedFilters.length > 1 ? "s" : "") + " not mapped:</b> " +
                stats.unmappedFilters.join(", ") + " — run Map Filters before exporting.<br>";
      }

      msg += "<br><i>Open the <b>Visualize</b> tab for per-filter, per-night and " +
             "per-exposure breakdowns.</i>";

      var msgBox = new MessageBox(msg, "Integration Summary", StdIcon.Information, StdButton.Ok);
      msgBox.execute();

   } catch (e) {
      Console.warningln("Error generating integration summary: " + e);
   }
}

calculateIntegrationStats()
{
   var stats = {
      totalIntegrationTime: 0,
      totalImages: 0,
      sessionCount: g_analysisData.length,
      dateRange: "",
      filterStats: "",
      exposureTimes: "",
      binningModes: "",
      gainSettings: "",
      fNumberSettings: "",
      tempRange: "",
      coolingRange: "",
      skyQuality: "",
      longestSession: 0,
      mostProductiveFilter: "",
      avgSessionLength: 0,
      insights: ""
   };

   var filters = {};
   var exposures = {};
   var binnings = {};
   var gains = {};
   var fNumbers = {};
   var temperatures = [];
   var coolings = [];
   var dates = [];
   var sessionTimes = [];

   // Process each session
   for (var i = 0; i < g_analysisData.length; i++) {
      var session = g_analysisData[i];
      if (session.excluded) continue;
      var sessionTime = parseFloat(session.duration || 0) * parseInt(session.number || 0);

      stats.totalIntegrationTime += sessionTime;
      stats.totalImages += parseInt(session.number || 0);
      sessionTimes.push(sessionTime);

      // Track filter usage
      var filterKey = session.filter || "No Filter";
      if (!filters[filterKey]) {
         filters[filterKey] = { time: 0, frames: 0, filterId: "", mapped: false };
      }
      filters[filterKey].time += sessionTime;
      filters[filterKey].frames += parseInt(session.number || 0);
      // Capture the mapped AstroBin filter ID so the breakdown reflects mapping state
      if (!filters[filterKey].mapped && _astrobinValidFilterId(session.filterId)) {
         filters[filterKey].filterId = session.filterId;
         filters[filterKey].mapped = true;
      }

      // Track unique settings
      if (session.duration) exposures[session.duration] = true;
      if (session.binning) binnings[session.binning] = true;
      if (session.gain) gains[session.gain] = true;
      if (session.fNumber) fNumbers[session.fNumber] = true;

      // Track environmental data
      if (session.temperature && session.temperature !== "" && session.temperature !== "0") {
         temperatures.push(parseFloat(session.temperature));
      }
      if (session.sensorCooling && session.sensorCooling !== "" && session.sensorCooling !== "0") {
         coolings.push(parseFloat(session.sensorCooling));
      }

      // Track dates
      if (session.date) dates.push(session.date);
   }

   // Calculate longest session
   stats.longestSession = Math.max.apply(Math, sessionTimes);
   stats.avgSessionLength = stats.totalIntegrationTime / stats.sessionCount;

   // Find most productive filter
   var maxTime = 0;
   for (var filter in filters) {
      if (filters[filter].time > maxTime) {
         maxTime = filters[filter].time;
         stats.mostProductiveFilter = filter + " (" + this.formatDuration(filters[filter].time) + ")";
      }
   }

   // Format filter stats — include AstroBin mapping state ("filters leveraged")
   var filterLines = [];
   var unmappedFilters = [];
   for (var filter in filters) {
      var f = filters[filter];
      var mapInfo;
      if (f.mapped) {
         mapInfo = " → " + getFilterDisplayName(f.filterId);
      } else {
         mapInfo = " ⚠ not mapped";
         unmappedFilters.push(filter);
      }
      filterLines.push("&nbsp;&nbsp;• " + filter + ": " + this.formatDuration(f.time) + " (" + f.frames + " frames)" + mapInfo);
   }
   stats.filterStats = filterLines.join("<br>");
   stats.unmappedFilters = unmappedFilters;

   // Format setting ranges
   stats.exposureTimes = Object.keys(exposures).sort((a,b) => parseFloat(a) - parseFloat(b)).join("s, ") + "s";
   stats.binningModes = Object.keys(binnings).sort().join(", ");
   stats.gainSettings = Object.keys(gains).sort((a,b) => parseInt(a) - parseInt(b)).join(", ");
   stats.fNumberSettings = Object.keys(fNumbers).sort((a,b) => parseFloat(a) - parseFloat(b)).join(", ");

   // Format temperature range
   if (temperatures.length > 0) {
      var minTemp = Math.min.apply(Math, temperatures);
      var maxTemp = Math.max.apply(Math, temperatures);
      stats.tempRange = minTemp.toFixed(1) + "°C to " + maxTemp.toFixed(1) + "°C";
   } else {
      stats.tempRange = "Not available in FITS";
   }

   // Format cooling range
   if (coolings.length > 0) {
      var minCool = Math.min.apply(Math, coolings);
      var maxCool = Math.max.apply(Math, coolings);
      stats.coolingRange = minCool.toFixed(1) + "°C to " + maxCool.toFixed(1) + "°C";
   } else {
      stats.coolingRange = "Not available in FITS";
   }

   // Format sky quality
   var sqmValue = CONFIG.meanSqm;
   var bortleValue = CONFIG.bortle;
   if (sqmValue && sqmValue !== "" && sqmValue !== "0") {
      var sqmFloat = parseFloat(sqmValue);
      var quality = "";
      if (sqmFloat > 21.5) quality = " (Excellent dark site)";
      else if (sqmFloat > 20.5) quality = " (Good dark site)";
      else if (sqmFloat > 19.0) quality = " (Suburban)";
      else if (sqmFloat > 17.0) quality = " (Urban)";
      else quality = " (Inner city)";
      stats.skyQuality = sqmValue + " mag/arcsec²" + quality;
   } else if (bortleValue && bortleValue !== "" && bortleValue !== "0") {
      stats.skyQuality = "Bortle Class " + bortleValue + " (SQM estimated)";
   } else {
      stats.skyQuality = "Not specified";
   }

   // Format date range
   if (dates.length > 0) {
      dates.sort();
      if (dates.length === 1) {
         stats.dateRange = dates[0];
      } else {
         stats.dateRange = dates[0] + " to " + dates[dates.length - 1];
      }
   }

   // Generate insights for astrophotographers
   var insights = [];

   // Filter mapping completeness — flag first since the CSV isn't export-ready
   // until every filter has an AstroBin ID.
   if (unmappedFilters.length > 0) {
      insights.push("• ⚠ " + unmappedFilters.length + " filter" + (unmappedFilters.length > 1 ? "s" : "") +
                    " not yet mapped to AstroBin IDs (" + unmappedFilters.join(", ") +
                    ") — run Map Filters before exporting");
   }

   // Integration time insights
   if (stats.totalIntegrationTime > 7200) { // > 2 hours
      insights.push("• Great integration time! " + this.formatDuration(stats.totalIntegrationTime) + " should provide excellent SNR");
   } else if (stats.totalIntegrationTime > 3600) { // > 1 hour
      insights.push("• Good integration time of " + this.formatDuration(stats.totalIntegrationTime) + " for deep sky work");
   } else {
      insights.push("• Consider more integration time for better signal-to-noise ratio");
   }

   // Filter diversity
   var filterCount = Object.keys(filters).length;
   if (filterCount > 3) {
      insights.push("• Excellent filter diversity (" + filterCount + " filters) for rich color data");
   } else if (filterCount > 1) {
      insights.push("• Good multi-filter approach for enhanced color information");
   }

   // Session consistency
   if (sessionTimes.length > 1) {
      var avgDiff = 0;
      for (var i = 0; i < sessionTimes.length; i++) {
         avgDiff += Math.abs(sessionTimes[i] - stats.avgSessionLength);
      }
      avgDiff = avgDiff / sessionTimes.length / stats.avgSessionLength;

      if (avgDiff < 0.3) {
         insights.push("• Consistent session lengths - excellent for balanced processing");
      }
   }

   // Temperature stability
   if (temperatures.length > 1) {
      var tempRange = Math.max.apply(Math, temperatures) - Math.min.apply(Math, temperatures);
      if (tempRange < 3) {
         insights.push("• Excellent temperature stability (±" + (tempRange/2).toFixed(1) + "°C)");
      } else if (tempRange < 8) {
         insights.push("• Good temperature stability across sessions");
      } else {
         insights.push("• Wide temperature range - monitor thermal effects on calibration");
      }
   }

   // Exposure time analysis
   var expCount = Object.keys(exposures).length;
   if (expCount === 1) {
      insights.push("• Consistent exposure times - optimal for stacking workflow");
   } else if (expCount > 3) {
      insights.push("• Multiple exposure times detected - verify intentional for HDR/dithering");
   }

   stats.insights = insights.length > 0 ? insights.join("<br>") : "• Analysis complete - ready for calibration and processing";

   return stats;
}

formatDuration(seconds)
{
   if (!seconds || seconds === 0) return "0 min";

   var hours = Math.floor(seconds / 3600);
   var minutes = Math.floor((seconds % 3600) / 60);
   var secs = Math.floor(seconds % 60);

   var parts = [];
   if (hours > 0) parts.push(hours + "h");
   if (minutes > 0) parts.push(minutes + "m");
   if (secs > 0 && hours === 0) parts.push(secs + "s");

   return parts.join(" ") || "0 min";
}

// Simple helper to calculate total integration time from analysis data
calculateTotalIntegrationTime()
{
   if (!g_analysisData || g_analysisData.length === 0) return 0;

   var totalSeconds = 0;
   for (var i = 0; i < g_analysisData.length; i++) {
      var data = g_analysisData[i];
      if (data.excluded) continue;
      var exposure = parseFloat(data.duration) || 0;
      var count = parseInt(data.number, 10) || 0;
      totalSeconds += exposure * count;
   }

   return totalSeconds;
}

// ============================================================================
// Visualize tab — custom-drawn bar charts of integration data
// ============================================================================

// Map a combo selection into chart data and repaint. Recomputes from the live
// g_analysisData every call, so tree exclusions / filter mapping stay reflected.
refreshChart()
{
   if (!this.chartScroll) return;
   var groupBy = this.chartGroupKeys[this.chartGroupByCombo.currentItem];
   var measure = this.chartMeasureKeys[this.chartMeasureCombo.currentItem];
   this.chartData = this.computeChartData(groupBy, measure);
   this.chartMeasure = measure;
   this.chartStacked = (groupBy === "date_filter");
   this.updateChartScrollRange();
   this.chartScroll.viewport.repaint();
}

// Aggregate non-excluded sessions for one dimension. Returns [{label, value}]
// plus, for the stacked "date_filter" mode, a per-row `segments` array.
computeChartData(groupBy, measure)
{
   // Stacked mode: one bar per date, segmented by filter.
   if (groupBy === "date_filter") {
      var byDate = {}; // date -> { total, filters: { name: value } }
      for (var di = 0; di < g_analysisData.length; di++) {
         var drow = g_analysisData[di];
         if (drow.excluded) continue;
         var dcount = parseInt(drow.number, 10) || 0;
         var dvalue = (measure === "frames") ? dcount : (parseFloat(drow.duration) || 0) * dcount;
         if (dvalue <= 0) continue;
         var date = drow.date || "(no date)";
         var fname = drow.filter || "(No Filter)";
         if (!byDate[date]) byDate[date] = { total: 0, filters: {} };
         byDate[date].total += dvalue;
         byDate[date].filters[fname] = (byDate[date].filters[fname] || 0) + dvalue;
      }
      var self = this;
      var rows = [];
      for (var d in byDate) {
         if (!byDate.hasOwnProperty(d)) continue;
         var segs = [];
         for (var fn in byDate[d].filters) {
            if (!byDate[d].filters.hasOwnProperty(fn)) continue;
            segs.push({ label: fn, value: byDate[d].filters[fn], color: this.chartBarColor(fn, 0) });
         }
         segs.sort(function(a, b) {
            var r = self.filterSortRank(a.label) - self.filterSortRank(b.label);
            return r !== 0 ? r : (a.label < b.label ? -1 : 1);
         });
         rows.push({ label: d, value: byDate[d].total, segments: segs });
      }
      rows.sort(function(a, b) { return a.label < b.label ? -1 : (a.label > b.label ? 1 : 0); });
      return rows;
   }

   var groups = {}; // label -> { value, key }

   for (var i = 0; i < g_analysisData.length; i++) {
      var row = g_analysisData[i];
      if (row.excluded) continue;

      var count = parseInt(row.number, 10) || 0;
      var seconds = (parseFloat(row.duration) || 0) * count;
      var value = (measure === "frames") ? count : seconds;
      if (value <= 0) continue;

      var label;
      switch (groupBy) {
         case "exposure": label = (row.duration || "?") + "s"; break;
         case "date":     label = row.date || "(no date)"; break;
         case "dow":      label = this.dayOfWeekFromDate(row.date); break;
         case "filter":
         default:         label = row.filter || "(No Filter)"; break;
      }

      if (!groups[label]) groups[label] = { value: 0, key: label };
      groups[label].value += value;
   }

   // Materialize and sort according to the dimension.
   var arr = [];
   for (var k in groups) {
      if (groups.hasOwnProperty(k)) arr.push({ label: k, value: groups[k].value, key: groups[k].key });
   }

   var dowOrder = { "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6 };
   if (groupBy === "date") {
      arr.sort(function(a, b) { return a.label < b.label ? -1 : (a.label > b.label ? 1 : 0); });
   } else if (groupBy === "dow") {
      arr.sort(function(a, b) { return (dowOrder[a.label] || 0) - (dowOrder[b.label] || 0); });
   } else if (groupBy === "exposure") {
      arr.sort(function(a, b) { return parseFloat(a.label) - parseFloat(b.label); });
   } else {
      arr.sort(function(a, b) { return b.value - a.value; }); // filter: longest first
   }

   return arr;
}

// "YYYY-MM-DD" night key -> short weekday name. Noon avoids TZ date rollover.
dayOfWeekFromDate(dateStr)
{
   if (!dateStr) return "(no date)";
   var names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
   var d = new Date(dateStr + "T12:00:00");
   if (isNaN(d.getTime())) return "(no date)";
   return names[d.getDay()];
}

// Conventional 0xAARRGGBB colors for filters; index palette for other dimensions.
chartBarColor(label, index)
{
   var name = (label || "").toLowerCase();
   // Narrowband hues are kept well clear of the broadband R/G/B so SHO and LRGB
   // never read as the same color (e.g. Ha = pink/crimson, not red).
   if (name.indexOf("ha") === 0 || name.indexOf("h-alpha") >= 0 || name.indexOf("halpha") >= 0) return 0xFFEC407A; // Ha pink/crimson
   if (name.indexOf("oiii") >= 0 || name === "o3" || name.indexOf("oxygen") >= 0)              return 0xFF00BCD4; // OIII cyan
   if (name.indexOf("sii") >= 0 || name === "s2" || name.indexOf("sulf") >= 0 || name.indexOf("sulph") >= 0) return 0xFFFFB300; // SII amber
   if (name === "l" || name.indexOf("lum") >= 0 || name.indexOf("clear") >= 0)                  return 0xFFBFBFBF; // L grey
   if (name === "r" || name.indexOf("red") >= 0)                                                return 0xFFE53935; // R red
   if (name === "g" || name.indexOf("green") >= 0)                                              return 0xFF43A047; // G green
   if (name === "b" || name.indexOf("blue") >= 0)                                               return 0xFF1E88E5; // B blue

   var palette = [0xFF5B8FF9, 0xFF61DDAA, 0xFFF6BD16, 0xFF7262FD, 0xFF78D3F8,
                  0xFF9661BC, 0xFFF6903D, 0xFF008685, 0xFFF08BB4, 0xFF6DC8EC];
   return palette[(index | 0) % palette.length];
}

// Canonical filter ordering (L,R,G,B,Ha,OIII,SII, then others) for stacked
// segments and the legend, so colors line up across bars.
filterSortRank(label)
{
   var name = (label || "").toLowerCase();
   if (name === "l" || name.indexOf("lum") >= 0 || name.indexOf("clear") >= 0) return 0;
   if (name === "r" || name.indexOf("red") >= 0)   return 1;
   if (name === "g" || name.indexOf("green") >= 0) return 2;
   if (name === "b" || name.indexOf("blue") >= 0)  return 3;
   if (name.indexOf("ha") === 0 || name.indexOf("halpha") >= 0 || name.indexOf("h-alpha") >= 0) return 4;
   if (name.indexOf("oiii") >= 0 || name === "o3" || name.indexOf("oxygen") >= 0) return 5;
   if (name.indexOf("sii") >= 0 || name === "s2" || name.indexOf("sulf") >= 0 || name.indexOf("sulph") >= 0) return 6;
   return 99;
}

// Chart layout metrics (kept in one place so paint + scroll-range agree).
chartMetrics()
{
   return { pad: 10, rowH: 22, legendH: this.chartStacked ? 22 : 0, bottomPad: 6 };
}

// Size the ScrollBox's vertical range to the full stack of bars.
updateChartScrollRange()
{
   if (!this.chartScroll) return;
   var m = this.chartMetrics();
   var n = (this.chartData || []).length;
   var totalH = m.legendH + m.pad + n * m.rowH + m.bottomPad;
   var maxScroll = Math.max(0, totalH - this.chartScroll.viewport.height);
   this.chartScroll.setHorizontalScrollRange(0, 0);
   this.chartScroll.setVerticalScrollRange(0, maxScroll);
}

// Render the bar chart onto the ScrollBox viewport (offset by scroll position).
paintChart()
{
   var control = this.chartScroll.viewport;
   var g = new Graphics(control);
   try {
      var W = control.width, H = control.height;
      g.fillRect(0, 0, W, H, new Brush(0xFF1A1A1A));

      var data = this.chartData || [];
      if (data.length === 0) {
         g.pen = new Pen(0xFF999999);
         g.font = new Font(FontFamily.Helvetica, 9);
         var msg = "Analyze images to see charts.";
         g.drawText((W - g.font.width(msg)) / 2, H / 2, msg);
         return;
      }

      var isTime = (this.chartMeasure !== "frames");
      var stacked = !!this.chartStacked;
      var m = this.chartMetrics();
      var rowH = m.rowH, barH = rowH - 6, legendH = m.legendH, pad = m.pad;
      var labelW = 92, gap = 8, valueW = 78;
      var barLeft = pad + labelW + gap;
      var barAreaW = Math.max(20, W - barLeft - valueW - pad);
      var scrollPos = this.chartScroll.verticalScrollPosition || 0;

      var maxValue = 0;
      for (var v = 0; v < data.length; v++) if (data[v].value > maxValue) maxValue = data[v].value;
      if (maxValue <= 0) maxValue = 1;

      g.antialiasing = true;
      g.font = new Font(FontFamily.Helvetica, 8);
      var ascent = g.font.ascent;

      for (var i = 0; i < data.length; i++) {
         var item = data[i];
         var y = legendH + pad + i * rowH - scrollPos;
         if (y + rowH < legendH) continue; // scrolled above the bar area
         if (y > H) break;                 // below the viewport
         var barTop = y + (rowH - barH) / 2;
         var textY = y + (rowH + ascent) / 2 - 1;

         // Label (right-aligned against the bar start)
         g.pen = new Pen(0xFFDDDDDD);
         var label = item.label;
         while (label.length > 1 && g.font.width(label) > labelW) label = label.substring(0, label.length - 1);
         g.drawText(pad + labelW - g.font.width(label), textY, label);

         var barW = Math.max(1, Math.round((item.value / maxValue) * barAreaW));

         if (stacked && item.segments && item.segments.length > 0) {
            var x = barLeft;
            for (var s = 0; s < item.segments.length; s++) {
               var seg = item.segments[s];
               var segW = Math.max(1, Math.round((seg.value / maxValue) * barAreaW));
               g.fillRect(x, barTop, x + segW, barTop + barH, new Brush(seg.color));
               x += segW;
            }
         } else {
            g.fillRect(barLeft, barTop, barLeft + barW, barTop + barH,
                       new Brush(this.chartBarColor(item.label, i)));
         }

         // Total value at the end of the bar
         g.pen = new Pen(0xFFBBBBBB);
         var valText = isTime ? this.formatDuration(item.value) : (item.value + " frames");
         g.drawText(barLeft + barW + 6, textY, valText);
      }

      // Fixed legend overlay for stacked mode (drawn last so bars don't cover it)
      if (stacked) {
         g.fillRect(0, 0, W, legendH, new Brush(0xFF1A1A1A));
         this.drawChartLegend(g, data, W, legendH);
      }
   } catch (e) {
      Console.warningln("Error painting chart: " + e);
   } finally {
      g.end();
   }
}

// One-line color legend of the filters present in the stacked chart.
drawChartLegend(g, rows, W, legendH)
{
   var seen = {}, items = [];
   for (var r = 0; r < rows.length; r++) {
      var segs = rows[r].segments || [];
      for (var s = 0; s < segs.length; s++) {
         if (!seen[segs[s].label]) { seen[segs[s].label] = true; items.push({ label: segs[s].label, color: segs[s].color }); }
      }
   }
   var self = this;
   items.sort(function(a, b) {
      var d = self.filterSortRank(a.label) - self.filterSortRank(b.label);
      return d !== 0 ? d : (a.label < b.label ? -1 : 1);
   });

   g.antialiasing = true;
   g.font = new Font(FontFamily.Helvetica, 8);
   var ascent = g.font.ascent;
   var sq = 10, x = 10;
   var sqTop = (legendH - sq) / 2;
   var textY = (legendH + ascent) / 2 - 1;

   for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var advance = sq + 4 + g.font.width(it.label) + 14;
      if (x + advance > W - 10) { g.pen = new Pen(0xFF999999); g.drawText(x, textY, "…"); break; }
      g.fillRect(x, sqTop, x + sq, sqTop + sq, new Brush(it.color));
      g.pen = new Pen(0xFFCCCCCC);
      g.drawText(x + sq + 4, textY, it.label);
      x += advance;
   }
}

} // end class AstroBinDialog

// Filter Mapping Dialog Class
class FilterMappingDialog extends Dialog
{
constructor(parentDialog)
{
   super();

   this.parentDialog = parentDialog; // Store reference to main dialog
   this.windowTitle = "Filter Mapping";
   this.scaledMinWidth = 900;  // Further increased width to accommodate wider manual entry field
   this.scaledMinHeight = 400;
   
   // Get unique filters from analysis data
   this.uniqueFilters = this.getUniqueFilters();
   this.filterMappings = {}; // Store current mappings
   this.personalControls = {}; // Store personal filter row controls
   
   this.createFilterMappingUI();
   this.populateFilterMappings();
}

getUniqueFilters()
{
   var filters = [];
   var seen = {};
   
   for (var i = 0; i < g_analysisData.length; i++) {
      var filter = g_analysisData[i].filter || "(No Filter)";
      if (!seen[filter]) {
         filters.push(filter);
         seen[filter] = true;
      }
   }
   
   return filters.sort();
}

createFilterMappingUI()
{
   var self = this;
   
   // Instructions
   this.instructionsLabel = new Label(this);
   this.instructionsLabel.text = "Map your detected filters to AstroBin filter IDs:\n" +
                                "• Select brand and filter from database, OR\n" +
                                "• Choose \"Manual Entry\" to enter an AstroBin filter ID directly\n" +
                                "• You can paste full AstroBin URLs (e.g., app.astrobin.com/equipment/explorer/filter/4359/) - the ID will be extracted automatically\n" +
                                "• Tick the checkbox on the left to exclude a filter from the CSV export\n\n" +
                                "Personal Filter Set: Define your preferred LRGB + SHO filter IDs once; they will auto-apply when brand is Auto.";
   this.instructionsLabel.wordWrapping = true;
   this.instructionsLabel.minHeight = 60;

   // Personal Filter Set Group
   this.personalGroupBox = new GroupBox(this);
   this.personalGroupBox.title = "Personal Mono Filter Set (LRGB + Ha OIII SII)";
   this.personalGroupBox.sizer = new VerticalSizer;
   this.personalGroupBox.sizer.margin = 6;
   this.personalGroupBox.sizer.spacing = 4;

   var roles = ["L","R","G","B","Ha","OIII","SII"];
   for (var r = 0; r < roles.length; r++) {
      this.createPersonalFilterRow(roles[r]);
   }

   // Personal buttons
   var personalBtnSizer = new HorizontalSizer;
   personalBtnSizer.spacing = 4;
   this.savePersonalButton = new PushButton(this.personalGroupBox);
   this.savePersonalButton.text = "Save Personal Set";
   this.savePersonalButton.toolTip = "Persist the current personal filter IDs";
   this.savePersonalButton.onClick = function(){ self.savePersonalFilterSet(); };
   this.applyPersonalButton = new PushButton(this.personalGroupBox);
   this.applyPersonalButton.text = "Apply Personal Set";
   this.applyPersonalButton.toolTip = "Apply personal IDs to current session filters (where roles detected)";
   this.applyPersonalButton.onClick = function(){ self.applyPersonalToSession(); };
   personalBtnSizer.addStretch();
   personalBtnSizer.add(this.savePersonalButton);
   personalBtnSizer.add(this.applyPersonalButton);
   this.personalGroupBox.sizer.add(personalBtnSizer);

   this.loadPersonalFilterSetIntoUI();
   
   // Create container for filter mappings
   this.filterMappingGroupBox = new GroupBox(this);
   this.filterMappingGroupBox.title = "Filter Mappings";
   this.filterMappingGroupBox.sizer = new VerticalSizer;
   this.filterMappingGroupBox.sizer.margin = 6;
   this.filterMappingGroupBox.sizer.spacing = 4;
   
   this.filterControls = []; // Store references to controls
   
   // Create filter mapping controls for each unique filter
   for (var i = 0; i < this.uniqueFilters.length; i++) {
      this.createFilterMappingRow(this.uniqueFilters[i]);
   }
   
   // Buttons
   this.buttonSizer = new HorizontalSizer;
   this.buttonSizer.spacing = 4;
   
   this.okButton = new PushButton(this);
   this.okButton.text = "OK";
   this.okButton.defaultButton = true;
   this.okButton.onClick = function() {
      self.saveFilterMappings();
      self.ok();
   };
   
   this.cancelButton = new PushButton(this);
   this.cancelButton.text = "Cancel";
   this.cancelButton.onClick = function() {
      self.cancel();
   };
   
   this.buttonSizer.addStretch();
   this.buttonSizer.add(this.okButton);
   this.buttonSizer.add(this.cancelButton);
   
   // Layout
   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   this.sizer.add(this.instructionsLabel);
   this.sizer.add(this.personalGroupBox);
   this.sizer.add(this.filterMappingGroupBox, 100);
   this.sizer.add(this.buttonSizer);
}

createPersonalFilterRow(role)
{
  var rowSizer = new HorizontalSizer;
  rowSizer.spacing = 4;

  var label = new Label(this.personalGroupBox);
  label.text = role + ":";
  label.minWidth = 40;
  label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

  var brandCombo = new ComboBox(this.personalGroupBox);
  brandCombo.editEnabled = false;
  brandCombo.minWidth = 180;
  brandCombo.addItem("-- Brand --");
  var brands = getFilterBrands();
  for (var i = 0; i < brands.length; i++) brandCombo.addItem(brands[i]);
  brandCombo.addItem("-- Manual Entry --");

  var filterCombo = new ComboBox(this.personalGroupBox);
  filterCombo.editEnabled = false;
  filterCombo.minWidth = 380;
  filterCombo.addItem("-- Filter --");
  filterCombo.enabled = false;

  var manualEdit = new Edit(this.personalGroupBox);
  manualEdit.text = "";
  manualEdit.minWidth = 120;
  manualEdit.visible = false;

  var validateBtn = new PushButton(this.personalGroupBox);
  validateBtn.text = "Set";
  validateBtn.visible = false;
  validateBtn.minWidth = 40;

  var idLabel = new Label(this.personalGroupBox);
  idLabel.text = "";
  idLabel.minWidth = 70;
   idLabel.maxHeight = 24;
  idLabel.styleSheet = "QLabel { border: 1px solid gray; padding: 4px; background: white; }";

  var self = this;
  brandCombo.onItemSelected = function(index){
     var txt = brandCombo.itemText(index);
     if (txt === "-- Manual Entry --") {
        filterCombo.visible = false; filterCombo.enabled = false;
        manualEdit.visible = true; validateBtn.visible = true;
        idLabel.text = "";
     } else if (index === 0) {
        filterCombo.enabled = false; filterCombo.visible = true;
        manualEdit.visible = false; validateBtn.visible = false;
        idLabel.text = "";
     } else {
        filterCombo.visible = true; manualEdit.visible = false; validateBtn.visible = false;
        self.updateFilterCombo(brandCombo, filterCombo, idLabel, role + "(personal)");
     }
  };
  filterCombo.onItemSelected = function(index){
     if (index === 0){ idLabel.text = ""; return; }
     var f = FILTER_BY_DISPLAY.get(filterCombo.itemText(index));
     if (f) {
        idLabel.text = f.id.toString();
        idLabel.styleSheet = "QLabel { border: 1px solid green; padding: 4px; background: #e6ffe6; }";
     }
  };
  validateBtn.onClick = function(){
     var entered = manualEdit.text.trim();
     var filterPos = entered.indexOf('/filter/');
     if (filterPos !== -1) { // extract if URL
        var sp = filterPos + 8; var ep = entered.indexOf('/', sp); if (ep === -1) ep = entered.length; entered = entered.substring(sp, ep); manualEdit.text = entered;
     }
     var num = parseInt(entered,10);
     if (isNaN(num) || num <= 0){ idLabel.text = "Invalid"; idLabel.styleSheet = "QLabel { border: 1px solid red; padding: 4px; background: #ffe6e6; }"; return; }
     var exists = FILTER_BY_ID.has(num.toString());
     idLabel.text = num.toString();
     if (exists) idLabel.styleSheet = "QLabel { border: 1px solid green; padding: 4px; background: #e6ffe6; }"; else idLabel.styleSheet = "QLabel { border: 1px solid orange; padding: 4px; background: #fff3cd; }";
  };
  manualEdit.onKeyPress = function(keyCode){ if (keyCode===13||keyCode===16777221){ validateBtn.onClick(); return true;} return false; };

  rowSizer.add(label); rowSizer.add(brandCombo); rowSizer.add(filterCombo); rowSizer.add(manualEdit); rowSizer.add(validateBtn); rowSizer.add(idLabel); rowSizer.addStretch();
  this.personalGroupBox.sizer.add(rowSizer);
  this.personalControls[role] = {brandCombo: brandCombo, filterCombo: filterCombo, manualEdit: manualEdit, validateBtn: validateBtn, idLabel: idLabel};
}

loadPersonalFilterSetIntoUI(){
  var set = getPersonalFilterSet();
  if (!set) return;
  for (var role in this.personalControls){
     var id = set[role] || "";
     if (!id) continue;
     // attempt to locate in database
     var ctrl = this.personalControls[role];
     var target = FILTER_BY_ID.get(id);
     if (target){
        // select brand
        for (var bi=0; bi<ctrl.brandCombo.numberOfItems; bi++) if (ctrl.brandCombo.itemText(bi)===target.brand){ ctrl.brandCombo.currentItem=bi; break; }
        this.updateFilterCombo(ctrl.brandCombo, ctrl.filterCombo, ctrl.idLabel, role + "(personal)");
        var targetText = target.display || target.name;
        for (var fi=0; fi<ctrl.filterCombo.numberOfItems; fi++) if (ctrl.filterCombo.itemText(fi)===targetText){ ctrl.filterCombo.currentItem=fi; ctrl.idLabel.text=target.id.toString(); ctrl.idLabel.styleSheet="QLabel { border: 1px solid green; padding: 4px; background: #e6ffe6; }"; break; }
     } else {
        // manual fallback
        for (var mi=0; mi<ctrl.brandCombo.numberOfItems; mi++) if (ctrl.brandCombo.itemText(mi)==="-- Manual Entry --") { ctrl.brandCombo.currentItem=mi; ctrl.filterCombo.visible=false; ctrl.manualEdit.visible=true; ctrl.validateBtn.visible=true; ctrl.manualEdit.text=id; ctrl.validateBtn.onClick(); break; }
     }
  }
}

savePersonalFilterSet(){
  var set = {L:"",R:"",G:"",B:"",Ha:"",OIII:"",SII:""};
  for (var role in this.personalControls){
     var id = this.personalControls[role].idLabel.text.trim();
     if (id && id.toLowerCase() !== "invalid") set[role]=id; else set[role]="";
  }
  CONFIG.personalFilterSet = set;
  Console.writeln("[AstroBin] Personal filter set updated in memory: " + JSON.stringify(set));
  
  // Call the global save function to persist to PixInsight Settings
  savePersonalFilterSet(set);
}

applyPersonalToSession(){
   var set = getPersonalFilterSet();
   if (!set) {
      Console.warningln("[AstroBin] No personal filter set defined.");
      return;
   }
   
   var appliedCount = 0;
   for (var i=0;i<g_analysisData.length;i++){
       var fName = (g_analysisData[i].filter || "").toLowerCase();
       var oldId = g_analysisData[i].filterId;
       
       if (fName.indexOf('lum')>=0 || fName === 'l' || fName.indexOf('lumin')>=0) { 
          if (set.L && _astrobinValidFilterId(set.L)) { g_analysisData[i].filterId = set.L; appliedCount++; continue; } 
       }
       if (fName === 'r' || fName.indexOf('red')>=0) { 
          if (set.R && _astrobinValidFilterId(set.R)) { g_analysisData[i].filterId = set.R; appliedCount++; continue; } 
       }
       if (fName === 'g' || fName.indexOf('green')>=0) { 
          if (set.G && _astrobinValidFilterId(set.G)) { g_analysisData[i].filterId = set.G; appliedCount++; continue; } 
       }
       if (fName === 'b' || fName.indexOf('blue')>=0) { 
          if (set.B && _astrobinValidFilterId(set.B)) { g_analysisData[i].filterId = set.B; appliedCount++; continue; } 
       }
       if (fName === 'h' || fName.indexOf('ha')>=0 || fName.indexOf('h-alpha')>=0 || fName.indexOf('halpha')>=0) { 
          if (set.Ha && _astrobinValidFilterId(set.Ha)) { g_analysisData[i].filterId = set.Ha; appliedCount++; continue; } 
       }
       if (fName === 'o' || fName.indexOf('oiii')>=0 || fName.indexOf('oxygen')>=0 || fName.indexOf('o3')>=0) { 
          if (set.OIII && _astrobinValidFilterId(set.OIII)) { g_analysisData[i].filterId = set.OIII; appliedCount++; continue; } 
       }
       if (fName === 's' || fName.indexOf('sii')>=0 || fName.indexOf('sulfur')>=0 || fName.indexOf('sulphur')>=0 || fName.indexOf('s2')>=0) { 
          if (set.SII && _astrobinValidFilterId(set.SII)) { g_analysisData[i].filterId = set.SII; appliedCount++; continue; } 
       }
   }
   Console.noteln("[AstroBin] Applied personal filter set to " + appliedCount + " filter(s) in session.");
   this.populateFilterMappings();
   
   // Refresh main dialog tree to show updated filter IDs
   if (this.parentDialog && this.parentDialog.populateImageTree) {
      this.parentDialog.populateImageTree();
   }
}

createFilterMappingRow(filterName)
{
   var rowSizer = new HorizontalSizer;
   rowSizer.spacing = 4;

   // Exclude checkbox
   var excludeCheckBox = new CheckBox(this.filterMappingGroupBox);
   excludeCheckBox.text = "";
   excludeCheckBox.toolTip = "Exclude '" + filterName + "' from analysis and CSV export";
   excludeCheckBox.checked = false;

   // Check if this filter is already excluded in analysis data
   for (var ei = 0; ei < g_analysisData.length; ei++) {
      if (g_analysisData[ei].filter === filterName && g_analysisData[ei].excluded) {
         excludeCheckBox.checked = true;
         break;
      }
   }

   // Filter name label
   var filterLabel = new Label(this.filterMappingGroupBox);
   filterLabel.text = filterName + ":";
   filterLabel.minWidth = 120;  // Increased width for filter names
   filterLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   
   // Brand selection combo
   var brandCombo = new ComboBox(this.filterMappingGroupBox);
   brandCombo.editEnabled = false;
   brandCombo.minWidth = 180;  // Set consistent width
   brandCombo.addItem("-- Select Brand --");
   
   // Get unique brands from filter database
   var brands = getFilterBrands();
   for (var i = 0; i < brands.length; i++) {
      brandCombo.addItem(brands[i]);
   }
   brandCombo.addItem("-- Manual Entry --");  // Add manual entry option
   
   // Filter selection combo
   var filterCombo = new ComboBox(this.filterMappingGroupBox);
   filterCombo.editEnabled = false;
   filterCombo.minWidth = 380;  // Set consistent width
   filterCombo.addItem("-- Select Filter --");
   filterCombo.enabled = false; // Initially disabled
   
   // Manual Filter ID input (initially hidden)
   var manualIdEdit = new Edit(this.filterMappingGroupBox);
   manualIdEdit.text = "";
   manualIdEdit.minWidth = 300; // Increased width to accommodate full AstroBin URLs
   manualIdEdit.maxHeight = 25;
   manualIdEdit.toolTip = "Enter AstroBin filter ID (e.g., from URL: app.astrobin.com/equipment/explorer/filter/4359/)";
   manualIdEdit.visible = false;
   
   // Manual entry button (initially hidden)
   var validateIdButton = new PushButton(this.filterMappingGroupBox);
   validateIdButton.text = "Validate";
   validateIdButton.maxWidth = 70;
   validateIdButton.maxHeight = 25;
   validateIdButton.toolTip = "Validate the manually entered filter ID";
   validateIdButton.visible = false;
   
   // Filter ID display
   var filterIdLabel = new Label(this.filterMappingGroupBox);
   filterIdLabel.text = "";
   filterIdLabel.minWidth = 100;  // Increased width to show filter IDs properly
   filterIdLabel.maxHeight = 25; // Prevent vertical stretching
   filterIdLabel.textAlignment = TextAlignment.Left | TextAlignment.VertCenter;
   filterIdLabel.styleSheet = "QLabel { border: 1px solid gray; padding: 4px; background: white; }";
   
   // Brand selection handler
   var self = this;
   brandCombo.onItemSelected = function(index) {
      if (brandCombo.itemText(index) === "-- Manual Entry --") {
         // Show manual entry controls, hide filter combo
         filterCombo.visible = false;
         manualIdEdit.visible = true;
         validateIdButton.visible = true;
         filterIdLabel.text = "";
         filterIdLabel.styleSheet = "QLabel { border: 1px solid gray; padding: 4px; background: white; }";
      } else {
         // Show filter combo, hide manual entry controls
         filterCombo.visible = true;
         manualIdEdit.visible = false;
         validateIdButton.visible = false;
         self.updateFilterCombo(brandCombo, filterCombo, filterIdLabel, filterName);
      }
   };
   
   // Filter selection handler
   filterCombo.onItemSelected = function(index) {
      self.updateFilterId(filterCombo, filterIdLabel, filterName);
   };
   
   // Manual ID validation handler
   validateIdButton.onClick = function() {
      self.validateManualFilterId(manualIdEdit, filterIdLabel, filterName);
   };
   
   // Allow Enter key in manual ID field to trigger validation
   manualIdEdit.onKeyPress = function(keyCode, modifiers) {
      // Use numeric key codes instead of undefined constants
      if (keyCode === 13 || keyCode === 16777221) { // 13 = Return, 16777221 = Enter
         self.validateManualFilterId(manualIdEdit, filterIdLabel, filterName);
         return true;
      }
      return false;
   };
   
   // Dim the row controls when excluded
   var rowControls = [filterLabel, brandCombo, filterCombo, manualIdEdit, validateIdButton, filterIdLabel];
   function setRowEnabled(enabled) {
      for (var rc = 0; rc < rowControls.length; rc++) {
         rowControls[rc].enabled = enabled;
      }
      if (!enabled) {
         filterLabel.styleSheet = "QLabel { color: #999; }";
      } else {
         filterLabel.styleSheet = "";
      }
   }
   if (excludeCheckBox.checked) setRowEnabled(false);

   excludeCheckBox.onCheck = function(checked) {
      setRowEnabled(!checked);
   };

   rowSizer.add(excludeCheckBox);
   rowSizer.add(filterLabel);
   rowSizer.add(brandCombo);
   rowSizer.add(filterCombo);
   rowSizer.add(manualIdEdit);
   rowSizer.add(validateIdButton);
   rowSizer.add(filterIdLabel);
   rowSizer.addStretch();

   this.filterMappingGroupBox.sizer.add(rowSizer);

   // Store references
   this.filterControls.push({
      filterName: filterName,
      brandCombo: brandCombo,
      filterCombo: filterCombo,
      filterIdLabel: filterIdLabel,
      manualIdEdit: manualIdEdit,
      validateIdButton: validateIdButton,
      excludeCheckBox: excludeCheckBox
   });
}

updateFilterCombo(brandCombo, filterCombo, filterIdLabel, filterName)
{
   // Clear existing filter items
   filterCombo.clear();
   filterCombo.addItem("-- Select Filter --");
   
   if (brandCombo.currentItem === 0) {
      filterCombo.enabled = false;
      filterIdLabel.text = "";
      return;
   }
   
   var selectedBrand = brandCombo.itemText(brandCombo.currentItem);
   
   // Populate filters for selected brand
   var brandFilters = FILTERS_BY_BRAND.get(selectedBrand) || [];
   for (var i = 0; i < brandFilters.length; i++) {
      filterCombo.addItem(brandFilters[i].display || brandFilters[i].name);
   }
   
   filterCombo.enabled = true;
   filterIdLabel.text = "";
}

updateFilterId(filterCombo, filterIdLabel, filterName)
{
   if (filterCombo.currentItem === 0) {
      filterIdLabel.text = "";
      delete this.filterMappings[filterName];
      return;
   }
   
   var selectedText = filterCombo.itemText(filterCombo.currentItem);
   
   // Find the matching filter in the database
   var filter = FILTER_BY_DISPLAY.get(selectedText);
   if (filter) {
      filterIdLabel.text = filter.id.toString();
      filterIdLabel.styleSheet = "QLabel { border: 1px solid gray; padding: 4px; background: white; }";
      this.filterMappings[filterName] = filter.id.toString();
   }
}

validateManualFilterId(manualIdEdit, filterIdLabel, filterName)
{
   var enteredId = manualIdEdit.text.trim();
   
   // Clear any previous styling
   filterIdLabel.styleSheet = "QLabel { border: 1px solid gray; padding: 4px; background: white; }";
   
   if (!enteredId) {
      filterIdLabel.text = "";
      filterIdLabel.styleSheet = "QLabel { border: 1px solid red; padding: 4px; background: #ffe6e6; }";
      delete this.filterMappings[filterName];
      return;
   }
   
   // Extract ID from URL if a full AstroBin URL was pasted
   // Use string methods instead of regex for better PixInsight compatibility
   var filterPos = enteredId.indexOf('/filter/');
   if (filterPos !== -1) {
      var startPos = filterPos + 8; // length of '/filter/'
      var endPos = enteredId.indexOf('/', startPos);
      if (endPos === -1) endPos = enteredId.length; // No trailing slash
      var extractedId = enteredId.substring(startPos, endPos);
      if (extractedId && !isNaN(extractedId)) {
         enteredId = extractedId;
         manualIdEdit.text = enteredId; // Update the field with just the ID
      }
   }
   
   // Validate that it's a number
   var filterId = parseInt(enteredId, 10);
   if (isNaN(filterId) || filterId <= 0) {
      filterIdLabel.text = "Invalid ID";
      filterIdLabel.styleSheet = "QLabel { border: 1px solid red; padding: 4px; background: #ffe6e6; }";
      delete this.filterMappings[filterName];
      return;
   }
   
   // Check if this ID exists in our database (optional - for feedback only)
   var matchedFilter = FILTER_BY_ID.get(filterId.toString());

   // Set the filter ID (green background if found in database, yellow if manual)
   filterIdLabel.text = filterId.toString();
   if (matchedFilter) {
      filterIdLabel.styleSheet = "QLabel { border: 1px solid green; padding: 4px; background: #e6ffe6; }";
      filterIdLabel.toolTip = "Found in database: " + matchedFilter.brand + " " + (matchedFilter.display || matchedFilter.name);
   } else {
      filterIdLabel.styleSheet = "QLabel { border: 1px solid orange; padding: 4px; background: #fff3cd; }";
      filterIdLabel.toolTip = "Manual entry - ID will be used as-is";
   }
   
   this.filterMappings[filterName] = filterId.toString();
}

populateFilterMappings()
{
   var idByFilter = {};
   for (var j = 0; j < g_analysisData.length; j++) {
      var row = g_analysisData[j];
      if (row.filterId && !idByFilter[row.filter]) {
         idByFilter[row.filter] = row.filterId;
      }
   }

   for (var i = 0; i < this.filterControls.length; i++) {
      var control = this.filterControls[i];
      var filterName = control.filterName;
      var currentFilterId = idByFilter[filterName] || "";

      if (currentFilterId) {
         this.selectFilterById(control, currentFilterId);
      } else {
         var suggestedId = suggestFilterId(filterName);
         if (suggestedId) {
            this.selectFilterById(control, suggestedId);
         }
      }
   }
}

selectFilterById(control, filterId)
{
   // Find the filter in the database
   var targetFilter = FILTER_BY_ID.get(filterId.toString());
   
   if (targetFilter) {
      // Filter found in database - use dropdown selection
      // Select the brand
      for (var i = 0; i < control.brandCombo.numberOfItems; i++) {
         if (control.brandCombo.itemText(i) === targetFilter.brand) {
            control.brandCombo.currentItem = i;
            break;
         }
      }
      
      // Update filter combo
      this.updateFilterCombo(control.brandCombo, control.filterCombo, control.filterIdLabel, control.filterName);
      
      // Select the filter
      var targetText = targetFilter.display || targetFilter.name;
      for (var i = 0; i < control.filterCombo.numberOfItems; i++) {
         if (control.filterCombo.itemText(i) === targetText) {
            control.filterCombo.currentItem = i;
            this.updateFilterId(control.filterCombo, control.filterIdLabel, control.filterName);
            break;
         }
      }
   } else {
      // Filter not found in database - use manual entry
      // Select "Manual Entry" from brand combo
      for (var i = 0; i < control.brandCombo.numberOfItems; i++) {
         if (control.brandCombo.itemText(i) === "-- Manual Entry --") {
            control.brandCombo.currentItem = i;
            // Trigger the brand selection handler to show manual controls
            control.filterCombo.visible = false;
            control.manualIdEdit.visible = true;
            control.validateIdButton.visible = true;
            break;
         }
      }
      
      // Set the manual ID and validate it
      control.manualIdEdit.text = filterId.toString();
      this.validateManualFilterId(control.manualIdEdit, control.filterIdLabel, control.filterName);
   }
}

saveFilterMappings()
{
   // Build set of excluded filter names
   var excludedFilters = {};
   for (var c = 0; c < this.filterControls.length; c++) {
      var ctrl = this.filterControls[c];
      if (ctrl.excludeCheckBox.checked) {
         excludedFilters[ctrl.filterName] = true;
      }
   }

   var excludedCount = 0;
   // Apply mappings and exclude state to all analysis data
   for (var i = 0; i < g_analysisData.length; i++) {
      var data = g_analysisData[i];
      var filterName = data.filter || "(No Filter)";

      // Set excluded flag
      if (excludedFilters[filterName]) {
         data.excluded = true;
         excludedCount++;
      } else {
         data.excluded = false;
      }

      if (this.filterMappings[filterName]) {
         data.filterId = this.filterMappings[filterName];
      } else {
         // Clear filter ID if no mapping selected
         data.filterId = "";
      }
   }

   Console.writeln("Applied filter mappings for " + Object.keys(this.filterMappings).length + " filters");
   if (excludedCount > 0) {
      Console.noteln("[AstroBin] Excluded " + excludedCount + " session(s) from " + Object.keys(excludedFilters).length + " filter(s)");
   }
}

} // end class FilterMappingDialog
