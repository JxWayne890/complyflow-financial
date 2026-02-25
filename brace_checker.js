
import fs from 'fs';
const content = fs.readFileSync('/Users/john/Desktop/Backed WorkFlows /complyflow-financial/pages/ContentEditor.tsx', 'utf8');

let braces = 0;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let char of line) {
        if (char === '{') braces++;
        if (char === '}') braces--;
    }
    if (braces < 0) {
        console.log(`Negative braces at line ${i + 1}: ${line}`);
        break;
    }
}
console.log(`Final Braces: ${braces}`);
