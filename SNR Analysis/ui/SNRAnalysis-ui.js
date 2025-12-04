/*
 * SNRAnalysis-ui.js
 * Main configuration dialog (refactored to use modular UI builders)
 */

/**
 * Main configuration dialog
 */
function SNRAnalysisDialog() {
   this.__base__ = Dialog;
   this.__base__();
   
   var self = this;
   
   // Load current settings
   loadSettings();
   
   // Build UI sections using helper functions
   var headerSection = buildHeaderSection(this);
   var infoSection = buildInfoSection(this);
   var inputSection = buildInputSection(this);
   var roiSection = buildRoiModeSection(this);
   var depthSection = buildDepthStrategySection(this);
   var processingSection = buildProcessingSection(this);
   var outputSection = buildOutputSection(this);
   
   // Buttons
   var buttonsSizer = new HorizontalSizer;
   buttonsSizer.spacing = 6;
   
   var okButton = new PushButton(this);
   okButton.text = "OK";
   okButton.icon = this.scaledResource(":/icons/ok.png");
   okButton.onClick = function() {
      // Validate inputs
      if (!CONFIG.inputDir || CONFIG.inputDir.trim().length === 0) {
         new MessageBox("Please select an input directory.", "Validation Error", StdIcon_Error, StdButton_Ok).execute();
         return;
      }
      
      if (!CONFIG.outputDir || CONFIG.outputDir.trim().length === 0) {
         new MessageBox("Please select an output directory.", "Validation Error", StdIcon_Error, StdButton_Ok).execute();
         return;
      }
      
      if (CONFIG.depthStrategy === "custom") {
         if (!CONFIG.customDepths || CONFIG.customDepths.trim().length === 0) {
            new MessageBox("Please specify custom depths or choose a different strategy.", "Validation Error", StdIcon_Error, StdButton_Ok).execute();
            return;
         }
      }
      
      // Save settings
      saveSettings();
      
      self.ok();
   };
   
   var cancelButton = new PushButton(this);
   cancelButton.text = "Cancel";
   cancelButton.icon = this.scaledResource(":/icons/cancel.png");
   cancelButton.onClick = function() {
      self.cancel();
   };
   
   buttonsSizer.addStretch();
   buttonsSizer.add(okButton);
   buttonsSizer.add(cancelButton);
   
   // Main layout
   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   this.sizer.add(headerSection);
   this.sizer.add(infoSection);
   this.sizer.add(inputSection);
   this.sizer.add(roiSection);
   this.sizer.add(depthSection);
   this.sizer.add(processingSection);
   this.sizer.add(outputSection);
   this.sizer.add(buttonsSizer);
   
   this.windowTitle = "SNR vs Integration Time Analysis";
   this.adjustToContents();
   this.setFixedSize();
}

SNRAnalysisDialog.prototype = new Dialog;
