import * as vscode from 'vscode';
import { askOllama, getOllamaModels } from './ollama';
import { execSync } from 'child_process';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    const provider = new CommitViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('aiCommit.panel', provider));
}

class CommitViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        webviewView.webview.html = this._getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'requestModel':
                    await this.updateModel();
                    break;
                case 'changeModel':
                    await this.handleChangeModel();
                    break;
                case 'generate':
                    await this.handleGenerate(data.instructions);
                    break;
                case 'insertTerminal':
                    await this.handleInsertTerminal(data.message);
                    break;
                case 'commit':
                    await this.handleCommit(data.message);
                    break;
                case 'loadDiff':
                    await this.handleLoadDiff();
                    break;
            }
        });

        this.updateModel();
    }

    private async updateModel() {
        const config = vscode.workspace.getConfiguration('aiCommit');
        const model = config.get<string>('defaultModel') || 'llama3.2';
        this._view?.webview.postMessage({ command: 'updateModel', model });
    }

    private async checkOllamaInstalled(): Promise<{ installed: boolean; message?: string }> {
        try {
            const models = await getOllamaModels();
            if (models && models.length > 0) {
                return { installed: true };
            }
            return { installed: false, message: 'Ollama is running but no models found' };
        } catch (error) {
            return { installed: false, message: 'Ollama is not running or not installed' };
        }
    }

    private async handleChangeModel() {
        try {
            const models = await getOllamaModels();
            const selected = await vscode.window.showQuickPick(models.map((m) => m.name));
            if (selected) {
                await vscode.workspace
                    .getConfiguration('aiCommit')
                    .update('defaultModel', selected, vscode.ConfigurationTarget.Global);
                this.updateModel();
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Error: ${err.message}`);
        }
    }

    private async handleGenerate(instructions: string) {
        try {
            // Check if Ollama is installed
            const ollamaCheck = await this.checkOllamaInstalled();
            if (!ollamaCheck.installed) {
                this._view?.webview.postMessage({
                    command: 'generateError',
                    error: 'Ollama is not installed or not running. Please install Ollama from https://ollama.ai and make sure it is running.',
                });
                return;
            }

            this._view?.webview.postMessage({ command: 'generatingStatus', text: 'Loading...' });
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) throw new Error('No workspace');

            const diff = execSync('git diff --cached', { cwd: workspaceFolders[0].uri.fsPath, encoding: 'utf8' });
            if (!diff.trim()) throw new Error('No staged changes');

            this._view?.webview.postMessage({ command: 'generatingStatus', text: 'Generating...' });
            const model = vscode.workspace.getConfiguration('aiCommit').get<string>('defaultModel') || 'llama3.2';

            let prompt = `You are a git commit message generator. Generate ONLY the commit message, nothing else.

STRICT OUTPUT RULES:
1. NO explanations, NO "Alternatively", NO extra text
2. NO markdown formatting, NO code blocks
3. NO empty numbered lists
4. Output the actual commit message directly

FORMAT RULES:
- Single change: <type>(scope): description
- Multiple changes: One line per change, no numbering
- Types: feat, fix, refactor, chore, perf, ci, build, docs, style, test
- Use imperative mood (Add, Fix, Update - not Added, Fixed, Updated)
- No periods at end of lines
- Keep under 72 characters per line

${instructions.trim() ? `CUSTOM INSTRUCTIONS: ${instructions}\n\n` : ''}Git diff:
${diff}

Generate commit message now:`;

            this._view?.webview.postMessage({ command: 'streamChunk', chunk: '', isStart: true });
            const result = await askOllama(prompt, model, (chunk) => {
                this._view?.webview.postMessage({ command: 'streamChunk', chunk, isStart: false });
            });

            this._view?.webview.postMessage({ command: 'generateComplete', result });
        } catch (err: any) {
            this._view?.webview.postMessage({ command: 'generateError', error: err.message });
        }
    }

    private async handleInsertTerminal(message: string) {
        const terminal = vscode.window.createTerminal('Git Commit');
        terminal.show();
        terminal.sendText(`git commit -m "${message.replace(/"/g, '\\"')}"`, false);
    }

    private async handleCommit(message: string) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) throw new Error('No workspace');
            execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: workspaceFolders[0].uri.fsPath });
            vscode.window.showInformationMessage('Committed!');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Error: ${err.message}`);
        }
    }

    private async handleLoadDiff() {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) throw new Error('No workspace');

            const diff = execSync('git diff --cached', { cwd: workspaceFolders[0].uri.fsPath, encoding: 'utf8' });
            
            if (!diff.trim()) {
                this._view?.webview.postMessage({ 
                    command: 'diffLoaded', 
                    diff: 'No staged changes found. Please stage your changes first.' 
                });
            } else {
                this._view?.webview.postMessage({ 
                    command: 'diffLoaded', 
                    diff: diff 
                });
            }
        } catch (err: any) {
            this._view?.webview.postMessage({ 
                command: 'diffLoaded', 
                diff: `Error: ${err.message}` 
            });
        }
    }

    private _getHtmlForWebview() {
        let htmlPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'sidebar.html');
        if (!fs.existsSync(htmlPath.fsPath)) {
            htmlPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'sidebar.html');
        }
        return fs.readFileSync(htmlPath.fsPath, 'utf8');
    }
}

export function deactivate() {}
