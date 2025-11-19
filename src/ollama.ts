import * as http from 'http';
import * as https from 'https';

export interface OllamaModel {
    name: string;
    modified_at: string;
    size: number;
}

export function getOllamaModels(): Promise<OllamaModel[]> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 11434,
            path: '/api/tags',
            method: 'GET',
            timeout: 5000,
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.models && Array.isArray(result.models)) {
                        resolve(result.models);
                    } else {
                        resolve([]);
                    }
                } catch (err) {
                    resolve([]);
                }
            });
        });

        req.on('error', () => {
            resolve([]);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve([]);
        });

        req.end();
    });
}

export function askOllama(prompt: string, model: string, onStream?: (chunk: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
        const useStream = !!onStream;
        const postData = JSON.stringify({
            model: model,
            prompt: prompt,
            stream: useStream,
        });

        const options = {
            hostname: 'localhost',
            port: 11434,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 60000, // 60 seconds timeout
        };

        const req = http.request(options, (res) => {
            let data = '';
            let fullResponse = '';

            res.on('data', (chunk) => {
                data += chunk;

                if (useStream && onStream) {
                    // Process streaming JSON lines
                    const lines = data.split('\n');
                    data = lines.pop() || ''; // Keep incomplete line

                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.response) {
                                    fullResponse += parsed.response;
                                    onStream(parsed.response);
                                }
                            } catch (e) {
                                // Ignore parse errors for partial lines
                            }
                        }
                    }
                }
            });

            res.on('end', () => {
                try {
                    if (useStream) {
                        resolve(fullResponse.trim());
                    } else {
                        const result = JSON.parse(data);
                        if (result.response !== undefined) {
                            resolve(result.response.trim());
                        } else {
                            reject(
                                new Error(
                                    `No response field in Ollama result. Got: ${JSON.stringify(result).substring(
                                        0,
                                        200
                                    )}`
                                )
                            );
                        }
                    }
                } catch (err) {
                    reject(new Error(`Failed to parse Ollama response: ${err}. Data: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(new Error(`Ollama connection error: ${err.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Ollama request timed out'));
        });

        req.write(postData);
        req.end();
    });
}

export function askOpenAI(
    prompt: string,
    model: string,
    apiKey: string,
    onStream?: (chunk: string) => void
): Promise<string> {
    return new Promise((resolve, reject) => {
        const useStream = !!onStream;
        const postData = JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
            stream: useStream,
        });

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 60000,
        };

        const req = https.request(options, (res) => {
            let data = '';
            let fullResponse = '';

            res.on('data', (chunk) => {
                data += chunk.toString();

                if (useStream && onStream) {
                    // Process streaming SSE format
                    const lines = data.split('\n');
                    data = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.substring(6);
                            if (jsonStr.trim() === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(jsonStr);
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content) {
                                    fullResponse += content;
                                    onStream(content);
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }
                    }
                }
            });

            res.on('end', () => {
                try {
                    if (useStream) {
                        resolve(fullResponse.trim());
                    } else {
                        const result = JSON.parse(data);
                        if (result.choices && result.choices[0]?.message?.content) {
                            resolve(result.choices[0].message.content.trim());
                        } else if (result.error) {
                            reject(new Error(`OpenAI error: ${result.error.message}`));
                        } else {
                            reject(new Error('No response from OpenAI'));
                        }
                    }
                } catch (err) {
                    reject(new Error(`Failed to parse OpenAI response: ${err}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(new Error(`OpenAI connection error: ${err.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('OpenAI request timed out'));
        });

        req.write(postData);
        req.end();
    });
}

export function askCustomAPI(prompt: string, endpoint: string, apiKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint);
        const postData = JSON.stringify({
            prompt: prompt,
        });

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: apiKey ? `Bearer ${apiKey}` : undefined,
                'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 60000,
        };

        const protocol = url.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    // Try common response formats
                    const response = result.response || result.text || result.content || result.message || data;
                    resolve(response.trim());
                } catch (err) {
                    resolve(data.trim());
                }
            });
        });

        req.on('error', (err) => {
            reject(new Error(`Custom API connection error: ${err.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Custom API request timed out'));
        });

        req.write(postData);
        req.end();
    });
}
