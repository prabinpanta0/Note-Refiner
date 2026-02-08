import { ArrowRight, Check, Copy, Loader2, Moon, Sun, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function App() {
    const [input, setInput] = useState("");
    const [output, setOutput] = useState("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [renderMarkdown, setRenderMarkdown] = useState<boolean>(true);
    const [healthOk, setHealthOk] = useState<boolean>(false);
    const [healthLoading, setHealthLoading] = useState<boolean>(true);
    const [theme, setTheme] = useState<"light" | "dark">(() =>
        typeof window !== "undefined" && localStorage.getItem("theme") === "dark" ? "dark" : "light",
    );
    const outputRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    // Apply theme class
    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("dark", theme === "dark");
            try {
                localStorage.setItem("theme", theme);
            } catch {
                /* ignore */
            }
        }
    }, [theme]);

    // Health check polling
    useEffect(() => {
        let mounted = true;
        const check = async () => {
            setHealthLoading(true);
            try {
                const res = await fetch("/api/health");
                const json = await res.json().catch(() => null);
                if (mounted) {
                    setHealthOk(!!(json && json.ok));
                }
            } catch {
                if (mounted) {
                    setHealthOk(false);
                }
            } finally {
                if (mounted) {
                    setHealthLoading(false);
                }
            }
        };

        check();
        const id = setInterval(check, 10_000);
        return () => {
            mounted = false;
            clearInterval(id);
        };
    }, []);

    const processStreamResponse = async (response: Response): Promise<void> => {
        const contentType = response.headers.get("content-type") ?? "";

        // If the server returns a non-stream JSON payload, handle it gracefully.
        if (contentType.includes("application/json")) {
            const json = await response.json().catch(() => null);
            if (json && typeof json === "object") {
                const maybeText =
                    (json as { text?: unknown; output?: unknown }).text ??
                    (json as { text?: unknown; output?: unknown }).output;
                if (typeof maybeText === "string") {
                    setOutput(maybeText);
                    return;
                }
            }
            // Fallback: show raw JSON string if shape is unknown
            setOutput(JSON.stringify(json, null, 2));
            return;
        }

        if (!response.body) {
            // Some environments buffer small responses; fallback to plain text.
            const text = await response.text();
            setOutput(text);
            return;
        }

        // Stream may be NDJSON or plain text lines. Buffer and split on newlines.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (!line.trim()) continue;
                // Try parse JSON per line (NDJSON). If it's JSON, try to extract text fields.
                try {
                    const obj = JSON.parse(line);
                    const maybeText = obj?.text ?? obj?.output ?? obj?.message?.content ?? obj?.chunk ?? null;
                    if (typeof maybeText === "string") setOutput(prev => prev + maybeText + "\n");
                    else setOutput(prev => prev + JSON.stringify(obj) + "\n");
                } catch {
                    // Not JSON — append raw line
                    setOutput(prev => prev + line + "\n");
                }
            }
        }

        // handle any remaining partial buffer
        const remaining = decoder.decode();
        if (remaining) buffer += remaining;
        if (buffer) {
            const line = buffer;
            try {
                const obj = JSON.parse(line);
                const maybeText = obj?.text ?? obj?.output ?? obj?.message?.content ?? obj?.chunk ?? null;
                if (typeof maybeText === "string") setOutput(prev => prev + maybeText + "\n");
                else setOutput(prev => prev + JSON.stringify(obj) + "\n");
            } catch {
                setOutput(prev => prev + line);
            }
        }
    };

    const fetchRefineResponse = async (text: string): Promise<Response> => {
        return fetch("/api/refine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
    };

    const handleRefineError = (error: unknown): void => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setError(`Error: ${errorMessage}. Check Ollama service status and model availability.`);
        setOutput("");
    };

    const validateResponse = (response: Response): void => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    };

    const logProcessingTime = (startTime: number): void => {
        console.log(`Processing completed in ${Date.now() - startTime}ms`);
    };

    const handleRefine = async () => {
        setLoading(true);
        setOutput("");
        setError(null);
        const startTime = Date.now();

        try {
            const response = await fetchRefineResponse(input);
            validateResponse(response);
            await processStreamResponse(response);
        } catch (error) {
            handleRefineError(error);
        } finally {
            setLoading(false);
            logProcessingTime(startTime);
        }
    };

    const handleCopy = () => {
        if (output) {
            navigator.clipboard.writeText(output);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClear = () => {
        if (window.confirm("Are you sure you want to clear your notes?")) {
            setInput("");
            setOutput("");
        }
    };

    // Keyboard submit handler: Ctrl/Cmd + Enter
    const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            if (!loading && input.trim()) {
                handleRefine();
            }
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Noise texture overlay */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.015]"
                style={{
                    backgroundImage:
                        'url("data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%" height="100%" filter="url(%23noiseFilter)"/%3E%3C/svg%3E")',
                }}
            />

            <div className="relative mx-auto max-w-4xl px-6 py-16 sm:py-24">
                {/* Header */}
                <header className="mb-16">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-2 h-2 rounded-full bg-foreground" />
                        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Local LLM Tool
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                            <button
                                aria-label="Toggle theme"
                                onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
                                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                        </div>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-balance">Note Refiner</h1>
                    <p className="text-muted-foreground mt-4 text-lg max-w-md">
                        Transform rough notes into clean, structured bullet points.
                    </p>
                </header>

                {/* Main content */}
                <div className="space-y-6">
                    {/* Input section */}
                    <div className="group">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                                Input
                            </label>
                            {input && (
                                <button
                                    onClick={handleClear}
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Trash2 size={12} />
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <textarea
                                className="w-full bg-card border border-border rounded-lg p-5 min-h-50 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground/50 leading-relaxed transition-shadow"
                                placeholder="Paste your rough notes here..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={loading}
                                onKeyDown={handleTextareaKeyDown}
                            />
                            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground tabular-nums">
                                {input.length}
                            </div>
                        </div>
                    </div>

                    {/* Action button */}
                    <div className="flex justify-center py-4">
                        <button
                            onClick={handleRefine}
                            disabled={loading || !input.trim()}
                            className="group relative flex items-center gap-3 px-8 py-3.5 bg-foreground text-background rounded-full font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 active:scale-[0.98]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin h-4 w-4" />
                                    <span>Processing</span>
                                </>
                            ) : (
                                <>
                                    <span>Refine Notes</span>
                                    <ArrowRight
                                        size={16}
                                        className="transition-transform group-hover:translate-x-0.5"
                                    />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Output section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                                Output
                            </label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <input
                                        type="checkbox"
                                        checked={renderMarkdown}
                                        onChange={() => setRenderMarkdown(r => !r)}
                                        className="w-4 h-4"
                                    />
                                    Render Markdown
                                </label>
                                {output && (
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {copied ? (
                                            <>
                                                <Check size={12} />
                                                Copied
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={12} />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                        {error && (
                            <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-800">{error}</div>
                        )}

                        <div
                            ref={outputRef}
                            className="w-full bg-card border border-border rounded-lg p-5 min-h-50 text-sm leading-relaxed"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <span className="inline-block w-1 h-4 bg-muted-foreground animate-pulse" />
                                </div>
                            ) : output ? (
                                renderMarkdown ? (
                                    <div className="markdown-body text-foreground">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <pre className="whitespace-pre-wrap text-foreground font-mono">{output}</pre>
                                )
                            ) : (
                                <span className="text-muted-foreground/50">Refined output will appear here...</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-16 pt-8 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Powered by local LLM</span>
                        <div className="flex items-center gap-2">
                            <div
                                className={`w-1.5 h-1.5 rounded-full ${healthLoading ? "bg-yellow-400 animate-pulse" : healthOk ? "bg-green-500" : "bg-red-500"}`}
                            />
                            <span>{healthLoading ? "Checking..." : healthOk ? "Connected" : "Disconnected"}</span>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default App;
