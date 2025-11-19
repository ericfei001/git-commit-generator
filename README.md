# AI Commit Assistant

Generate conventional commit messages using local Ollama models.

## Features

-   🤖 AI-powered commit message generation using Ollama
-   📝 Custom instructions support
-   ⚡ Real-time streaming responses
-   🔒 100% local - no API keys needed
-   🎯 Always uses staged changes (`git diff --cached`)

## Requirements

-   [Ollama](https://ollama.ai/) installed and running
-   At least one Ollama model installed (e.g., `llama3.2`, `deepseek-r1:1.5b`)

## Usage

1. Click the Git Commit icon in the Activity Bar
2. (Optional) Enter custom instructions
3. Click **✨ Generate Commit Message**
4. Review the generated message
5. Click **📋 Insert to New Terminal** or **✅ Commit Directly**

## Configuration

-   `aiCommit.defaultModel`: Default Ollama model (default: `llama3.2`)

## Installation

Install Ollama models:

```bash
ollama pull llama3.2
ollama pull deepseek-r1:1.5b
```

Make sure Ollama is running:

```bash
ollama serve
```

## License

MIT
