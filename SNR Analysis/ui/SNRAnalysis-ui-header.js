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
   titleLabel.text = "SNR vs Integration Time Analysis v1.0.0";
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
 * Build info section (why use this tool)
 */
function buildInfoSection(dialog) {
   var infoGroupBox = new GroupBox(dialog);
   infoGroupBox.title = "Why Use This Tool?";
   infoGroupBox.sizer = new VerticalSizer;
   infoGroupBox.sizer.margin = 6;
   infoGroupBox.sizer.spacing = 4;
   
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
   
   infoGroupBox.sizer.add(infoLabel);
   
   return infoGroupBox;
}
