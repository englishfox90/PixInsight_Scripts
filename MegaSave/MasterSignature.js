#feature-id    MasterSignature : PFRAstro > Master Signature

#feature-info  Addes image details to the bottom left hand corner of the image \
               adds the user logo found at logo.png of the script directory \
               user can select the text, font and size of the \
               text to be drawn

#feature-icon  DrawSignature.xpm

#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>

#define VERSION   1.1
#define TITLE     MasterSignature

var logoDir = File.fullPath(File.extractDrive(#__FILE__)+File.extractDirectory(#__FILE__)+"/logo.png")

/**
 * The DrawSignatureEngine object defines and implements the DrawSignature
 * routine and its functional parameters.
 */
function DrawSignatureEngine()
{
   this.initialize = function()
   {
      // Default parameters
      this.subject = "";
      this.catalog = "";
      this.integration = "";
      this.exposure = "";
      this.frames = "";
      this.date = "";
      this.location = "";
      this.fontFace = "Space Grotesk";
      // Set default font size to 5% of image height if possible, else fallback to 48
      var defaultFontSize = 48;
      if (this.targetView && this.targetView.image && this.targetView.image.height > 0) {
         defaultFontSize = Math.round(this.targetView.image.height * 0.10);
      }
      this.fontSize = defaultFontSize;
      this.bold = true;      // removed from UI, always true
      this.italic = false;    // removed from UI, always false
      this.stretch = 100;     // removed from UI, always 100
      this.showLogo = true; // removed from UI, always true
      this.textColor = 0xFFFFFFFF; // always white
      this.bkgColor = 0x00000000;  // always fully transparent
      this.margin = 15;
      this.softEdges = false; // removed from UI, always false
      this.logo = logoDir;

      if ( Parameters.isViewTarget || Parameters.isGlobalTarget )
      {
         // Our script is being executed as a Script instance.

         // Retrieve instance parameters
         if ( Parameters.has( "text" ) )
            this.text = Parameters.getString( "text" );
         if ( Parameters.has( "fontFace" ) )
            this.fontFace = Parameters.getString( "fontFace" );
         if ( Parameters.has( "fontSize" ) )
            this.fontSize = Parameters.getUInt( "fontSize" );
         if ( Parameters.has( "margin" ) )
            this.margin = Parameters.getInteger( "margin" );
         if ( Parameters.has( "exposure" ) )
            this.exposure = Parameters.getString( "exposure" );
         if ( Parameters.has( "frames" ) )
            this.frames = Parameters.getString( "frames" );
      }

      if ( Parameters.isViewTarget )
      {
         // View context: use the target view.
         this.targetView = Parameters.targetView;
      }
      else
      {
         // Direct or global contexts: use the active view.
         var window = ImageWindow.activeWindow;
         if ( !window.isNull )
            this.targetView = window.currentView;
      }

    // Try to auto-populate from FITS header if possible
    var view = this.targetView;
    if (view) {
        var win = view.window;
        if (!view.keywords || view.keywords.length === 0) {
            console.warningln("view.keywords is empty or undefined.");
            if (win && win.keywords && win.keywords.length > 0) {
                console.writeln("Found " + win.keywords.length + " keywords in ImageWindow. Using those.");
                view.keywords = win.keywords;
            } else {
                console.warningln("No keywords in view or window.");
            }
        }

        if (view.keywords && view.keywords.length > 0) {
            console.writeln("Using " + view.keywords.length + " FITS keywords.");

            this.subject  = getFITSKeyword(view, "SUBJECT");
            this.catalog  = getFITSKeyword(view, "OBJECT");
            var exp       = getFITSKeyword(view, "EXPTIME");
            // Flatten exposure to integer if it's a decimal
            if (exp && !isNaN(exp)) {
                exp = String(Math.round(Number(exp)));
            }
            var nframes   = getFITSKeyword(view, "FRAMES") || getFITSKeyword(view, "NFRAMES");
            var dateObs   = getFITSKeyword(view, "DATE-OBS");
            // Convert ISO date to US format if possible
            if (dateObs && dateObs.length >= 10) {
                // Extract YYYY-MM-DD
                var isoDate = dateObs.substring(0, 10);
                var parts = isoDate.split("-");
                if (parts.length === 3) {
                    // Format as MM/DD/YYYY
                    dateObs = parts[1] + "/" + parts[2] + "/" + parts[0];
                }
            }
            var loc       = getFITSKeyword(view, "OBSERVER") || getFITSKeyword(view, "LOCATN") || getFITSKeyword(view, "SITE");

            this.exposure = exp || "";
            this.frames   = nframes || "";
            this.date     = dateObs || "";
            this.location = loc || "";

            console.writeln("FITS auto-fill:");
            console.writeln("  Subject : " + this.subject);
            console.writeln("  Catalog : " + this.catalog);
            console.writeln("  Exposure: " + this.exposure);
            console.writeln("  Frames  : " + this.frames);
            console.writeln("  Date    : " + this.date);
            console.writeln("  Location: " + this.location);
        } else {
            console.warningln("No usable FITS keywords found.");
        }
    }

      // Integration will be calculated dynamically
    };

   this.calculateIntegration = function() {
      // Calculate integration time and format as s, min, or h
      let exp = parseFloat(this.exposure);
      let frames = parseInt(this.frames, 10);
      if (!isNaN(exp) && !isNaN(frames) && frames > 0) {
         let totalSeconds = exp * frames;
         if (totalSeconds < 60) {
            return totalSeconds.toFixed(0) + "s";
         } else if (totalSeconds < 3600) {
            return (totalSeconds / 60).toFixed(1).replace(/\.0$/, "") + " min";
         } else {
            return (totalSeconds / 3600).toFixed(2).replace(/\.00$/, "") + " h";
         }
      }
      return "";
   };

   this.composeText = function() {
      // Compose the text in the requested two-line format:
      // [Title: Name and Catalog #] | exposed [integration time] ([exposure time]x[# of Frames])
      // [Date] | [Location of Capture]
      let title = (this.catalog ? this.catalog + " " : " ") + (this.subject || "");
      let integration = this.calculateIntegration();
      let exposure = this.exposure || "";
      let frames = this.frames || "";
      let date = this.date || "";
      let location = this.location || "";

      let line1 = "" + title + " | exposed " + integration +
                  ((exposure && frames) ? " (" + exposure + "s" + "x" + frames + ")" : "");
      let line2 = date + " | " + location;

      return line1 + "\n" + line2;
   };

   this.apply = function()
   {
      // Export script parameters. We must carry out this here, *before* applying
      // our routine to targetView, so that a newly created Script instance will
      // encapsulate our current set of working parameters.
      this.exportParameters();

      // Tell the core application that we are going to change this view.
      // Without doing this, we'd have just read-only access to the view's image.
      this.targetView.beginProcess();

      // Perform our drawing routine.
      this.draw();

      // Done with view.
      this.targetView.endProcess();
   };

   this.exportParameters = function()
   {
      this.text = this.composeText();
      Parameters.set( "text", this.text );
      Parameters.set( "fontFace", this.fontFace );
      Parameters.set( "fontSize", this.fontSize );
      Parameters.set( "margin", this.margin );
      // Do not export bold, italic, stretch, textColor, bkgColor, softEdges
   };

   /**
    * A routine to draw an arbitrary text at the lower-left corner of an image.
    *
    * The data argument provides operating parameters:
    *
    * targetView  Image to draw the text over.
    *
    * text        The text to draw.
    *
    * fontFace    The font to draw with.
    *
    * pointSize   The font size in points.
    *
    * bold        Whether the text will be drawn with a bold font.
    *
    * italic      Whether the text will be drawn with an italic font.
    *
    * stretch     The font stretch factor. A stretch factor of 100 draws
    *             characters with their normal widths. stretch > 100 draws
    *             wider (extended) characters, and stretch < 100 draws
    *             compressed characters.
    *
    * textColor   The text color. Encoded as a 32-bit integer: AARRGGBB, where
    *             AA is the 8-bit alpha (transparency) value, and RR, GG, BB
    *             are the red, green and blue 8-bit values, respectively.
    *
    * bgColor     The background color, encoded as explained above.
    *
    * margin      The outer margin in pixels.
    *
    * softEdges   If true, the text will be drawn with extra soft edges;
    *             normal edges otherwise.
    */
   this.draw = function()
   {
      // To execute with diagnostics messages, #define the __DEBUG__ macro; e.g.:
      //    run -D=__DEBUG__ signature.js
#ifdef __DEBUG__
      console.writeln(         "text      : ",   this.text );
      console.writeln(         "font      : ",   this.fontFace );
      console.writeln(         "fontSize  : ",   this.fontSize );
      console.writeln(         "stretch   : ",   this.stretch );
      console.writeln(         "bold      : ",   this.bold );
      console.writeln(         "italic    : ",   this.italic );
      console.writeln( format( "textColor : %X", this.textColor ) );
      console.writeln( format( "bgColor   : %X", this.bkgColor ) );
      console.writeln(         "margin    : ",   this.margin );
      console.writeln(         "soft      : ",   this.softEdges );
#endif

      // Create the font
      var font = new Font( this.fontFace );
      font.pixelSize = this.fontSize;
      var linePadding = 10; // Add 10px padding between lines


#ifdef __DEBUG__
      console.writeln( "Exact font match : ", font.isExactMatch );
      console.writeln( "Font point size  : ", font.pointSize );
#endif

      // Calculate a reasonable inner margin in pixels
      var innerMargin = Math.round( font.pixelSize/5 );

      // Calculate the sizes of our drawing box
      var text = this.composeText();
      // Calculate width and height for multiline text
      var lines = text.split("\n");
      var maxWidth = 0;
      for (var i = 0; i < lines.length; ++i)
         maxWidth = Math.max(maxWidth, font.width(lines[i]));
      var width = maxWidth + 2*innerMargin;
      var height = font.ascent*lines.length + font.descent + 2*innerMargin + (lines.length > 1 ? (lines.length-1)*linePadding : 0);

#ifdef __DEBUG__
      console.writeln( "Drawing box sizes : w=", width, ", h=", height );
#endif

      var logoPath = logoDir;
      console.writeln("Logo path resolved to: " + logoPath);
      
      //check if the logo file exists
      if (!File.exists(logoPath)) {
        console.criticalln("Logo file not found!");
    } else {
        console.writeln("Logo file exists. Trying to load bitmap...");
    }

      // --- Only do preview if called from dialog preview control ---
      if (typeof this.previewControl !== "undefined" && this.previewControl !== null) {
         var previewImage = new Image(this.targetView.image);
         var bmp = new Bitmap(width, height);
         bmp.fill(0x00000000);
         var G = new Graphics(bmp);

        // Select the required drawing tools: font and pen.
         G.font = font;
         G.pen = new Pen(0xFFFFFFFF);
         G.transparentBackground = true;
         G.textAntialiasing = true;

         // Now draw the signature
         for (var i = 0; i < lines.length; ++i)
            G.drawText(
               innerMargin,
               height - font.descent - innerMargin - (lines.length-1-i)*(font.ascent + linePadding),
               lines[i]
            );
         G.end();

         previewImage.selectedPoint = new Point(this.margin, previewImage.height - this.margin - height);
         previewImage.blend(bmp);

         // --- Overlay the logo bitmap on bottom-right ---
         if(this.showLogo){
            try {
                var logoBmp = new Bitmap(logoPath);
                console.writeln("Bitmap loaded. Size: " + logoBmp.width + "x" + logoBmp.height);

                var x = previewImage.width - this.margin - logoBmp.width;
                var y = previewImage.height - this.margin - logoBmp.height;

                previewImage.selectedPoint = new Point(x, y);
                previewImage.blend(logoBmp);
            } catch (e) {
                console.criticalln("Failed to create Bitmap: " + e.toString());
            }
        }

         this.previewControl.doUpdateImage(previewImage);
         return;
      }

      // --- ACTUAL IMAGE DRAW ---
      var image = this.targetView.image;
      var bmp = new Bitmap(width, height);
      bmp.fill(0x00000000);
      var G = new Graphics(bmp);

      // Select the required drawing tools: font and pen.
      G.font = font;
      G.pen = new Pen(0xFFFFFFFF);
      G.transparentBackground = true;
      G.textAntialiasing = true;

      // Now draw the signature
      for (var i = 0; i < lines.length; ++i)
         G.drawText(
            innerMargin,
            height - font.descent - innerMargin - (lines.length-1-i)*(font.ascent + linePadding),
            lines[i]
         );
      G.end();

      // If soft text has been requested, we apply a convolution with a mild
      // low-pass filter to soften text edges.
      if (this.softEdges) {
         var simg = new Image(width, height, 4, 1);
         simg.firstSelectedChannel = 0;
         simg.lastSelectedChannel = 3;
         simg.fill(0);
         simg.blend(bmp);
         simg.convolve([0.05, 0.15, 0.05,
                        0.15, 1.00, 0.15,
                        0.05, 0.15, 0.05]);
         bmp.assign(simg.render());
      }

      image.selectedPoint = new Point(this.margin, image.height - this.margin - height);
      image.blend(bmp);

      // --- Overlay the logo bitmap on bottom-right ---
      if(this.showLogo){
         try {
            var logoBmp = new Bitmap(logoPath);
            console.writeln("Bitmap loaded. Size: " + logoBmp.width + "x" + logoBmp.height);

            var x = image.width - this.margin - logoBmp.width;
            var y = image.height - this.margin - logoBmp.height;

            image.selectedPoint = new Point(x, y);
            image.blend(logoBmp);
        } catch (e) {
            console.criticalln("Failed to create Bitmap: " + e.toString());
        }
    }
   };

   // Append missing FITS keywords to the view
    function ensureFITSKeyword(view, name, value) {
    if (!view || !view.window) return;
        var exists = false;
    if (view.keywords)
        for (var i = 0; i < view.keywords.length; ++i)
            if (view.keywords[i].name === name) {
                exists = true;
                break;
            }
    if (!exists && value) {
        console.writeln("Appending FITS keyword: " + name + " = " + value);
        view.window.setKeyword(name, value, "Added by MasterSignature.js");
    }
    }

    ensureFITSKeyword(this.targetView, "OBJECT", this.subject);
    ensureFITSKeyword(this.targetView, "CATALOG", this.catalog);
    ensureFITSKeyword(this.targetView, "EXPTIME", this.exposure);
    ensureFITSKeyword(this.targetView, "FRAMES", this.frames);
    ensureFITSKeyword(this.targetView, "DATE-OBS", this.date ? this.date.split("/").join("-") : "");
    ensureFITSKeyword(this.targetView, "OBSERVER", this.location);

    this.initialize();
    }

// Global DrawSignature parameters.
var engine = new DrawSignatureEngine;

/**
 * DrawSignatureDialog is a graphical user interface to define
 * DrawSignature parameters.
 */
function DrawSignatureDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   //

   var emWidth = this.font.width( 'M' );
   var labelWidth1 = this.font.width( "Target image:" );

   //

   this.helpLabel = new Label( this );
   this.helpLabel.frameStyle = FrameStyle_Box;
   this.helpLabel.margin = 4;
   this.helpLabel.wordWrapping = true;
   this.helpLabel.useRichText = true;
   this.helpLabel.text = "<p><b>" + #TITLE + " v" + #VERSION +
      "</b> &mdash; This script overlays a two-line signature block and a logo on your image, inspired by the Celestron Origin output files.<br/>" +
      "<ul>" +
      "<li><b>Signature Block:</b> Includes Subject, Catalog, Exposure, Frame Count, Integration Time, Date, and Location.</li>" +
      "<li><b>FITS Header Integration:</b> Where possible, fields are auto-populated from the FITS header (OBJECT, CATALOG, EXPTIME, FRAMES, DATE-OBS, LOCATION, etc).</li>" +
      "<li><b>Logo Overlay:</b> A logo is placed in the lower-right corner. You can update the logo by replacing the <code>logo.png</code> file in the same directory as this script.</li>" +
      "<li><b>Customizable:</b> You can edit all fields, font, size, margin, and toggle the logo overlay.</li>" +
      "</ul>" +
      "<p>To apply the script, click the OK button. To close this dialog without making any changes, click the Cancel button.</p>";

   //

   this.targetImage_Label = new Label( this );
   this.targetImage_Label.text = "Target image:";
   this.targetImage_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.targetImage_Label.minWidth = labelWidth1;

   this.targetImage_ViewList = new ViewList( this );
   this.targetImage_ViewList.getAll();
   this.targetImage_ViewList.currentView = engine.targetView;
   this.targetImage_ViewList.toolTip = "Select the image to draw the text over";
   this.targetImage_ViewList.onViewSelected = function( view )
   {
      engine.targetView = view;
   };

   this.targetImage_Sizer = new HorizontalSizer;
   this.targetImage_Sizer.spacing = 4;
   this.targetImage_Sizer.add( this.targetImage_Label );
   this.targetImage_Sizer.add( this.targetImage_ViewList, 100 );

   this.fontFace_Label = new Label( this );
   this.fontFace_Label.text = "Face:";
   this.fontFace_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.fontFace_Label.minWidth = labelWidth1 - this.logicalPixelsToPhysical( 4+1 );

   this.fontFace_ComboBox = new ComboBox( this );
   this.fontFace_ComboBox.addItem( "Space Grotesk" );
   this.fontFace_ComboBox.addItem( "Helvetica" );
   this.fontFace_ComboBox.addItem( "Times" );
   this.fontFace_ComboBox.addItem( "Courier" );
   this.fontFace_ComboBox.addItem( "SansSerif" );
   this.fontFace_ComboBox.addItem( "Serif" );
   this.fontFace_ComboBox.addItem( "Monospace" );
   this.fontFace_ComboBox.editEnabled = true;
   this.fontFace_ComboBox.editText = engine.fontFace;
   this.fontFace_ComboBox.toolTip = "Type a font face to draw with, or select a standard font family.";
   this.fontFace_ComboBox.onEditTextUpdated = function()
   {
      engine.fontFace = this.editText;
   };
   this.fontFace_ComboBox.onItemSelected = function( index )
   {
      engine.fontFace = this.itemText( index );
   };

   this.fontFace_Sizer = new HorizontalSizer;
   this.fontFace_Sizer.spacing = 4;
   this.fontFace_Sizer.add( this.fontFace_Label );
   this.fontFace_Sizer.add( this.fontFace_ComboBox, 100 );

   this.fontSize_Label = new Label( this );
   this.fontSize_Label.text = "Size (px):";
   this.fontSize_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.fontSize_Label.minWidth = labelWidth1 - this.logicalPixelsToPhysical( 4+1 );

   this.fontSize_SpinBox = new SpinBox( this );
   this.fontSize_SpinBox.minValue = 8;
   this.fontSize_SpinBox.maxValue = 4000;
   this.fontSize_SpinBox.value = engine.fontSize;
   this.fontSize_SpinBox.toolTip = "Font size in pixels.";
   this.fontSize_SpinBox.onValueUpdated = function( value )
   {
      engine.fontSize = value;
   };

   this.fontStyle_Sizer = new HorizontalSizer;
   this.fontStyle_Sizer.spacing = 4;
   this.fontStyle_Sizer.add( this.fontSize_Label );
   this.fontStyle_Sizer.add( this.fontSize_SpinBox );
   this.fontStyle_Sizer.addStretch();

   this.font_Sizer = new VerticalSizer;
   this.font_Sizer.margin = 4;
   this.font_Sizer.spacing = 4;
   this.font_Sizer.add( this.fontFace_Sizer );
   this.font_Sizer.add( this.fontStyle_Sizer );

   this.font_GroupBox = new GroupBox( this );
   this.font_GroupBox.title = "Font";
   this.font_GroupBox.sizer = this.font_Sizer;

   //

   this.margin_Label = new Label( this );
   this.margin_Label.text = "Margin (px):";
   this.margin_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.margin_Label.minWidth = labelWidth1;

   this.margin_SpinBox = new SpinBox( this );
   this.margin_SpinBox.minValue = 0;
   this.margin_SpinBox.maxValue = 250;
   this.margin_SpinBox.value = engine.margin;
   this.margin_SpinBox.toolTip = "The margin in pixels between the drawing rectangle and the borders of the image.";
   this.margin_SpinBox.onValueUpdated = function( value )
   {
      engine.margin = value;
   };
   
   this.logo_CheckBox = new CheckBox( this );
   this.logo_CheckBox.text = "Show Logo";
   this.logo_CheckBox.checked = engine.showLogo;
   this.logo_CheckBox.toolTip = "Add your logo in the bottom-right corner.";
   this.logo_CheckBox.onCheck = function( checked )
   {
      engine.showLogo = checked;
   };

   this.renderOptions_Sizer = new HorizontalSizer;
   this.renderOptions_Sizer.spacing = 4;
   this.renderOptions_Sizer.add( this.margin_Label );
   this.renderOptions_Sizer.add( this.margin_SpinBox );
   this.renderOptions_Sizer.addStretch();
   this.renderOptions_Sizer.add( this.logo_CheckBox );
   this.renderOptions_Sizer.addStretch();

   //

   this.newInstance_Button = new ToolButton( this );
   this.newInstance_Button.icon = this.scaledResource( ":/process-interface/new-instance.png" );
   this.newInstance_Button.setScaledFixedSize( 24, 24 );
   this.newInstance_Button.toolTip = "New Instance";
   this.newInstance_Button.onMousePress = function()
   {
      this.hasFocus = true;
      engine.exportParameters();
      this.pushed = false;
      this.dialog.newInstance();
   };

   this.ok_Button = new PushButton( this );
   this.ok_Button.text = "OK";
   this.ok_Button.icon = this.scaledResource( ":/icons/ok.png" );
   this.ok_Button.onClick = function()
   {
      this.dialog.ok();
   };

   this.cancel_Button = new PushButton( this );
   this.cancel_Button.text = "Cancel";
   this.cancel_Button.icon = this.scaledResource( ":/icons/cancel.png" );
   this.cancel_Button.onClick = function()
   {
      this.dialog.cancel();
   };

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 6;
   this.buttons_Sizer.add( this.newInstance_Button );
   this.buttons_Sizer.addStretch();
   // Add Refresh Preview button before OK/Cancel
   this.refreshPreview_Button = new PushButton(this);
   this.refreshPreview_Button.text = "Refresh Preview";
   this.refreshPreview_Button.toolTip = "Manually refresh the preview image and text overlay.";
   this.refreshPreview_Button.onClick = () => {
      // Always reload preview from current engine state
      this.updatePreview();
   };
   this.buttons_Sizer.add(this.refreshPreview_Button);
   this.buttons_Sizer.add( this.ok_Button );
   this.buttons_Sizer.add( this.cancel_Button );

   //

   // Subject Name & Catalog
   this.catalog_Label = new Label(this);
   this.catalog_Label.text = "Catalog:";
   this.catalog_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.catalog_Label.minWidth = labelWidth1 - this.logicalPixelsToPhysical( 4+1 );

   this.catalog_Edit = new Edit(this);
   this.catalog_Edit.text = engine.catalog ? String(engine.catalog) : "";
   this.catalog_Edit.onEditCompleted = function() { engine.catalog = this.text; };

   this.subject_Label = new Label(this);
   this.subject_Label.text = "Subject:";
   this.subject_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.subject_Label.minWidth = labelWidth1 - this.logicalPixelsToPhysical( 4+1 );

   this.subject_Edit = new Edit(this);
   this.subject_Edit.text = engine.subject ? String(engine.subject) : "";
   this.subject_Edit.onEditCompleted = function() { engine.subject = this.text; };

   this.subject_Sizer = new HorizontalSizer;
   this.subject_Sizer.spacing = 4;
   this.subject_Sizer.add(this.catalog_Label);
   this.subject_Sizer.add(this.catalog_Edit, 100);
   this.subject_Sizer.add(this.subject_Label);
   this.subject_Sizer.add(this.subject_Edit, 100);

   // Exposure and Frames (user-editable)
   this.exposure_Label = new Label(this);
   this.exposure_Label.text = "Exposure(s):";
   this.exposure_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.exposure_Label.minWidth = labelWidth1 - this.logicalPixelsToPhysical( 4+1 );

   this.exposure_Edit = new Edit(this);
   this.exposure_Edit.text = engine.exposure ? String(engine.exposure) : "";
   this.exposure_Edit.toolTip = "Exposure time per frame in seconds";
   this.exposure_Edit.onEditCompleted = function() {
      engine.exposure = this.text;
      // No need to update integration field, it's calculated dynamically
   };

   this.frames_Label = new Label(this);
   this.frames_Label.text = "Frames:";
   this.frames_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.frames_Label.minWidth = labelWidth1 - this.logicalPixelsToPhysical( 4+1 );

   this.frames_Edit = new Edit(this);
   this.frames_Edit.text = engine.frames ? String(engine.frames) : "";
   this.frames_Edit.toolTip = "Number of frames";
   this.frames_Edit.onEditCompleted = function() {
      engine.frames = this.text;
      // No need to update integration field, it's calculated dynamically
   };

   this.exposure_Sizer = new HorizontalSizer;
   this.exposure_Sizer.spacing = 4;
   this.exposure_Sizer.add(this.exposure_Label);
   this.exposure_Sizer.add(this.exposure_Edit, 50);
   this.exposure_Sizer.add(this.frames_Label);
   this.exposure_Sizer.add(this.frames_Edit, 50);

   // Date
   this.date_Label = new Label(this);
   this.date_Label.text = "Date:";
   this.date_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.date_Label.minWidth = labelWidth1 - this.logicalPixelsToPhysical( 4+1 );
   
   this.date_Edit = new Edit(this);
   this.date_Edit.text = engine.date ? String(engine.date) : "";
   this.date_Edit.onEditCompleted = function() { engine.date = this.text; };

   this.date_Sizer = new HorizontalSizer;
   this.date_Sizer.spacing = 4;
   this.date_Sizer.add(this.date_Label);
   this.date_Sizer.add(this.date_Edit, 100);

   // Location
   this.location_Label = new Label(this);
   this.location_Label.text = "Location:";
   this.location_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.location_Label.minWidth = labelWidth1 - this.logicalPixelsToPhysical( 4+1 );
   
   this.location_Edit = new Edit(this);
   this.location_Edit.text = engine.location ? String(engine.location) : "";
   this.location_Edit.onEditCompleted = function() { engine.location = this.text; };

   this.location_Sizer = new HorizontalSizer;
   this.location_Sizer.spacing = 4;
   this.location_Sizer.add(this.location_Label);
   this.location_Sizer.add(this.location_Edit, 100);

   //

   // --- PREVIEW CONTROL AND LAYOUT ---

   // Add preview control
   this.previewControl = new DrawSignaturePreviewControl(this);

   // Add zoom controls
   this.zoomInButton = new PushButton(this);
   this.zoomInButton.text = "";
   this.zoomInButton.icon = this.scaledResource(":/icons/zoom-in.png");
   this.zoomInButton.toolTip = "Zoom In";
   this.zoomInButton.onClick = () => {
      this.previewControl.zoomIn();
   };

   this.zoomOutButton = new PushButton(this);
   this.zoomOutButton.text = "";
   this.zoomOutButton.icon = this.scaledResource(":/icons/zoom-out.png");
   this.zoomOutButton.toolTip = "Zoom Out";
   this.zoomOutButton.onClick = () => {
      this.previewControl.zoomOut();
   };

   this.zoomLabel = new Label(this);
   this.zoomLabel.text = "Zoom In/Out (Mouse Wheel Supported)";

   this.zoomSizer = new HorizontalSizer;
   this.zoomSizer.spacing = 6;
   this.zoomSizer.add(this.zoomInButton);
   this.zoomSizer.add(this.zoomOutButton);
   this.zoomSizer.add(this.zoomLabel);
   this.zoomSizer.addStretch();

   // --- LAYOUT: Place preview and zoom controls on the right ---

   var leftSizer = new VerticalSizer;
   leftSizer.margin = 0;
   leftSizer.spacing = 6;
   leftSizer.add(this.helpLabel);
   leftSizer.addSpacing(4);
   leftSizer.add(this.targetImage_Sizer);
   leftSizer.add(this.subject_Sizer);
   leftSizer.add(this.exposure_Sizer);
   leftSizer.add(this.date_Sizer);
   leftSizer.add(this.location_Sizer);
   leftSizer.add(this.font_GroupBox);
   leftSizer.add(this.renderOptions_Sizer);
   leftSizer.add(this.buttons_Sizer);
   // leftSizer.addStretch();

   // --- Add updatePreview method to the dialog instance ---
   this.updatePreview = function() {
      if (!engine.targetView || engine.targetView.isNull)
         return;
      var previewImage = new Image(engine.targetView.image);
      var font = new Font(engine.fontFace);
      font.pixelSize = engine.fontSize;
      var text = engine.composeText();
      var lines = text.split("\n");
      var innerMargin = Math.round(font.pixelSize/5);
      var linePadding = 10; // Add 10px padding between lines
      var maxWidth = 0;
      for (var i = 0; i < lines.length; ++i)
         maxWidth = Math.max(maxWidth, font.width(lines[i]));
      var width = maxWidth + 2*innerMargin;
      var height = font.ascent*lines.length + font.descent + 2*innerMargin + (lines.length > 1 ? (lines.length-1)*linePadding : 0);
      var bmp = new Bitmap(width, height);
      bmp.fill(0x00000000);
      var G = new Graphics(bmp);
      G.font = font;
      G.pen = new Pen(0xFFFFFFFF);
      G.transparentBackground = true;
      G.textAntialiasing = true;
      for (var i = 0; i < lines.length; ++i)
         G.drawText(
            innerMargin,
            height - font.descent - innerMargin - (lines.length-1-i)*(font.ascent + linePadding),
            lines[i]
         );
      G.end();
      previewImage.selectedPoint = new Point(engine.margin, previewImage.height - engine.margin - height);
      previewImage.blend(bmp);

        var logoPath = logoDir;
        console.writeln("Logo path resolved to: " + logoPath);

        //check if the logo file exists
        if (!File.exists(logoPath)) {
            console.criticalln("Logo file not found!");
        } else {
            console.writeln("Logo file exists. Trying to load bitmap...");
        }

        if(engine.showLogo) {
            try {
                var logoBmp = new Bitmap(logoPath);
                console.writeln("Bitmap loaded. Size: " + logoBmp.width + "x" + logoBmp.height);

                var x = previewImage.width - engine.margin - logoBmp.width;
                var y = previewImage.height - engine.margin - logoBmp.height;

                previewImage.selectedPoint = new Point(x, y);
                previewImage.blend(logoBmp);
            } catch (e) {
                console.criticalln("Failed to create Bitmap: " + e.toString());
            }
        }
      this.previewControl.doUpdateImage(previewImage);
   };

   // Target image selection
   this.targetImage_ViewList.onViewSelected = function(view) {
      engine.targetView = view;
      this.updatePreview();
   };

   // Ensure preview updates on dialog show (fixes initial text not updating)
   this.onShow = function() {
      this._fitZoomInitialized = false;
      this.updatePreview();
   };

   // Initial preview
   this._fitZoomInitialized = false;
   this.updatePreview();

   var rightSizer = new VerticalSizer;
   rightSizer.spacing = 6;
   rightSizer.add(this.zoomSizer);
   rightSizer.add(this.previewControl, 1);

   var mainSizer = new HorizontalSizer;
   mainSizer.margin = 6;
   mainSizer.spacing = 8;
   mainSizer.add(leftSizer);
   mainSizer.add(rightSizer, 1);

   this.sizer = mainSizer;

   this.windowTitle = #TITLE + " Script";
   this.adjustToContents();
   this.setFixedSize();
}
DrawSignatureDialog.prototype = new Dialog;

function DrawSignaturePreviewControl(parent) {
   this.__base__ = ScrollBox;
   this.__base__(parent);

   // Larger preview area
   this.setMinWidth(900);
   this.setMinHeight(400);

   this.autoScroll = true;
   this.tracking = true;

   this.previewImage = null;
   this.zoomFactor = 1.0;
   this.minZoomFactor = 0.1;
   this.maxZoomFactor = 10.0;
   this.dragging = false;
   this.dragOrigin = new Point(0, 0);

   this.getImage = function() {
      return this.previewImage;
   };

   this.doUpdateImage = function(image) {
      this.previewImage = image;
      // Automatically set zoom to fit the image to the viewport
      if (this.viewport && image && image.width > 0 && image.height > 0) {
         var fitZoom = Math.min(
            this.viewport.width / image.width,
            this.viewport.height / image.height,
            1.0
         );
         this.zoomFactor = fitZoom;
      }
      this.initScrollBars();
      if (this.viewport)
         this.viewport.update();
   };

   this.initScrollBars = function(scrollPoint) {
      var image = this.getImage();
      if (!image || image.width <= 0 || image.height <= 0) {
         this.setHorizontalScrollRange(0, 0);
         this.setVerticalScrollRange(0, 0);
         this.scrollPosition = new Point(0, 0);
      } else {
         let zoomFactor = this.zoomFactor;
         this.setHorizontalScrollRange(0, Math.max(0, image.width * zoomFactor - this.viewport.width));
         this.setVerticalScrollRange(0, Math.max(0, image.height * zoomFactor - this.viewport.height));
         if (scrollPoint) {
            this.scrollPosition = scrollPoint;
         } else {
            this.scrollPosition = new Point(
               Math.min(this.scrollPosition ? this.scrollPosition.x : 0, Math.max(0, image.width * zoomFactor - this.viewport.width)),
               Math.min(this.scrollPosition ? this.scrollPosition.y : 0, Math.max(0, image.height * zoomFactor - this.viewport.height))
            );
         }
      }
      if (this.viewport)
         this.viewport.update();
   };

   // Zoom In/Out methods
   this.zoomIn = function() {
      this.zoomFactor = Math.min(this.zoomFactor * 1.25, this.maxZoomFactor);
      this.initScrollBars();
      if (this.viewport)
         this.viewport.update();
   };
   this.zoomOut = function() {
      this.zoomFactor = Math.max(this.zoomFactor * 0.8, this.minZoomFactor);
      this.initScrollBars();
      if (this.viewport)
         this.viewport.update();
   };

   // Mouse wheel zoom
   this.viewport.onMouseWheel = function(x, y, delta, buttons, modifiers) {
      var parent = this.parent;
      if (delta > 0) {
         parent.zoomIn();
      } else if (delta < 0) {
         parent.zoomOut();
      }
   };

   // Drag to scroll
   this.viewport.onMousePress = function(x, y, button, buttons, modifiers) {
      var parent = this.parent;
      parent.dragging = true;
      parent.dragOrigin.x = x;
      parent.dragOrigin.y = y;
      this.cursor = new Cursor(StdCursor_ClosedHand);
   };
   this.viewport.onMouseMove = function(x, y, buttons, modifiers) {
      var parent = this.parent;
      if (parent.dragging) {
         var dx = x - parent.dragOrigin.x;
         var dy = y - parent.dragOrigin.y;
         parent.scrollPosition = new Point(
            Math.max(0, Math.min(parent.scrollPosition.x - dx, Math.max(0, (parent.getImage() ? parent.getImage().width * parent.zoomFactor : 0) - this.width))),
            Math.max(0, Math.min(parent.scrollPosition.y - dy, Math.max(0, (parent.getImage() ? parent.getImage().height * parent.zoomFactor : 0) - this.height)))
         );
         parent.dragOrigin.x = x;
         parent.dragOrigin.y = y;
         this.update();
      }
   };
   this.viewport.onMouseRelease = function(x, y, button, buttons, modifiers) {
      this.cursor = new Cursor(StdCursor_OpenHand);
      this.parent.dragging = false;
   };

   // Redraw on resize
   this.viewport.onResize = function() {
      this.parent.initScrollBars();
   };

   // Paint the preview with zoom and scroll
   this.viewport.onPaint = function(x0, y0, x1, y1) {
      var g = new Graphics(this);
      var previewImage = this.parent.previewImage;
      var zoom = this.parent.zoomFactor;
      var scroll = this.parent.scrollPosition || new Point(0, 0);
      if (previewImage && previewImage.width > 0 && previewImage.height > 0) {
         g.fillRect(x0, y0, x1, y1, new Brush(0xff222222));
         g.scaleTransformation(zoom);
         g.translateTransformation(-scroll.x / zoom, -scroll.y / zoom);
         g.drawBitmap(0, 0, previewImage.render());
      } else {
         g.fillRect(x0, y0, x1, y1, new Brush(0xff222222));
         g.drawText(10, 30, "No preview available");
      }
      g.end();
   };

   // Initial scrollbars
   this.initScrollBars();
}
DrawSignaturePreviewControl.prototype = new ScrollBox;

/*
 * Script entry point.
 */
function main()
{
   // If the script is being executed as a Script instance on a view context,
   // then apply it and exit, without showing any graphical user interface.
   // This allows us to run a script just as a regular (module-defined) process
   // instance.
   if ( Parameters.isViewTarget )
   {
      engine.apply();
      return;
   }

#ifndef __DEBUG__
   console.hide();
#endif

   // If the script is being executed either directly or in the global context,
   // then we need a target view, so an image window must be available.
   if ( !engine.targetView )
   {
      var msg = new MessageBox( "There is no active image window!",
                                (#TITLE + " Script"), StdIcon_Error, StdButton_Ok );
      msg.execute();
      return;
   }

   var dialog = new DrawSignatureDialog();
   for ( ;; )
   {
      // Execute the DrawSignature dialog.
      if ( !dialog.execute() )
         break;

      // A view must be selected.
      if ( engine.targetView.isNull )
      {
         var msg = new MessageBox( "You must select a view to apply this script.",
                                   (#TITLE + " Script"), StdIcon_Error, StdButton_Ok );
         msg.execute();
         continue;
      }

      // Perform the DrawSignature routine.
      engine.apply();

      // Quit after successful execution.
      break;
   }
}

main();

function getFITSKeyword(view, key) {
   if (!view || !view.keywords) return "";
   for (let i = 0; i < view.keywords.length; ++i)
      if (view.keywords[i].name.toUpperCase() === key.toUpperCase())
         return view.keywords[i].strippedValue || view.keywords[i].value || "";
   return "";
}