# Pi Supermemory Extension

A powerful extension for the [Pi coding agent](https://github.com/mariozechner/pi-coding-agent) that integrates with [Supermemory AI](https://supermemory.ai) for long-term memory, knowledge management, and semantic search.

## Features

- **Semantic Search**: Search your Supermemory knowledge base using natural language queries.
- **Document Ingestion**: Add URLs or raw text as documents to your memories.
- **Atomic Memories**: Create specific "facts" or "traits" that persist across sessions.
- **Easy Configuration**: Integrated setup command to manage your API keys and container tags.
- **Session Persistence**: Your configuration is stored within the Pi session and survives reloads.

## Installation

### 1. Native Pi Package (Recommended)
Add this repository to your global Pi `settings.json` (usually at `~/.pi/agent/settings.json`) in the `packages` array:

```json
{
  "packages": [
    "git:github.com/dpolishuk/pi-extension-supermemory"
  ]
}
```

Pi will automatically download, install, and update the extension for you.

### 2. Skills CLI
You can also install the tools and extension via the `skills` CLI:

```bash
npx skills add dpolishuk/pi-extension-supermemory -g -y
```

### 3. Manual Installation
Clone this repository and copy the source to your Pi extensions directory:

```bash
# Global installation
mkdir -p ~/.pi/agent/extensions/supermemory
cp -r src/index.ts ~/.pi/agent/extensions/supermemory/

# Project-local installation
mkdir -p .pi/extensions/supermemory
cp -r src/index.ts .pi/extensions/supermemory/
```

### 2. Loading the Extension
Run Pi with the extension flag:

```bash
pi -e ~/.pi/agent/extensions/supermemory/index.ts
```

## Setup

Once Pi is running with the extension loaded, use the setup command to configure your Supermemory API key:

1. Get your API key from the [Supermemory Console](https://console.supermemory.ai).
2. Run the command in Pi:
   ```
   /supermemory-setup
   ```
3. Enter your API key and an optional **Container Tag** (default is `pi-user`). Container tags allow you to isolate different memory spaces (e.g., one for personal notes, one for a specific project).

## Tools Provided

The extension registers the following tools for Pi:

### `supermemory_search`
Search your memories using semantic or hybrid search.
- **Arguments**:
  - `query` (string): The natural language search query.
  - `searchMode` (string): "semantic" or "hybrid" (default: "hybrid").

### `supermemory_add`
Add a URL or raw text document to your Supermemory.
- **Arguments**:
  - `content` (string): The URL or text to add.

### `supermemory_add_memory`
Directly create memories without the full document processing pipeline. Ideal for atomic facts.
- **Arguments**:
  - `memories` (array): List of memory objects with `content` (string) and optional `isStatic` (boolean).

## About Supermemory
Supermemory is a state-of-the-art memory and context infrastructure for AI agents. It provides:
- **Persistent memory across conversations**
- **Personalized AI experiences**
- **Advanced RAG (Retrieval-Augmented Generation)**

For more information, visit [supermemory.ai](https://supermemory.ai).
