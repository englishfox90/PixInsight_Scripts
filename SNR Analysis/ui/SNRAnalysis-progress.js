/*
 * SNRAnalysis-progress.js
 * Progress monitoring dialog for SNR analysis workflow
 */

#ifndef __SNR_ANALYSIS_PROGRESS_JS
#define __SNR_ANALYSIS_PROGRESS_JS

#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>

/**
 * Progress monitor dialog - shows real-time progress of analysis steps
 */
function ProgressMonitor() {
   this.dialog = null;
   this.statusLabel = null;
   this.progressBar = null;
   this.stepsTreeBox = null;
   this.elapsedLabel = null;
   this.cancelRequested = false;
   this.startTime = null;
   this.steps = [];
   this.updateTimer = null;
   this.isComplete = false;
   
   // Step states
   this.STATE_PENDING = 0;
   this.STATE_RUNNING = 1;
   this.STATE_SUCCESS = 2;
   this.STATE_WARNING = 3;
   this.STATE_ERROR = 4;
   this.STATE_SKIPPED = 5;
   
   /**
    * Initialize and show the progress dialog
    */
   this.show = function() {
      this.startTime = new Date();
      this.cancelRequested = false;
      this.isComplete = false;
      
      this.dialog = new Dialog();
      this.dialog.windowTitle = "SNR Analysis Progress";
      this.dialog.scaledMinWidth = 900; 
      this.dialog.scaledMinHeight = 440; 
      
      // Status label
      this.statusLabel = new Label(this.dialog);
      this.statusLabel.text = "Initializing...";
      this.statusLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
      this.statusLabel.styleSheet = "QLabel { font-weight: bold; }";
      
      // Progress bar (visual using Label)
      this.progressBarContainer = new Control(this.dialog);
      this.progressBarContainer.setScaledFixedHeight(25);
      this.progressBarContainer.backgroundColor = 0xFFE0E0E0; // Light gray background
      
      this.progressBarFill = new Label(this.progressBarContainer);
      this.progressBarFill.text = "0%";
      this.progressBarFill.textAlignment = TextAlign_Center | TextAlign_VertCenter;
      this.progressBarFill.backgroundColor = 0xFF4CAF50; // Green fill
      this.progressBarFill.setScaledFixedHeight(25);
      this.progressBarFill.setScaledFixedWidth(0); // Start at 0 width
      
      var progressBarSizer = new HorizontalSizer;
      progressBarSizer.margin = 0;
      progressBarSizer.spacing = 0;
      progressBarSizer.add(this.progressBarFill);
      progressBarSizer.addStretch();
      this.progressBarContainer.sizer = progressBarSizer;
      
      // Steps tree box
      this.stepsTreeBox = new TreeBox(this.dialog);
      this.stepsTreeBox.alternateRowColor = true;
      this.stepsTreeBox.headerVisible = true;
      this.stepsTreeBox.numberOfColumns = 4;
      this.stepsTreeBox.setHeaderText(0, "Step");
      this.stepsTreeBox.setHeaderText(1, "Status");
      this.stepsTreeBox.setHeaderText(2, "Details");
      this.stepsTreeBox.setHeaderText(3, "Time");
      this.stepsTreeBox.setScaledMinHeight(300);
      
      // Make Step column 3x wider than default
      this.stepsTreeBox.setColumnWidth(0, 250); // Step name - triple width
      this.stepsTreeBox.setColumnWidth(1, 100); // Status
      this.stepsTreeBox.setColumnWidth(2, 400); // Details
      this.stepsTreeBox.setColumnWidth(3, 80);  // Time
      
      // Elapsed time label
      this.elapsedLabel = new Label(this.dialog);
      this.elapsedLabel.text = "Elapsed: 0s";
      this.elapsedLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
      
      // Cancel button
      var cancelButton = new PushButton(this.dialog);
      cancelButton.text = "Cancel";
      cancelButton.icon = this.dialog.scaledResource(":/icons/cancel.png");
      var self = this;
      cancelButton.onClick = function() {
         self.cancelRequested = true;
         cancelButton.text = "Cancelling...";
         cancelButton.enabled = false;
      };
      
      // Layout
      this.dialog.sizer = new VerticalSizer;
      this.dialog.sizer.margin = 8;
      this.dialog.sizer.spacing = 6;
      this.dialog.sizer.add(this.statusLabel);
      this.dialog.sizer.add(this.progressBarContainer);
      this.dialog.sizer.add(this.stepsTreeBox, 100);
      this.dialog.sizer.add(this.elapsedLabel);
      this.dialog.sizer.add(cancelButton);
      
      // Show non-modal so we can update it
      this.dialog.show();
      processEvents();
      
      // Start live timer update
      var self = this;
      this.updateTimer = new Timer();
      this.updateTimer.interval = 0.5; // Update every 500ms
      this.updateTimer.periodic = true;
      this.updateTimer.onTimeout = function() {
         if (!self.isComplete && self.elapsedLabel && self.startTime) {
            var elapsed = (new Date() - self.startTime) / 1000;
            self.elapsedLabel.text = "Elapsed: " + formatTime(elapsed);
            processEvents();
         }
      };
      this.updateTimer.start();
   };
   
   /**
    * Add a step to track
    */
   this.addStep = function(id, name) {
      var node = new TreeBoxNode(this.stepsTreeBox);
      node.setText(0, name);
      node.setText(1, "Pending");
      node.setText(2, "");
      node.setText(3, "");
      
      this.steps.push({
         id: id,
         name: name,
         node: node,
         state: this.STATE_PENDING,
         startTime: null,
         endTime: null
      });
      
      processEvents();
   };
   
   /**
    * Update step state
    */
   this.updateStep = function(id, state, details) {
      for (var i = 0; i < this.steps.length; i++) {
         if (this.steps[i].id === id) {
            var step = this.steps[i];
            step.state = state;
            
            if (state === this.STATE_RUNNING) {
               // Only set start time on first RUNNING transition
               if (!step.startTime) {
                  step.startTime = new Date();
               }
               step.node.setText(1, "Running");
               step.node.setIcon(1, this.dialog.scaledResource(":/bullets/bullet-ball-glass-blue.png"));
            } else if (state === this.STATE_SUCCESS) {
               step.endTime = new Date();
               step.node.setText(1, "Success");
               step.node.setIcon(1, this.dialog.scaledResource(":/bullets/bullet-ball-glass-green.png"));
               if (step.startTime) {
                  var elapsed = (step.endTime - step.startTime) / 1000;
                  step.node.setText(3, elapsed.toFixed(1) + "s");
               }
            } else if (state === this.STATE_WARNING) {
               step.endTime = new Date();
               step.node.setText(1, "Warning");
               step.node.setIcon(1, this.dialog.scaledResource(":/bullets/bullet-ball-glass-yellow.png"));
               if (step.startTime) {
                  var elapsed = (step.endTime - step.startTime) / 1000;
                  step.node.setText(3, elapsed.toFixed(1) + "s");
               }
            } else if (state === this.STATE_ERROR) {
               step.endTime = new Date();
               step.node.setText(1, "Error");
               step.node.setIcon(1, this.dialog.scaledResource(":/bullets/bullet-ball-glass-red.png"));
               if (step.startTime) {
                  var elapsed = (step.endTime - step.startTime) / 1000;
                  step.node.setText(3, elapsed.toFixed(1) + "s");
               }
            } else if (state === this.STATE_SKIPPED) {
               step.node.setText(1, "Skipped");
               step.node.setIcon(1, this.dialog.scaledResource(":/bullets/bullet-ball-glass-grey.png"));
               step.node.setText(3, "-");
            }
            
            if (details) {
               step.node.setText(2, details);
            }
            
            // Auto-update progress percentage based on completed steps
            this.updateProgressFromSteps();
            
            processEvents();
            break;
         }
      }
   };
   
   /**
    * Calculate and update progress percentage based on step completion
    */
   this.updateProgressFromSteps = function() {
      if (this.steps.length === 0) return;
      
      var completedCount = 0;
      for (var i = 0; i < this.steps.length; i++) {
         if (this.steps[i].state === this.STATE_SUCCESS || 
             this.steps[i].state === this.STATE_WARNING ||
             this.steps[i].state === this.STATE_ERROR ||
             this.steps[i].state === this.STATE_SKIPPED) {
            completedCount++;
         }
      }
      
      var percent = Math.floor((completedCount / this.steps.length) * 100);
      this.setProgress(percent);
   };
   
   /**
    * Set overall status text
    */
   this.setStatus = function(text) {
      if (this.statusLabel) {
         this.statusLabel.text = text;
         processEvents();
      }
   };
   
   /**
    * Set progress percentage (0-100)
    */
   this.setProgress = function(percent) {
      if (this.progressBarFill && this.progressBarContainer) {
         var pct = Math.max(0, Math.min(100, Math.floor(percent)));
         
         // Update width of the fill based on percentage
         var containerWidth = this.progressBarContainer.width;
         var fillWidth = Math.floor((containerWidth * pct) / 100);
         
         this.progressBarFill.setScaledFixedWidth(fillWidth);
         this.progressBarFill.text = pct + "%";
         
         // Change color based on progress
         if (pct === 100) {
            this.progressBarFill.backgroundColor = 0xFF4CAF50; // Green
         } else if (pct >= 50) {
            this.progressBarFill.backgroundColor = 0xFF2196F3; // Blue
         } else {
            this.progressBarFill.backgroundColor = 0xFFFF9800; // Orange
         }
         
         processEvents();
      }
   };
   
   /**
    * Update elapsed time (manual update, now mostly handled by timer)
    */
   this.updateElapsed = function() {
      if (this.elapsedLabel && this.startTime) {
         var elapsed = (new Date() - this.startTime) / 1000;
         this.elapsedLabel.text = "Elapsed: " + formatTime(elapsed);
         processEvents();
      }
   };
   
   /**
    * Mark progress as complete and stop timer
    */
   this.markComplete = function() {
      this.isComplete = true;
      if (this.updateTimer) {
         this.updateTimer.stop();
      }
      // Do final elapsed update
      this.updateElapsed();
   };
   
   /**
    * Check if cancel was requested
    */
   this.isCancelled = function() {
      processEvents();
      return this.cancelRequested;
   };
   
   /**
    * Close the dialog
    */
   this.close = function() {
      this.markComplete();
      if (this.dialog) {
         this.dialog.ok();
      }
   };
}

#endif // __SNR_ANALYSIS_PROGRESS_JS
