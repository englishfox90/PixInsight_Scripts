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
   lines.push("label,nSubs,totalExposure_s,intTime_s,starRemovalTime_s,stretchTime_s,bgMean,bgMedian,bgSigma,fgMean,fgMedian,signalMeasured,signalRef,snrMeasured,snrStop,deltaSNRpct,deltaHours,gainPerHour,t10Hours,scaleFactor,bgMedianRaw,bgMedianScaled,globalMedian,globalNoise");
   
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
         r.bgMean.toFixed(8),
         (r.bgMedian !== undefined ? r.bgMedian.toFixed(8) : ""),
         r.bgSigma.toFixed(8),
         r.fgMean.toFixed(8),
         (r.fgMedian !== undefined ? r.fgMedian.toFixed(8) : ""),
         (r.signalMeasured !== undefined && r.signalMeasured !== null ? r.signalMeasured.toFixed(8) : ""),
         (r.signalRef !== undefined && r.signalRef !== null ? r.signalRef.toFixed(8) : ""),
         (r.snrMeasured !== undefined && r.snrMeasured !== null ? r.snrMeasured.toFixed(4) : ""),
         (r.snrStop !== undefined && r.snrStop !== null ? r.snrStop.toFixed(4) : r.snr.toFixed(4)),
         (r.deltaSNRpct !== undefined && r.deltaSNRpct !== null ? r.deltaSNRpct.toFixed(2) : ""),
         (r.deltaHours !== undefined && r.deltaHours !== null ? r.deltaHours.toFixed(4) : ""),
         (r.gainPerHour !== undefined && r.gainPerHour !== null ? r.gainPerHour.toFixed(2) : ""),
         (r.t10Hours !== undefined && r.t10Hours !== null && isFinite(r.t10Hours) ? r.t10Hours.toFixed(2) : ""),
         (r.scaleFactor !== undefined ? r.scaleFactor.toFixed(6) : "1.000000"),
         (r.bgMedianRaw !== undefined && r.bgMedianRaw !== null ? r.bgMedianRaw.toFixed(8) : ""),
         (r.bgMedianScaled !== undefined && r.bgMedianScaled !== null ? r.bgMedianScaled.toFixed(8) : ""),
         (r.globalMedian !== undefined && r.globalMedian !== null ? r.globalMedian.toFixed(8) : ""),
         (r.globalNoise !== undefined && r.globalNoise !== null ? r.globalNoise.toFixed(8) : "")
      ].join(","));
   }
   
   var content = lines.join("\n");
   var path = CONFIG.dataDir + "/snr_results" + filterSuffix + ".csv";
   
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
         applyStretch: CONFIG.applyStretch,
         lockSignalScale: CONFIG.lockSignalScale
      },
      rois: {
         background: rois.bg,
         foreground: rois.fg,
         bgRef: (rois.bgRef !== undefined ? rois.bgRef : null),
         bgRefSourceLabel: (rois.bgRefSourceLabel !== undefined ? rois.bgRefSourceLabel : null)
      },
      results: results,
      insights: insights
   };
   
   var json = JSON.stringify(data, null, 2);
   var path = CONFIG.dataDir + "/snr_results" + filterSuffix + ".json";
   
   return writeTextFile(path, json);
}

/**
 * Print results summary to console
 */
function printResultsSummary(results, signalRef, refLabel) {
   console.writeln("");
   console.writeln("=== DECISION SNR (Fixed Signal Reference) ===");
   console.writeln("");
   console.writeln("Decision SNR uses fixed signal from deepest stack to measure only noise improvement:");
   console.writeln("");
   console.writeln("              signalRef");
   console.writeln("  SNR_stop = -----------");
   console.writeln("             σ_BG(depth)");
   console.writeln("");
   console.writeln("  signalRef = median(FG_ref) − median(BG_ref)");
   console.writeln("  σ_BG(depth) = 1.4826 × MAD(background pixels)");
   console.writeln("");
   console.writeln("★ Decision SNR uses fixed signal from deepest stack:");
   console.writeln("  signalRef = " + signalRef.toFixed(8) + " at " + refLabel);
   console.writeln("");
   console.writeln("=== RESULTS SUMMARY ===");
   console.writeln("");
   console.writeln("Diminishing returns metric:");
   console.writeln("        100 × (SNRᵢ − SNRᵢ₋₁)");
   console.writeln("  ΔSNR% = --------------------");
   console.writeln("              SNRᵢ₋₁");
   console.writeln("");
   console.writeln("           ΔSNR%");
   console.writeln("  Gain/hr = ------");
   console.writeln("          Δt(hours)");
   console.writeln("");
   console.writeln("  T₁₀ = Δt × (10 / ΔSNR%)");
   console.writeln("");
   console.writeln(format("%-10s %8s %12s %10s %10s %12s %10s %10s %10s", "Label", "N Subs", "Total Exp", "SNR_meas", "SNR_stop", "Global Noise", "ΔSNR", "Gain/hr", "T10(hrs)"));
   console.writeln("-".repeat(110));
   
   for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var deltaSNRstr = (r.deltaSNRpct !== null && r.deltaSNRpct !== undefined) ? 
                        ("+" + r.deltaSNRpct.toFixed(1) + "%") : "--";
      var gainHrStr = (r.gainPerHour !== null && r.gainPerHour !== undefined) ? 
                      r.gainPerHour.toFixed(2) : "--";
      var globalNoiseStr = (r.globalNoise !== null && r.globalNoise !== undefined) ?
                           r.globalNoise.toFixed(6) : "--";
      var snrMeasStr = (r.snrMeasured !== null && r.snrMeasured !== undefined) ?
                       r.snrMeasured.toFixed(2) : r.snr.toFixed(2);
      var snrStopStr = (r.snrStop !== null && r.snrStop !== undefined) ?
                       r.snrStop.toFixed(2) : r.snr.toFixed(2);
      var t10HrsStr = (r.t10Hours !== null && r.t10Hours !== undefined && isFinite(r.t10Hours)) ?
                      r.t10Hours.toFixed(1) : "--";
      
      console.writeln(format("%-10s %8d %12s %10s %10s %12s %10s %10s %10s",
         r.label,
         r.depth,
         formatTime(r.totalExposure),
         snrMeasStr,
         snrStopStr,
         globalNoiseStr,
         deltaSNRstr,
         gainHrStr,
         t10HrsStr
      ));
   }
   
   console.writeln("");
   console.writeln("Note: SNR is ROI-dependent and used to evaluate relative improvement,");
   console.writeln("      not as a global image quality score.");
   console.writeln("      Global Noise is measured across the entire image using MAD estimator.");
   console.writeln("");
}

/**
 * Simple string formatting helper
 */
function format(template) {
   var args = Array.prototype.slice.call(arguments, 1);
   var argIndex = 0;
   
   return template.replace(/%(-?)(\d*)(?:\.(\d+))?([sdf])/g, function(match, leftAlign, width, precision, type) {
      if (argIndex >= args.length) return match;
      var value = args[argIndex++];
      var str;
      if (type === 'd') {
         str = Math.floor(value).toString();
      } else if (type === 'f') {
         var p = precision ? parseInt(precision, 10) : 0;
         str = Number(value).toFixed(p);
      } else {
         str = value.toString();
      }
      width = parseInt(width, 10) || 0;
      if (width > str.length) {
         var padding = new Array(width - str.length + 1).join(' ');
         str = leftAlign ? str + padding : padding + str;
      }
      return str;
   });
}
