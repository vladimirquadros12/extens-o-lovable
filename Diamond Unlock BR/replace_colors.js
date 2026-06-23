const fs = require('fs');

const files = [
  "c:\\Users\\jeanm\\Documents\\Extensão Siri 4.1\\sidepanel.css",
  "c:\\Users\\jeanm\\Documents\\Extensão Siri 4.1\\floating.css"
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/#FF4242/g, '#A855F7');
  content = content.replace(/rgba\(255,\s*66,\s*66,/g, 'rgba(168, 85, 247,');
  content = content.replace(/rgba\(255,66,66,/g, 'rgba(168,85,247,');
  content = content.replace(/#ff5e5e/g, '#C084FC');
  content = content.replace(/#c01818/g, '#7C3AED');
  content = content.replace(/#7a0a0a/g, '#4C1D95');
  
  // also check for any red-related gradients that weren't captured if they used #ef4444 or similar.
  // Wait, let's also replace "Extensão Síri" -> "Diamond Unlock BR" and "Extensão Siri" -> "Diamond Unlock BR" in the CSS comments/text if any, but better to do global replace later.
  
  fs.writeFileSync(file, content, 'utf8');
}
