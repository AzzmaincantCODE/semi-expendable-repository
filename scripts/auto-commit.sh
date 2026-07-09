#!/bin/bash

# Auto-commit script for Unix/Linux/Mac
# This script watches for file changes and automatically commits them

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEBOUNCE_SECONDS=5

cd "$PROJECT_ROOT" || exit 1

# Check if git is initialized
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not a git repository. Please initialize git first with: git init"
    exit 1
fi

echo "🚀 Auto-commit watcher started..."
echo "📁 Watching: $PROJECT_ROOT"
echo "⏱️  Debounce: ${DEBOUNCE_SECONDS}s"
echo "💡 Press Ctrl+C to stop"
echo ""

# Function to commit changes
auto_commit() {
    if [ -z "$(git status --porcelain)" ]; then
        echo "No changes to commit."
        return
    fi

    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    CHANGED_FILES=$(git status --porcelain | sed 's/^...//')
    
    echo ""
    echo "📝 Auto-committing changes..."
    echo "Files changed:"
    echo "$CHANGED_FILES" | sed 's/^/  - /'
    
    git add -A
    git commit -m "Auto-commit: $TIMESTAMP

Files changed:
$(echo "$CHANGED_FILES" | sed 's/^/  - /')"
    
    if [ $? -eq 0 ]; then
        echo "✅ Auto-commit successful!"
        echo ""
        
        # Uncomment the next line if you want to auto-push
        # git push origin main
    else
        echo "❌ Auto-commit failed!"
    fi
}

# Watch for changes using inotifywait (Linux) or fswatch (Mac)
if command -v inotifywait > /dev/null; then
    # Linux
    echo "Using inotifywait (Linux)"
    inotifywait -m -r -e modify,create,delete,move --format '%w%f' \
        --exclude 'node_modules|\.git|dist|build|\.next|.*\.log$|\.env\.local$' \
        "$PROJECT_ROOT" | while read -r file; do
        echo "✏️  File changed: $(basename "$file")"
        # Debounce: cancel previous timer
        if [ -n "$COMMIT_TIMER" ]; then
            kill "$COMMIT_TIMER" 2>/dev/null
        fi
        # Schedule commit
        (sleep "$DEBOUNCE_SECONDS" && auto_commit) &
        COMMIT_TIMER=$!
    done
elif command -v fswatch > /dev/null; then
    # Mac
    echo "Using fswatch (Mac)"
    fswatch -o \
        --exclude='node_modules' \
        --exclude='\.git' \
        --exclude='dist' \
        --exclude='build' \
        --exclude='\.next' \
        --exclude='.*\.log$' \
        --exclude='\.env\.local$' \
        "$PROJECT_ROOT" | while read -r; do
        echo "✏️  Files changed"
        # Debounce
        if [ -n "$COMMIT_TIMER" ]; then
            kill "$COMMIT_TIMER" 2>/dev/null
        fi
        (sleep "$DEBOUNCE_SECONDS" && auto_commit) &
        COMMIT_TIMER=$!
    done
else
    echo "❌ No file watcher found. Please install:"
    echo "   Linux: sudo apt-get install inotify-tools"
    echo "   Mac: brew install fswatch"
    exit 1
fi

