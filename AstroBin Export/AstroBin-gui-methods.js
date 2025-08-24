/*
 * AstroBin CSV Export - GUI Methods
 * Dialog method implementations and event handlers
 */

// Method implementations
AstroBinDialog.prototype.scanForFiles = function()
{
   if (!CONFIG.rootDir) return;
   
   try {
      console.writeln("Scanning directory: " + CONFIG.rootDir);
      g_imageFiles = listFiles(CONFIG.rootDir, CONFIG.includeSubdirs);
      this.fileCountLabel.text = "Files found: " + g_imageFiles.length;
      this.analysisStatusLabel.text = "Ready to analyze " + g_imageFiles.length + " files";
      this.updateUI();
   } catch (e) {
      console.criticalln("Error scanning files: " + e);
      this.fileCountLabel.text = "Error scanning files";
   }
};

AstroBinDialog.prototype.analyzeImages = function()
{
   if (g_imageFiles.length === 0) {
      console.warningln("No files to analyze. Please select a directory first.");
      return;
   }
   
   this.analyzeButton.enabled = false;
   this.analysisStatusLabel.text = "Analyzing " + g_imageFiles.length + " files...";
   
   // Reset UI controls to enabled state for new analysis
   this.resetGlobalParametersUI();
   
   processEvents();
   
   try {
      // Filter mappings are now handled by the JavaScript database
      console.writeln("Using JavaScript filter database...");
      this.analysisStatusLabel.text = "Using filter database...";
      processEvents();
      
      // Analyze files with progress updates
      console.writeln("Analyzing image files...");
      this.analysisStatusLabel.text = "Extracting metadata from images...";
      processEvents();
      
      try {
         var result = analyzeFiles(g_imageFiles);
         console.writeln("File analysis completed");
         var rows = result.rows;
         var globalData = result.globalData;
         
         // Populate global parameters from the first image if they're empty
         console.writeln("Populating global parameters...");
         this.populateGlobalParametersFromMetadata(globalData);
         
         // Update UI to reflect available metadata and disable auto-detected fields
         this.updateGlobalParametersFromMetadata(globalData);
         
      } catch (e) {
         console.criticalln("Error during file analysis: " + e);
         throw e;
      }
      
      // Aggregate data
      console.writeln("Aggregating data...");
      this.analysisStatusLabel.text = "Grouping acquisition sessions...";
      processEvents();
      
      try {
         g_analysisData = aggregate(rows, globalData);
         console.writeln("Data aggregation completed");
      } catch (e) {
         console.criticalln("Error during data aggregation: " + e);
         throw e;
      }
      
      console.writeln("Populating results table...");
      this.analysisStatusLabel.text = "Updating display...";
      processEvents();
      
      this.populateImageTree();
      this.analysisStatusLabel.text = "Analysis complete: " + g_analysisData.length + " unique sessions found";
      
   } catch (e) {
      console.criticalln("Error during analysis: " + e);
      console.criticalln("Stack trace: " + (e.stack || "No stack trace available"));
      this.analysisStatusLabel.text = "Analysis failed: " + e;
   } finally {
      this.analyzeButton.enabled = true;
      this.updateUI();
   }
};

// Method to populate global parameters from image metadata
AstroBinDialog.prototype.populateGlobalParametersFromMetadata = function(globalData)
{
   if (!globalData) return;
   
   // Only populate if the field is currently empty or default
   if (globalData.ambientTemp !== undefined && (!this.temperatureEdit.text || this.temperatureEdit.text === CONFIG.ambientTemp)) {
      var temp = Math.round(globalData.ambientTemp * 10) / 10; // Round to 1 decimal
      this.temperatureEdit.text = temp.toString();
      CONFIG.ambientTemp = temp.toString();
      console.writeln("Populated ambient temperature: " + temp + "°C");
   }
   
   // Try to estimate SQM from sky brightness if available
   if (globalData.skyBrightness !== undefined && (!this.meanSqmEdit.text || this.meanSqmEdit.text === CONFIG.meanSqm)) {
      // Sky brightness is typically in [lux], need to convert to mag/arcsec²
      // This is a rough approximation: SQM ≈ -2.5 * log10(skyBrightness) + constant
      // For more accurate conversion, this would need calibration
      var estimatedSqm = Math.round((21.0 - Math.log10(Math.max(globalData.skyBrightness, 0.001)) * 2.5) * 10) / 10;
      if (estimatedSqm > 15 && estimatedSqm < 23) { // Reasonable SQM range
         this.meanSqmEdit.text = estimatedSqm.toString();
         CONFIG.meanSqm = estimatedSqm.toString();
         console.writeln("Estimated SQM from sky brightness: " + estimatedSqm + " mag/arcsec²");
      }
   }
   
   // Log other available metadata for future enhancement or manual entry
   if (globalData.focalLength !== undefined) {
      console.writeln("Available focal length: " + globalData.focalLength + "mm");
   }
   if (globalData.telescope) {
      console.writeln("Available telescope: " + globalData.telescope);
   }
   if (globalData.instrument) {
      console.writeln("Available instrument: " + globalData.instrument);
   }
   if (globalData.siteLatitude !== undefined) {
      console.writeln("Available site latitude: " + globalData.siteLatitude.toFixed(4) + "°");
   }
   if (globalData.siteLongitude !== undefined) {
      console.writeln("Available site longitude: " + globalData.siteLongitude.toFixed(4) + "°");
   }
   if (globalData.siteElevation !== undefined) {
      console.writeln("Available site elevation: " + globalData.siteElevation + "m");
   }
   if (globalData.humidity !== undefined) {
      console.writeln("Available humidity: " + globalData.humidity + "%");
   }
   if (globalData.pressure !== undefined) {
      console.writeln("Available air pressure: " + globalData.pressure + " hPa");
   }
   if (globalData.dewPoint !== undefined) {
      console.writeln("Available dew point: " + globalData.dewPoint + "°C");
   }
   if (globalData.windSpeed !== undefined) {
      console.writeln("Available wind speed: " + globalData.windSpeed + " km/h");
   }
   if (globalData.skyTemp !== undefined) {
      console.writeln("Available sky temperature: " + globalData.skyTemp + "°C");
   }
};

// Reset global parameters UI to enabled state for new analysis
AstroBinDialog.prototype.resetGlobalParametersUI = function()
{
   // Re-enable all input controls
   this.darksEdit.enabled = true;
   this.flatsEdit.enabled = true;
   this.flatDarksEdit.enabled = true;
   this.biasEdit.enabled = true;
   this.bortleComboBox.enabled = true;
   this.meanSqmEdit.enabled = true;
   this.meanFwhmEdit.enabled = true;
   this.temperatureEdit.enabled = true;
   
   // Clear tooltips (except for helpful defaults)
   this.darksEdit.toolTip = "";
   this.flatsEdit.toolTip = "";
   this.flatDarksEdit.toolTip = "";
   this.biasEdit.toolTip = "";
   this.bortleComboBox.toolTip = "";
   // Keep helpful tooltips for SQM, FWHM, and Temperature
   this.meanSqmEdit.toolTip = "Sky Quality Meter reading in mag/arcsec². Range: 16-22 (higher = darker skies)\n" +
                              "Urban: 16-18, Suburban: 18-20, Rural: 20-21, Dark site: 21-22";
   this.meanFwhmEdit.toolTip = "Full Width Half Maximum in arcseconds. Measures seeing quality.\n" +
                               "Excellent: <1.5\", Good: 1.5-2.5\", Average: 2.5-3.5\", Poor: >3.5\"\n" +
                               "Measure star FWHM in PixInsight with DynamicPSF or similar tools";
   this.temperatureEdit.toolTip = "Ambient air temperature in Celsius. Used as fallback if not available in FITS.\n" +
                                  "Per-session temperatures from FITS take precedence when available.";
   
   // Reset info label
   this.metadataInfoLabel.text = "Analyzing images to detect available metadata...";
   this.metadataInfoLabel.styleSheet = "QLabel { color: #666; font-size: 9pt; }";
};

AstroBinDialog.prototype.populateImageTree = function()
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
      
      node.setText(2, String(data.filterId || ""));
      node.setText(3, String(data.number || "0"));
      node.setText(4, data.duration ? String(data.duration) + "s" : "N/A");
      node.setText(5, String(data.binning || "N/A"));
      node.setText(6, String(data.gain || "N/A"));
      node.setText(7, data.sensorCooling ? String(data.sensorCooling) : "N/A");
      
      // Store data index for editing
      node.dataIndex = i;
   }
   
   this.updateUI();
};

AstroBinDialog.prototype.generateCSV = function()
{
   if (g_analysisData.length === 0) {
      console.warningln("No data to export. Please analyze images first.");
      return;
   }
   
   try {
      // Update config with current UI values BEFORE generating CSV
      this.updateConfigFromUI();
      console.writeln("Updated CONFIG from current UI values");
      
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
      
      console.noteln("CSV content generated successfully with current global parameters");
      console.noteln("Temperature and numeric values formatted according to AstroBin CSV requirements");
   } catch (e) {
      console.criticalln("Error generating CSV: " + e);
   }
};

AstroBinDialog.prototype.createCSVContent = function(data)
{
   var lines = [];
   
   // Header
   var header = [
      "date","filter","number","duration",
      "iso","binning","gain","sensorCooling","fNumber",
      "darks","flats","flatDarks","bias","bortle","meanSqm","meanFwhm","temperature"
   ].join(",");
   lines.push(header);
   
   // Data rows
   for (var i = 0; i < data.length; i++) {
      var a = data[i];
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
      
      var row = [
         a.date,
         a.filterId,
         a.number,
         durationStr,
         "",
         a.binning,
         gainStr,
         sensorCoolingStr,
         fNumberStr,
         a.darks, a.flats, a.flatDarks, a.bias, bortleStr, sqmStr, fwhmStr, ambientTempStr
      ].join(",");
      lines.push(row);
   }
   
   return lines.join("\n");
};

AstroBinDialog.prototype.saveCSVFile = function()
{
   if (!this.csvPreviewTextBox.text) return;
   
   var sfd = new SaveFileDialog;
   sfd.caption = "Save AstroBin CSV File";
   sfd.overwritePrompt = true;
   sfd.filters = [["CSV Files", "*.csv"], ["All Files", "*"]];
   
   if (sfd.execute()) {
      try {
         File.writeTextFile(sfd.fileName, this.csvPreviewTextBox.text);
         console.noteln("CSV saved to: " + sfd.fileName);
      } catch (e) {
         console.criticalln("Error saving CSV file: " + e);
      }
   }
};

AstroBinDialog.prototype.copyCSVToClipboard = function()
{
   if (!this.csvPreviewTextBox.text) return;
   
   // Note: PixInsight doesn't have direct clipboard access, so we show a message
   console.noteln("CSV content is in the preview box. Please select all text and copy manually.");
   this.csvPreviewTextBox.selectAll();
};

AstroBinDialog.prototype.updateConfigFromUI = function()
{
   CONFIG.darks = this.darksEdit.text;
   CONFIG.flats = this.flatsEdit.text;
   CONFIG.flatDarks = this.flatDarksEdit.text;
   CONFIG.bias = this.biasEdit.text;
   CONFIG.bortle = (this.bortleComboBox.currentItem + 1).toString(); // Get numeric value (1-9) from ComboBox
   CONFIG.meanSqm = this.meanSqmEdit.text;
   CONFIG.meanFwhm = this.meanFwhmEdit.text;
   CONFIG.ambientTemp = this.temperatureEdit.text;
   CONFIG.preferredFilterBrand = this.filterBrandCombo.itemText(this.filterBrandCombo.currentItem);
};

AstroBinDialog.prototype.updateUI = function()
{
   this.analyzeButton.enabled = (g_imageFiles.length > 0);
   this.mapFiltersButton.enabled = (g_analysisData.length > 0);
   this.generateCSVButton.enabled = (g_analysisData.length > 0);
   this.summaryButton.enabled = (g_analysisData.length > 0);
};

// Convert Bortle Scale to SQM estimate
AstroBinDialog.prototype.updateSQMFromBortle = function()
{
   var bortleValue = parseFloat(CONFIG.bortle);
   if (isNaN(bortleValue) || bortleValue < 1 || bortleValue > 9) {
      return; // Invalid Bortle value
   }
   
   // Only update SQM if it's currently empty
   if (CONFIG.meanSqm === "" || CONFIG.meanSqm === "0") {
      var estimatedSQM = this.bortleToSQM(bortleValue);
      CONFIG.meanSqm = estimatedSQM.toFixed(1);
      this.meanSqmEdit.text = CONFIG.meanSqm;
      console.writeln("Estimated SQM " + CONFIG.meanSqm + " mag/arcsec² from Bortle Class " + bortleValue);
   }
};

// Bortle to SQM conversion lookup
AstroBinDialog.prototype.bortleToSQM = function(bortleClass)
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
};

AstroBinDialog.prototype.showAbout = function()
{
   var msg = "<b>AstroBin CSV Export v3.0</b><br><br>" +
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
             
   var msgBox = new MessageBox(msg, "About AstroBin CSV Export", StdIcon_Information, StdButton_Ok);
   msgBox.execute();
};

// Filter Mapping Dialog
AstroBinDialog.prototype.showFilterMappingDialog = function()
{
   if (g_analysisData.length === 0) {
      console.warningln("No analysis data available. Please analyze images first.");
      return;
   }
   
   console.writeln("Opening filter mapping dialog...");
   
   // Create filter mapping dialog
   try {
      var filterDialog = new FilterMappingDialog();
      console.writeln("Filter mapping dialog created successfully");
      
      // Execute the dialog and update the main tree if OK was pressed
      var result = filterDialog.execute();
      console.writeln("Dialog result: " + result);
      if (result === 1) { // 1 = OK button pressed
         // Update the Filter ID column in the main tree and g_analysisData
         this.populateImageTree();
         console.writeln("Filter mapping updated successfully");
      }
   } catch (e) {
      console.criticalln("Error creating or executing filter mapping dialog: " + e);
      console.criticalln("Stack trace: " + (e.stack || "No stack trace available"));
   }
};

// Filter Mapping Dialog Class
function FilterMappingDialog()
{
   this.__base__ = Dialog;
   this.__base__();
   
   this.windowTitle = "Filter Mapping";
   this.scaledMinWidth = 800;  // Increased width to accommodate manual entry controls
   this.scaledMinHeight = 400;
   
   // Get unique filters from analysis data
   this.uniqueFilters = this.getUniqueFilters();
   this.filterMappings = {}; // Store current mappings
   
   this.createFilterMappingUI();
   this.populateFilterMappings();
}

FilterMappingDialog.prototype = new Dialog;

FilterMappingDialog.prototype.getUniqueFilters = function()
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
};

FilterMappingDialog.prototype.createFilterMappingUI = function()
{
   var self = this;
   
   // Instructions
   this.instructionsLabel = new Label(this);
   this.instructionsLabel.text = "Map your detected filters to AstroBin filter IDs:\n" +
                                "• Select brand and filter from database, OR\n" +
                                "• Choose \"Manual Entry\" to enter an AstroBin filter ID directly\n" +
                                "• You can paste full AstroBin URLs (e.g., app.astrobin.com/equipment/explorer/filter/4359/) - the ID will be extracted automatically";
   this.instructionsLabel.wordWrapping = true;
   this.instructionsLabel.minHeight = 60;
   
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
   this.sizer.add(this.filterMappingGroupBox, 100);
   this.sizer.add(this.buttonSizer);
};

FilterMappingDialog.prototype.createFilterMappingRow = function(filterName)
{
   var rowSizer = new HorizontalSizer;
   rowSizer.spacing = 4;
   
   // Filter name label
   var filterLabel = new Label(this.filterMappingGroupBox);
   filterLabel.text = filterName + ":";
   filterLabel.minWidth = 120;  // Increased width for filter names
   filterLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   
   // Brand selection combo
   var brandCombo = new ComboBox(this.filterMappingGroupBox);
   brandCombo.editEnabled = false;
   brandCombo.minWidth = 150;  // Set consistent width
   brandCombo.addItem("-- Select Brand --");
   
   // Get unique brands from filter database
   var brands = this.getUniqueBrands();
   for (var i = 0; i < brands.length; i++) {
      brandCombo.addItem(brands[i]);
   }
   brandCombo.addItem("-- Manual Entry --");  // Add manual entry option
   
   // Filter selection combo
   var filterCombo = new ComboBox(this.filterMappingGroupBox);
   filterCombo.editEnabled = false;
   filterCombo.minWidth = 200;  // Set consistent width
   filterCombo.addItem("-- Select Filter --");
   filterCombo.enabled = false; // Initially disabled
   
   // Manual Filter ID input (initially hidden)
   var manualIdEdit = new Edit(this.filterMappingGroupBox);
   manualIdEdit.text = "";
   manualIdEdit.minWidth = 100;
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
   filterIdLabel.minWidth = 80;  // Increased width to show filter IDs properly
   filterIdLabel.maxHeight = 25; // Prevent vertical stretching
   filterIdLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
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
      if (keyCode === KeyCode_Return || keyCode === KeyCode_Enter) {
         self.validateManualFilterId(manualIdEdit, filterIdLabel, filterName);
         return true;
      }
      return false;
   };
   
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
      validateIdButton: validateIdButton
   });
};

FilterMappingDialog.prototype.getUniqueBrands = function()
{
   var brands = [];
   var seen = {};
   
   for (var i = 0; i < ASTROBIN_FILTERS.length; i++) {
      var brand = ASTROBIN_FILTERS[i].brand;
      if (!seen[brand]) {
         brands.push(brand);
         seen[brand] = true;
      }
   }
   
   return brands.sort();
};

FilterMappingDialog.prototype.updateFilterCombo = function(brandCombo, filterCombo, filterIdLabel, filterName)
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
   for (var i = 0; i < ASTROBIN_FILTERS.length; i++) {
      var filter = ASTROBIN_FILTERS[i];
      if (filter.brand === selectedBrand) {
         filterCombo.addItem(filter.display || filter.name);
      }
   }
   
   filterCombo.enabled = true;
   filterIdLabel.text = "";
};

FilterMappingDialog.prototype.updateFilterId = function(filterCombo, filterIdLabel, filterName)
{
   if (filterCombo.currentItem === 0) {
      filterIdLabel.text = "";
      delete this.filterMappings[filterName];
      return;
   }
   
   var selectedText = filterCombo.itemText(filterCombo.currentItem);
   
   // Find the matching filter in the database
   for (var i = 0; i < ASTROBIN_FILTERS.length; i++) {
      var filter = ASTROBIN_FILTERS[i];
      var comboText = filter.display || filter.name;
      if (comboText === selectedText) {
         filterIdLabel.text = filter.id.toString();
         filterIdLabel.styleSheet = "QLabel { border: 1px solid gray; padding: 4px; background: white; }";
         this.filterMappings[filterName] = filter.id.toString();
         break;
      }
   }
};

FilterMappingDialog.prototype.validateManualFilterId = function(manualIdEdit, filterIdLabel, filterName)
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
   var idMatch = enteredId.match(/\/filter\/(\d+)\//);
   if (idMatch) {
      enteredId = idMatch[1];
      manualIdEdit.text = enteredId; // Update the field with just the ID
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
   var existsInDatabase = false;
   for (var i = 0; i < ASTROBIN_FILTERS.length; i++) {
      if (ASTROBIN_FILTERS[i].id === filterId) {
         existsInDatabase = true;
         break;
      }
   }
   
   // Set the filter ID (green background if found in database, yellow if manual)
   filterIdLabel.text = filterId.toString();
   if (existsInDatabase) {
      filterIdLabel.styleSheet = "QLabel { border: 1px solid green; padding: 4px; background: #e6ffe6; }";
      filterIdLabel.toolTip = "Found in database: " + ASTROBIN_FILTERS[i].brand + " " + (ASTROBIN_FILTERS[i].display || ASTROBIN_FILTERS[i].name);
   } else {
      filterIdLabel.styleSheet = "QLabel { border: 1px solid orange; padding: 4px; background: #fff3cd; }";
      filterIdLabel.toolTip = "Manual entry - ID will be used as-is";
   }
   
   this.filterMappings[filterName] = filterId.toString();
};

FilterMappingDialog.prototype.populateFilterMappings = function()
{
   // Auto-populate based on current filter IDs in analysis data
   for (var i = 0; i < this.filterControls.length; i++) {
      var control = this.filterControls[i];
      var filterName = control.filterName;
      
      // Find current filter ID for this filter name
      var currentFilterId = "";
      for (var j = 0; j < g_analysisData.length; j++) {
         if (g_analysisData[j].filter === filterName && g_analysisData[j].filterId) {
            currentFilterId = g_analysisData[j].filterId;
            break;
         }
      }
      
      // If we have a filter ID, try to select it
      if (currentFilterId) {
         this.selectFilterById(control, currentFilterId);
      } else {
         // Try auto-suggestion based on filter name
         var suggestedId = suggestFilterId(filterName);
         if (suggestedId) {
            this.selectFilterById(control, suggestedId);
         }
      }
   }
};

FilterMappingDialog.prototype.selectFilterById = function(control, filterId)
{
   // Find the filter in the database
   var targetFilter = null;
   for (var i = 0; i < ASTROBIN_FILTERS.length; i++) {
      if (ASTROBIN_FILTERS[i].id.toString() === filterId.toString()) {
         targetFilter = ASTROBIN_FILTERS[i];
         break;
      }
   }
   
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
};

FilterMappingDialog.prototype.saveFilterMappings = function()
{
   // Apply mappings to all analysis data
   for (var i = 0; i < g_analysisData.length; i++) {
      var data = g_analysisData[i];
      var filterName = data.filter || "(No Filter)";
      
      if (this.filterMappings[filterName]) {
         data.filterId = this.filterMappings[filterName];
      } else {
         // Clear filter ID if no mapping selected
         data.filterId = "";
      }
   }
   
   console.writeln("Applied filter mappings for " + Object.keys(this.filterMappings).length + " filters");
};

// Integration Summary Dialog
AstroBinDialog.prototype.showIntegrationSummary = function()
{
   if (g_analysisData.length === 0) {
      return;
   }
   
   try {
      // Calculate summary statistics
      var stats = this.calculateIntegrationStats();
      
      var msg = "<b>🌟 Integration Session Summary</b><br><br>" +
                
                "<b>📊 Total Integration:</b><br>" +
                "• Total time: " + this.formatDuration(stats.totalIntegrationTime) + "<br>" +
                "• Images captured: " + stats.totalImages + " frames<br>" +
                "• Sessions detected: " + stats.sessionCount + "<br>" +
                "• Date range: " + stats.dateRange + "<br><br>" +
                
                "<b>🔭 Filter Breakdown:</b><br>" +
                stats.filterStats + "<br>" +
                
                "<b>⚙️ Acquisition Settings:</b><br>" +
                "• Exposure times: " + stats.exposureTimes + "<br>" +
                "• Binning modes: " + stats.binningModes + "<br>" +
                "• Gain settings: " + stats.gainSettings + "<br>" +
                "• F-ratios: " + stats.fNumberSettings + "<br><br>" +
                
                "<b>🌡️ Environmental Conditions:</b><br>" +
                "• Temperature range: " + stats.tempRange + "<br>" +
                "• Sensor cooling: " + stats.coolingRange + "<br>" +
                "• Sky quality: " + stats.skyQuality + "<br><br>" +
                
                "<b>📈 Session Quality:</b><br>" +
                "• Longest session: " + this.formatDuration(stats.longestSession) + "<br>" +
                "• Most productive filter: " + stats.mostProductiveFilter + "<br>" +
                "• Average session length: " + this.formatDuration(stats.avgSessionLength) + "<br><br>" +
                
                "<b>🎯 Calibration Ready:</b><br>" +
                "• Dark frames needed: " + (CONFIG.darks || "Not set") + "<br>" +
                "• Flat frames needed: " + (CONFIG.flats || "Not set") + "<br>" +
                "• Bias frames needed: " + (CONFIG.bias || "Not set") + "<br><br>" +
                
                "<b>💡 Session Insights:</b><br>" +
                stats.insights;
      
      var msgBox = new MessageBox(msg, "Integration Session Summary", StdIcon_Information, StdButton_Ok);
      msgBox.execute();
      
   } catch (e) {
      console.warningln("Error generating integration summary: " + e);
   }
};

AstroBinDialog.prototype.calculateIntegrationStats = function()
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
      var sessionTime = parseFloat(session.duration || 0) * parseInt(session.number || 0);
      
      stats.totalIntegrationTime += sessionTime;
      stats.totalImages += parseInt(session.number || 0);
      sessionTimes.push(sessionTime);
      
      // Track filter usage
      var filterKey = session.filter || "No Filter";
      if (!filters[filterKey]) {
         filters[filterKey] = { time: 0, frames: 0 };
      }
      filters[filterKey].time += sessionTime;
      filters[filterKey].frames += parseInt(session.number || 0);
      
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
   
   // Format filter stats
   var filterLines = [];
   for (var filter in filters) {
      var f = filters[filter];
      filterLines.push("&nbsp;&nbsp;• " + filter + ": " + this.formatDuration(f.time) + " (" + f.frames + " frames)");
   }
   stats.filterStats = filterLines.join("<br>");
   
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
};

AstroBinDialog.prototype.formatDuration = function(seconds)
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
};
