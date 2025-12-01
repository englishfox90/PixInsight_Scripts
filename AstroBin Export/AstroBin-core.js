/*
 * AstroBin CSV Export - Core Utilities
 * File operations, date parsing, and other utility functions
 */

// Script metadata
var SCRIPT_NAME = "AstroBin Export";
var SCRIPT_VERSION = "3.1.0";
var SCRIPT_DESCRIPTION = "Generates CSV files compatible with AstroBin's bulk acquisition upload feature. Includes automatic FITS header analysis, comprehensive filter database (200+ filters), personal filter sets, and more.";
var SCRIPT_DEVELOPER = "Paul Fox-Reeks (englishfox90)";

// Configuration constants  
var FILE_EXTS = [".xisf", ".fits", ".fit", ".fts"];
// Night offset for handling midnight crossover in imaging sessions
// -12 means images before noon (12 PM) are considered part of the previous night
// This breaks imaging sessions at midday, grouping evening through morning sessions together
// (e.g., session from 11 PM Aug 21 through 6 AM Aug 22 = all grouped as Aug 21)
var NIGHT_OFFSET_HOURS = -12;
var GROUP_BY_ROUND_DATE = false;

// Global configuration
var CONFIG = {
  rootDir: "",
  outputPath: "",
  filtersPath: "",
  includeSubdirs: true,
  darks: "15",
  flats: "20",
  flatDarks: "15", 
  bias: "50",
  bortle: "4",
  meanSqm: "",
  meanFwhm: "",
  ambientTemp: "",
  preferredFilterBrand: "Auto",
  // Which CSV columns should be populated (headers are always present)
  exportColumns: undefined,
  // User's personal mono filter set (AstroBin filter IDs as strings or "")
  personalFilterSet: undefined
};

// Settings module identifier for PixInsight Settings registry
// Use a unique settings module name to avoid collisions with other scripts
var AB_SETTINGS_MODULE = "AstroBinCSVExport";
var EXPORT_COLUMNS_VERSION = 1; // bump if schema changes
var PERSONAL_FILTER_SET_VERSION = 1; // versioning if schema changes later

// Default export columns: all enabled; 'number' and 'duration' are required
var DEFAULT_EXPORT_COLUMNS = {
  date: true,
  filter: true,
  number: true,      // required
  duration: true,    // required
  iso: true,
  binning: true,
  gain: true,
  sensorCooling: true,
  fNumber: true,
  darks: true,
  flats: true,
  flatDarks: true,
  bias: true,
  bortle: true,
  meanSqm: true,
  meanFwhm: true,
  temperature: true
};

function loadExportColumnSettings() {
  var cols = {};
  try {
    console.writeln("[AstroBin] Loading export column settings...");
    var init = Settings.read(AB_SETTINGS_MODULE + "/exportColumns/_initialized", DataType_UInt32);
    var initialized = Settings.lastReadOK && (init === 1);

    if (!initialized) {
      // First run or older settings: use defaults until user saves
      for (var d in DEFAULT_EXPORT_COLUMNS) cols[d] = !!DEFAULT_EXPORT_COLUMNS[d];
      // Enforce required columns
      cols.number = true; cols.duration = true;
      console.writeln("[AstroBin] Export column settings not found; using defaults.");
      return cols;
    }

    // Initialized: read stored values (UInt32 0/1)
    for (var key in DEFAULT_EXPORT_COLUMNS) {
      var ret = Settings.read(AB_SETTINGS_MODULE + "/exportColumns/" + key, DataType_UInt32);
      if (Settings.lastReadOK) {
        cols[key] = (ret === 1);
      } else {
        cols[key] = !!DEFAULT_EXPORT_COLUMNS[key];
      }
    }
    // Enforce required columns
    cols.number = true;
    cols.duration = true;
    console.writeln("[AstroBin] Export column settings loaded successfully.");
  } catch (e) {
    // Fall back to defaults on error
    for (var d in DEFAULT_EXPORT_COLUMNS) cols[d] = !!DEFAULT_EXPORT_COLUMNS[d];
    cols.number = true; cols.duration = true;
    console.warningln("[AstroBin] Failed to read settings, using defaults. Error: " + e);
  }
  return cols;
}

function saveExportColumnSettings(columns) {
  try {
    console.writeln("[AstroBin] Saving export column settings...");
    for (var key in DEFAULT_EXPORT_COLUMNS) {
      var val = columns.hasOwnProperty(key) ? !!columns[key] : DEFAULT_EXPORT_COLUMNS[key];
      // Enforce required columns saved as true
      if (key === 'number' || key === 'duration') val = true;
      Settings.write(AB_SETTINGS_MODULE + "/exportColumns/" + key, DataType_UInt32, val ? 1 : 0);
    }
    // Mark as initialized
    Settings.write(AB_SETTINGS_MODULE + "/exportColumns/_initialized", DataType_UInt32, EXPORT_COLUMNS_VERSION);
    console.writeln("[AstroBin] Export column settings saved successfully to: " + AB_SETTINGS_MODULE);
  } catch (e) {
    // Non-fatal; continue
    console.criticalln("[AstroBin] Error saving export column settings: " + e);
  }
}

// Initialize export columns in CONFIG at load time
CONFIG.exportColumns = loadExportColumnSettings();
// Personal filter set will be loaded lazily on first access
CONFIG.personalFilterSet = null;

// Personal Filter Set: L R G B Ha OIII SII
var DEFAULT_PERSONAL_FILTER_SET = { L: "", R: "", G: "", B: "", Ha: "", OIII: "", SII: "" };

function loadPersonalFilterSet() {
  var set = {};
  try {
    console.writeln("[AstroBin] Loading personal filter set...");
    var init = Settings.read(AB_SETTINGS_MODULE + "/personalFilters/_initialized", DataType_UInt32);
    var initialized = Settings.lastReadOK && (init === 1);
    
    if (!initialized) {
      console.writeln("[AstroBin] Personal filter set not found; using empty defaults.");
      for (var key in DEFAULT_PERSONAL_FILTER_SET) set[key] = ""; // empty defaults
      return set;
    }
    
    for (var key in DEFAULT_PERSONAL_FILTER_SET) {
      var val = Settings.read(AB_SETTINGS_MODULE + "/personalFilters/" + key, DataType_String);
      if (Settings.lastReadOK && val !== undefined && val !== null) {
        set[key] = ("" + val).trim();
        if (set[key]) {
          console.writeln("[AstroBin] Loaded personal filter " + key + " = " + set[key]);
        }
      } else {
        set[key] = "";
      }
    }
    console.writeln("[AstroBin] Personal filter set loaded successfully.");
    return set;
  } catch (e) {
    for (var k in DEFAULT_PERSONAL_FILTER_SET) set[k] = "";
    console.warningln("[AstroBin] Failed to load personal filter set: " + e);
    return set;
  }
}

// Lazy loader for personal filter set - loads on first access
function getPersonalFilterSet() {
  if (CONFIG.personalFilterSet === null) {
    console.writeln("[AstroBin] Loading personal filter set (lazy initialization)...");
    CONFIG.personalFilterSet = loadPersonalFilterSet();
  }
  return CONFIG.personalFilterSet;
}

function savePersonalFilterSet(set) {
  try {
    if (!set) {
      console.warningln("[AstroBin] Cannot save personal filter set - set is null/undefined");
      return;
    }
    console.writeln("[AstroBin] Saving personal filter set...");
    console.writeln("[AstroBin] Filter set to save: " + JSON.stringify(set));
    
    for (var key in DEFAULT_PERSONAL_FILTER_SET) {
      var val = set.hasOwnProperty(key) ? (set[key] || "") : "";
      Settings.write(AB_SETTINGS_MODULE + "/personalFilters/" + key, DataType_String, val);
      if (val) {
        console.writeln("[AstroBin] Saved personal filter " + key + " = " + val);
      }
    }
    Settings.write(AB_SETTINGS_MODULE + "/personalFilters/_initialized", DataType_UInt32, PERSONAL_FILTER_SET_VERSION);
    console.writeln("[AstroBin] Personal filter set saved successfully to: " + AB_SETTINGS_MODULE + "/personalFilters/");
    
    // Update in-memory cache
    CONFIG.personalFilterSet = set;
  } catch (e) {
    console.criticalln("[AstroBin] Error saving personal filter set: " + e);
  }
}

// Core utility functions
function endsWithAny( s, exts ){
  var sl = s.toLowerCase();
  for ( var i = 0; i < exts.length; i++ )
    if ( sl.endsWith( exts[i] ) )
      return true;
  return false;
}

function listFiles( dirPath, includeSubdirs ){
  var list = [];
  
  // Use PixInsight's searchDirectory function
  try {
    // Search for each file extension
    for (var i = 0; i < FILE_EXTS.length; i++) {
      var pattern = dirPath + "/*" + FILE_EXTS[i];
      var files = searchDirectory(pattern, includeSubdirs);
      list = list.concat(files);
    }
  } catch (e) {
    throw new Error("Error searching directory: " + e);
  }
  
  return list;
}

function readKeyword( ff, keyName ){
  var k = ff.keywords;
  var up = keyName.toUpperCase();
  for ( var i = 0; i < k.length; i++ )
    if ( k[i].name.toUpperCase() === up )
      return k[i].strippedValue;
  return undefined;
}

function parseDateObs( s ){
  if ( !s || s.length === 0 ) return undefined;
  
  var original = s;
  var t = s;
  
  // Remove trailing 'Z' if present
  if (t.toLowerCase().endsWith("z")) {
    t = t.substring(0, t.length - 1);
  }
  
  // Replace space with T
  t = t.replace(" ", "T");
  
  // Handle non-standard time separator (periods instead of colons)
  // Need to handle both "2025-03-21T04.41.04.873" and "2025-03-21T04:41:04.873"
  var tParts = t.split("T");
  if (tParts.length === 2) {
    var datePart = tParts[0];
    var timePart = tParts[1];
    
    // Check if time uses periods (non-standard format)
    // Count periods - if we have 3 or more, it's period-separated time
    var periodCount = (timePart.match(/\./g) || []).length;
    if (periodCount >= 3) {
      // Replace ALL periods with colons first
      timePart = timePart.replace(/\./g, ":");
      // Now convert the last colon back to period for milliseconds
      var lastColonIndex = timePart.lastIndexOf(":");
      if (lastColonIndex !== -1) {
        timePart = timePart.substring(0, lastColonIndex) + "." + timePart.substring(lastColonIndex + 1);
      }
    }
    
    t = datePart + "T" + timePart;
  }
  
  // Check if date only and add time
  if ( t.length === 10 && t.indexOf("T") === -1 ) t += "T00:00:00";
  
  try {
    var d = new Date( t );
    if ( isNaN( d ) ) {
      console.warningln("[AstroBin] Failed to parse date: '" + original + "' -> '" + t + "'");
      return undefined;
    }
    // Debug first few dates only
    if (Math.random() < 0.1) { // Log ~10% to avoid spam
      console.writeln("[AstroBin] Parsed date: '" + original + "' -> " + d.toISOString());
    }
    return d;
  } catch( err ){
    console.warningln("[AstroBin] Exception parsing date: '" + original + "' - " + err);
    return undefined;
  }
}

function toLocalDateString( d ){
  function pad(n){ return (n<10?"0":"") + n; }
  return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate());
}

function applyNightOffset( d, hours ){ 
  return new Date( d.getTime() + hours*3600*1000 ); 
}

function openForKeywords( path ){
  var ext = File.extractExtension( path ).toLowerCase();
  var fmtId = ( ext === ".xisf" ) ? "XISF" : "FITS";
  var fmt = new FileFormat( fmtId, false, true );
  if ( fmt.isNull ) throw new Error( "No reader for: " + path );
  var f = new FileFormatInstance( fmt );
  if ( f.isNull ) throw new Error( "Cannot open: " + path );
  if ( !f.open( path, "verbosity 0" ) )
    throw new Error( "Open failed: " + path );
  return f;
}
