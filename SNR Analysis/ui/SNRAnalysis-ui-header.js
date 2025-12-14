/*
 * SNRAnalysis-ui-header.js
 * Header and informational sections for the main dialog
 */

/**
 * Build header section (title, author, description)
 */
function buildHeaderSection(dialog) {
   var headerGroupBox = new GroupBox(dialog);
   headerGroupBox.title = "";
   headerGroupBox.sizer = new VerticalSizer;
   headerGroupBox.sizer.margin = 4;
   headerGroupBox.sizer.spacing = 2;
   headerGroupBox.styleSheet = "QGroupBox { padding-top: 0px; margin-top: 0px; }";
   
   // Title row: Name/version on left, author on right
   var titleSizer = new HorizontalSizer;
   titleSizer.spacing = 4;
   
   var titleLabel = new Label(dialog);
   titleLabel.text = "SNR vs Integration Time Analysis v" + (typeof SCRIPT_VERSION !== "undefined" ? SCRIPT_VERSION : "?");
   titleLabel.styleSheet = "QLabel { font-weight: bold; }";
   
   var copyrightLabel = new Label(dialog);
   copyrightLabel.text = "Paul Fox-Reeks (englishfox90)";
   copyrightLabel.textAlignment = TextAlign_Right;
   
   titleSizer.add(titleLabel);
   titleSizer.addStretch();
   titleSizer.add(copyrightLabel);
   
   // Description
   var descriptionLabel = new Label(dialog);
   descriptionLabel.text = "Analyze how SNR improves with integration depth to find diminishing returns and optimize your imaging sessions.";
   descriptionLabel.wordWrapping = true;
   descriptionLabel.useRichText = false;
   
   headerGroupBox.sizer.add(titleSizer);
   headerGroupBox.sizer.add(descriptionLabel);
   
   return headerGroupBox;
}

/**
 * Build info section (why use this tool) - expandable
 */
function buildInfoSection(dialog) {
   var infoGroupBox = new GroupBox(dialog);
   infoGroupBox.title = "";
   infoGroupBox.sizer = new VerticalSizer;
   infoGroupBox.sizer.margin = 6;
   infoGroupBox.sizer.spacing = 4;
   
   // Header with toggle button on the RIGHT
   var headerSizer = new HorizontalSizer;
   headerSizer.spacing = 4;
   
   var titleLabel = new Label(dialog);
   titleLabel.text = "Why Use This Tool?";
   titleLabel.styleSheet = "QLabel { font-weight: bold; }";
   
   var toggleButton = new ToolButton(dialog);
   toggleButton.icon = dialog.scaledResource(":/process-interface/contract.png");
   toggleButton.setScaledFixedSize(20, 20);
   toggleButton.toolTip = "Click to show/hide tool information";
   
   headerSizer.add(titleLabel);
   headerSizer.addStretch();
   headerSizer.add(toggleButton);
   
   // Content (collapsible)
   var infoLabel = new Label(dialog);
   infoLabel.text = 
      "<b>What it does:</b> Integrates your subframes at increasing depths (e.g., 8, 16, 32 subs) and measures SNR at each step.<br/><br/>" +
      "<b>Why it's valuable:</b><br/>" +
      "• <b>Optimize integration time</b> - Discover when additional subs provide minimal SNR improvement<br/>" +
      "• <b>Save imaging time</b> - Know when to stop integrating and move to your next target<br/>" +
      "• <b>Quantify signal gains</b> - See actual SNR improvements vs theoretical √N behavior<br/>" +
      "• <b>Detect bad data</b> - Identify sessions with poor subframes that decrease SNR<br/>" +
      "• <b>Plan future sessions</b> - Determine ideal total exposure for your equipment and conditions<br/><br/>" +
      "<b>Example insights:</b> \"SNR improvements drop below 10% after 90 minutes - diminishing returns beyond this point.\"";
   infoLabel.wordWrapping = true;
   infoLabel.useRichText = true;
   infoLabel.styleSheet = "QLabel { color: #444; }";
   infoLabel.visible = false; // Start collapsed
   
   // Toggle functionality with dynamic window resizing
   toggleButton.onClick = function() {
      infoLabel.visible = !infoLabel.visible;
      toggleButton.icon = infoLabel.visible ? 
         dialog.scaledResource(":/process-interface/expand.png") :
         dialog.scaledResource(":/process-interface/contract.png");
      
      // Force dialog to resize properly both ways (expand and collapse)
      // Multiple passes are needed to ensure proper resize
      dialog.setFixedSize();
      processEvents();
      dialog.adjustToContents();
      processEvents();
      dialog.setVariableSize();
      processEvents();
      dialog.adjustToContents();
   };
   
   infoGroupBox.sizer.add(headerSizer);
   infoGroupBox.sizer.add(infoLabel);
   
   return infoGroupBox;
}
