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
 * Compute scaling exponent (SNR ~ N^exponent)
 * Ideal sqrt(N) behavior would give exponent ≈ 0.5
 */
function computeScalingExponent(results) {
   if (results.length < 3) return null;
   
   // Prepare data for linear regression in log-log space
   var logN = [];
   var logSNR = [];
   
   for (var i = 0; i < results.length; i++) {
      if (results[i].snr > 0) {
         logN.push(Math.log(results[i].depth));
         logSNR.push(Math.log(results[i].snr));
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
   
   var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
   
   return slope;
}

/**
 * Project potential SNR gains with additional integration time
 */
function projectFutureGains(results, insights) {
   if (results.length < 2 || !insights.scalingExponent) {
      return null;
   }
   
   var lastResult = results[results.length - 1];
   var lastImprovement = insights.improvements[insights.improvements.length - 1];
   var lastPct = lastImprovement.improvementPct;
   
   var currentDepth = lastResult.depth;
   var currentSNR = lastResult.snr;
   var exponent = insights.scalingExponent;
   
   var depth2x = currentDepth * 2;
   var depth3x = currentDepth * 3;
   
   var snr2x = currentSNR * Math.pow(2, exponent);
   var snr3x = currentSNR * Math.pow(3, exponent);
   
   var gain2x = ((snr2x - currentSNR) / currentSNR) * 100;
   var gain3x = ((snr3x - currentSNR) / currentSNR) * 100;
   
   var time2x = lastResult.totalExposure * 2;
   var time3x = lastResult.totalExposure * 3;
   
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
      projection2x: {
         depth: depth2x,
         snr: snr2x,
         gain: gain2x,
         totalTime: time2x,
         additionalTime: lastResult.totalExposure
      },
      projection3x: {
         depth: depth3x,
         snr: snr3x,
         gain: gain3x,
         totalTime: time3x,
         additionalTime: lastResult.totalExposure * 2
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
   
   // Diminishing returns
   if (insights.diminishingReturns10pct) {
      var idx = findResultIndex(results, insights.diminishingReturns10pct);
      lines.push("• SNR improvements drop below 10% after " + insights.diminishingReturns10pct + 
                 " (" + formatTime(results[idx].totalExposure) + ")");
   }
   
   if (insights.diminishingReturns5pct) {
      var idx = findResultIndex(results, insights.diminishingReturns5pct);
      lines.push("• SNR improvements drop below 5% after " + insights.diminishingReturns5pct + 
                 " (" + formatTime(results[idx].totalExposure) + ")");
   }
   
   // Recommended range
   if (insights.recommendedRange) {
      lines.push("• Recommended integration range: " + 
                 formatTime(insights.recommendedRange.minExposure) + " - " +
                 formatTime(insights.recommendedRange.maxExposure) +
                 " (90-95% of max SNR)");
   }
   
   // Scaling behavior
   if (insights.scalingExponent !== null) {
      var exp = insights.scalingExponent;
      var comparison = "";
      if (exp >= 0.45 && exp <= 0.55) {
         comparison = " (close to ideal √N behavior)";
      } else if (exp < 0.45) {
         comparison = " (slower than √N - possible systematic issues)";
      } else {
         comparison = " (faster than √N - unusual, verify data)";
      }
      lines.push("• Scaling exponent: " + exp.toFixed(2) + comparison);
   }
   
   // Future projections if more data would be beneficial
   if (insights.projectedGains && insights.projectedGains.category === "strong") {
      lines.push("");
      lines.push("ADDITIONAL INTEGRATION RECOMMENDED:");
      var proj = insights.projectedGains;
      
      lines.push("• Current: " + proj.currentDepth + " subs, SNR = " + proj.currentSNR.toFixed(2));
      lines.push("• Doubling integration (" + formatTime(proj.projection2x.totalTime) + " total):");
      lines.push("    → Projected SNR: " + proj.projection2x.snr.toFixed(2) + 
                 " (+" + proj.projection2x.gain.toFixed(1) + "% gain)");
      lines.push("    → Additional time needed: " + formatTime(proj.projection2x.additionalTime));
      
      lines.push("• Tripling integration (" + formatTime(proj.projection3x.totalTime) + " total):");
      lines.push("    → Projected SNR: " + proj.projection3x.snr.toFixed(2) + 
                 " (+" + proj.projection3x.gain.toFixed(1) + "% gain)");
      lines.push("    → Additional time needed: " + formatTime(proj.projection3x.additionalTime));
      
      lines.push("");
      lines.push("  Note: Last depth showed " + insights.improvements[insights.improvements.length - 1].improvementPct.toFixed(1) + 
                 "% improvement - more data recommended");
   } else if (insights.projectedGains && insights.projectedGains.category === "modest") {
      lines.push("");
      lines.push("MODEST GAINS POSSIBLE:");
      var proj = insights.projectedGains;
      lines.push("• Last step gain: " + proj.lastImprovementPct.toFixed(1) + "%");
      lines.push("• Doubling integration (" + formatTime(proj.projection2x.totalTime) + " total):");
      lines.push("    → Projected SNR: " + proj.projection2x.snr.toFixed(2) + 
                 " (" + proj.projection2x.gain.toFixed(1) + "% gain)");
      lines.push("    → Additional time needed: " + formatTime(proj.projection2x.additionalTime));
      lines.push("• Tripling integration (" + formatTime(proj.projection3x.totalTime) + " total):");
      lines.push("    → Projected SNR: " + proj.projection3x.snr.toFixed(2) + 
                 " (" + proj.projection3x.gain.toFixed(1) + "% gain)");
      lines.push("    → Additional time needed: " + formatTime(proj.projection3x.additionalTime));
   } else {
      lines.push("");
      lines.push("INTEGRATION STATUS:");
      lines.push("• Diminishing returns reached - additional integration may not be cost-effective");
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
