/*
 * SNRAnalysis-subframe-scanner.js
 * Subframe discovery and metadata extraction
 */

/**
 * Scans a directory for calibrated subframes and extracts metadata
 * 
 * @param {string} dirPath - Directory to scan
 * @param {string} pattern - File pattern (e.g., "*.xisf;*.fits")
 * @param {boolean} groupByFilter - If true, group subframes by FILTER header
 * @returns {Object|Array} If groupByFilter=true, returns {filterName: [subframes]}, else returns [subframes]
 */
function scanSubframes(dirPath, pattern, groupByFilter) {
   var subframes = [];
   var skippedNonLight = 0;
   var skippedInvalid = 0;
   
   // Parse file pattern into extensions
   var patterns = pattern.split(";");
   var extensions = [];
   for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i].trim();
      if (p.startsWith("*")) {
         extensions.push(p.substring(1).toLowerCase());
      }
   }
   
   // Recursively find files
   var files = findFilesRecursive(dirPath, extensions);
   
   console.writeln("Found " + files.length + " files matching pattern");
   console.writeln("Extracting metadata (this may take a moment for large datasets)...");
   
   // Extract metadata from each file
   var progressInterval = Math.max(1, Math.floor(files.length / 10));
   
   for (var i = 0; i < files.length; i++) {
      // Progress feedback every 10%
      if (i > 0 && i % progressInterval === 0) {
         console.write(format("  Progress: %d%%\r", Math.floor((i / files.length) * 100)));
         processEvents();
      }
      
      try {
         var metadata = extractSubframeMetadata(files[i]);
         
         if (!metadata) {
            console.warningln("Skipping " + File.extractName(files[i]) + " (failed to read metadata)");
            skippedInvalid++;
            continue;
         }
         
         if (!metadata.isLight) {
            console.warningln("Skipping " + File.extractName(files[i]) + " (IMAGETYP='" + metadata.imageType + "')");
            skippedNonLight++;
            continue;
         }
         
         subframes.push(metadata);
         
      } catch (error) {
         console.warningln("Error processing " + files[i] + ": " + error.message);
         skippedInvalid++;
      }
   }
   
   console.writeln("  Progress: 100%");
   console.writeln("Found " + subframes.length + " subframes");
   if (skippedNonLight > 0) console.writeln("Skipped " + skippedNonLight + " non-light frames");
   if (skippedInvalid > 0) console.writeln("Skipped " + skippedInvalid + " unreadable frames");
   
   // Sort by date-obs
   subframes.sort(function(a, b) {
      if (a.dateObs < b.dateObs) return -1;
      if (a.dateObs > b.dateObs) return 1;
      return 0;
   });
   
   // Group by filter if requested
   if (groupByFilter) {
      var filterGroups = {};
      for (var i = 0; i < subframes.length; i++) {
         var sub = subframes[i];
         var filterName = sub.filter || "Unknown";
         
         if (!filterGroups[filterName]) {
            filterGroups[filterName] = [];
         }
         filterGroups[filterName].push(sub);
      }
      
      // Log filter groups
      console.writeln("\nFilter groups found:");
      for (var filterName in filterGroups) {
         console.writeln("  " + filterName + ": " + filterGroups[filterName].length + " subframes");
      }
      
      return filterGroups;
   }
   
   return subframes;
}

/**
 * Recursively find files with given extensions
 */
function findFilesRecursive(dirPath, extensions) {
   var results = [];
   
   var find = new FileFind();
   if (find.begin(dirPath + "/*")) {
      do {
         var name = find.name;
         if (name === "." || name === "..") continue;
         
         var fullPath = dirPath + "/" + name;
         
         if (find.isDirectory) {
            // Recurse into subdirectory
            var subResults = findFilesRecursive(fullPath, extensions);
            results = results.concat(subResults);
         } else {
            // Check if file has matching extension
            for (var i = 0; i < extensions.length; i++) {
               if (name.toLowerCase().endsWith(extensions[i])) {
                  results.push(fullPath);
                  break;
               }
            }
         }
      } while (find.next());
   }
   
   return results;
}

/**
 * Extract metadata from a single subframe
 */
var __snrExposureUnitConversionNotified = false;

function normalizeExposureSeconds(exposureValue) {
   if (typeof exposureValue !== "number" || !isFinite(exposureValue) || exposureValue <= 0)
      return 0;

   // Heuristic:
   // - Some producers write EXPTIME/EXPOSURE in milliseconds (e.g. 600000 for 600s)
   // - Some write microseconds (e.g. 600000000 for 600s)
   // We only convert when values are very large and cleanly divisible.
   if (exposureValue > 10000) {
      var rounded = Math.round(exposureValue);
      if (Math.abs(exposureValue - rounded) < 1.0e-6) {
         // milliseconds
         if (rounded % 1000 === 0) {
            var secFromMs = rounded / 1000;
            if (secFromMs > 0 && secFromMs <= 20000)
               return secFromMs;
         }
         // microseconds
         if (rounded % 1000000 === 0) {
            var secFromUs = rounded / 1000000;
            if (secFromUs > 0 && secFromUs <= 20000)
               return secFromUs;
         }
      }
   }

   return exposureValue;
}

function extractSubframeMetadata(filePath) {
   try {
      // Fast keyword-only reading without loading image data
      var extension = File.extractExtension(filePath).toLowerCase();
      
      // Use ImageWindow.open with keywordsOnly flag for fast metadata reading
      var keywordsOnly = true;
      var windows = ImageWindow.open(filePath, "", "", keywordsOnly);
      
      if (!windows || windows.length === 0) {
         return null;
      }
      
      var window = windows[0];
      var keywords = window.keywords;
      
      var exposure = 0;
      var filter = "";
      var dateObs = "";
      var imageType = "";
      
      // Extract keywords
      for (var i = 0; i < keywords.length; i++) {
         var key = keywords[i];
         var name = key.name.toUpperCase();
         
         if (name === "EXPTIME" || name === "EXPOSURE") {
            exposure = parseFloat(key.value);
         } else if (name === "FILTER") {
            filter = key.value.trim();
         } else if (name === "DATE-OBS") {
            dateObs = key.value.trim();
         } else if (name === "IMAGETYP" || name === "IMAGETYPE" || name === "FRAME") {
            imageType = key.value.trim();
         }
      }
      
      // Close the window immediately
      window.forceClose();
      
      // Normalize and validate required fields
      var normalizedExposure = normalizeExposureSeconds(exposure);
      if (normalizedExposure !== exposure && !__snrExposureUnitConversionNotified) {
         __snrExposureUnitConversionNotified = true;
         console.warningln("Exposure keyword appears to be in ms/us for some files; converting to seconds for calculations.");
      }

      exposure = normalizedExposure;

      if (exposure <= 0) {
         return null;
      }
      
      if (!dateObs) {
         // Use file modification time as fallback
         var fileInfo = new FileInfo(filePath);
         dateObs = fileInfo.lastModified.toString();
      }
   
      var imageTypeUpper = imageType.toUpperCase();
      var isLight = (imageTypeUpper.indexOf("LIGHT") !== -1);
   
      if (!isLight) {
         // Not a light frame; return metadata with flag so caller can decide
         return {
            path: filePath,
            exposure: exposure,
            filter: filter,
            dateObs: dateObs,
            imageType: imageType,
            isLight: false
         };
      }
      
      return {
         path: filePath,
         exposure: exposure,
         filter: filter,
         dateObs: dateObs,
         imageType: imageType || "",
         isLight: true
      };
      
   } catch (error) {
      return null;
   }
}
