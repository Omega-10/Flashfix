const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let newContent = content
        .replace(/bg-\[\#0A0A0A\]/g, 'bg-[var(--surface-bg)]')
        .replace(/bg-\[\#0D0D0D\]/g, 'bg-[var(--surface-bg)]')
        .replace(/bg-\[\#111\]/g, 'bg-[var(--surface-elevated)]')
        .replace(/bg-\[\#111111\]/g, 'bg-[var(--surface-elevated)]')
        .replace(/bg-\[\#151515\]/g, 'bg-[var(--surface-elevated)]')
        .replace(/bg-\[\#1A1A1A\]/g, 'bg-[var(--surface-elevated)]')
        .replace(/bg-\[\#222\]/g, 'bg-[var(--surface-border)]')
        .replace(/border-white\/10/g, 'border-[var(--surface-border)]')
        .replace(/border-white\/5/g, 'border-[var(--surface-border)]')
        .replace(/text-white\/60/g, 'text-[var(--text-muted)]')
        .replace(/text-white\/80/g, 'text-[var(--text-secondary)]')
        .replace(/text-white/g, 'text-[var(--text-primary)]');
        
      if (content !== newContent) {
        console.log("Updated: " + fullPath);
        fs.writeFileSync(fullPath, newContent);
      }
    }
  }
}

replaceInDir('packages/web/src');
console.log("Done.");
