# Obsidian RAGFlow Sync Plugin

This plugin allows you to sync your Obsidian notes to a RAGFlow knowledge base, making them available for retrieval and use in RAGFlow-powered applications.

## Features

- Sync Obsidian notes to a RAGFlow knowledge base
- Configure which knowledge base to sync to
- Exclude specific folders from syncing
- Track sync status with MD5 hashing to avoid duplicate submissions
- Automatic chunking of notes for optimal retrieval

## Installation

### From Obsidian Community Plugins

1. Open Obsidian
2. Go to Settings > Community Plugins
3. Disable Safe Mode if necessary
4. Click "Browse" and search for "RAGFlow Sync"
5. Install the plugin and enable it

### Manual Installation

1. Download the latest release from the GitHub repository
2. Extract the files to your Obsidian vault's `.obsidian/plugins/obsidian-ragflow-sync` folder
3. Restart Obsidian
4. Enable the plugin in Settings > Community Plugins

## Configuration

1. Go to Settings > RAGFlow Sync
2. Enter your RAGFlow API key
3. Enter the base URL of your RAGFlow instance (e.g., `http://localhost:2081`)
4. Enter the name of the knowledge base to sync to
5. Configure other settings as needed:
   - Sync on startup: Automatically sync notes when Obsidian starts
   - Exclude folders: Specify folders to exclude from syncing
   - Chunk size: Set the maximum size of each chunk in tokens

## Usage

### Manual Sync

1. Click the cloud icon in the ribbon menu, or
2. Use the command palette (Ctrl/Cmd+P) and search for "Sync notes to RAGFlow"

### Automatic Sync

If you've enabled "Sync on startup" in the settings, the plugin will automatically sync your notes when Obsidian starts.

## How It Works

1. The plugin scans your Obsidian vault for markdown files
2. It calculates an MD5 hash for each file to track changes
3. For files that have changed or haven't been synced yet, it:
   - Chunks the content into smaller pieces for optimal retrieval
   - Creates a document in the RAGFlow knowledge base
   - Adds the chunks to the document
4. It maintains a local index of synced files to avoid duplicate submissions

## Troubleshooting

- If you encounter errors during syncing, check your RAGFlow API key and base URL
- Make sure your RAGFlow instance is running and accessible
- Check the console logs for more detailed error messages

## License

This plugin is licensed under the MIT License.
