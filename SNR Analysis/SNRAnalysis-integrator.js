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
   
   // Rejection
   P.rejection = ImageIntegration.prototype.WinsorizedSigmaClip;
   P.rejectionNormalization = ImageIntegration.prototype.Scale;
   P.minMaxLow = 1;
   P.minMaxHigh = 1;
   P.pcClipLow = 0.200;
   P.pcClipHigh = 0.100;
   P.sigmaLow = 4.000;
   P.sigmaHigh = 3.000;
   P.linearFitLow = 5.000;
   P.linearFitHigh = 2.500;
   P.ccdGain = 1.00;
   P.ccdReadNoise = 10.00;
   P.ccdScaleNoise = 0.00;
   
   // Range clipping
   P.rangeClipLow = true;
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
   var outputPath = outputDir + "/ref_master_full" + filterSuffix + ".xisf";
   if (!window.saveAs(outputPath, false, false, false, false)) {
      console.warningln("Failed to save reference master to disk");
   }
   
   console.writeln("Full integration complete: " + window.mainView.id);
   
   return window.mainView.id;
}

/**
 * Integrate a specific depth (first N subframes)
 */
function integrateDepth(job, subframes, outputDir, filterSuffix) {
   filterSuffix = filterSuffix || "";
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
   
   // Configure (same as full integration)
   P.inputHints = "";
   P.combination = ImageIntegration.prototype.Average;
   P.normalization = ImageIntegration.prototype.AdditiveWithScaling;
   P.weightMode = ImageIntegration.prototype.DontCare;
   P.weightKeyword = "";
   P.weightScale = ImageIntegration.prototype.WeightScale_IKSS;
   P.ignoreNoiseKeywords = false;
   
   P.rejection = ImageIntegration.prototype.WinsorizedSigmaClip;
   P.rejectionNormalization = ImageIntegration.prototype.Scale;
   P.minMaxLow = 1;
   P.minMaxHigh = 1;
   P.pcClipLow = 0.200;
   P.pcClipHigh = 0.100;
   P.sigmaLow = 4.000;
   P.sigmaHigh = 3.000;
   P.linearFitLow = 5.000;
   P.linearFitHigh = 2.500;
   P.ccdGain = 1.00;
   P.ccdReadNoise = 10.00;
   P.ccdScaleNoise = 0.00;
   
   P.rangeClipLow = true;
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
   var outputPath = outputDir + "/" + id + ".xisf";
   if (!window.saveAs(outputPath, false, false, false, false)) {
      console.warningln("Failed to save " + id + " to disk");
   }
   
   return id;
}
