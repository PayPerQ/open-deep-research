"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getApiBasePath } from "@/lib/utils";
import {
    LockIcon,
    KeyIcon,
    Loader2Icon,
    ShieldCheckIcon,
    GithubIcon,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ApiKeyDialogProps {
    show: boolean;
    onClose: (open: boolean) => void;
    onSuccess: () => void;
}

export function ApiKeyDialog({ show, onClose, onSuccess }: ApiKeyDialogProps) {
    const [openaiKey, setOpenaiKey] = useState("");
    const [firecrawlKey, setFirecrawlKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [virtualApiKey, setVirtualApiKey] = useState("");
    const [usePpqApi, setUsePpqApi] = useState(false);

    // Load PPQ settings from localStorage on component mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedVirtualApiKey = localStorage.getItem('virtual_api_key');
            const savedUsePpqApi = localStorage.getItem('use_ppq_api') === 'true';
            
            if (savedVirtualApiKey) {
                setVirtualApiKey(savedVirtualApiKey);
            }
            
            if (savedUsePpqApi) {
                setUsePpqApi(savedUsePpqApi);
            }
        }
    }, []);

    const handleApiKeySubmit = async () => {
        if (!openaiKey || !firecrawlKey) return;
        setLoading(true);
        
        // Save PPQ settings to localStorage if provided
        if (virtualApiKey) {
            localStorage.setItem('virtual_api_key', virtualApiKey);
            localStorage.setItem('use_ppq_api', usePpqApi ? 'true' : 'false');
        } else {
            // Clear PPQ settings if not provided
            localStorage.removeItem('virtual_api_key');
            localStorage.removeItem('use_ppq_api');
        }
        
        const res = await fetch(`${getApiBasePath()}/api/keys`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ openaiKey, firecrawlKey }),
        });
        
        if (res.ok) {
            onClose(false);
            onSuccess();
        }
        setLoading(false);
    };

    return (
        <Dialog open={show} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-w-[95%] h-[90vh] sm:h-auto overflow-y-auto bg-white/80 backdrop-blur-xl border border-zinc-200 shadow-2xl p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl sm:text-2xl mb-2 sm:mb-4 font-bold text-black">
                        Open Deep Research
                    </DialogTitle>
                    <DialogDescription className="text-zinc-600 space-y-3 sm:space-y-4 mt-2 sm:mt-4">
                        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 sm:p-4">
                            <h3 className="font-semibold text-zinc-900 mb-2 flex items-center text-sm sm:text-base">
                                <KeyIcon className="w-4 h-4 mr-2" />
                                Secure API Key Setup
                            </h3>
                            <p className="text-xs text-zinc-600">
                                To use Deep Research, you'll need to provide
                                your API keys. These keys are stored securely
                                using HTTP-only cookies and are never exposed to
                                client-side JavaScript.
                            </p>
                            <div className="mt-3 flex flex-col space-y-2 text-xs">
                                <div className="text-zinc-600">
                                    <p>
                                        <span className="font-medium">
                                            Self-hosting option:
                                        </span>{" "}
                                        You can clone the repository and host
                                        this application on your own
                                        infrastructure. This gives you complete
                                        control over your data and API key
                                        management.
                                    </p>
                                    <a
                                        href="https://github.com/fdarkaou/open-deep-research"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center mt-1 text-zinc-700 hover:text-zinc-900 transition-colors"
                                    >
                                        View self-hosting instructions
                                        <svg
                                            className="w-3 h-3 ml-1"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                                            />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 sm:p-4">
                                <h4 className="font-medium text-blue-900 flex items-center mb-2 text-sm">
                                    <Image
                                        src='/providers/openai.webp'
                                        alt="OpenAI Logo"
                                        width={16}
                                        height={16}
                                        className="mr-2"
                                        unoptimized
                                    />
                                    OpenAI API Key
                                </h4>
                                <p className="text-xs text-blue-700">
                                    Powers our advanced language models for
                                    research analysis and synthesis.
                                    <a
                                        href="https://platform.openai.com/api-keys"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block mt-2 text-blue-600 hover:text-blue-800 underline"
                                    >
                                        Get your OpenAI key →
                                    </a>
                                </p>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 sm:p-4">
                                <h4 className="font-medium text-emerald-900 flex items-center mb-2 text-sm">
                                    🔥 FireCrawl API Key
                                </h4>
                                <p className="text-xs text-emerald-700">
                                    Enables real-time web crawling and data
                                    gathering capabilities.
                                    <a
                                        href="https://www.firecrawl.dev/app/api-keys"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block mt-2 text-emerald-600 hover:text-emerald-800 underline"
                                    >
                                        Get your FireCrawl key →
                                    </a>
                                </p>
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
                    <div className="space-y-3 sm:space-y-4">
                        {/* PPQ API Integration */}
                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 sm:p-4 mb-4">
                            <h4 className="font-medium text-purple-900 flex items-center mb-2 text-sm">
                                <svg viewBox="0 0 24 24" width="16" height="16" className="mr-2" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                                </svg>
                                PPQ API Integration (Optional)
                            </h4>
                            <p className="text-xs text-purple-700 mb-2">
                                Use PayPerQ API for better performance and cost control.
                            </p>
                            <div className="mt-2">
                                <label className="text-sm font-medium text-purple-700 mb-1 block">
                                    Virtual API Key
                                </label>
                                <div className="relative">
                                    <Input
                                        type="password"
                                        value={virtualApiKey}
                                        onChange={(e) => setVirtualApiKey(e.target.value)}
                                        placeholder="sk-..."
                                        className="pr-10 font-mono text-sm bg-white/50 border-purple-200 focus:border-purple-400 focus:ring-purple-400 h-9 sm:h-10"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-purple-500">
                                    PayPerQ API key - stored in your browser&apos;s localStorage
                                </p>
                            </div>
                            <div className="mt-3 flex items-center">
                                <input
                                    type="checkbox"
                                    id="use-ppq-api"
                                    checked={usePpqApi}
                                    onChange={(e) => setUsePpqApi(e.target.checked)}
                                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-purple-300 rounded"
                                />
                                <label htmlFor="use-ppq-api" className="ml-2 block text-sm text-purple-700">
                                    Use PPQ API for research instead of standard OpenAI
                                </label>
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-sm font-medium text-zinc-700 mb-1 block">
                                OpenAI API Key
                            </label>
                            <div className="relative">
                                <Input
                                    type="password"
                                    value={openaiKey}
                                    onChange={(e) =>
                                        setOpenaiKey(e.target.value)
                                    }
                                    placeholder="sk-..."
                                    className="pr-10 font-mono text-sm bg-white/50 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 h-9 sm:h-10"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <LockIcon className="h-4 w-4 text-zinc-400" />
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">
                                Starts with 'sk-' and contains about 50
                                characters
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-zinc-700 mb-1 block">
                                FireCrawl API Key
                            </label>
                            <div className="relative">
                                <Input
                                    type="password"
                                    value={firecrawlKey}
                                    onChange={(e) =>
                                        setFirecrawlKey(e.target.value)
                                    }
                                    placeholder="fc-..."
                                    className="pr-10 font-mono text-sm bg-white/50 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 h-9 sm:h-10"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <LockIcon className="h-4 w-4 text-zinc-400" />
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">
                                Usually starts with 'fc-' for production keys
                            </p>
                        </div>
                    </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-3 sm:justify-between mt-4">
                    <div className="flex items-center text-xs text-zinc-500 justify-center sm:justify-start">
                        <ShieldCheckIcon className="w-4 h-4 mr-1 text-zinc-400" />
                        Your keys are stored securely
                    </div>
                    <div className="flex items-center justify-center sm:justify-end space-x-4 text-xs text-zinc-500">
                        <a
                            href="https://github.com/fdarkaou/open-deep-research"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-zinc-600 hover:text-zinc-900 transition-colors"
                        >
                            <GithubIcon className="w-4 h-4 mr-1" />
                            Get source code
                        </a>
                    </div>
                    <Button
                        type="submit"
                        onClick={handleApiKeySubmit}
                        className="w-full sm:w-auto bg-black text-white hover:bg-zinc-800 transition-all duration-200"
                        disabled={!openaiKey || !firecrawlKey || loading}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center">
                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                Setting up...
                            </div>
                        ) : (
                            "Start Researching"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
