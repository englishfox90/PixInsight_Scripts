/*
 * AstroBin CSV Export - GUI Components
 * Dialog creation and user interface management
 */

// Global variables for GUI
var g_imageFiles = [];
var g_analysisData = [];
var g_filterMapping = {};

// Base dialog class
function AstroBinDialog()
{
   this.__base__ = Dialog;
   this.__base__();
   
   // Set dialog properties
   this.windowTitle = "AstroBin CSV Export v3";
   this.scaledMinWidth = 900;
   this.scaledMinHeight = 700;

   // Create main sections
   this.createFileSelectionSection();
   this.createGlobalParametersSection();
   this.createImageAnalysisSection();
   this.createCSVPreviewSection();
   this.createButtonSection();

   // Layout everything
   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   this.sizer.add(this.fileSelectionGroupBox);
   this.sizer.add(this.globalParametersGroupBox);
   this.sizer.add(this.imageAnalysisGroupBox, 100); // Takes most space
   this.sizer.add(this.csvPreviewGroupBox);
   this.sizer.add(this.buttonSizer);

   this.updateUI();
}

AstroBinDialog.prototype = new Dialog;

// File Selection Section
AstroBinDialog.prototype.createFileSelectionSection = function()
{
   this.fileSelectionGroupBox = new GroupBox(this);
   this.fileSelectionGroupBox.title = "Image Files";
   this.fileSelectionGroupBox.sizer = new VerticalSizer;
   this.fileSelectionGroupBox.sizer.margin = 6;
   this.fileSelectionGroupBox.sizer.spacing = 4;

   // Directory path
   var pathSizer = new HorizontalSizer;
   pathSizer.spacing = 4;
   
   this.directoryLabel = new Label(this);
   this.directoryLabel.text = "Directory:";
   this.directoryLabel.minWidth = 80;
   
   this.directoryEdit = new Edit(this);
   this.directoryEdit.text = CONFIG.rootDir;
   this.directoryEdit.toolTip = "Selected directory containing image files";
   this.directoryEdit.readOnly = true;
   
   this.selectDirectoryButton = new PushButton(this);
   this.selectDirectoryButton.text = "Select Directory";
   this.selectDirectoryButton.toolTip = "Select directory containing image files";
   var self = this;
   this.selectDirectoryButton.onClick = function() {
      var gdd = new GetDirectoryDialog;
      gdd.caption = "Select Directory Containing Image Files";
      if (gdd.execute()) {
         CONFIG.rootDir = gdd.directory;
         self.directoryEdit.text = CONFIG.rootDir;
         self.scanForFiles();
      }
   };

   pathSizer.add(this.directoryLabel);
   pathSizer.add(this.directoryEdit, 100);
   pathSizer.add(this.selectDirectoryButton);

   // Options
   var optionsSizer = new HorizontalSizer;
   optionsSizer.spacing = 4;
   
   this.includeSubdirsCheckBox = new CheckBox(this);
   this.includeSubdirsCheckBox.text = "Include subdirectories";
   this.includeSubdirsCheckBox.checked = CONFIG.includeSubdirs;
   this.includeSubdirsCheckBox.toolTip = "Recursively scan subdirectories for image files";
   this.includeSubdirsCheckBox.onCheck = function(checked) {
      CONFIG.includeSubdirs = checked;
      if (CONFIG.rootDir) self.scanForFiles();
   };

   this.fileCountLabel = new Label(this);
   this.fileCountLabel.text = "Files found: 0";
   
   optionsSizer.add(this.includeSubdirsCheckBox);
   optionsSizer.addStretch();
   optionsSizer.add(this.fileCountLabel);

   this.fileSelectionGroupBox.sizer.add(pathSizer);
   this.fileSelectionGroupBox.sizer.add(optionsSizer);
};

// Global Parameters Section
AstroBinDialog.prototype.createGlobalParametersSection = function()
{
   this.globalParametersGroupBox = new GroupBox(this);
   this.globalParametersGroupBox.title = "Global Acquisition Parameters";
   this.globalParametersGroupBox.sizer = new VerticalSizer;
   this.globalParametersGroupBox.sizer.margin = 6;
   this.globalParametersGroupBox.sizer.spacing = 4;

   // First row: Darks, Flats, Flat Darks, Bias
   var calibrationSizer = new HorizontalSizer;
   calibrationSizer.spacing = 4;

   // Darks
   var darksLabel = new Label(this);
   darksLabel.text = "Darks:";
   darksLabel.minWidth = 70;
   darksLabel.textAlignment = TextAlign_VertCenter;
   calibrationSizer.add(darksLabel);
   this.darksEdit = new Edit(this);
   this.darksEdit.text = CONFIG.darks;
   this.darksEdit.setFixedWidth(60);
   this.darksEdit.onTextUpdated = function(text) { CONFIG.darks = text; };
   calibrationSizer.add(this.darksEdit);

   // Flats
   var flatsLabel = new Label(this);
   flatsLabel.text = "Flats:";
   flatsLabel.minWidth = 70;
   flatsLabel.textAlignment = TextAlign_VertCenter;
   calibrationSizer.add(flatsLabel);
   this.flatsEdit = new Edit(this);
   this.flatsEdit.text = CONFIG.flats;
   this.flatsEdit.setFixedWidth(60);
   this.flatsEdit.onTextUpdated = function(text) { CONFIG.flats = text; };
   calibrationSizer.add(this.flatsEdit);

   // Flat Darks
   var flatDarksLabel = new Label(this);
   flatDarksLabel.text = "Flat Darks:";
   flatDarksLabel.minWidth = 70;
   flatDarksLabel.textAlignment = TextAlign_VertCenter;
   calibrationSizer.add(flatDarksLabel);
   this.flatDarksEdit = new Edit(this);
   this.flatDarksEdit.text = CONFIG.flatDarks;
   this.flatDarksEdit.setFixedWidth(60);
   this.flatDarksEdit.onTextUpdated = function(text) { CONFIG.flatDarks = text; };
   calibrationSizer.add(this.flatDarksEdit);

   // Bias
   var biasLabel = new Label(this);
   biasLabel.text = "Bias:";
   biasLabel.minWidth = 70;
   biasLabel.textAlignment = TextAlign_VertCenter;
   calibrationSizer.add(biasLabel);
   this.biasEdit = new Edit(this);
   this.biasEdit.text = CONFIG.bias;
   this.biasEdit.setFixedWidth(60);
   this.biasEdit.onTextUpdated = function(text) { CONFIG.bias = text; };
   calibrationSizer.add(this.biasEdit);

   calibrationSizer.addStretch();

   // Second row: Bortle Scale (dedicated row for better visibility)
   var bortleSizer = new HorizontalSizer;
   bortleSizer.spacing = 4;

   // Bortle Scale Dropdown
   var bortleLabel = new Label(this);
   bortleLabel.text = "Bortle Scale:";
   bortleLabel.minWidth = 100;
   bortleLabel.textAlignment = TextAlign_VertCenter;
   bortleSizer.add(bortleLabel);
   
   this.bortleComboBox = new ComboBox(this);
   this.bortleComboBox.setFixedWidth(320); // Increased width for better readability
   this.bortleComboBox.toolTip = "Bortle Dark-Sky Scale - Select your sky conditions.\n" +
                                 "This dropdown shows descriptions to help you choose,\n" +
                                 "but only the number (1-9) is stored and exported.";
   
   // Add Bortle scale options with descriptions
   var bortleOptions = [
      { value: "1", display: "1 - Excellent dark site (21.7-22.0 SQM)" },
      { value: "2", display: "2 - Typical dark site (21.5-21.7 SQM)" },
      { value: "3", display: "3 - Rural sky (21.3-21.5 SQM)" },
      { value: "4", display: "4 - Rural/suburban transition (20.4-21.3 SQM)" },
      { value: "5", display: "5 - Suburban sky (19.1-20.4 SQM)" },
      { value: "6", display: "6 - Bright suburban (18.0-19.1 SQM)" },
      { value: "7", display: "7 - Suburban/urban transition (17.5-19.1 SQM)" },
      { value: "8", display: "8 - City sky (17.5-18.0 SQM)" },
      { value: "9", display: "9 - Inner city (13.1-17.5 SQM)" }
   ];
   
   for (var i = 0; i < bortleOptions.length; i++) {
      this.bortleComboBox.addItem(bortleOptions[i].display);
   }
   
   // Set current selection based on CONFIG.bortle
   var currentBortle = parseInt(CONFIG.bortle) || 4;
   if (currentBortle >= 1 && currentBortle <= 9) {
      this.bortleComboBox.currentItem = currentBortle - 1; // ComboBox is 0-indexed
   } else {
      this.bortleComboBox.currentItem = 3; // Default to Bortle 4
   }
   
   var self = this;
   this.bortleComboBox.onItemSelected = function(itemIndex) {
      // Store only the number (1-9) in CONFIG.bortle
      CONFIG.bortle = (itemIndex + 1).toString(); // Convert back to 1-based
      self.updateSQMFromBortle();
   };
   
   bortleSizer.add(this.bortleComboBox);
   bortleSizer.addStretch();

   // Third row: Filter Brand (dedicated row for better visibility)
   var filterBrandSizer = new HorizontalSizer;
   filterBrandSizer.spacing = 4;

   // Filter Brand Preference
   var filterBrandLabel = new Label(this);
   filterBrandLabel.text = "Filter Brand:";
   filterBrandLabel.minWidth = 100;
   filterBrandLabel.textAlignment = TextAlign_VertCenter;
   filterBrandSizer.add(filterBrandLabel);
   
   this.filterBrandCombo = new ComboBox(this);
   this.filterBrandCombo.editEnabled = false;
   this.filterBrandCombo.setFixedWidth(200); // Increased width for better readability
   this.filterBrandCombo.toolTip = "Preferred brand for auto-suggestion of filter IDs";
   this.filterBrandCombo.addItem("Auto"); // Default option
   
   // Populate with available brands from filter database
   var brands = this.getUniqueBrands();
   for (var i = 0; i < brands.length; i++) {
      this.filterBrandCombo.addItem(brands[i]);
   }
   
   // Set current selection based on config
   for (var i = 0; i < this.filterBrandCombo.numberOfItems; i++) {
      if (this.filterBrandCombo.itemText(i) === CONFIG.preferredFilterBrand) {
         this.filterBrandCombo.currentItem = i;
         break;
      }
   }
   
   this.filterBrandCombo.onItemSelected = function(index) {
      CONFIG.preferredFilterBrand = this.itemText(index);
   };
   filterBrandSizer.add(this.filterBrandCombo);
   filterBrandSizer.addStretch();

   // Fourth row: SQM, FWHM, Temperature
   var environmentSizer = new HorizontalSizer;
   environmentSizer.spacing = 4;

   // Mean SQM
   var meanSqmLabel = new Label(this);
   meanSqmLabel.text = "Mean SQM:";
   meanSqmLabel.minWidth = 90;
   meanSqmLabel.textAlignment = TextAlign_VertCenter;
   environmentSizer.add(meanSqmLabel);
   this.meanSqmEdit = new Edit(this);
   this.meanSqmEdit.text = CONFIG.meanSqm;
   this.meanSqmEdit.setFixedWidth(80);
   this.meanSqmEdit.toolTip = "Sky Quality Meter reading in mag/arcsec². Leave empty if unavailable.\n" +
                              "Script auto-converts sky brightness (lux) from FITS to proper SQM values.\n" +
                              "If empty, will estimate from Bortle Scale (enter Bortle first, then tab here).\n" +
                              "If you don't have SQM data:\n" +
                              "• Use Bortle Scale (much easier!) - enter 1-9 in Bortle field above\n" +
                              "• Use mobile apps like 'Sky Quality Meter' or 'Loss of the Night'\n" +
                              "• Estimate from Bortle scale: Class 1=21.7-22, Class 4=20.4-21.3, Class 9=13-18\n" +
                              "• Buy a hardware SQM device (~$200) for accurate readings\n" +
                              "• Leave blank - it's optional for AstroBin";
   this.meanSqmEdit.onTextUpdated = function(text) { CONFIG.meanSqm = text; };
   this.meanSqmEdit.onGetFocus = function() { self.updateSQMFromBortle(); };
   environmentSizer.add(this.meanSqmEdit);

   // Mean FWHM
   var meanFwhmLabel = new Label(this);
   meanFwhmLabel.text = "Mean FWHM:";
   meanFwhmLabel.minWidth = 90;
   meanFwhmLabel.textAlignment = TextAlign_VertCenter;
   environmentSizer.add(meanFwhmLabel);
   this.meanFwhmEdit = new Edit(this);
   this.meanFwhmEdit.text = CONFIG.meanFwhm;
   this.meanFwhmEdit.setFixedWidth(80);
   this.meanFwhmEdit.toolTip = "Full Width Half Maximum in arcseconds. Leave empty if unavailable.\n" +
                               "How to measure FWHM in PixInsight:\n" +
                               "1. Open a calibrated/stretched light frame\n" +
                               "2. Process → Image Analysis → DynamicPSF\n" +
                               "3. Click on 3-5 unsaturated stars (not too bright)\n" +
                               "4. Read the 'FWHM' value from results (typically 1-4 arcseconds)\n" +
                               "5. Average the readings from different stars\n" +
                               "If no suitable stars or tools, leave blank - it's optional";
   this.meanFwhmEdit.onTextUpdated = function(text) { CONFIG.meanFwhm = text; };
   environmentSizer.add(this.meanFwhmEdit);

   // Temperature
   var temperatureLabel = new Label(this);
   temperatureLabel.text = "Temperature (°C):";
   temperatureLabel.minWidth = 120;
   temperatureLabel.textAlignment = TextAlign_VertCenter;
   environmentSizer.add(temperatureLabel);
   this.temperatureEdit = new Edit(this);
   this.temperatureEdit.text = CONFIG.ambientTemp;
   this.temperatureEdit.setFixedWidth(80);
   this.temperatureEdit.toolTip = "Ambient air temperature in Celsius. Used as fallback if not available in FITS.\n" +
                                  "Per-session temperatures from FITS take precedence when available.";
   this.temperatureEdit.onTextUpdated = function(text) { CONFIG.ambientTemp = text; };
   environmentSizer.add(this.temperatureEdit);

   environmentSizer.addStretch();

   // Layout the rows with spacing
   this.globalParametersGroupBox.sizer.add(calibrationSizer);
   this.globalParametersGroupBox.sizer.addSpacing(8); // Add space between rows
   this.globalParametersGroupBox.sizer.add(bortleSizer);
   this.globalParametersGroupBox.sizer.addSpacing(4); // Add space between rows
   this.globalParametersGroupBox.sizer.add(filterBrandSizer);
   this.globalParametersGroupBox.sizer.addSpacing(8); // Add space between rows
   this.globalParametersGroupBox.sizer.add(environmentSizer);
   
   // Add space before info messages
   this.globalParametersGroupBox.sizer.addSpacing(12);
   
   // Add info label for metadata status and helpful guidance
   this.metadataInfoLabel = new Label(this);
   this.metadataInfoLabel.text = "Input parameter values manually or analyze images to auto-detect from FITS metadata.\n" +
                                "SQM & FWHM are optional - use mobile apps/hardware SQM, or PixInsight DynamicPSF for FWHM.\n" +
                                "Leave fields blank if data unavailable - AstroBin import will still work.";
   this.metadataInfoLabel.wordWrapping = true;
   this.metadataInfoLabel.styleSheet = "QLabel { color: #666; font-size: 9pt; }";
   this.globalParametersGroupBox.sizer.add(this.metadataInfoLabel);
};

// Helper method to get unique brands from filter database
AstroBinDialog.prototype.getUniqueBrands = function()
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

// Update global parameters UI based on available FITS metadata
AstroBinDialog.prototype.updateGlobalParametersFromMetadata = function(globalData)
{
   if (!globalData) return;
   
   var infoMessages = [];
   var availableMetadata = globalData.availableMetadata || {};
   var calibrationCounts = globalData.calibrationCounts || {};
   
   // Update calibration frame counts if detected
   if (calibrationCounts.darks > 0) {
      this.darksEdit.text = calibrationCounts.darks.toString();
      this.darksEdit.enabled = false;
      this.darksEdit.toolTip = "Auto-detected from " + calibrationCounts.darks + " DARK frames in directory";
      infoMessages.push("Found " + calibrationCounts.darks + " dark frames");
   }
   
   if (calibrationCounts.flats > 0) {
      this.flatsEdit.text = calibrationCounts.flats.toString();
      this.flatsEdit.enabled = false;
      this.flatsEdit.toolTip = "Auto-detected from " + calibrationCounts.flats + " FLAT frames in directory";
      infoMessages.push("Found " + calibrationCounts.flats + " flat frames");
   }
   
   if (calibrationCounts.flatDarks > 0) {
      this.flatDarksEdit.text = calibrationCounts.flatDarks.toString();
      this.flatDarksEdit.enabled = false;
      this.flatDarksEdit.toolTip = "Auto-detected from " + calibrationCounts.flatDarks + " FLAT DARK frames in directory";
      infoMessages.push("Found " + calibrationCounts.flatDarks + " flat dark frames");
   }
   
   if (calibrationCounts.bias > 0) {
      this.biasEdit.text = calibrationCounts.bias.toString();
      this.biasEdit.enabled = false;
      this.biasEdit.toolTip = "Auto-detected from " + calibrationCounts.bias + " BIAS frames in directory";
      infoMessages.push("Found " + calibrationCounts.bias + " bias frames");
   }
   
   // Update environmental parameters if available in FITS
   if (availableMetadata.hasBortle && globalData.bortle) {
      // Set Bortle dropdown selection
      var bortleValue = parseInt(globalData.bortle) || 4;
      if (bortleValue >= 1 && bortleValue <= 9) {
         this.bortleComboBox.currentItem = bortleValue - 1; // ComboBox is 0-indexed
      }
      this.bortleComboBox.enabled = false;
      this.bortleComboBox.toolTip = "Auto-detected from FITS metadata";
      infoMessages.push("Bortle scale extracted from FITS");
   }
   
   if (availableMetadata.hasSQM && globalData.meanSqm) {
      this.meanSqmEdit.text = globalData.meanSqm.toFixed(2);
      this.meanSqmEdit.enabled = false;
      this.meanSqmEdit.toolTip = "Auto-detected from FITS metadata";
      infoMessages.push("SQM extracted from FITS");
   }
   
   if (availableMetadata.hasFWHM && globalData.meanFwhm) {
      this.meanFwhmEdit.text = globalData.meanFwhm.toFixed(2);
      this.meanFwhmEdit.enabled = false;
      this.meanFwhmEdit.toolTip = "Auto-detected from FITS metadata";
      infoMessages.push("FWHM extracted from FITS");
   }
   
   if (availableMetadata.hasAmbientTemp && globalData.ambientTemp) {
      this.temperatureEdit.text = globalData.ambientTemp.toFixed(1);
      this.temperatureEdit.enabled = false;
      this.temperatureEdit.toolTip = "Auto-detected from FITS metadata";
      infoMessages.push("Ambient temperature extracted from FITS");
   }
   
   // Update info label
   if (infoMessages.length > 0) {
      this.metadataInfoLabel.text = "Auto-detected: " + infoMessages.join(", ") + ".\n" +
                                   "Remaining fields use manual values or will need to be entered.\n" +
                                   "SQM: Sky quality meter (16-22 mag/arcsec²). FWHM: Star seeing (1-4\").";
      this.metadataInfoLabel.styleSheet = "QLabel { color: #008000; font-size: 9pt; }"; // Green for success
   } else {
      this.metadataInfoLabel.text = "No calibration frames or FITS metadata detected.\n" +
                                   "SQM: Optional - use SQM apps, hardware devices, or leave blank.\n" + 
                                   "FWHM: Optional - measure with PixInsight DynamicPSF or leave blank.\n" +
                                   "Manual calibration frame counts and environmental data can be entered above.";
      this.metadataInfoLabel.styleSheet = "QLabel { color: #FFA500; font-size: 9pt; }"; // Orange for warning
   }
};

// Image Analysis Section
AstroBinDialog.prototype.createImageAnalysisSection = function()
{
   this.imageAnalysisGroupBox = new GroupBox(this);
   this.imageAnalysisGroupBox.title = "Image Analysis Results";
   this.imageAnalysisGroupBox.sizer = new VerticalSizer;
   this.imageAnalysisGroupBox.sizer.margin = 6;
   this.imageAnalysisGroupBox.sizer.spacing = 4;

   // Analysis controls
   var analysisSizer = new HorizontalSizer;
   analysisSizer.spacing = 4;
   
   this.analyzeButton = new PushButton(this);
   this.analyzeButton.text = "Analyze Images";
   this.analyzeButton.toolTip = "Analyze selected image files and extract metadata";
   var self = this;
   this.analyzeButton.onClick = function() { self.analyzeImages(); };
   
   this.mapFiltersButton = new PushButton(this);
   this.mapFiltersButton.text = "Map Filters";
   this.mapFiltersButton.toolTip = "Map detected filters to AstroBin filter IDs";
   this.mapFiltersButton.enabled = false; // Disabled until analysis is done
   this.mapFiltersButton.onClick = function() { self.showFilterMappingDialog(); };
   
   this.analysisStatusLabel = new Label(this);
   this.analysisStatusLabel.text = "No analysis performed";
   
   analysisSizer.add(this.analyzeButton);
   analysisSizer.add(this.mapFiltersButton);
   analysisSizer.addStretch();
   analysisSizer.add(this.analysisStatusLabel);

   // Results tree
   this.imageTreeBox = new TreeBox(this);
   this.imageTreeBox.alternateRowColor = true;
   this.imageTreeBox.headerVisible = true;
   this.imageTreeBox.numberOfColumns = 8;
   this.imageTreeBox.rootDecoration = false;
   this.imageTreeBox.multipleSelection = true;
   this.imageTreeBox.setHeaderText(0, "Date");
   this.imageTreeBox.setHeaderText(1, "Filter");
   this.imageTreeBox.setHeaderText(2, "Filter ID");
   this.imageTreeBox.setHeaderText(3, "Count");
   this.imageTreeBox.setHeaderText(4, "Duration");
   this.imageTreeBox.setHeaderText(5, "Binning");
   this.imageTreeBox.setHeaderText(6, "Gain");
   this.imageTreeBox.setHeaderText(7, "Temp (°C)");
   
   // Set column widths and enable editing for Filter ID column
   for (var i = 0; i < 8; i++) {
      this.imageTreeBox.setColumnWidth(i, 100);
   }
   
   // Enable editing on all columns except first column (make column 2 editable)
   this.imageTreeBox.editEnabled = true;
   
   // Enable editing on all columns except first column (make column 2 editable)
   this.imageTreeBox.editEnabled = true;
   
   // Enable editing event handler
   var self = this;
   this.imageTreeBox.onNodeUpdated = function(node, column) {
      if (column === 2 && node.dataIndex !== undefined) {
         // Update the filter ID when user edits column 2
         var newFilterId = node.text(2);
         if (g_analysisData && g_analysisData[node.dataIndex]) {
            g_analysisData[node.dataIndex].filterId = newFilterId;
            console.writeln("Updated filter ID for image " + (node.dataIndex + 1) + " to: " + newFilterId);
         }
         // Regenerate CSV if it exists
         if (self.csvPreviewTextBox && self.csvPreviewTextBox.text) {
            self.generateCSV();
         }
      }
   };

   this.imageAnalysisGroupBox.sizer.add(analysisSizer);
   this.imageAnalysisGroupBox.sizer.add(this.imageTreeBox, 100);
};

// CSV Preview Section
AstroBinDialog.prototype.createCSVPreviewSection = function()
{
   this.csvPreviewGroupBox = new GroupBox(this);
   this.csvPreviewGroupBox.title = "CSV Export Preview";
   this.csvPreviewGroupBox.sizer = new VerticalSizer;
   this.csvPreviewGroupBox.sizer.margin = 6;
   this.csvPreviewGroupBox.sizer.spacing = 4;

   // Export controls
   var exportSizer = new HorizontalSizer;
   exportSizer.spacing = 4;
   
   this.generateCSVButton = new PushButton(this);
   this.generateCSVButton.text = "Generate CSV";
   this.generateCSVButton.toolTip = "Generate CSV content from analyzed data";
   var self = this;
   this.generateCSVButton.onClick = function() { self.generateCSV(); };
   
   this.saveCSVButton = new PushButton(this);
   this.saveCSVButton.text = "Save CSV File";
   this.saveCSVButton.toolTip = "Save CSV to file";
   this.saveCSVButton.onClick = function() { self.saveCSVFile(); };
   this.saveCSVButton.enabled = false;
   
   this.copyCSVButton = new PushButton(this);
   this.copyCSVButton.text = "Copy to Clipboard";
   this.copyCSVButton.toolTip = "Copy CSV content to clipboard";
   this.copyCSVButton.onClick = function() { self.copyCSVToClipboard(); };
   this.copyCSVButton.enabled = false;
   
   // Settings button (opens export columns dialog)
   this.exportSettingsButton = new PushButton(this);
   this.exportSettingsButton.text = "Columns...";
   this.exportSettingsButton.toolTip = "Select which columns to populate in the CSV";
   this.exportSettingsButton.onClick = function() { self.showExportColumnsDialog(); };
   
   exportSizer.add(this.generateCSVButton);
   exportSizer.add(this.saveCSVButton);
   exportSizer.add(this.copyCSVButton);
   exportSizer.addStretch();
   exportSizer.add(this.exportSettingsButton);

   // CSV preview text
   this.csvPreviewTextBox = new TextBox(this);
   this.csvPreviewTextBox.readOnly = true;
   this.csvPreviewTextBox.setMinHeight(120);

   this.csvPreviewGroupBox.sizer.add(exportSizer);
   this.csvPreviewGroupBox.sizer.add(this.csvPreviewTextBox, 100);
};

// Button Section
AstroBinDialog.prototype.createButtonSection = function()
{
   this.buttonSizer = new HorizontalSizer;
   this.buttonSizer.spacing = 4;
   
   this.aboutButton = new PushButton(this);
   this.aboutButton.text = "About";
   var self = this;
   this.aboutButton.onClick = function() { self.showAbout(); };
   
   this.summaryButton = new PushButton(this);
   this.summaryButton.text = "Integration Summary";
   this.summaryButton.toolTip = "Show detailed summary of analyzed integration data";
   this.summaryButton.onClick = function() { self.showIntegrationSummary(); };
   this.summaryButton.enabled = false; // Enabled after analysis
   
   this.buttonSizer.add(this.aboutButton);
   this.buttonSizer.add(this.summaryButton);
   this.buttonSizer.addStretch();
   
   this.okButton = new PushButton(this);
   this.okButton.text = "Close";
   this.okButton.onClick = function() { self.ok(); };
   this.okButton.defaultButton = true;
   
   this.buttonSizer.add(this.okButton);
};
