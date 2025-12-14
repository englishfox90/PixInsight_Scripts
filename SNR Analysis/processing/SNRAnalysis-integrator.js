/*
 * SNRAnalysis-integrator.js
 * ImageIntegration wrapper for partial depth integrations
 */

/**
 * Add FITS keywords to an integrated image
 * @param {ImageWindow} window - Image window to add keywords to
 * @param {Array} subframes - Array of subframes used in integration
 * @param {number} depth - Number of subframes integrated
 */
function addIntegrationMetadata(window, subframes, depth) {
   if (!window || window.isNull) return;
   
   // Calculate total exposure time
   var totalExposure = 0;
   var filterList = [];
   var dateObsList = [];
   
   for (var i = 0; i < depth && i < subframes.length; i++) {
      totalExposure += subframes[i].exposure;
      
      if (subframes[i].filter && filterList.indexOf(subframes[i].filter) === -1) {
         filterList.push(subframes[i].filter);
      }
      
      if (subframes[i].dateObs) {
         dateObsList.push(subframes[i].dateObs);
      }
   }
   
   // Get existing keywords
   var keywords = window.keywords;
   
   // Helper to update or add keyword
   function setKeyword(name, value, comment) {
      // Remove existing if present
      for (var i = 0; i < keywords.length; i++) {
         if (keywords[i].name === name) {
            keywords.splice(i, 1);
            break;
         }
      }
      // Add new
      keywords.push(new FITSKeyword(name, value, comment));
   }
   
   // Add integration metadata
   setKeyword("EXPTIME", totalExposure.toString(), "Total exposure time (seconds)");
   setKeyword("EXPOSURE", totalExposure.toString(), "Total exposure time (seconds)");
   setKeyword("NIMAGES", depth.toString(), "Number of integrated images");
   
   if (filterList.length === 1) {
      setKeyword("FILTER", filterList[0], "Filter name");
   } else if (filterList.length > 1) {
      setKeyword("FILTER", filterList.join("+"), "Combined filters");
   }
   
   if (dateObsList.length > 0) {
      setKeyword("DATE-OBS", dateObsList[0], "Observation start date/time");
   }
   
   setKeyword("IMAGETYP", "Light Frame", "Image type");
   setKeyword("OBJECT", "SNR_Integration", "Object name");
   
   // Write keywords back to window
   window.keywords = keywords;
}

/**
 * Perform full-depth integration for ROI reference master
 */
function performFullIntegration(subframes, outputDir, filterSuffix) {
   filterSuffix = filterSuffix || "";
   console.writeln("Integrating all " + subframes.length + " subframes...");
   
   ensureDirectory(outputDir);
   
   var P = new ImageIntegration();
   
   // Add all subframes
   var images = [];
   for (var i = 0; i < subframes.length; i++) {
      images.push([
         true,                    // enabled
         subframes[i].path,       // path
         "",                      // drizzle path
         ""                       // local normalization data
      ]);
   }
   P.images = images;
   
   // Configure integration parameters
   P.inputHints = "";
   P.combination = ImageIntegration.prototype.Average;
   P.normalization = ImageIntegration.prototype.AdditiveWithScaling;
   P.weightMode = ImageIntegration.prototype.DontCare;
   P.weightKeyword = "";
   P.weightScale = ImageIntegration.prototype.WeightScale_IKSS;
   P.ignoreNoiseKeywords = false;
   
   // Adaptive rejection algorithm (WBPP-style Auto mode)
   P.rejection = selectRejectionAlgorithm(subframes.length);
   P.rejectionNormalization = ImageIntegration.prototype.Scale;
   P.minMaxLow = 1;
   P.minMaxHigh = 1;
   
   // Use CONFIG values for rejection parameters
   P.pcClipLow = CONFIG.percentileLow;
   P.pcClipHigh = CONFIG.percentileHigh;
   P.sigmaLow = CONFIG.sigmaLow;
   P.sigmaHigh = CONFIG.sigmaHigh;
   P.linearFitLow = CONFIG.linearFitLow;
   P.linearFitHigh = CONFIG.linearFitHigh;
   P.ccdGain = 1.00;
   P.ccdReadNoise = 10.00;
   P.ccdScaleNoise = 0.00;
   
   // Range clipping - disable low clipping to avoid dark sky artifacts
   P.rangeClipLow = false;
   P.rangeLow = 0.000000;
   P.rangeClipHigh = false;
   P.rangeHigh = 0.980000;
   
   // Output
   P.generate64BitResult = false;
   P.generateRejectionMaps = false;
   P.generateIntegratedImage = true;
   P.generateDrizzleData = false;
   P.closePreviousImages = false;
   
   // Execute
   var result = P.executeGlobal();
   
   if (!result) {
      throw new Error("Full integration failed");
   }
   
   // Get the integrated image window
   var window = ImageWindow.activeWindow;
   if (!window || window.isNull) {
      throw new Error("No active window after integration");
   }
   
   // Rename window
   window.mainView.id = "ref_master_full" + filterSuffix;
   
   // Add FITS metadata with total exposure
   addIntegrationMetadata(window, subframes, subframes.length);
   
   // Save to disk
   var outputPath = CONFIG.integrationsDir + "/ref_master_full" + filterSuffix + ".xisf";
   if (!window.saveAs(outputPath, false, false, false, false)) {
      console.warningln("Failed to save reference master to disk");
   }
   
   // Show the window to the user
   window.show();
   window.zoomToFit();
   
   console.writeln("Full integration complete: " + window.mainView.id);
   
   return window.mainView.id;
}

/**
 * Select rejection algorithm based on Auto mode (WBPP-style)
 * @param {number} depth - Number of images being integrated
 * @returns {number} ImageIntegration rejection constant
 */
function selectRejectionAlgorithm(depth) {
   var algo = CONFIG.rejectionAlgorithm;
   
   if (algo === "Auto") {
      // WBPP Auto mode logic: adapt based on image count
      if (depth < 5) {
         console.writeln("  Auto mode: Using PercentileClip (depth < 5)");
         return ImageIntegration.prototype.PercentileClip;
      } else if (depth < 15) {
         console.writeln("  Auto mode: Using PercentileClip (depth < 15)");
         return ImageIntegration.prototype.PercentileClip;
      } else if (depth < 25) {
         console.writeln("  Auto mode: Using WinsorizedSigmaClip (depth 15-24)");
         return ImageIntegration.prototype.WinsorizedSigmaClip;
      } else {
         console.writeln("  Auto mode: Using LinearFit (depth >= 25)");
         return ImageIntegration.prototype.LinearFit;
      }
   }
   
   // Manual selection
   if (algo === "PercentileClip") return ImageIntegration.prototype.PercentileClip;
   if (algo === "WinsorizedSigmaClip") return ImageIntegration.prototype.WinsorizedSigmaClip;
   if (algo === "LinearFit") return ImageIntegration.prototype.LinearFit;
   if (algo === "ESD" && ImageIntegration.prototype.Rejection_ESD) {
      return ImageIntegration.prototype.Rejection_ESD;
   }
   
   // Fallback
   console.warningln("  Unknown rejection algorithm '" + algo + "', using WinsorizedSigmaClip");
   return ImageIntegration.prototype.WinsorizedSigmaClip;
}

/**
 * Integrate a specific depth (first N subframes)
 * Optimization: Reuse reference master if depth equals total subframes
 */
function integrateDepth(job, subframes, outputDir, filterSuffix) {
   filterSuffix = filterSuffix || "";
   
   // Check if this depth matches the full reference master
   if (job.depth === subframes.length) {
      var refMasterId = "ref_master_full" + filterSuffix;
      var refWindow = ImageWindow.windowById(refMasterId);
      
      // Try to use existing reference master window
      if (refWindow && !refWindow.isNull) {
         console.writeln("Reusing reference master for " + job.label + " (depth = " + job.depth + ")");
         
         // Clone the reference to create a new window with appropriate naming
         var newWindow = new ImageWindow(
            refWindow.mainView.image.width,
            refWindow.mainView.image.height,
            refWindow.mainView.image.numberOfChannels,
            refWindow.mainView.image.bitsPerSample,
            refWindow.mainView.image.isReal,
            refWindow.mainView.image.isColor,
            "int_" + job.label + filterSuffix
         );
         
         newWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
         newWindow.mainView.image.assign(refWindow.mainView.image);
         newWindow.mainView.endProcess();
         
         // Copy keywords
         newWindow.keywords = refWindow.keywords;
         
         // Save the cloned image
         var outputPath = CONFIG.integrationsDir + "/int_" + job.label + filterSuffix + ".xisf";
         if (!newWindow.saveAs(outputPath, false, false, false, false)) {
            console.warningln("Failed to save " + newWindow.mainView.id + " to disk");
         }
         
         newWindow.show();
         
         console.writeln("Reference master reused successfully (saved integration time)");
         return newWindow.mainView.id;
      }
      
      // If reference master window not available, try loading from disk
      var refPath = CONFIG.integrationsDir + "/ref_master_full" + filterSuffix + ".xisf";
      if (File.exists(refPath)) {
         console.writeln("Loading reference master from disk for " + job.label + "...");
         var windows = ImageWindow.open(refPath);
         if (windows && windows.length > 0) {
            var loadedWindow = windows[0];
            loadedWindow.mainView.id = "int_" + job.label + filterSuffix;
            
            // Save as the depth integration file
            var outputPath = CONFIG.integrationsDir + "/int_" + job.label + filterSuffix + ".xisf";
            if (!loadedWindow.saveAs(outputPath, false, false, false, false)) {
               console.warningln("Failed to save " + loadedWindow.mainView.id + " to disk");
            }
            
            console.writeln("Reference master loaded and reused (saved integration time)");
            return loadedWindow.mainView.id;
         }
      }
      
      console.writeln("Reference master not available, proceeding with full integration for " + job.label + "...");
   }
   
   console.writeln("Integrating " + job.depth + " subframes...");
   
   var P = new ImageIntegration();
   
   // Add first N subframes
   var images = [];
   for (var i = 0; i < job.depth && i < subframes.length; i++) {
      images.push([
         true,
         subframes[i].path,
         "",
         ""
      ]);
   }
   P.images = images;
   
   // Configure integration
   P.inputHints = "";
   P.combination = ImageIntegration.prototype.Average;
   P.normalization = ImageIntegration.prototype.AdditiveWithScaling;
   P.weightMode = ImageIntegration.prototype.DontCare;
   P.weightKeyword = "";
   P.weightScale = ImageIntegration.prototype.WeightScale_IKSS;
   P.ignoreNoiseKeywords = false;
   
   // Adaptive rejection algorithm (WBPP-style Auto mode)
   P.rejection = selectRejectionAlgorithm(job.depth);
   P.rejectionNormalization = ImageIntegration.prototype.Scale;
   P.minMaxLow = 1;
   P.minMaxHigh = 1;
   
   // Use CONFIG values for rejection parameters
   P.pcClipLow = CONFIG.percentileLow;
   P.pcClipHigh = CONFIG.percentileHigh;
   P.sigmaLow = CONFIG.sigmaLow;
   P.sigmaHigh = CONFIG.sigmaHigh;
   P.linearFitLow = CONFIG.linearFitLow;
   P.linearFitHigh = CONFIG.linearFitHigh;
   P.ccdGain = 1.00;
   P.ccdReadNoise = 10.00;
   P.ccdScaleNoise = 0.00;
   
   // Range clipping - disable low clipping to avoid dark sky artifacts
   P.rangeClipLow = false;
   P.rangeLow = 0.000000;
   P.rangeClipHigh = false;
   P.rangeHigh = 0.980000;
   
   P.generate64BitResult = false;
   P.generateRejectionMaps = false;
   P.generateIntegratedImage = true;
   P.generateDrizzleData = false;
   P.closePreviousImages = true;
   
   // Execute
   var result = P.executeGlobal();
   
   if (!result) {
      console.warningln("Integration failed for " + job.label);
      return null;
   }
   
   // Get result window
   var window = ImageWindow.activeWindow;
   if (!window || window.isNull) {
      console.warningln("No active window after integration");
      return null;
   }
   
   // Rename
   var id = "int_" + job.label + filterSuffix;
   window.mainView.id = id;
   
   // Add FITS metadata with total exposure
   addIntegrationMetadata(window, subframes, job.depth);
   
   // Save
   var outputPath = CONFIG.integrationsDir + "/" + id + ".xisf";
   if (!window.saveAs(outputPath, false, false, false, false)) {
      console.warningln("Failed to save " + id + " to disk");
   }
   
   return id;
}
