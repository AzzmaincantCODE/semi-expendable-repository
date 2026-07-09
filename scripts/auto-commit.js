#!/usr/bin/env node

/**
 * Auto-commit script that watches for file changes and automatically commits them
 * Run with: npm run auto-commit
 */

import { execSync } from 'child_process';
import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEBOUNCE_MS = 5000; // Wait 5 seconds after last change before committing
const GIT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '*.log',
  '.env.local',
  '.env.*.local',
];

let commitTimer = null;
let pendingChanges = new Set();

function isGitIgnored(filePath) {
  // Simple check - in production, you'd want to use git check-ignore
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  return GIT_IGNORE_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(relativePath);
    }
    return relativePath.includes(pattern);
  });
}

function getGitStatus() {
  try {
    const status = execSync('git status --porcelain', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    });
    const lines = status.trim();
    return lines ? lines.split('\n').filter(line => line.trim()) : [];
  } catch (error) {
    console.error('Error getting git status:', error.message);
    return [];
  }
}

function autoCommit() {
  const changes = getGitStatus();
  
  if (changes.length === 0) {
    console.log('No changes to commit.');
    return;
  }

  // Filter out ignored files
  const validChanges = changes.filter(change => {
    const filePath = change.substring(3).trim();
    return !isGitIgnored(filePath);
  });

  if (validChanges.length === 0) {
    console.log('All changes are in ignored files.');
    return;
  }

  try {
    const timestamp = new Date().toISOString();
    const commitMessage = `Auto-commit: ${timestamp}\n\nFiles changed:\n${validChanges.map(c => `  - ${c.substring(3).trim()}`).join('\n')}`;

    console.log(`\n📝 Auto-committing ${validChanges.length} file(s)...`);
    
    // Stage all changes
    execSync('git add -A', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });

    // Commit
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });

    console.log('✅ Auto-commit successful!\n');
    
    // Optionally push (uncomment if you want auto-push)
    // try {
    //   execSync('git push origin main', {
    //     cwd: PROJECT_ROOT,
    //     stdio: 'inherit',
    //   });
    //   console.log('✅ Auto-pushed to remote!\n');
    // } catch (pushError) {
    //   console.log('⚠️  Auto-push failed (this is normal if remote is not configured or requires auth)\n');
    // }

    pendingChanges.clear();
  } catch (error) {
    console.error('❌ Auto-commit failed:', error.message);
  }
}

function scheduleCommit(filePath) {
  pendingChanges.add(filePath);
  
  if (commitTimer) {
    clearTimeout(commitTimer);
  }

  commitTimer = setTimeout(() => {
    autoCommit();
  }, DEBOUNCE_MS);
}

// Check if we're in a git repository
try {
  execSync('git rev-parse --git-dir', {
    cwd: PROJECT_ROOT,
    stdio: 'ignore',
  });
} catch (error) {
  console.error('❌ Not a git repository. Please initialize git first with: git init');
  process.exit(1);
}

console.log('🚀 Auto-commit watcher started...');
console.log(`📁 Watching: ${PROJECT_ROOT}`);
console.log(`⏱️  Debounce: ${DEBOUNCE_MS}ms`);
console.log('💡 Press Ctrl+C to stop\n');

// Watch for file changes
const watcher = chokidar.watch(PROJECT_ROOT, {
  ignored: [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.next/,
    /.*\.log$/,
    /\.env\.local$/,
    /\.env\..*\.local$/,
  ],
  persistent: true,
  ignoreInitial: true,
});

watcher
  .on('add', (filePath) => {
    console.log(`📄 File added: ${path.relative(PROJECT_ROOT, filePath)}`);
    scheduleCommit(filePath);
  })
  .on('change', (filePath) => {
    console.log(`✏️  File changed: ${path.relative(PROJECT_ROOT, filePath)}`);
    scheduleCommit(filePath);
  })
  .on('unlink', (filePath) => {
    console.log(`🗑️  File deleted: ${path.relative(PROJECT_ROOT, filePath)}`);
    scheduleCommit(filePath);
  })
  .on('error', (error) => {
    console.error('❌ Watcher error:', error);
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping auto-commit watcher...');
  
  // Commit any pending changes before exit
  if (pendingChanges.size > 0) {
    console.log('💾 Committing pending changes...');
    autoCommit();
  }
  
  watcher.close();
  process.exit(0);
});

