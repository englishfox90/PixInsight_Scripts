/*
 * MasterSignature-core.js
 *
 * Signature engine and headless signImage(). Contains no preprocessor
 * directives, so it can be #included by MasterSignature.js and also loaded
 * directly by the PixInsight connector (run_pjsr with include=[this file]):
 *
 *   signImage({ view: "M31", catalog: "M31", subject: "Andromeda Galaxy",
 *               filters: "L:300x40;R:300x20", location: "Backyard",
 *               scriptDir: "D:/PixInsight Files/PixInsight Custom Scripts/Signature" })
 */

const SCRIPT_TITLE = "MasterSignature";
const SCRIPT_VERSION = "1.4.0";
// Folder holding the script (used to find logo.png). MasterSignature.js sets
// this from #__FILE__; a connector call passes scriptDir= in its options.
const MS_CONFIG = { scriptDir: "" };

// Option keys shared by script-instance Parameters and command-line arguments.
// Everything is stored as a string so instances and CLI go through one path.
const OPTION_KEYS = [
   "catalog", "subject", "exposure", "frames", "integration", "filters", "mode",
   "date", "location", "fontFace", "fontSize", "margin", "logo", "logoPath",
   "textOpacity", "logoOpacity"
];
const CLI_ONLY_KEYS = ["input", "output", "view", "keepOpen", "scriptDir", "help"];
const MODE_NAMES = ["simple", "direct", "detailed"];

function parseBool(v) {
   return /^(1|true|yes|on)$/i.test(String(v).trim());
}

function clampInt(v, lo, hi, fallback) {
   const n = parseInt(v, 10);
   return isNaN(n) ? fallback : Math.max(lo, Math.min(hi, n));
}

function findLogo(customPath) {
   const dir = MS_CONFIG.scriptDir;
   const candidates = [customPath];
   if (dir)
      candidates.push(
         dir + "/logo.png",
         dir + "/lib/logos/logo.png",
         // Installed via the update repository: src/scripts/Signature -> rsc/Signature
         dir + "/../../../rsc/Signature/logo.png");
   for (const p of candidates)
      if (p && File.exists(p))
         return File.fullPath(p);
   return "";
}

function getFITSKeyword(window, key) {
   if (!window || window.isNull) return "";
   const keywords = window.keywords || [];
   const upper = key.toUpperCase();
   for (const kw of keywords)
      if (kw.name.toUpperCase() === upper)
         return kw.strippedValue || kw.value || "";
   return "";
}

// "L:300x40;R:300x20" <-> [{filter:"L", exposure:"300", frames:"40"}, ...]
function parseFilterString(s) {
   const out = [];
   for (const part of String(s).split(";")) {
      const p = part.trim();
      if (!p) continue;
      const colon = p.indexOf(":");
      const name = colon >= 0 ? p.substring(0, colon).trim() : "";
      const rest = colon >= 0 ? p.substring(colon + 1).trim() : p;
      const m = rest.match(/^([\d.]+)\s*s?\s*[x×*]\s*(\d+)$/i);
      if (m)
         out.push({ filter: name, exposure: m[1], frames: m[2] });
      else
         out.push({ filter: name || rest, exposure: "", frames: "" });
   }
   return out;
}

function formatFilterString(details) {
   return details
      .filter(d => d.filter || d.exposure || d.frames)
      .map(d => `${d.filter}:${d.exposure}x${d.frames}`)
      .join(";");
}

/**
 * Holds the signature parameters and does the drawing.
 */
class DrawSignatureEngine {
   constructor() {
      this.subject = "";
      this.catalog = "";
      this.exposure = "";
      this.frames = "";
      this.date = "";
      this.location = "";
      this.fontFace = "Space Grotesk";
      this.fontSize = 48;
      this.fontSizeExplicit = false;
      this.showLogo = true;
      this.logoPath = "";
      this.margin = 15;
      // 0 = Simple (exposure x frames), 1 = Direct entry, 2 = Detailed (per filter)
      this.integrationMode = 0;
      this.directIntegration = "";
      this.filterDetails = [{ filter: "", exposure: "", frames: "" }];
      this.textOpacity = 100;
      this.logoOpacity = 100;
      this.targetView = null;
   }

   /**
    * Point the engine at a view: pick a default font size from the image
    * height and fill fields from its FITS header.
    */
   setTarget(view) {
      this.targetView = (view && !view.isNull) ? view : null;
      if (!this.targetView) return;

      const img = this.targetView.image;
      if (!this.fontSizeExplicit && img && img.height > 0)
         this.fontSize = Math.max(8, Math.min(4000, Math.round(img.height * 0.05)));

      this.loadFromFITS(this.targetView.window);
   }

   loadFromFITS(win) {
      if (!win || win.isNull || !win.keywords || win.keywords.length === 0) {
         Console.warningln(`[${SCRIPT_TITLE}] No FITS keywords found; fields left as entered.`);
         return;
      }

      const subject = getFITSKeyword(win, "SUBJECT");
      const catalog = getFITSKeyword(win, "OBJECT");
      let exp = getFITSKeyword(win, "EXPTIME");
      if (exp && !isNaN(exp))
         exp = String(Math.round(Number(exp)));
      const nframes = getFITSKeyword(win, "FRAMES") || getFITSKeyword(win, "NFRAMES");
      let dateObs = getFITSKeyword(win, "DATE-OBS");
      if (dateObs && dateObs.length >= 10) {
         const parts = dateObs.substring(0, 10).split("-");
         if (parts.length === 3)
            dateObs = `${parts[1]}/${parts[2]}/${parts[0]}`;   // MM/DD/YYYY
      }
      const loc = getFITSKeyword(win, "OBSERVER") || getFITSKeyword(win, "LOCATN") || getFITSKeyword(win, "SITE");

      // Only fill blanks, so values set by an instance or the CLI win.
      if (!this.subject) this.subject = subject;
      if (!this.catalog) this.catalog = catalog;
      if (!this.exposure) this.exposure = exp || "";
      if (!this.frames) this.frames = nframes || "";
      if (!this.date) this.date = dateObs || "";
      if (!this.location) this.location = loc || "";

      Console.writeln(`[${SCRIPT_TITLE}] FITS auto-fill from ${win.keywords.length} keywords:`);
      Console.writeln(`  Subject : ${this.subject}`);
      Console.writeln(`  Catalog : ${this.catalog}`);
      Console.writeln(`  Exposure: ${this.exposure}`);
      Console.writeln(`  Frames  : ${this.frames}`);
      Console.writeln(`  Date    : ${this.date}`);
      Console.writeln(`  Location: ${this.location}`);
   }

   /**
    * Apply a plain {key: string} map (from Parameters or CLI arguments).
    */
   applyOptions(opts) {
      const has = k => Object.prototype.hasOwnProperty.call(opts, k) && opts[k] !== undefined && opts[k] !== null;

      for (const k of ["catalog", "subject", "exposure", "frames", "date", "location", "fontFace", "logoPath"])
         if (has(k)) this[k] = String(opts[k]);

      if (has("integration")) this.directIntegration = String(opts.integration);
      if (has("filters")) {
         const parsed = parseFilterString(opts.filters);
         this.filterDetails = parsed.length > 0 ? parsed : [{ filter: "", exposure: "", frames: "" }];
      }

      if (has("mode")) {
         const m = String(opts.mode).trim().toLowerCase();
         const idx = MODE_NAMES.indexOf(m);
         this.integrationMode = idx >= 0 ? idx : clampInt(m, 0, 2, this.integrationMode);
      } else if (has("filters")) {
         this.integrationMode = 2;
      } else if (has("integration")) {
         this.integrationMode = 1;
      }

      if (has("fontSize")) {
         this.fontSize = clampInt(opts.fontSize, 8, 4000, this.fontSize);
         this.fontSizeExplicit = true;
      }
      if (has("margin")) this.margin = clampInt(opts.margin, 0, 10000, this.margin);
      if (has("logo")) this.showLogo = parseBool(opts.logo);
      if (has("textOpacity")) this.textOpacity = clampInt(opts.textOpacity, 0, 100, this.textOpacity);
      if (has("logoOpacity")) this.logoOpacity = clampInt(opts.logoOpacity, 0, 100, this.logoOpacity);
   }

   toOptions() {
      return {
         catalog: this.catalog,
         subject: this.subject,
         exposure: this.exposure,
         frames: this.frames,
         integration: this.directIntegration,
         filters: formatFilterString(this.filterDetails),
         mode: MODE_NAMES[this.integrationMode],
         date: this.date,
         location: this.location,
         fontFace: this.fontFace,
         fontSize: String(this.fontSize),
         margin: String(this.margin),
         logo: this.showLogo ? "true" : "false",
         logoPath: this.logoPath,
         textOpacity: String(this.textOpacity),
         logoOpacity: String(this.logoOpacity)
      };
   }

   importParameters() {
      const opts = {};
      for (const k of OPTION_KEYS)
         if (Parameters.has(k))
            opts[k] = Parameters.getString(k);
      this.applyOptions(opts);
   }

   exportParameters() {
      const opts = this.toOptions();
      for (const k of OPTION_KEYS)
         Parameters.set(k, opts[k]);
      Parameters.set("text", this.composeText());   // informational only
   }

   formatIntegrationTime(totalSeconds) {
      if (totalSeconds < 60)
         return totalSeconds.toFixed(0) + "s";
      if (totalSeconds < 3600)
         return (totalSeconds / 60).toFixed(1).replace(/\.0$/, "") + " min";
      return (totalSeconds / 3600).toFixed(2).replace(/\.00$/, "") + " h";
   }

   calculateIntegration() {
      if (this.integrationMode === 1)
         return this.directIntegration || "";

      let totalSeconds = 0;
      const rows = this.integrationMode === 2
         ? this.filterDetails
         : [{ exposure: this.exposure, frames: this.frames }];
      for (const d of rows) {
         const exp = parseFloat(d.exposure);
         const frames = parseInt(d.frames, 10);
         if (!isNaN(exp) && !isNaN(frames) && frames > 0)
            totalSeconds += exp * frames;
      }
      return totalSeconds > 0 ? this.formatIntegrationTime(totalSeconds) : "";
   }

   getExposureDetails() {
      if (this.integrationMode === 2) {
         const details = [];
         for (const d of this.filterDetails) {
            let part = d.filter ? d.filter + ": " : "";
            if (d.exposure && d.frames) part += `${d.exposure}s x ${d.frames}`;
            else if (d.exposure) part += d.exposure + "s";
            else if (d.frames) part += d.frames + " frames";
            if (part) details.push(part);
         }
         return details.join(", ");
      }
      if (this.integrationMode === 1)
         return "";
      return (this.exposure && this.frames) ? `(${this.exposure}s x ${this.frames})` : "";
   }

   /**
    * Two-line format:
    *   [Catalog] [Subject] | exposed [integration] ([exposure details])
    *   [Date] | [Location]
    */
   composeText() {
      const title = (this.catalog ? this.catalog + " " : " ") + (this.subject || "");
      let line1 = title + " | exposed " + this.calculateIntegration();
      const details = this.getExposureDetails();
      if (details)
         line1 += this.integrationMode === 2 ? ` (${details})` : " " + details;
      const line2 = (this.date || "") + " | " + (this.location || "");
      return line1 + "\n" + line2;
   }

   applyOpacity(bmp, opacity) {
      if (opacity >= 100) return bmp;
      const newBmp = new Bitmap(bmp.width, bmp.height);
      newBmp.fill(0x00000000);
      if (opacity <= 0) return newBmp;
      const G = new Graphics(newBmp);
      G.opacity = opacity / 100;
      G.drawBitmap(0, 0, bmp);
      G.end();
      return newBmp;
   }

   /**
    * Draw the signature text (lower left) and the logo (lower right) into image.
    */
   renderSignature(image) {
      // Load the logo first: its width limits the room left for the text.
      let logoBmp = null;
      if (this.showLogo) {
         const logoFile = findLogo(this.logoPath);
         if (!logoFile) {
            Console.warningln(`[${SCRIPT_TITLE}] Logo not found (looked for logo.png next to the script and in rsc/Signature); skipping logo.`);
         } else {
            try {
               logoBmp = new Bitmap(logoFile);
            } catch (e) {
               Console.criticalln(`[${SCRIPT_TITLE}] Failed to load logo from ${logoFile}: ${e}`);
            }
         }
      }

      const lines = this.composeText().split("\n");
      const linePadding = 10;
      const font = new Font(this.fontFace);
      const measure = () => {
         const innerMargin = Math.round(font.pixelSize / 5);
         let maxWidth = 0;
         for (const line of lines)
            maxWidth = Math.max(maxWidth, font.width(line));
         return { innerMargin, width: maxWidth + 2 * innerMargin };
      };

      // Room for the text: image width minus outer margins, and minus the logo
      // plus a gap when the logo is shown.
      const available = image.width - 2 * this.margin - (logoBmp ? logoBmp.width + this.margin : 0);
      font.pixelSize = this.fontSize;
      let m = measure();
      if (m.width > available && available > 0) {
         if (this.fontSizeExplicit) {
            Console.warningln(`[${SCRIPT_TITLE}] Text at ${this.fontSize}px is ${m.width}px wide but only ${available}px fit; it will be clipped. Lower the font size.`);
         } else {
            // Automatic size: shrink until it fits (width scales ~linearly).
            for (let tries = 0; tries < 5 && m.width > available && font.pixelSize > 8; ++tries) {
               font.pixelSize = Math.max(8, Math.floor(font.pixelSize * available / m.width));
               m = measure();
            }
            Console.writeln(`[${SCRIPT_TITLE}] Font size fitted to ${font.pixelSize}px so the text clears the logo.`);
         }
      }
      const innerMargin = m.innerMargin;
      const width = m.width;
      const height = font.ascent * lines.length + font.descent + 2 * innerMargin + (lines.length - 1) * linePadding;

      const bmp = new Bitmap(width, height);
      bmp.fill(0x00000000);
      const G = new Graphics(bmp);
      G.font = font;
      G.pen = new Pen(0xFFFFFFFF);
      G.transparentBackground = true;
      G.textAntialiasing = true;
      for (let i = 0; i < lines.length; ++i)
         G.drawText(
            innerMargin,
            height - font.descent - innerMargin - (lines.length - 1 - i) * (font.ascent + linePadding),
            lines[i]
         );
      G.end();

      const textBmp = this.applyOpacity(bmp, this.textOpacity);
      image.selectedPoint = new Point(this.margin, image.height - this.margin - height);
      image.blend(textBmp);
      if (textBmp !== bmp) textBmp.clear();
      bmp.clear();

      if (logoBmp) {
         const logoWithOpacity = this.applyOpacity(logoBmp, this.logoOpacity);
         image.selectedPoint = new Point(
            image.width - this.margin - logoBmp.width,
            image.height - this.margin - logoBmp.height);
         image.blend(logoWithOpacity);
         if (logoWithOpacity !== logoBmp) logoWithOpacity.clear();
         logoBmp.clear();
      }
   }

   apply() {
      // Export first so a new Script instance captures the current parameters.
      this.exportParameters();
      this.targetView.beginProcess();
      try {
         this.renderSignature(this.targetView.image);
      } finally {
         this.targetView.endProcess();
      }
   }
}

function printUsage() {
   Console.writeln(`${SCRIPT_TITLE} v${SCRIPT_VERSION} - command-line keys (key=value, comma separated):`);
   Console.writeln("  input=<file> | view=<id>   target (default: active window)");
   Console.writeln("  output=<file>              save signed image; keepOpen=true to leave it open");
   Console.writeln("  catalog, subject, date, location");
   Console.writeln("  exposure, frames           simple mode");
   Console.writeln("  integration=<text>         direct mode, e.g. integration=5.5 h");
   Console.writeln("  filters=L:300x40;R:300x20  detailed mode");
   Console.writeln("  mode=simple|direct|detailed");
   Console.writeln("  fontFace, fontSize, margin, logo=true|false, logoPath, textOpacity, logoOpacity");
}

/**
 * Sign an image without any UI. Used by the command line and the PixInsight
 * connector. opts is a {key: value} map (see the header of MasterSignature.js);
 * values may be strings, numbers or booleans. Throws on failure and returns a
 * short summary string on success.
 */
function signImage(opts) {
   opts = opts || {};
   if (opts.scriptDir)
      MS_CONFIG.scriptDir = String(opts.scriptDir).replace(/\\/g, "/").replace(/\/+$/, "");
   const engine = new DrawSignatureEngine();

   Console.show();
   Console.writeln(`[${SCRIPT_TITLE}] v${SCRIPT_VERSION} headless run`);

   if (opts.help) {
      printUsage();
      return "usage printed";
   }

   let win = null;
   let view = null;
   let opened = false;

   if (opts.input) {
      const windows = ImageWindow.open(opts.input);
      if (!windows || windows.length === 0)
         throw new Error("Could not open input image: " + opts.input);
      win = windows[0];
      opened = true;
      view = win.mainView;
   } else if (opts.view) {
      view = View.viewById(opts.view);
      if (!view || view.isNull)
         throw new Error("No view with id: " + opts.view);
      win = view.window;
   } else {
      win = ImageWindow.activeWindow;
      if (!win || win.isNull)
         throw new Error("No input=, no view=, and no active image window.");
      view = win.currentView;
   }

   // Explicit arguments are applied before the FITS fill so they take priority
   // (the FITS fill only fills blanks); then a second pass re-applies them in
   // case setTarget recomputed the default font size.
   engine.applyOptions(opts);
   engine.setTarget(view);
   engine.applyOptions(opts);

   Console.writeln(`[${SCRIPT_TITLE}] Signing ${view.id}:`);
   for (const line of engine.composeText().split("\n"))
      Console.writeln("  " + line);

   engine.apply();

   let savedTo = "";
   if (opts.output) {
      const outPath = File.fullPath(opts.output);
      // saveAs(path, queryOptions, allowMessages, strict, verifyOverwrite)
      if (!win.saveAs(outPath, false, false, false, false))
         throw new Error("Failed to save " + outPath);
      Console.noteln(`[${SCRIPT_TITLE}] Saved ${outPath}`);
      savedTo = outPath;
   }

   if (opened) {
      if (opts.keepOpen && parseBool(opts.keepOpen))
         win.show();
      else
         win.forceClose();
   }

   Console.noteln(`[${SCRIPT_TITLE}] Done.`);
   return `Signed ${view.id}${savedTo ? " -> " + savedTo : ""}:
${engine.composeText()}`;
}
