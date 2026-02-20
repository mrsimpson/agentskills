import fs from 'fs';

let content = fs.readFileSync('src/__tests__/cli.test.ts', 'utf-8');

// Remove { from: 'user' } including newlines before it
content = content.replace(/,?\s*{\s*from:\s*'user'\s*}/g, '');

fs.writeFileSync('src/__tests__/cli.test.ts', content);
console.log('Fixed');
