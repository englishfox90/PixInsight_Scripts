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
            continue;
         }
         
         subframes.push(metadata);
         
      } catch (error) {
         console.warningln("Error processing " + files[i] + ": " + error.message);
      }
   }
   
   console.writeln("  Progress: 100%");
   console.writeln("Found " + subframes.length + " subframes");
   
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
         }
      }
      
      // Close the window immediately
      window.forceClose();
      
      // Validate required fields
      if (exposure <= 0) {
         return null;
      }
      
      if (!dateObs) {
         // Use file modification time as fallback
         var fileInfo = new FileInfo(filePath);
         dateObs = fileInfo.lastModified.toString();
      }
      
      return {
         path: filePath,
         exposure: exposure,
         filter: filter,
         dateObs: dateObs
      };
      
   } catch (error) {
      return null;
   }
}
