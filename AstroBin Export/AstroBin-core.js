/*
 * AstroBin CSV Export - Core Utilities
 * File operations, date parsing, and other utility functions
 */

// Configuration constants  
var FILE_EXTS = [".xisf", ".fits", ".fit", ".fts"];
// Night offset for handling midnight crossover in imaging sessions
// -6 means images before 6 AM are considered part of the previous night
// This handles sessions that span midnight (e.g., OIII at 11 PM, Ha at 2 AM = same night)
var NIGHT_OFFSET_HOURS = -6;
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
  exportColumns: undefined
};

// Settings module identifier for PixInsight Settings registry
// Use a unique settings module name to avoid collisions with other scripts
var AB_SETTINGS_MODULE = "AstroBinCSVExport";
var EXPORT_COLUMNS_VERSION = 1; // bump if schema changes

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
    var initialized = (init === 1 || init === "1");

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
      var val = (ret === 1 || ret === true || ret === "1" || ret === "true");
      cols[key] = !!val;
    }
    // Enforce required columns
    cols.number = true;
    cols.duration = true;
    console.writeln("[AstroBin] Export column settings loaded.");
  } catch (e) {
    // Fall back to defaults on error
    cols = DEFAULT_EXPORT_COLUMNS;
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
    console.writeln("[AstroBin] Export column settings saved.");
  } catch (e) {
    // Non-fatal; continue
    console.criticalln("[AstroBin] Error saving export column settings: " + e);
  }
}

// Initialize export columns in CONFIG at load time
CONFIG.exportColumns = loadExportColumnSettings();

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
  // Simple string replacements instead of regex
  var t = s;
  if (t.toLowerCase().endsWith("z")) {
    t = t.substring(0, t.length - 1);
  }
  t = t.replace(" ", "T");
  
  // Check if date only and add time
  if ( t.length === 10 && t.indexOf("T") === -1 ) t += "T00:00:00";
  
  try {
    var d = new Date( t );
    if ( isNaN( d ) ) return undefined;
    return d;
  } catch( __ ){
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
