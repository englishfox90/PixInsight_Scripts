/*
 * SNRAnalysis-depth-planner.js
 * Integration depth planning strategies
 */

/**
 * Generate integration depth plan based on strategy
 * 
 * @param {string} strategy - Strategy name
 * @param {number} maxSubs - Maximum number of available subs
 * @param {string} customList - Comma-separated custom depths (for custom strategy)
 * @param {boolean} includeFullDepth - If true, ensure a final depth with all subs
 * @returns {Array} Array of job objects with depth and calculated exposure
 */
function planIntegrationDepths(strategy, maxSubs, customList, includeFullDepth) {
   var depths = [];
   
   switch (strategy) {
      case "preset_osc":
         depths = generatePresetOSC(maxSubs);
         break;
      case "doubling":
         depths = generateDoubling(maxSubs);
         break;
      case "fibonacci":
         depths = generateFibonacci(maxSubs);
         break;
      case "logarithmic":
         depths = generateLogarithmic(maxSubs);
         break;
      case "custom":
         depths = parseCustomDepths(customList, maxSubs);
         break;
      default:
         throw new Error("Unknown depth strategy: " + strategy);
   }
   
    // Optionally append a full-depth stack using all subs
    if (includeFullDepth && maxSubs > 0) {
      var found = false;
      for (var d = 0; d < depths.length; d++) {
         if (depths[d] === maxSubs) { found = true; break; }
      }
      if (!found) {
         depths.push(maxSubs);
      }
    }
   
    // Ensure ascending order after possible append
    depths.sort(function(a, b) { return a - b; });
   
   // Create job objects
   var jobs = [];
   for (var i = 0; i < depths.length; i++) {
      jobs.push({
         label: "N" + depths[i],
         depth: depths[i],
         totalExposure: 0,  // Will be calculated when subframes are known
         integrationTime: 0,
         starRemovalTime: 0,
         stretchTime: 0,
         bgMedian: 0,
         fgMedian: 0,
         fgSigma: 0,
         snr: 0
      });
   }
   
   return jobs;
}

/**
 * Preset OSC depths: 12, 24, 48, 96, 192, 384, 720
 */
function generatePresetOSC(maxSubs) {
   var preset = [12, 24, 48, 96, 192, 384, 720];
   var result = [];
   
   for (var i = 0; i < preset.length; i++) {
      if (preset[i] <= maxSubs) {
         result.push(preset[i]);
      }
   }
   
   // Ensure we have at least one depth
   if (result.length === 0 && maxSubs >= 8) {
      result.push(Math.min(maxSubs, 12));
   }
   
   return result;
}

/**
 * Doubling sequence: 8, 16, 32, 64, 128, 256, ...
 */
function generateDoubling(maxSubs) {
   var result = [];
   var depth = 8;
   
   while (depth <= maxSubs) {
      result.push(depth);
      depth *= 2;
   }
   
   // Ensure we have at least one depth
   if (result.length === 0 && maxSubs >= 4) {
      result.push(Math.min(maxSubs, 8));
   }
   
   return result;
}

/**
 * Fibonacci sequence up to maxSubs
 */
function generateFibonacci(maxSubs) {
   var result = [];
   var a = 8;  // Start at 8 instead of 1
   var b = 13;
   
   if (maxSubs >= 8) result.push(8);
   
   while (b <= maxSubs) {
      result.push(b);
      var next = a + b;
      a = b;
      b = next;
   }
   
   return result;
}

/**
 * Logarithmic progression: 5-8 exponentially spaced values
 */
function generateLogarithmic(maxSubs) {
   var result = [];
   var minDepth = Math.min(8, maxSubs);
   var numSteps = 7;
   
   if (maxSubs < minDepth) {
      return [maxSubs];
   }
   
   // Calculate exponential spacing
   var logMin = Math.log(minDepth);
   var logMax = Math.log(maxSubs);
   var step = (logMax - logMin) / (numSteps - 1);
   
   for (var i = 0; i < numSteps; i++) {
      var logVal = logMin + i * step;
      var depth = Math.round(Math.exp(logVal));
      
      // Avoid duplicates
      if (result.length === 0 || depth > result[result.length - 1]) {
         if (depth <= maxSubs) {
            result.push(depth);
         }
      }
   }
   
   return result;
}

/**
 * Parse custom depth list
 */
function parseCustomDepths(customList, maxSubs) {
   if (!customList || customList.trim().length === 0) {
      throw new Error("Custom depth list is empty");
   }
   
   var parts = customList.split(",");
   var depths = [];
   var seen = {};
   
   for (var i = 0; i < parts.length; i++) {
      var val = parseInt(parts[i].trim(), 10);
      
      if (isNaN(val) || val <= 0) {
         console.warningln("Invalid custom depth value: " + parts[i]);
         continue;
      }
      
      if (val > maxSubs) {
         console.warningln("Custom depth " + val + " exceeds available subs (" + maxSubs + "), clamping");
         val = maxSubs;
      }
      
      // Deduplicate
      if (!seen[val]) {
         depths.push(val);
         seen[val] = true;
      }
   }
   
   if (depths.length === 0) {
      throw new Error("No valid custom depths found");
   }
   
   // Sort
   depths.sort(function(a, b) { return a - b; });
   
   return depths;
}

/**
 * Calculate total exposure for each job based on subframes
 */
function calculateJobExposures(jobs, subframes) {
   for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      var totalExp = 0;
      
      for (var j = 0; j < job.depth && j < subframes.length; j++) {
         totalExp += subframes[j].exposure;
      }
      
      job.totalExposure = totalExp;
   }
}
