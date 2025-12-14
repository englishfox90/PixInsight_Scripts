/*
 * SNRAnalysis-insights.js
 * Compute insights about SNR behavior and diminishing returns
 */

/**
 * Compute insights from SNR results
 */
function computeInsights(results) {
   if (results.length < 2) {
      return {
         summary: "Insufficient data for insights (need at least 2 depths)",
         recommendations: [],
         anomalies: []
      };
   }
   
   var insights = {
      improvements: [],
      diminishingReturns5pct: null,
      diminishingReturns10pct: null,
      gainPerHourStop: null,  // New: Gain/hr based stop recommendation
      recommendedRange: null,
      scalingExponent: null,
      projectedGains: null,
      needsMoreData: false,
      anomalies: [],
      summary: ""
   };
   
   // Compute per-depth improvements
   for (var i = 1; i < results.length; i++) {
      var prev = results[i - 1];
      var curr = results[i];
      
      var improvement = ((curr.snr - prev.snr) / prev.snr) * 100;
      insights.improvements.push({
         fromLabel: prev.label,
         toLabel: curr.label,
         improvementPct: improvement
      });
      
      // Detect diminishing returns thresholds
      if (insights.diminishingReturns10pct === null && improvement < 10) {
         insights.diminishingReturns10pct = curr.label;
      }
      if (insights.diminishingReturns5pct === null && improvement < 5) {
         insights.diminishingReturns5pct = curr.label;
      }
      
      // Detect anomalies (SNR decrease)
      if (improvement < -1) {
         insights.anomalies.push({
            label: curr.label,
            issue: "SNR decreased by " + Math.abs(improvement).toFixed(1) + "% - possible bad subs"
         });
      }
   }
   
   // Compute Gain per Hour stop recommendation
   insights.gainPerHourStop = computeGainPerHourStop(results);
   
   // Compute scaling exponent via log-log linear fit
   insights.scalingExponent = computeScalingExponent(results);
   
   // Check if more integration time would be beneficial
   insights.projectedGains = projectFutureGains(results, insights);
   
   // Determine recommended range
   insights.recommendedRange = determineRecommendedRange(results, insights);
   
   // Generate summary text
   insights.summary = generateInsightsSummary(results, insights);
   
   return insights;
}

/**
 * Compute Gain per Hour stop recommendation
 * Returns the first depth where Gain/hr < threshold for confirmSteps consecutive steps
 */
function computeGainPerHourStop(results) {
   var gainThreshold = 2.0;  // percent per hour
   var confirmSteps = 2;     // consecutive steps below threshold
   
   if (results.length < 2) {
      return null;
   }
   
   var consecutiveBelowCount = 0;
   var recommendedStopLabel = null;
   
   for (var i = 1; i < results.length; i++) {
      var r = results[i];
      
      if (r.gainPerHour !== null && r.gainPerHour !== undefined) {
         if (r.gainPerHour < gainThreshold) {
            consecutiveBelowCount++;
            
            if (consecutiveBelowCount >= confirmSteps) {
               // Found the stop point - use the depth BEFORE this decline started
               var stopIndex = Math.max(0, i - confirmSteps);
               recommendedStopLabel = results[stopIndex].label;
               break;
            }
         } else {
            // Reset counter if gain is above threshold
            consecutiveBelowCount = 0;
         }
      }
   }
   
   // If never crossed threshold, recommend the deepest integration tested
   if (recommendedStopLabel === null) {
      recommendedStopLabel = results[results.length - 1].label;
   }
   
   return {
      stopLabel: recommendedStopLabel,
      threshold: gainThreshold,
      confirmSteps: confirmSteps
   };
}

/**
 * Compute scaling exponent (SNR ~ N^exponent)
 * Ideal sqrt(N) behavior would give exponent ≈ 0.5
 */
function computeScalingExponent(results) {
   if (results.length < 3) return null;
   
   // Prepare data for linear regression in log-log space
   var logN = [];
   var logSNR = [];
   
   for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (r && r.depth > 0 && r.snr > 0) {
         logN.push(Math.log(r.depth));
         logSNR.push(Math.log(r.snr));
      }
   }
   
   if (logN.length < 3) return null;
   
   // Linear regression: logSNR = slope * logN + intercept
   var n = logN.length;
   var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
   
   for (var i = 0; i < n; i++) {
      sumX += logN[i];
      sumY += logSNR[i];
      sumXY += logN[i] * logSNR[i];
      sumX2 += logN[i] * logN[i];
   }
   
   var denom = (n * sumX2 - sumX * sumX);
   if (denom === 0) return null;

   var slope = (n * sumXY - sumX * sumY) / denom;
   if (!isFinite(slope)) return null;

   return slope;
}

/**
 * Project potential SNR gains with additional integration time
 */
function projectFutureGains(results, insights) {
   if (results.length < 2 || !insights || typeof insights.scalingExponent !== "number" || !isFinite(insights.scalingExponent)) {
      return null;
   }
   
   var lastResult = results[results.length - 1];
   var lastImprovement = insights.improvements[insights.improvements.length - 1];
   var lastPct = lastImprovement.improvementPct;
   
   var currentDepth = lastResult.depth;
   var currentSNR = lastResult.snr;
   var exponent = insights.scalingExponent;
   
   // Calculate exposure per sub for planning additional captures
   var exposurePerSub = lastResult.totalExposure / lastResult.depth;
   
   var depth2x = currentDepth * 2;
   var depth3x = currentDepth * 3;
   
   var snr2x = currentSNR * Math.pow(2, exponent);
   var snr3x = currentSNR * Math.pow(3, exponent);
   
   var gain2x = ((snr2x - currentSNR) / currentSNR) * 100;
   var gain3x = ((snr3x - currentSNR) / currentSNR) * 100;
   
   var time2x = lastResult.totalExposure * 2;
   var time3x = lastResult.totalExposure * 3;
   
   // Calculate additional subs needed at current exposure rate
   var additionalSubs2x = Math.ceil(lastResult.totalExposure / exposurePerSub);
   var additionalSubs3x = Math.ceil((lastResult.totalExposure * 2) / exposurePerSub);
   
   // Flag strong or modest depending on last step gain
   var category = (lastPct >= 10) ? "strong" : (lastPct >= 2 ? "modest" : "weak");
   if (category === "strong") {
      insights.needsMoreData = true;
   }
   
   return {
      category: category,
      lastImprovementPct: lastPct,
      currentDepth: currentDepth,
      currentSNR: currentSNR,
      exposurePerSub: exposurePerSub,
      projection2x: {
         depth: depth2x,
         snr: snr2x,
         gain: gain2x,
         totalTime: time2x,
         additionalTime: lastResult.totalExposure,
         additionalSubs: additionalSubs2x
      },
      projection3x: {
         depth: depth3x,
         snr: snr3x,
         gain: gain3x,
         totalTime: time3x,
         additionalTime: lastResult.totalExposure * 2,
         additionalSubs: additionalSubs3x
      }
   };
}

/**
 * Determine recommended integration range
 */
function determineRecommendedRange(results, insights) {
   // Find the point where we reach 90-95% of maximum SNR
   var maxSNR = 0;
   for (var i = 0; i < results.length; i++) {
      if (results[i].snr > maxSNR) maxSNR = results[i].snr;
   }
   
   var target90 = maxSNR * 0.90;
   var target95 = maxSNR * 0.95;
   
   var range90 = null;
   var range95 = null;
   
   for (var i = 0; i < results.length; i++) {
      if (range90 === null && results[i].snr >= target90) {
         range90 = results[i].label;
      }
      if (range95 === null && results[i].snr >= target95) {
         range95 = results[i].label;
      }
   }
   
   if (range90 && range95) {
      return {
         min: range90,
         max: range95,
         minExposure: results[findResultIndex(results, range90)].totalExposure,
         maxExposure: results[findResultIndex(results, range95)].totalExposure
      };
   }
   
   return null;
}

/**
 * Generate human-readable insights summary
 */
function generateInsightsSummary(results, insights) {
   var lines = [];
   
   lines.push("SNR ANALYSIS INSIGHTS");
   lines.push("=====================");
   lines.push("");
   
   // Scaling behavior (moved up before efficiency metrics)
   if (insights.scalingExponent !== null) {
      var exp = insights.scalingExponent;
      var comparison = "";
      var warning = "";
      
      if (exp >= 0.45 && exp <= 0.55) {
         comparison = " (close to ideal sqrt(N) behavior)";
      } else if (exp < 0.3) {
         comparison = " (much slower than sqrt(N))";
         warning = "  Warning: exponent deviates from sqrt(t); check background mask/ROI or correlated noise";
      } else if (exp < 0.45) {
         comparison = " (slower than sqrt(N))";
         warning = "  Warning: exponent deviates from sqrt(t); check background mask/ROI or correlated noise";
      } else if (exp > 0.6) {
         comparison = " (faster than sqrt(N) - unusual)";
         warning = "  Warning: exponent deviates from sqrt(t); check background mask/ROI or correlated noise";
      }
      
      lines.push("Scaling exponent: " + exp.toFixed(2) + comparison);
      if (warning) {
         lines.push(warning);
      }
      lines.push("");
   }
   
   // Efficiency by hours
   lines.push("Efficiency by hours:");
   lines.push("");
   
   // Last step efficiency
   if (results.length >= 2) {
      var lastResult = results[results.length - 1];
      var lastDelta = lastResult.deltaSNRpct || 0;
      var lastHours = lastResult.deltaHours || 0;
      var lastGain = lastResult.gainPerHour || 0;
      var lastT10 = lastResult.t10Hours || Infinity;
      
      lines.push("Last step efficiency:");
      lines.push("  +" + lastDelta.toFixed(1) + "% over " + lastHours.toFixed(1) + "h = " + 
                 lastGain.toFixed(1) + "%/hr");
      if (isFinite(lastT10)) {
         lines.push("  At this rate: ~T10 = " + lastT10.toFixed(1) + " hours for +10% more SNR");
      } else {
         lines.push("  At this rate: ~T10 = infinite hours (gain too small)");
      }
      lines.push("");
   }
   
   // Best step efficiency
   if (results.length >= 2) {
      var bestGain = 0;
      var bestIndex = -1;
      for (var i = 1; i < results.length; i++) {
         if (results[i].gainPerHour !== null && results[i].gainPerHour > bestGain) {
            bestGain = results[i].gainPerHour;
            bestIndex = i;
         }
      }
      
      if (bestIndex > 0) {
         var bestResult = results[bestIndex];
         var prevLabel = results[bestIndex - 1].label;
         lines.push("Best efficiency:");
         lines.push("  +" + bestResult.deltaSNRpct.toFixed(1) + "% over " + 
                    bestResult.deltaHours.toFixed(1) + "h = " + 
                    bestResult.gainPerHour.toFixed(1) + "%/hr (" + 
                    prevLabel + " -> " + bestResult.label + ")");
         lines.push("");
      }
   }
   
   // Diminishing returns status
   if (insights.gainPerHourStop) {
      var stopLabel = insights.gainPerHourStop.stopLabel;
      var threshold = insights.gainPerHourStop.threshold;
      var confirmSteps = insights.gainPerHourStop.confirmSteps;
      
      var isMaxDepth = (stopLabel === results[results.length - 1].label);
      
      lines.push("Diminishing returns:");
      if (isMaxDepth) {
         lines.push("  Not yet reached (threshold " + threshold.toFixed(1) + "%/hr)");
         if (results.length >= 2) {
            var currentGain = results[results.length - 1].gainPerHour || 0;
            lines.push("  Current = " + currentGain.toFixed(1) + "%/hr");
         }
      } else {
         lines.push("  Reached at " + stopLabel + " (Gain/hr < " + threshold.toFixed(1) + 
                    "%/hr for " + confirmSteps + " consecutive steps)");
      }
      lines.push("");
      
      // Recommended stop depth
      lines.push("Recommended stop depth: " + stopLabel);
      var stopIndex = findResultIndex(results, stopLabel);
      if (stopIndex >= 0) {
         var stopTime = formatTime(results[stopIndex].totalExposure);
         if (isMaxDepth) {
            lines.push("  (" + stopTime + ") (Deepest analyzed)");
         } else {
            lines.push("  (" + stopTime + ")");
         }
      }
      lines.push("");
   }
   
   // Future projections if more data would be beneficial
   if (insights.projectedGains && insights.projectedGains.category === "strong") {
      lines.push("ADDITIONAL INTEGRATION RECOMMENDED:");
      var proj = insights.projectedGains;
      
      lines.push("  Current: " + proj.currentDepth + " subs, SNR = " + proj.currentSNR.toFixed(2));
      lines.push("  Doubling integration (" + formatTime(proj.projection2x.totalTime) + " total):");
      lines.push("    -> Projected SNR: " + proj.projection2x.snr.toFixed(2) + 
                 " (+" + proj.projection2x.gain.toFixed(1) + "% gain)");
      lines.push("    -> Additional time needed: " + formatTime(proj.projection2x.additionalTime) + 
                 " (" + proj.projection2x.additionalSubs + " more subs)");
      
      lines.push("  Tripling integration (" + formatTime(proj.projection3x.totalTime) + " total):");
      lines.push("    -> Projected SNR: " + proj.projection3x.snr.toFixed(2) + 
                 " (+" + proj.projection3x.gain.toFixed(1) + "% gain)");
      lines.push("    -> Additional time needed: " + formatTime(proj.projection3x.additionalTime) + 
                 " (" + proj.projection3x.additionalSubs + " more subs)");
      
      lines.push("");
      lines.push("  Note: Last depth showed " + insights.improvements[insights.improvements.length - 1].improvementPct.toFixed(1) + 
                 "% improvement - more data recommended");
   } else if (insights.projectedGains && insights.projectedGains.category === "modest") {
      lines.push("MODEST GAINS POSSIBLE:");
      var proj = insights.projectedGains;
      lines.push("  Last step gain: " + proj.lastImprovementPct.toFixed(1) + "%");
      lines.push("  Doubling integration (" + formatTime(proj.projection2x.totalTime) + " total):");
      lines.push("    -> Projected SNR: " + proj.projection2x.snr.toFixed(2) + 
                 " (+" + proj.projection2x.gain.toFixed(1) + "% gain)");
      lines.push("    -> Additional time needed: " + formatTime(proj.projection2x.additionalTime) + 
                 " (" + proj.projection2x.additionalSubs + " more subs)");
      lines.push("  Tripling integration (" + formatTime(proj.projection3x.totalTime) + " total):");
      lines.push("    -> Projected SNR: " + proj.projection3x.snr.toFixed(2) + 
                 " (+" + proj.projection3x.gain.toFixed(1) + "% gain)");
      lines.push("    -> Additional time needed: " + formatTime(proj.projection3x.additionalTime) + 
                 " (" + proj.projection3x.additionalSubs + " more subs)");
   } else {
      lines.push("INTEGRATION STATUS:");
      lines.push("  Diminishing returns reached - additional integration may not be cost-effective");
   }
   
   // Anomalies
   if (insights.anomalies.length > 0) {
      lines.push("");
      lines.push("ANOMALIES DETECTED:");
      for (var i = 0; i < insights.anomalies.length; i++) {
         lines.push("  - " + insights.anomalies[i].label + ": " + insights.anomalies[i].issue);
      }
   }
   
   return lines.join("\n");
}

/**
 * Print insights to console
 */
function printInsights(insights) {
   if (!insights) return;
   
   console.writeln("");
   
   // Print Gain/hr stop recommendation
   if (insights.gainPerHourStop) {
      console.writeln("=== GAIN PER HOUR RECOMMENDATION ===");
      console.writeln("");
      console.writeln("Recommended stop point: " + insights.gainPerHourStop.stopLabel);
      console.writeln("  (Based on Gain/hr falling below " + insights.gainPerHourStop.threshold.toFixed(1) + "% per hour");
      console.writeln("   for " + insights.gainPerHourStop.confirmSteps + " consecutive integration steps)");
      console.writeln("");
   }
   
   console.writeln(insights.summary);
   console.writeln("");
}

/**
 * Find result index by label
 */
function findResultIndex(results, label) {
   for (var i = 0; i < results.length; i++) {
      if (results[i].label === label) return i;
   }
   return -1;
}
