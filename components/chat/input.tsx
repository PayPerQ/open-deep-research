"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import cx from "classnames";
import { motion } from "framer-motion";
import {
  ArrowUpIcon,
  CheckCircleIcon,
  ChevronDown,
  DownloadIcon,
  InfoIcon,
  Settings2,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getApiBasePath } from "@/lib/utils";
import {
  availableModels,
  type AIModelDisplayInfo,
} from "@/lib/deep-research/ai/providers";
import { ApiKeyDialog } from "@/components/chat/api-key-dialog";

interface MultimodalInputProps {
  onSubmit: (
    input: string,
    config: {
      breadth: number;
      modelId: string;
    }
  ) => void;
  isLoading: boolean;
  placeholder?: string;
  isAuthenticated?: boolean;
  onDownload?: () => void;
  canDownload?: boolean;
}

export function MultimodalInput({
  onSubmit,
  isLoading,
  placeholder = "What would you like to research?",
  onDownload,
  canDownload = false,
}: MultimodalInputProps) {
  const [input, setInput] = useState("");
  const [breadth, setBreadth] = useState(4);
  const [selectedModel, setSelectedModel] = useState<AIModelDisplayInfo>(
    availableModels.find((model) => model.id === "o3-mini") ||
      availableModels[0]
  );
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Read the feature flag from environment variables.
  const enableApiKeys = process.env.NEXT_PUBLIC_ENABLE_API_KEYS === "true";
  // When API keys are disabled via env flag, always consider keys as present.
  const effectiveHasKeys = enableApiKeys ? hasKeys : true;

  // Check for keys using the consolidated endpoint
  useEffect(() => {
    const checkKeys = async () => {
        const res = await fetch(`${getApiBasePath()}/api/keys`);
      const data = await res.json();
      setHasKeys(data.keysPresent);
      if (!data.keysPresent && enableApiKeys) {
        setShowApiKeyPrompt(true);
      } else {
        setShowApiKeyPrompt(false);
      }
    };
    checkKeys();
  }, [enableApiKeys]);

  // New: Remove API keys handler
  const handleRemoveKeys = async () => {
    if (!window.confirm("Are you sure you want to remove your API keys?"))
      return;
    try {
        const res = await fetch(`${getApiBasePath()}/api/keys`, {
            method: "DELETE",
          });
      if (res.ok) {
        setHasKeys(false);
      }
    } catch (error) {
      console.error("Error removing keys:", error);
    }
  };

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    if (enableApiKeys && !effectiveHasKeys) {
      // Re-open the API key modal if keys are missing
      setShowApiKeyPrompt(true);
      return;
    }
    onSubmit(input, {
      breadth,
      modelId: selectedModel.id,
    });
    setInput("");
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const DownloadButton = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={onDownload}
      className="bg-primary/5 hover:bg-primary/10 border-primary/20 hover:border-primary/30 transition-colors"
    >
      <DownloadIcon className="h-4 w-4 mr-1.5" />
      <span className="text-xs font-medium">Download Report</span>
    </Button>
  );

  return (
    <div className="relative w-full flex flex-col gap-4 border-none">
      {/* Conditionally render API key dialog only if enabled */}
      {enableApiKeys && (
        <ApiKeyDialog
          show={showApiKeyPrompt}
          onClose={setShowApiKeyPrompt}
          onSuccess={() => {
            setShowApiKeyPrompt(false);
            setHasKeys(true);
          }}
        />
      )}

      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className={cx(
          "bg-white min-h-[72px] max-h-[calc(100dvh-200px)] overflow-y-auto text-sm w-full",
          "overflow-hidden resize-none px-4 pb-10 pt-4 rounded-2xl",
          "outline-none focus:outline-none focus:ring-0 border-0"
        )}
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />

      {/* Mobile Controls - Shown in a row above the input */}
      <div className="md:hidden flex flex-wrap gap-2 px-4 py-2 border-t border-border/40 bg-background/80 rounded-xl backdrop-blur-sm">
        {/* API Keys Status */}
        <button
          type="button"
          onClick={
            enableApiKeys
              ? effectiveHasKeys
                ? handleRemoveKeys
                : () => setShowApiKeyPrompt(true)
              : undefined
          }
          className="flex items-center gap-1"
        >
          {enableApiKeys ? (
            effectiveHasKeys ? (
              <>
                <CheckCircleIcon size={16} className="text-green-500" />
                <span className="text-xs text-green-600">
                  API keys configured
                </span>
              </>
            ) : (
              <>
                <XCircleIcon size={16} className="text-red-500" />
                <span className="text-xs text-red-600">API keys missing</span>
              </>
            )
          ) : (
            <span className="text-xs text-green-600"></span>
          )}
        </button>

        {/* Model Selector with Dropdown */}
        <div className="relative">
          <button
            type="button"
            className="cursor-pointer text-xs inline-flex items-center justify-center font-medium text-muted-foreground hover:text-primary/80 h-7 rounded-md px-2 py-1"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          >
            <Image
              src={selectedModel.logo}
              alt={selectedModel.name}
              width={16}
              height={16}
              className="mr-1 rounded-sm"
              unoptimized
            />
            {selectedModel.name}
            <ChevronDown
              className={`ml-1 h-4 w-4 transition-transform ${
                isModelDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-md bg-background shadow-lg border border-border/40">
              <div className="py-1">
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`
                      w-full px-3 py-2 text-left text-xs
                      flex items-center gap-2
                      ${
                        selectedModel.id === model.id
                          ? "bg-muted"
                          : "hover:bg-muted/50"
                      }
                    `}
                  >
                    <Image
                      src={model.logo}
                      alt={model.name}
                      width={16}
                      height={16}
                      className="rounded-sm"
                      unoptimized
                    />
                    {model.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Research Controls */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  B:{breadth}
                  <InfoIcon className="h-3 w-3 text-muted-foreground/70" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Breadth controls the number of SERP (Search Engine Result Page) queries generated and used for research. It essentially determines how wide your research net is cast</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Slider
            value={[breadth]}
            min={2}
            max={8}
            step={1}
            className="w-20"
            onValueChange={([value]) => setBreadth(value)}
          />
        </div>


        {/* Mobile Download Button */}
        {canDownload && <DownloadButton />}
      </div>

      {/* Desktop Controls - Original layout */}
      <div className="hidden md:flex bg-white absolute bottom-0 py-3 left-2 gap-2 items-center">
        {/* Original desktop controls - unchanged */}
        <button
          type="button"
          onClick={
            enableApiKeys
              ? effectiveHasKeys
                ? handleRemoveKeys
                : () => setShowApiKeyPrompt(true)
              : undefined
          }
          className="flex items-center gap-1"
        >
          {enableApiKeys ? (
            effectiveHasKeys ? (
              <>
                <CheckCircleIcon size={16} className="text-green-500" />
                <span className="text-xs text-green-600">
                  API keys configured
                </span>
              </>
            ) : (
              <>
                <XCircleIcon size={16} className="text-red-500" />
                <span className="text-xs text-red-600">API keys missing</span>
              </>
            )
          ) : (
            <span className="text-xs text-green-600"></span>
          )}
        </button>

        {/* Model Selector with Dropdown */}
        <div className="relative">
          <button
            type="button"
            className="cursor-pointer text-xs inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-muted-foreground hover:text-primary/80 h-7 rounded-md px-2 py-1"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          >
            <Image
              src={selectedModel.logo}
              alt={selectedModel.name}
              width={16}
              height={16}
              className="mr-1 rounded-sm"
              unoptimized
            />
            {selectedModel.name}
            <ChevronDown
              className={`ml-1 h-4 w-4 transition-transform ${
                isModelDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute left-0 bottom-full mb-1 z-50 w-48 rounded-md bg-background shadow-lg border border-border/40">
              <div className="py-1">
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`
                      w-full px-3 py-2 text-left text-xs
                      flex items-center gap-2
                      ${
                        selectedModel.id === model.id
                          ? "bg-muted"
                          : "hover:bg-muted/50"
                      }
                    `}
                  >
                    <Image
                      src={model.logo}
                      alt={model.name}
                      width={16}
                      height={16}
                      className="rounded-sm"
                      unoptimized
                    />
                    {model.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    Breadth: {breadth}
                    <InfoIcon className="h-3 w-3 text-muted-foreground/70" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Breadth controls the number of SERP (Search Engine Result Page) queries generated and used for research. It essentially determines how wide your research net is cast</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Slider
              value={[breadth]}
              min={2}
              max={8}
              step={1}
              className="w-24"
              onValueChange={([value]) => setBreadth(value)}
            />
          </div>

        </div>

        {/* Desktop Download Button */}
        {canDownload && <DownloadButton />}
      </div>

      {/* Submit Button */}
      <Button
        className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600"
        onClick={handleSubmit}
        disabled={!input.trim() || isLoading}
      >
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Settings2 className="h-4 w-4" />
          </motion.div>
        ) : (
          <ArrowUpIcon className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
