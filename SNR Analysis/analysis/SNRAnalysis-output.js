/*
 * SNRAnalysis-output.js
 * CSV and JSON output generation
 */

/**
 * Write results to CSV file
 */
function writeCSV(results, outputDir, filterSuffix) {
   filterSuffix = filterSuffix || "";
   var lines = [];
   
   // Header
   lines.push("label,nSubs,totalExposure_s,intTime_s,starRemovalTime_s,stretchTime_s,bgMedian,fgMedian,fgSigma,snr");
   
   // Data rows
   for (var i = 0; i < results.length; i++) {
      var r = results[i];
      lines.push([
         r.label,
         r.depth,
         r.totalExposure.toFixed(1),
         r.integrationTime.toFixed(2),
         r.starRemovalTime.toFixed(2),
         r.stretchTime.toFixed(2),
         r.bgMedian.toFixed(8),
         r.fgMedian.toFixed(8),
         r.fgSigma.toFixed(8),
         r.snr.toFixed(4)
      ].join(","));
   }
   
   var content = lines.join("\n");
   var path = outputDir + "/snr_results" + filterSuffix + ".csv";
   
   return writeTextFile(path, content);
}

/**
 * Write results to JSON file with full metadata
 */
function writeJSON(results, rois, insights, outputDir, filterSuffix) {
   filterSuffix = filterSuffix || "";
   var data = {
      version: SCRIPT_VERSION,
      timestamp: new Date().toISOString(),
      settings: {
         inputDir: CONFIG.inputDir,
         filePattern: CONFIG.filePattern,
         analyzeAllFilters: CONFIG.analyzeAllFilters,
         depthStrategy: CONFIG.depthStrategy,
         customDepths: CONFIG.customDepths,
         generateStarless: CONFIG.generateStarless,
         starRemovalMethod: CONFIG.starRemovalMethod,
         applyStretch: CONFIG.applyStretch
      },
      rois: {
         background: rois.bg,
         foreground: rois.fg
      },
      results: results,
      insights: insights
   };
   
   var json = JSON.stringify(data, null, 2);
   var path = outputDir + "/snr_results" + filterSuffix + ".json";
   
   return writeTextFile(path, json);
}

/**
 * Print results summary to console
 */
function printResultsSummary(results) {
   console.writeln("");
   console.writeln("=== RESULTS SUMMARY ===");
   console.writeln("");
   console.writeln(format("%-10s %8s %12s %10s", "Label", "N Subs", "Total Exp", "SNR"));
   console.writeln("-".repeat(50));
   
   for (var i = 0; i < results.length; i++) {
      var r = results[i];
      console.writeln(format("%-10s %8d %12s %10.2f",
         r.label,
         r.depth,
         formatTime(r.totalExposure),
         r.snr
      ));
   }
   
   console.writeln("");
}

/**
 * Simple string formatting helper
 */
function format(template) {
   var args = Array.prototype.slice.call(arguments, 1);
   var argIndex = 0;
   
   return template.replace(/%(-?)(\d*)([sd])/g, function(match, leftAlign, width, type) {
      if (argIndex >= args.length) return match;
      
      var value = args[argIndex++];
      var str = type === 'd' ? Math.floor(value).toString() : value.toString();
      
      width = parseInt(width, 10) || 0;
      if (width > str.length) {
         var padding = new Array(width - str.length + 1).join(' ');
         str = leftAlign ? str + padding : padding + str;
      }
      
      return str;
   });
}
