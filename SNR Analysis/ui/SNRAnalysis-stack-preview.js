/*
 * SNRAnalysis-stack-preview.js
 * Stack preview panel for viewing integrated images at different depths
 */

/**
 * Create stack preview entries from results
 * @param {Array} results - Array of integration depth results
 * @param {string} outputDir - Output directory where stack files are saved
 * @param {string} filterSuffix - Filter suffix for file naming (e.g., "_Ha")
 * @param {boolean} starRemovalEnabled - Whether star removal was used
 * @returns {Array} Array of preview entry objects
 */
function createStackPreviewEntries(results, outputDir, filterSuffix, starRemovalEnabled) {
   var entries = [];
   filterSuffix = filterSuffix || "";

   function resolvePath(basePath, fallbackPath) {
      if (File.exists(basePath))
         return basePath;
      if (fallbackPath && File.exists(fallbackPath))
         return fallbackPath;
      return basePath;
   }
   
   for (var i = 0; i < results.length; i++) {
      var r = results[i];
      
      // Use organized directory structure
      var stackPath = CONFIG.integrationsDir + "/int_" + r.label + filterSuffix + ".xisf";
      // Fallback: if suffix-based name is missing, try without suffix (and vice versa)
      var altStackPath = null;
      if (filterSuffix) {
         altStackPath = CONFIG.integrationsDir + "/int_" + r.label + ".xisf";
      }
      stackPath = resolvePath(stackPath, altStackPath);
      var starlessPath = null;
      
      if (starRemovalEnabled) {
         starlessPath = CONFIG.previewsDir + "/int_" + r.label + filterSuffix + "_starless.xisf";
         var altStarlessPath = null;
         if (filterSuffix) {
            altStarlessPath = CONFIG.previewsDir + "/int_" + r.label + "_starless.xisf";
         }
         starlessPath = resolvePath(starlessPath, altStarlessPath);
         // Check if starless file exists, otherwise set to null
         if (!File.exists(starlessPath)) {
            starlessPath = null;
         }
      }
      
      entries.push({
         label: r.label,
         depth: r.depth,
         stackPath: stackPath,
         starlessPath: starlessPath,
         totalExposure: r.totalExposure,
         totalExposureStr: formatTime(r.totalExposure),
         snr: r.snr
      });
   }
   
   return entries;
}

/**
 * Create a stack preview panel (tab content)
 * @param {Control} parent - Parent control
 * @param {Array} previewEntries - Array of preview entries from createStackPreviewEntries
 * @param {boolean} isCroppedMode - Whether cropped stacking mode was used
 * @param {string} filterName - Filter name for labeling
 * @returns {Control} Panel control with stack preview UI
 */
function createStackPreviewPanel(parent, previewEntries, isCroppedMode, filterName) {
   var panel = new Control(parent);
   panel.sizer = new VerticalSizer;
   panel.sizer.margin = 6;
   panel.sizer.spacing = 4;
   
   // Info label at top
   var infoLabel = new Label(panel);
   if (isCroppedMode) {
      infoLabel.text = "Cropped ROI stack preview (auto-stretch is display-only; SNR is measured on linear data before stretch)";
      infoLabel.toolTip = "Preview uses an automatic display stretch for visibility only. SNR calculations are performed on the linear (pre-stretch) integration.";
   } else {
      infoLabel.text = "Integrated stack preview (auto-stretch is display-only; SNR is measured on linear data before stretch)";
      infoLabel.toolTip = "Preview uses an automatic display stretch for visibility only. SNR calculations are performed on the linear (pre-stretch) integration.";
   }
   infoLabel.styleSheet = "font-style: italic; color: #606060;";
   infoLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   
   // Depth selector row
   var selectorSizer = new HorizontalSizer;
   selectorSizer.spacing = 6;
   
   var depthLabel = new Label(panel);
   depthLabel.text = "Depth:";
   depthLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   depthLabel.minWidth = 60;
   
   var depthCombo = new ComboBox(panel);
   for (var i = 0; i < previewEntries.length; i++) {
      depthCombo.addItem(previewEntries[i].label);
   }
   depthCombo.currentItem = 0;
   depthCombo.minWidth = 120;
   
   selectorSizer.add(depthLabel);
   selectorSizer.add(depthCombo);
   selectorSizer.addStretch();
   
   // Preview area with ScrollBox
   var previewBox = new ScrollBox(panel);
   previewBox.setScaledMinSize(780, 350);
   previewBox.autoScroll = true;
   previewBox.tracking = true;
   previewBox.cursor = new Cursor(StdCursor_Arrow);
   
   // Store preview data
   previewBox.currentBitmap = null;
   previewBox.currentWindow = null;
   previewBox.statusText = "Select a depth to preview";
   
   // Viewport paint handler
   previewBox.viewport.onPaint = function(x0, y0, x1, y1) {
      var g = new Graphics(this);
      var bmp = this.parent.currentBitmap;
      
      if (bmp && bmp.width > 0 && bmp.height > 0) {
         // Fill background
         g.fillRect(x0, y0, x1, y1, new Brush(0xFF1A1A1A));
         
         // Calculate scale to fit
         var maxWidth = 760;
         var maxHeight = 330;
         var scale = Math.min(maxWidth / bmp.width, maxHeight / bmp.height, 1.0);
         var scaledWidth = Math.floor(bmp.width * scale);
         var scaledHeight = Math.floor(bmp.height * scale);
         
         // Center
         var xOffset = Math.max(0, (this.width - scaledWidth) / 2);
         var yOffset = Math.max(0, (this.height - scaledHeight) / 2);
         
         // Draw
         g.drawScaledBitmap(xOffset, yOffset, xOffset + scaledWidth, yOffset + scaledHeight, bmp);
      } else {
         // No preview
         g.fillRect(x0, y0, x1, y1, new Brush(0xFF1A1A1A));
         g.pen = new Pen(0xFFA0A0A0);
         g.font = new Font("helvetica", 12);
         var statusText = this.parent.statusText || "No preview available";
         g.drawText(20, 30, statusText);
      }
      
      g.end();
   };
   
   // Info label below preview
   var infoTextLabel = new Label(panel);
   infoTextLabel.text = "";
   infoTextLabel.textAlignment = TextAlign_Center | TextAlign_VertCenter;
   infoTextLabel.styleSheet = "font-weight: bold; font-size: 11pt;";
   
   // Function to load and display a stack
   function loadStackPreview(index) {
      if (index < 0 || index >= previewEntries.length) return;
      
      var entry = previewEntries[index];
      
      // Close previous window if it was temporary
      if (previewBox.currentWindow && !previewBox.currentWindow.isNull) {
         try {
            previewBox.currentWindow.forceClose();
         } catch (e) {
            // Ignore
         }
         previewBox.currentWindow = null;
      }
      
      // Clear current bitmap
      previewBox.currentBitmap = null;
      
      // Determine which file to load
      var filePath = entry.stackPath;
      var useStarless = false;
      
      if (entry.starlessPath && File.exists(entry.starlessPath)) {
         filePath = entry.starlessPath;
         useStarless = true;
      }
      
      // Check if file exists
      if (!File.exists(filePath)) {
         previewBox.statusText = "File not found: " + entry.label;
         infoTextLabel.text = entry.label + " - File not available";
         previewBox.viewport.update();
         console.warningln("Stack preview: File not found - " + filePath);
         return;
      }
      
      try {
         // Load image (read-only, don't show window)
         var windows = ImageWindow.open(filePath);
         if (!windows || windows.length === 0) {
            previewBox.statusText = "Failed to load: " + entry.label;
            infoTextLabel.text = entry.label + " - Load failed";
            previewBox.viewport.update();
            console.warningln("Stack preview: Failed to open - " + filePath);
            return;
         }
         
         var window = windows[0];
         window.hide();  // Don't show to user
         previewBox.currentWindow = window;
         
         // Calculate Auto-STF parameters (PixInsight-style)
         var img = window.mainView.image;
         var median = img.median();
         var avgDev = img.avgDev();

         var stretch = calculateAutoStretchParameters(median, avgDev, -1.25, 0.25);
         var c0 = stretch.c0;
         var m = stretch.m;
         var c1 = stretch.c1;

         console.writeln("Preview stretch - c0: " + c0 + ", m: " + m + ", c1: " + c1);
         console.writeln("Image min: " + img.minimum() + ", median: " + median + ", max: " + img.maximum());
         
         // Create a working copy of the image
         var stretchedImg = new Image(Math.floor(img.width), Math.floor(img.height), img.numberOfChannels, 
                                       img.colorSpace, img.bitsPerSample, img.sampleType);
         stretchedImg.assign(img);
         
         // Apply stretch using a linked HistogramTransformation on the copy.
         // Applying per-channel stretches can exaggerate artifacts/colors; use the RGB/K row.
         var HT = new HistogramTransformation;
         HT.H = [
            [0, 0.5, 1, 0, 1],
            [0, 0.5, 1, 0, 1],
            [0, 0.5, 1, 0, 1],
            [c0, m, c1, 0, 1],
            [0, 0.5, 1, 0, 1]
         ];
         
         // Apply the stretch to the copied image
         HT.executeOn(stretchedImg);
         
         console.writeln("After stretch - min: " + stretchedImg.minimum() + ", median: " + stretchedImg.median() + ", max: " + stretchedImg.maximum());
         
         // Render the stretched image to bitmap
         var bmp = stretchedImg.render();
         
         console.writeln("Bitmap created: " + bmp.width + "x" + bmp.height);
         
         // Clean up
         stretchedImg.free();
         
         previewBox.currentBitmap = bmp;
         previewBox.statusText = "";
         
         // Update info label
         var typeStr = useStarless ? "Starless" : "Full";
         infoTextLabel.text = entry.label + " – " + entry.totalExposureStr + " – SNR: " + 
                             entry.snr.toFixed(2) + " (" + typeStr + ")";
         
         previewBox.viewport.update();
         console.writeln("Stack preview loaded: " + entry.label + " (" + window.mainView.image.width + "x" + window.mainView.image.height + ")");
         
      } catch (e) {
         previewBox.statusText = "Error loading: " + entry.label;
         infoTextLabel.text = entry.label + " - Error: " + e.message;
         previewBox.viewport.update();
         console.warningln("Stack preview error: " + e.message);
      }
   }
   
   // Combo box change handler
   depthCombo.onItemSelected = function(index) {
      loadStackPreview(index);
   };
   
   // Add to layout
   panel.sizer.add(infoLabel);
   panel.sizer.add(selectorSizer);
   panel.sizer.add(previewBox);
   panel.sizer.add(infoTextLabel);
   
   // Load first preview automatically
   if (previewEntries.length > 0) {
      loadStackPreview(0);
   }
   
   return panel;
}

/**
 * Apply Auto-STF to a window for preview display only
 * Returns a new window with STF applied (original unchanged)
 * @param {ImageWindow} window - Source window
 * @returns {ImageWindow} Window with STF applied
 */
function applyAutoSTFForPreview(window) {
   try {
      // Create a duplicate for STF application
      // For 32-bit images, use float sample type (true), otherwise integer (false)
      var isFloatSample = (window.mainView.image.bitsPerSample == 32);
      
      var duplicate = new ImageWindow(
         Math.floor(window.mainView.image.width),
         Math.floor(window.mainView.image.height),
         window.mainView.image.numberOfChannels,
         window.mainView.image.bitsPerSample,
         isFloatSample,
         window.mainView.image.isColor,
         "stf_preview_temp"
      );
      
      duplicate.mainView.beginProcess();
      duplicate.mainView.image.assign(window.mainView.image);
      duplicate.mainView.endProcess();
      
      // Calculate Auto-STF
      var stf = new ScreenTransferFunction();
      
      var median = window.mainView.image.median();
      var avgDev = window.mainView.image.avgDev();
      
      var c0 = Math.max(0, median + (-2.8) * avgDev);
      var m = calculateMidtonesBalance(median - c0, 0.5);
      
      // Apply STF to all channels
      var STF = [
         [0, 0.5, 1, 0, 1],
         [0, 0.5, 1, 0, 1],
         [0, 0.5, 1, 0, 1],
         [0, 0.5, 1, 0, 1]
      ];
      
      if (window.mainView.image.isColor) {
         for (var i = 0; i < 3; i++) {
            STF[i][0] = c0;
            STF[i][1] = m;
         }
      } else {
         STF[0][0] = c0;
         STF[0][1] = m;
      }
      
      stf.STF = STF;
      stf.executeOn(duplicate.mainView, false);  // Don't show STF, just apply
      
      // Apply the STF to the actual image pixels (not just screen transfer)
      duplicate.mainView.stf = STF;
      
      return duplicate;
      
   } catch (e) {
      console.warningln("STF preview failed, using original: " + e.message);
      return window;
   }
}

/**
 * Calculate midtones balance for STF
 */
function calculateMidtonesBalance(median, targetMedian) {
   if (median <= 0) return 0.5;
   if (median >= 1) return 0.5;
   
   var m = Math.mtf(targetMedian, median);
   if (m < 0) m = 0;
   if (m > 1) m = 1;
   
   return m;
}

/*
 * PixInsight AutoSTF-style parameter calculation for previews.
 * Based on the simplified AutoStretch routine (c0 in sigma units + midtones solve).
 */
function findMidtonesBalance(v0, v1, eps) {
   if (v1 <= 0)
      return 0;
   if (v1 >= 1)
      return 1;

   v0 = Math.range(v0, 0.0, 1.0);
   eps = eps ? Math.max(1.0e-15, eps) : 5.0e-05;

   var m0, m1;
   if (v1 < v0) {
      m0 = 0;
      m1 = 0.5;
   } else {
      m0 = 0.5;
      m1 = 1;
   }

   for (;;) {
      var m = (m0 + m1) / 2;
      var v = Math.mtf(m, v1);

      if (Math.abs(v - v0) < eps)
         return m;

      if (v < v0)
         m1 = m;
      else
         m0 = m;
   }
}

function calculateAutoStretchParameters(median, avgDev, shadowsClipping, targetBackground) {
   if (shadowsClipping === undefined)
      shadowsClipping = -1.25;
   if (targetBackground === undefined)
      targetBackground = 0.25;

   var c0 = Math.range(median + shadowsClipping * avgDev, 0.0, 1.0);
   var m = findMidtonesBalance(targetBackground, median - c0);
   return { m: m, c0: c0, c1: 1 };
}
