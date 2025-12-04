/*
 * SNRAnalysis-roi-cropper.js
 * ROI-based cropping for faster stacking
 */

/**
 * Crop a list of subframes to the given ROI rectangle and write temp files
 *
 * @param {Array<Subframe>} subframes - original subframes (with .path)
 * @param {Object} roiRect - { x0, y0, x1, y1 } in pixels (reference-master coordinates)
 * @param {String} tempRootDir - base directory for temp output
 * @param {String} filterLabel - e.g. "Ha", "OIII" (for folder naming)
 * @param {Object} refSize - { width, height } of the reference master image
 *
 * @returns {Array<Subframe>|null} newSubframes - same shape but with .path pointing to cropped files,
 *          or null if cropping cannot be safely applied (dimension mismatch, I/O failure, etc.)
 */
function cropSubframesToRoi(subframes, roiRect, tempRootDir, filterLabel, refSize) {
   console.writeln("");
   console.writeln("=== ROI Cropping for " + filterLabel + " ===");
   console.writeln("ROI Rectangle: " + formatRect(roiRect));
   console.writeln("Reference Size: " + refSize.width + "x" + refSize.height);
   console.writeln("Subframes to crop: " + subframes.length);
   
   // Validate ROI rect
   if (roiRect.x0 < 0 || roiRect.y0 < 0 || 
       roiRect.x1 > refSize.width || roiRect.y1 > refSize.height ||
       roiRect.x0 >= roiRect.x1 || roiRect.y0 >= roiRect.y1) {
      console.warningln("ROI cropping disabled for " + filterLabel + " – invalid ROI rectangle.");
      return null;
   }
   
   // Calculate crop dimensions
   var cropWidth = roiRect.x1 - roiRect.x0;
   var cropHeight = roiRect.y1 - roiRect.y0;
   console.writeln("Crop dimensions: " + cropWidth + "x" + cropHeight + " pixels");
   
   // Create temp directory
   var filterTempDir = tempRootDir + "/" + filterLabel.replace(/[^a-zA-Z0-9]/g, "_");
   try {
      ensureDirectory(filterTempDir);
   } catch (error) {
      console.warningln("ROI cropping disabled for " + filterLabel + " – failed to create temp directory: " + error.message);
      return null;
   }
   
   var newSubframes = [];
   var failureCount = 0;
   var dimensionMismatch = false;
   
   // Process each subframe
   for (var i = 0; i < subframes.length; i++) {
      var sf = subframes[i];
      
      if (i % 10 === 0) {
         console.writeln("  Cropping subframe " + (i + 1) + "/" + subframes.length + "...");
      }
      
      var w = null;
      var cw = null;
      
      try {
         // Open the image
         var windows = ImageWindow.open(sf.path);
         if (windows.length === 0) {
            console.warningln("  Failed to open: " + sf.path);
            failureCount++;
            if (failureCount > 5) {
               console.warningln("ROI cropping disabled for " + filterLabel + " – too many file open failures.");
               return null;
            }
            continue;
         }
         
         w = windows[0];
         var img = w.mainView.image;
         
         // Validate dimensions
         if (img.width !== refSize.width || img.height !== refSize.height) {
            console.warningln("ROI cropping disabled for " + filterLabel + " – subframe dimensions do not match reference master.");
            console.warningln("  Expected: " + refSize.width + "x" + refSize.height);
            console.warningln("  Got: " + img.width + "x" + img.height);
            console.warningln("  File: " + sf.path);
            dimensionMismatch = true;
            w.forceClose();
            break;
         }
         
         // Extract ROI
         var cropped = img.selectedRect(roiRect.x0, roiRect.y0, roiRect.x1, roiRect.y1);
         
         // Create new window for cropped image
         cw = new ImageWindow(
            cropWidth, cropHeight,
            img.numberOfChannels,
            img.bitsPerSample,
            img.isFloatSample,
            img.isColor,
            "roi_tmp"
         );
         
         cw.mainView.beginProcess();
         cw.mainView.image.assign(cropped);
         cw.mainView.endProcess();
         
         // Generate temp file path
         var baseName = File.extractName(sf.path);
         var extension = File.extractExtension(sf.path);
         var tempPath = filterTempDir + "/" + baseName + "_roi" + extension;
         
         // Save cropped image
         if (!cw.saveAs(tempPath, false, false, false, false)) {
            console.warningln("  Failed to save cropped file: " + tempPath);
            failureCount++;
            if (failureCount > 5) {
               console.warningln("ROI cropping disabled for " + filterLabel + " – too many file save failures.");
               cw.forceClose();
               w.forceClose();
               return null;
            }
            cw.forceClose();
            w.forceClose();
            continue;
         }
         
         // Close windows
         cw.forceClose();
         w.forceClose();
         
         // Add to newSubframes with updated path
         newSubframes.push({
            path: tempPath,
            exposure: sf.exposure,
            filter: sf.filter,
            dateObs: sf.dateObs
         });
         
      } catch (error) {
         console.warningln("  Error cropping " + sf.path + ": " + error.message);
         failureCount++;
         
         // Clean up any open windows
         if (cw && !cw.isNull) cw.forceClose();
         if (w && !w.isNull) w.forceClose();
         
         if (failureCount > 5) {
            console.warningln("ROI cropping disabled for " + filterLabel + " – too many errors.");
            return null;
         }
         continue;
      }
   }
   
   // Check if we encountered dimension mismatch
   if (dimensionMismatch) {
      // Clean up any cropped files we created
      try {
         File.remove(filterTempDir, true);
      } catch (e) {
         // Ignore cleanup errors
      }
      return null;
   }
   
   // Verify we got all subframes
   if (newSubframes.length !== subframes.length) {
      console.warningln("ROI cropping incomplete for " + filterLabel + " – only " + newSubframes.length + "/" + subframes.length + " succeeded.");
      console.warningln("Falling back to full-frame stacking.");
      // Clean up partial results
      try {
         File.remove(filterTempDir, true);
      } catch (e) {
         // Ignore cleanup errors
      }
      return null;
   }
   
   console.writeln("ROI crop successful: " + newSubframes.length + " subs cropped for filter " + filterLabel);
   console.writeln("Temp directory: " + filterTempDir);
   
   return newSubframes;
}

/**
 * Compute bounding rectangle that contains both BG and FG ROIs
 * Adds a small padding margin and clamps to image bounds
 *
 * @param {Object} bgRect - Background ROI { x0, y0, x1, y1 }
 * @param {Object} fgRect - Foreground ROI { x0, y0, x1, y1 }
 * @param {Number} imageWidth - Reference image width
 * @param {Number} imageHeight - Reference image height
 * @param {Number} margin - Padding margin in pixels (default 16)
 * @returns {Object} Bounding rectangle { x0, y0, x1, y1 }
 */
function computeRoiBoundingBox(bgRect, fgRect, imageWidth, imageHeight, margin) {
   if (margin === undefined) margin = 16;
   
   var bbox = {
      x0: Math.min(bgRect.x0, fgRect.x0),
      y0: Math.min(bgRect.y0, fgRect.y0),
      x1: Math.max(bgRect.x1, fgRect.x1),
      y1: Math.max(bgRect.y1, fgRect.y1)
   };
   
   // Add padding
   bbox.x0 = Math.max(0, bbox.x0 - margin);
   bbox.y0 = Math.max(0, bbox.y0 - margin);
   bbox.x1 = Math.min(imageWidth, bbox.x1 + margin);
   bbox.y1 = Math.min(imageHeight, bbox.y1 + margin);
   
   return bbox;
}

/**
 * Clean up temporary ROI cropped files
 *
 * @param {String} tempRootDir - Root temp directory containing filter subdirectories
 */
function cleanupTempRoiFiles(tempRootDir) {
   if (!File.directoryExists(tempRootDir)) {
      return;
   }
   
   try {
      console.writeln("");
      console.writeln("Cleaning up temporary ROI files...");
      File.remove(tempRootDir, true);  // Recursive delete
      console.writeln("Cleanup complete.");
   } catch (error) {
      console.warningln("Failed to clean up temp files: " + error.message);
      // Don't fail the script over cleanup errors
   }
}
