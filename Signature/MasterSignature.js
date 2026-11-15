#engine v8
#feature-id    MasterSignature : PFRAstro > Master Signature

#feature-info  Adds image details to the bottom left hand corner of the image \
               and the user logo to the bottom right. The user can select the \
               text, font and size of the text to be drawn. Can also run \
               headless from the PixInsight command line (see header comment).

/*
 * MasterSignature
 *
 * Interactive: Script > PFRAstro > Master Signature.
 *
 * Headless / command line: pass key=value arguments. Arguments are separated
 * by commas, so use ';' between filters. Example (Windows):
 *
 *   PixInsight.exe -n --automation-mode --force-exit ^
 *     -r="D:/path/MasterSignature.js,input=D:/img/M31.xisf,output=D:/img/M31_signed.xisf,catalog=M31,subject=Andromeda Galaxy,filters=L:300x40;R:300x20;G:300x20;B:300x20,date=10/12/2026,location=Backyard"
 *
 * Keys (all optional):
 *   input=<file>        open this image (otherwise view=<id>, otherwise the active window)
 *   view=<viewId>       sign an image that's already open
 *   output=<file>       save the signed image here (format from the extension)
 *   keepOpen=true       keep an image opened by input= open after saving
 *   catalog, subject, date, location
 *   exposure, frames    simple mode (exposure x frames)
 *   integration=5.5 h   direct mode (total integration text)
 *   filters=L:300x40;Ha:600x12   detailed mode (per filter: exposure x frames)
 *   mode=simple|direct|detailed  (inferred from integration=/filters= if omitted)
 *   fontFace, fontSize (px), margin (px), logo=true|false, logoPath=<png>,
 *   textOpacity, logoOpacity (0-100)
 *   help                print this list to the console
 *
 * Fields left out are taken from the FITS header (OBJECT, SUBJECT, EXPTIME,
 * FRAMES/NFRAMES, DATE-OBS, OBSERVER/LOCATN/SITE) where present.
 */

(function() {
"use strict";

CoreApplication.ensureMinimumVersion(1, 9, 4);

#include "MasterSignature-core.js"

MS_CONFIG.scriptDir = File.extractDrive(#__FILE__) + File.extractDirectory(#__FILE__);

const engine = new DrawSignatureEngine();

/**
 * Dialog for editing the signature parameters.
 */
class DrawSignatureDialog extends Dialog {
   constructor() {
      super();

      const self = this;
      this.layoutReady = false;

      const labelWidth1 = this.font.width("Target image:");
      const labelWidth2 = labelWidth1 - this.logicalPixelsToPhysical(4 + 1);

      this.helpLabel = new Label(this);
      this.helpLabel.frameStyle = FrameStyle.Box;
      this.helpLabel.margin = 4;
      this.helpLabel.wordWrapping = true;
      this.helpLabel.useRichText = true;
      this.helpLabel.text = "<p><b>" + SCRIPT_TITLE + " v" + SCRIPT_VERSION +
         "</b> &mdash; This script overlays a two-line signature block and a logo on your image, inspired by the Celestron Origin output files.<br/>" +
         "<ul>" +
         "<li><b>Signature Block:</b> Includes Subject, Catalog, Integration Time, Date, and Location.</li>" +
         "<li><b>Integration Modes:</b> Choose Simple (exposure × frames), Direct entry (type total time), or Detailed (per-filter breakdown).</li>" +
         "<li><b>FITS Header Integration:</b> Where possible, fields are auto-populated from the FITS header.</li>" +
         "<li><b>Transparency:</b> Adjust text and logo opacity independently (0-100%).</li>" +
         "<li><b>Logo Overlay:</b> A logo is placed in the lower-right corner. Replace <code>logo.png</code> in the script directory to customize.</li>" +
         "</ul>" +
         "<p>Click OK to apply, Cancel to close without changes.</p>";

      // --- Target image ---
      this.targetImage_Label = new Label(this);
      this.targetImage_Label.text = "Target image:";
      this.targetImage_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
      this.targetImage_Label.minWidth = labelWidth1;

      this.targetImage_ViewList = new ViewList(this);
      this.targetImage_ViewList.getAll();
      if (engine.targetView)
         this.targetImage_ViewList.currentView = engine.targetView;
      this.targetImage_ViewList.toolTip = "Select the image to draw the text over";
      this.targetImage_ViewList.onViewSelected = function(view) {
         engine.targetView = (view && !view.isNull) ? view : null;
         self.updatePreview();
      };

      this.targetImage_Sizer = new HorizontalSizer;
      this.targetImage_Sizer.spacing = 4;
      this.targetImage_Sizer.add(this.targetImage_Label);
      this.targetImage_Sizer.add(this.targetImage_ViewList, 100);

      // --- Font ---
      this.fontFace_Label = new Label(this);
      this.fontFace_Label.text = "Face:";
      this.fontFace_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
      this.fontFace_Label.minWidth = labelWidth2;

      this.fontFace_ComboBox = new ComboBox(this);
      for (const f of ["Space Grotesk", "Helvetica", "Times", "Courier", "SansSerif", "Serif", "Monospace"])
         this.fontFace_ComboBox.addItem(f);
      this.fontFace_ComboBox.editEnabled = true;
      this.fontFace_ComboBox.editText = engine.fontFace;
      this.fontFace_ComboBox.toolTip = "Type a font face to draw with, or select a standard font family.";
      this.fontFace_ComboBox.onEditTextUpdated = function() {
         engine.fontFace = this.editText;
      };
      this.fontFace_ComboBox.onItemSelected = function(index) {
         engine.fontFace = this.itemText(index);
      };

      this.fontFace_Sizer = new HorizontalSizer;
      this.fontFace_Sizer.spacing = 4;
      this.fontFace_Sizer.add(this.fontFace_Label);
      this.fontFace_Sizer.add(this.fontFace_ComboBox, 100);

      this.fontSize_Label = new Label(this);
      this.fontSize_Label.text = "Size (px):";
      this.fontSize_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
      this.fontSize_Label.minWidth = labelWidth2;

      this.fontSize_SpinBox = new SpinBox(this);
      this.fontSize_SpinBox.minValue = 8;
      this.fontSize_SpinBox.maxValue = 4000;
      this.fontSize_SpinBox.value = engine.fontSize;
      this.fontSize_SpinBox.toolTip = "Font size in pixels.";
      this.fontSize_SpinBox.onValueUpdated = function(value) {
         engine.fontSize = value;
         engine.fontSizeExplicit = true;
      };

      this.fontStyle_Sizer = new HorizontalSizer;
      this.fontStyle_Sizer.spacing = 4;
      this.fontStyle_Sizer.add(this.fontSize_Label);
      this.fontStyle_Sizer.add(this.fontSize_SpinBox);
      this.fontStyle_Sizer.addStretch();

      this.font_GroupBox = new GroupBox(this);
      this.font_GroupBox.title = "Font";
      this.font_GroupBox.sizer = new VerticalSizer;
      this.font_GroupBox.sizer.margin = 4;
      this.font_GroupBox.sizer.spacing = 4;
      this.font_GroupBox.sizer.add(this.fontFace_Sizer);
      this.font_GroupBox.sizer.add(this.fontStyle_Sizer);

      // --- Margin / logo ---
      this.margin_Label = new Label(this);
      this.margin_Label.text = "Margin (px):";
      this.margin_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
      this.margin_Label.minWidth = labelWidth1;

      this.margin_SpinBox = new SpinBox(this);
      this.margin_SpinBox.minValue = 0;
      this.margin_SpinBox.maxValue = 250;
      this.margin_SpinBox.value = Math.min(engine.margin, 250);
      this.margin_SpinBox.toolTip = "The margin in pixels between the drawing rectangle and the borders of the image.";
      this.margin_SpinBox.onValueUpdated = function(value) {
         engine.margin = value;
      };

      this.logo_CheckBox = new CheckBox(this);
      this.logo_CheckBox.text = "Show Logo";
      this.logo_CheckBox.checked = engine.showLogo;
      this.logo_CheckBox.toolTip = "Add your logo in the bottom-right corner.";
      this.logo_CheckBox.onCheck = function(checked) {
         engine.showLogo = checked;
      };

      this.renderOptions_Sizer = new HorizontalSizer;
      this.renderOptions_Sizer.spacing = 4;
      this.renderOptions_Sizer.add(this.margin_Label);
      this.renderOptions_Sizer.add(this.margin_SpinBox);
      this.renderOptions_Sizer.addStretch();
      this.renderOptions_Sizer.add(this.logo_CheckBox);
      this.renderOptions_Sizer.addStretch();

      // --- Opacity ---
      this.opacity_Sizer = new HorizontalSizer;
      this.opacity_Sizer.spacing = 4;
      this.addOpacityControls("Text Opacity:", "textOpacity", "Text");
      this.opacity_Sizer.addSpacing(16);
      this.addOpacityControls("Logo Opacity:", "logoOpacity", "Logo");
      this.opacity_Sizer.addStretch();

      // --- Buttons ---
      this.newInstance_Button = new ToolButton(this);
      this.newInstance_Button.icon = this.scaledResource(":/process-interface/new-instance.png");
      this.newInstance_Button.setScaledFixedSize(24, 24);
      this.newInstance_Button.toolTip = "New Instance";
      this.newInstance_Button.onMousePress = function() {
         this.hasFocus = true;
         engine.exportParameters();
         this.pushed = false;
         this.dialog.newInstance();
      };

      this.refreshPreview_Button = new PushButton(this);
      this.refreshPreview_Button.text = "Refresh Preview";
      this.refreshPreview_Button.toolTip = "Manually refresh the preview image and text overlay.";
      this.refreshPreview_Button.onClick = function() {
         self.updatePreview();
      };

      this.ok_Button = new PushButton(this);
      this.ok_Button.text = "OK";
      this.ok_Button.icon = this.scaledResource(":/icons/ok.png");
      this.ok_Button.onClick = function() {
         this.dialog.ok();
      };

      this.cancel_Button = new PushButton(this);
      this.cancel_Button.text = "Cancel";
      this.cancel_Button.icon = this.scaledResource(":/icons/cancel.png");
      this.cancel_Button.onClick = function() {
         this.dialog.cancel();
      };

      this.buttons_Sizer = new HorizontalSizer;
      this.buttons_Sizer.spacing = 6;
      this.buttons_Sizer.add(this.newInstance_Button);
      this.buttons_Sizer.addStretch();
      this.buttons_Sizer.add(this.refreshPreview_Button);
      this.buttons_Sizer.add(this.ok_Button);
      this.buttons_Sizer.add(this.cancel_Button);

      // --- Catalog & subject ---
      this.catalog_Label = this.makeLabel("Catalog:", labelWidth2);
      this.catalog_Edit = this.makeEdit(engine.catalog, function(text) { engine.catalog = text; });
      this.subject_Label = this.makeLabel("Subject:", labelWidth2);
      this.subject_Edit = this.makeEdit(engine.subject, function(text) { engine.subject = text; });

      this.subject_Sizer = new HorizontalSizer;
      this.subject_Sizer.spacing = 4;
      this.subject_Sizer.add(this.catalog_Label);
      this.subject_Sizer.add(this.catalog_Edit, 100);
      this.subject_Sizer.add(this.subject_Label);
      this.subject_Sizer.add(this.subject_Edit, 100);

      // --- Integration mode ---
      this.integrationMode_Label = this.makeLabel("Integration Mode:", labelWidth2);

      this.modeRadios = [];
      const modeSpecs = [
         ["Simple (Exp × Frames)", "Calculate integration from single exposure time and frame count"],
         ["Direct Entry", "Enter total integration time directly (e.g., '5.5 h')"],
         ["Detailed (Per Filter)", "Enter exposure details for each filter separately"]
      ];
      this.integrationMode_Sizer = new HorizontalSizer;
      this.integrationMode_Sizer.spacing = 8;
      this.integrationMode_Sizer.add(this.integrationMode_Label);
      modeSpecs.forEach(([text, tip], mode) => {
         const radio = new RadioButton(this);
         radio.text = text;
         radio.toolTip = tip;
         radio.checked = (engine.integrationMode === mode);
         radio.onCheck = function(checked) {
            if (checked) {
               engine.integrationMode = mode;
               self.updateIntegrationModeUI();
            }
         };
         this.modeRadios.push(radio);
         this.integrationMode_Sizer.add(radio);
      });
      this.integrationMode_Sizer.addStretch();

      // Simple mode
      this.simpleMode_GroupBox = new GroupBox(this);
      this.simpleMode_GroupBox.title = "Simple Mode";
      this.exposure_Edit = this.makeEdit(engine.exposure, function(text) { engine.exposure = text; }, 80,
         "Exposure time per frame in seconds", this.simpleMode_GroupBox);
      this.frames_Edit = this.makeEdit(engine.frames, function(text) { engine.frames = text; }, 80,
         "Number of frames", this.simpleMode_GroupBox);
      this.simpleMode_GroupBox.sizer = new HorizontalSizer;
      this.simpleMode_GroupBox.sizer.margin = 4;
      this.simpleMode_GroupBox.sizer.spacing = 4;
      this.simpleMode_GroupBox.sizer.add(this.makeLabel("Exposure(s):", 0, this.simpleMode_GroupBox));
      this.simpleMode_GroupBox.sizer.add(this.exposure_Edit);
      this.simpleMode_GroupBox.sizer.addSpacing(8);
      this.simpleMode_GroupBox.sizer.add(this.makeLabel("Frames:", 0, this.simpleMode_GroupBox));
      this.simpleMode_GroupBox.sizer.add(this.frames_Edit);
      this.simpleMode_GroupBox.sizer.addStretch();

      // Direct mode
      this.directMode_GroupBox = new GroupBox(this);
      this.directMode_GroupBox.title = "Direct Entry Mode";
      this.directIntegration_Edit = this.makeEdit(engine.directIntegration, function(text) { engine.directIntegration = text; }, 150,
         "Enter total integration time (e.g., '5.5 h', '120 min', '3600s')", this.directMode_GroupBox);
      this.directMode_GroupBox.sizer = new HorizontalSizer;
      this.directMode_GroupBox.sizer.margin = 4;
      this.directMode_GroupBox.sizer.spacing = 4;
      this.directMode_GroupBox.sizer.add(this.makeLabel("Total Integration:", 0, this.directMode_GroupBox));
      this.directMode_GroupBox.sizer.add(this.directIntegration_Edit);
      this.directMode_GroupBox.sizer.addStretch();

      // Detailed mode (per filter). Each row is its own Control so it can be
      // hidden and removed as one unit.
      this.detailedMode_GroupBox = new GroupBox(this);
      this.detailedMode_GroupBox.title = "Detailed Mode (Per Filter)";

      this.filterRows = [];
      this.filterRowsSizer = new VerticalSizer;
      this.filterRowsSizer.spacing = 4;
      for (let i = 0; i < engine.filterDetails.length; i++)
         this.addFilterRow(i);

      this.addFilter_Button = new PushButton(this.detailedMode_GroupBox);
      this.addFilter_Button.text = "Add Filter";
      this.addFilter_Button.toolTip = "Add another filter entry";
      this.addFilter_Button.onClick = function() {
         engine.filterDetails.push({ filter: "", exposure: "", frames: "" });
         self.addFilterRow(engine.filterDetails.length - 1);
         self.relayout();
      };

      this.removeFilter_Button = new PushButton(this.detailedMode_GroupBox);
      this.removeFilter_Button.text = "Remove Last";
      this.removeFilter_Button.toolTip = "Remove the last filter entry";
      this.removeFilter_Button.onClick = function() {
         if (engine.filterDetails.length > 1) {
            engine.filterDetails.pop();
            const row = self.filterRows.pop();
            row.hide();
            self.filterRowsSizer.remove(row);
            self.relayout();
         }
      };

      this.filterButtons_Sizer = new HorizontalSizer;
      this.filterButtons_Sizer.spacing = 4;
      this.filterButtons_Sizer.add(this.addFilter_Button);
      this.filterButtons_Sizer.add(this.removeFilter_Button);
      this.filterButtons_Sizer.addStretch();

      this.detailedMode_GroupBox.sizer = new VerticalSizer;
      this.detailedMode_GroupBox.sizer.margin = 4;
      this.detailedMode_GroupBox.sizer.spacing = 4;
      this.detailedMode_GroupBox.sizer.add(this.filterRowsSizer);
      this.detailedMode_GroupBox.sizer.add(this.filterButtons_Sizer);

      this.integration_Sizer = new VerticalSizer;
      this.integration_Sizer.spacing = 4;
      this.integration_Sizer.add(this.integrationMode_Sizer);
      this.integration_Sizer.add(this.simpleMode_GroupBox);
      this.integration_Sizer.add(this.directMode_GroupBox);
      this.integration_Sizer.add(this.detailedMode_GroupBox);

      // --- Date & location ---
      this.date_Edit = this.makeEdit(engine.date, function(text) { engine.date = text; });
      this.date_Sizer = new HorizontalSizer;
      this.date_Sizer.spacing = 4;
      this.date_Sizer.add(this.makeLabel("Date:", labelWidth2));
      this.date_Sizer.add(this.date_Edit, 100);

      this.location_Edit = this.makeEdit(engine.location, function(text) { engine.location = text; });
      this.location_Sizer = new HorizontalSizer;
      this.location_Sizer.spacing = 4;
      this.location_Sizer.add(this.makeLabel("Location:", labelWidth2));
      this.location_Sizer.add(this.location_Edit, 100);

      // --- Preview ---
      this.previewControl = new DrawSignaturePreviewControl(this);

      this.zoomInButton = new PushButton(this);
      this.zoomInButton.icon = this.scaledResource(":/icons/zoom-in.png");
      this.zoomInButton.toolTip = "Zoom In";
      this.zoomInButton.onClick = function() { self.previewControl.zoomIn(); };

      this.zoomOutButton = new PushButton(this);
      this.zoomOutButton.icon = this.scaledResource(":/icons/zoom-out.png");
      this.zoomOutButton.toolTip = "Zoom Out";
      this.zoomOutButton.onClick = function() { self.previewControl.zoomOut(); };

      this.zoomLabel = new Label(this);
      this.zoomLabel.text = "Zoom In/Out (Mouse Wheel Supported)";

      this.zoomSizer = new HorizontalSizer;
      this.zoomSizer.spacing = 6;
      this.zoomSizer.add(this.zoomInButton);
      this.zoomSizer.add(this.zoomOutButton);
      this.zoomSizer.add(this.zoomLabel);
      this.zoomSizer.addStretch();

      // --- Layout ---
      const leftSizer = new VerticalSizer;
      leftSizer.spacing = 6;
      leftSizer.add(this.helpLabel);
      leftSizer.addSpacing(4);
      leftSizer.add(this.targetImage_Sizer);
      leftSizer.add(this.subject_Sizer);
      leftSizer.add(this.integration_Sizer);
      leftSizer.add(this.date_Sizer);
      leftSizer.add(this.location_Sizer);
      leftSizer.add(this.font_GroupBox);
      leftSizer.add(this.renderOptions_Sizer);
      leftSizer.add(this.opacity_Sizer);
      leftSizer.add(this.buttons_Sizer);

      const rightSizer = new VerticalSizer;
      rightSizer.spacing = 6;
      rightSizer.add(this.zoomSizer);
      rightSizer.add(this.previewControl, 1);

      this.sizer = new HorizontalSizer;
      this.sizer.margin = 6;
      this.sizer.spacing = 8;
      this.sizer.add(leftSizer);
      this.sizer.add(rightSizer, 1);

      this.windowTitle = SCRIPT_TITLE + " Script";
      this.updateIntegrationModeUI();
      this.layoutReady = true;
      this.relayout();

      this.onShow = function() {
         self.updatePreview();
      };
   }

   makeLabel(text, minWidth, parent) {
      const label = new Label(parent || this);
      label.text = text;
      label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
      if (minWidth) label.minWidth = minWidth;
      return label;
   }

   // onTextUpdated keeps the engine in sync on every keystroke, so clicking
   // OK or Refresh Preview straight after typing never loses the last edit.
   makeEdit(value, onChange, fixedWidth, toolTip, parent) {
      const edit = new Edit(parent || this);
      edit.text = value ? String(value) : "";
      if (fixedWidth) edit.setFixedWidth(fixedWidth);
      if (toolTip) edit.toolTip = toolTip;
      edit.onTextUpdated = function(text) { onChange(text); };
      return edit;
   }

   addOpacityControls(labelText, field, what) {
      const tip = what + " transparency (0=invisible, 100=fully opaque)";
      const label = new Label(this);
      label.text = labelText;
      label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

      const slider = new Slider(this);
      slider.minValue = 0;
      slider.maxValue = 100;
      slider.value = engine[field];
      slider.setFixedWidth(120);
      slider.toolTip = tip;

      const spin = new SpinBox(this);
      spin.minValue = 0;
      spin.maxValue = 100;
      spin.value = engine[field];
      spin.setFixedWidth(70);
      spin.toolTip = tip;

      slider.onValueUpdated = function(value) { engine[field] = value; spin.value = value; };
      spin.onValueUpdated = function(value) { engine[field] = value; slider.value = value; };

      const percent = new Label(this);
      percent.text = "%";

      this.opacity_Sizer.add(label);
      this.opacity_Sizer.add(slider);
      this.opacity_Sizer.add(spin);
      this.opacity_Sizer.add(percent);
   }

   addFilterRow(index) {
      const detail = engine.filterDetails[index];
      const row = new Control(this.detailedMode_GroupBox);

      const makeField = (key, tip) => {
         const edit = new Edit(row);
         edit.text = detail[key] || "";
         edit.toolTip = tip;
         edit.setFixedWidth(60);
         edit.onTextUpdated = function(text) { engine.filterDetails[index][key] = text; };
         return edit;
      };
      const makeRowLabel = text => {
         const label = new Label(row);
         label.text = text;
         label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
         return label;
      };

      row.sizer = new HorizontalSizer;
      row.sizer.spacing = 4;
      row.sizer.add(makeRowLabel("Filter:"));
      row.sizer.add(makeField("filter", "Filter name (e.g., L, R, G, B, Ha, OIII, SII)"));
      row.sizer.addSpacing(4);
      row.sizer.add(makeRowLabel("Exp(s):"));
      row.sizer.add(makeField("exposure", "Exposure time in seconds"));
      row.sizer.addSpacing(4);
      row.sizer.add(makeRowLabel("Frames:"));
      row.sizer.add(makeField("frames", "Number of frames"));
      row.sizer.addStretch();
      row.adjustToContents();

      this.filterRows.push(row);
      this.filterRowsSizer.add(row);
   }

   updateIntegrationModeUI() {
      this.simpleMode_GroupBox.visible = (engine.integrationMode === 0);
      this.directMode_GroupBox.visible = (engine.integrationMode === 1);
      this.detailedMode_GroupBox.visible = (engine.integrationMode === 2);
      this.relayout();
   }

   /**
    * The dialog is fixed-size, so a change in content (filter rows added or
    * removed, mode group boxes shown/hidden) needs the size unlocked, the
    * layout recomputed, then locked again. Without this the new rows get
    * squeezed into the old height until the window is moved.
    */
   relayout() {
      if (!this.layoutReady) return;
      this.detailedMode_GroupBox.adjustToContents();
      this.setVariableSize();
      this.adjustToContents();
      this.setFixedSize();
   }

   updatePreview() {
      if (!engine.targetView || engine.targetView.isNull)
         return;
      const previewImage = new Image(engine.targetView.image);
      engine.renderSignature(previewImage);
      this.previewControl.doUpdateImage(previewImage);
   }
}

class DrawSignaturePreviewControl extends ScrollBox {
   constructor(parent) {
      super(parent);

      this.setMinWidth(900);
      this.setMinHeight(400);
      this.autoScroll = true;
      this.tracking = true;

      this.previewImage = null;
      this.previewBitmap = null;
      this.zoomFactor = 1.0;
      this.minZoomFactor = 0.1;
      this.maxZoomFactor = 10.0;
      this.dragging = false;
      this.dragOrigin = new Point(0, 0);

      this.viewport.onMouseWheel = function(x, y, delta) {
         if (delta > 0) this.parent.zoomIn();
         else if (delta < 0) this.parent.zoomOut();
      };

      this.viewport.onMousePress = function(x, y) {
         const p = this.parent;
         p.dragging = true;
         p.dragOrigin.x = x;
         p.dragOrigin.y = y;
         this.cursor = new Cursor(StdCursor.ClosedHand);
      };

      this.viewport.onMouseMove = function(x, y) {
         const p = this.parent;
         if (!p.dragging) return;
         const img = p.previewImage;
         const maxX = Math.max(0, (img ? img.width * p.zoomFactor : 0) - this.width);
         const maxY = Math.max(0, (img ? img.height * p.zoomFactor : 0) - this.height);
         p.scrollPosition = new Point(
            Math.max(0, Math.min(p.scrollPosition.x - (x - p.dragOrigin.x), maxX)),
            Math.max(0, Math.min(p.scrollPosition.y - (y - p.dragOrigin.y), maxY)));
         p.dragOrigin.x = x;
         p.dragOrigin.y = y;
         this.update();
      };

      this.viewport.onMouseRelease = function() {
         this.cursor = new Cursor(StdCursor.OpenHand);
         this.parent.dragging = false;
      };

      this.viewport.onResize = function() {
         this.parent.initScrollBars();
      };

      this.viewport.onPaint = function(x0, y0, x1, y1) {
         const g = new Graphics(this);
         const p = this.parent;
         const scroll = p.scrollPosition || new Point(0, 0);
         g.fillRect(x0, y0, x1, y1, new Brush(0xff222222));
         if (p.previewBitmap) {
            g.scaleTransformation(p.zoomFactor);
            g.translateTransformation(-scroll.x / p.zoomFactor, -scroll.y / p.zoomFactor);
            g.drawBitmap(0, 0, p.previewBitmap);
         } else {
            g.drawText(10, 30, "No preview available");
         }
         g.end();
      };

      this.initScrollBars();
   }

   doUpdateImage(image) {
      if (this.previewImage && this.previewImage !== image)
         this.previewImage.free();
      if (this.previewBitmap)
         this.previewBitmap.clear();
      this.previewImage = image;
      this.previewBitmap = (image && image.width > 0 && image.height > 0) ? image.render() : null;
      if (this.viewport && image && image.width > 0 && image.height > 0)
         this.zoomFactor = Math.min(this.viewport.width / image.width, this.viewport.height / image.height, 1.0);
      this.initScrollBars();
   }

   initScrollBars(scrollPoint) {
      const image = this.previewImage;
      if (!image || image.width <= 0 || image.height <= 0) {
         this.setHorizontalScrollRange(0, 0);
         this.setVerticalScrollRange(0, 0);
         this.scrollPosition = new Point(0, 0);
      } else {
         const maxX = Math.max(0, image.width * this.zoomFactor - this.viewport.width);
         const maxY = Math.max(0, image.height * this.zoomFactor - this.viewport.height);
         this.setHorizontalScrollRange(0, maxX);
         this.setVerticalScrollRange(0, maxY);
         if (scrollPoint) {
            this.scrollPosition = scrollPoint;
         } else {
            const sp = this.scrollPosition;
            this.scrollPosition = new Point(Math.min(sp ? sp.x : 0, maxX), Math.min(sp ? sp.y : 0, maxY));
         }
      }
      if (this.viewport)
         this.viewport.update();
   }

   zoomIn() {
      this.zoomFactor = Math.min(this.zoomFactor * 1.25, this.maxZoomFactor);
      this.initScrollBars();
   }

   zoomOut() {
      this.zoomFactor = Math.max(this.zoomFactor * 0.8, this.minZoomFactor);
      this.initScrollBars();
   }
}

// ---------------------------------------------------------------------------
// Command-line / headless mode
// ---------------------------------------------------------------------------

function parseScriptArguments() {
   // Runtime.jsArguments in 1.9.4+; the bare global is deprecated (warns).
   const args = (typeof Runtime !== "undefined" && Runtime.jsArguments) || [];
   if (args.length === 0)
      return null;

   const canonical = {};
   for (const k of OPTION_KEYS.concat(CLI_ONLY_KEYS))
      canonical[k.toLowerCase()] = k;

   const opts = {};
   for (const raw of args) {
      const s = String(raw).trim();
      if (!s) continue;
      const eq = s.indexOf("=");
      const rawKey = (eq < 0 ? s : s.substring(0, eq)).trim().replace(/^-+/, "");
      let value = eq < 0 ? "true" : s.substring(eq + 1).trim();
      if (value.length >= 2 && /^(['"]).*\1$/.test(value))
         value = value.substring(1, value.length - 1);
      const key = canonical[rawKey.toLowerCase()];
      if (key)
         opts[key] = value;
      else
         Console.warningln(`[${SCRIPT_TITLE}] Ignoring unknown argument: ${rawKey}`);
   }
   return opts;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
   // Script instance dropped on a view: apply without UI, like a process.
   if (Parameters.isViewTarget) {
      engine.importParameters();
      engine.setTarget(Parameters.targetView);
      engine.importParameters();
      engine.apply();
      return;
   }

   // Command-line arguments: headless run.
   const cliOpts = parseScriptArguments();
   if (cliOpts) {
      try {
         signImage(cliOpts);
      } catch (e) {
         Console.criticalln(`[${SCRIPT_TITLE}] ERROR: ${e.message || e}`);
      }
      return;
   }

   // Interactive (direct or global instance): load instance params, then the dialog.
   if (Parameters.isGlobalTarget)
      engine.importParameters();

   const window = ImageWindow.activeWindow;
   if (window && !window.isNull)
      engine.setTarget(window.currentView);
   if (Parameters.isGlobalTarget)
      engine.importParameters();

#ifndef __DEBUG__
   Console.hide();
#endif

   if (!engine.targetView) {
      new MessageBox("There is no active image window!",
                     SCRIPT_TITLE + " Script", StdIcon.Error, StdButton.Ok).execute();
      return;
   }

   const dialog = new DrawSignatureDialog();
   for (;;) {
      if (!dialog.execute())
         break;
      if (!engine.targetView || engine.targetView.isNull) {
         new MessageBox("You must select a view to apply this script.",
                        SCRIPT_TITLE + " Script", StdIcon.Error, StdButton.Ok).execute();
         continue;
      }
      engine.apply();
      break;
   }
}

main();

})();
