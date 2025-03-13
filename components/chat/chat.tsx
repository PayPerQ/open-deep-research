"use client";

import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Message } from "ai";
import { motion } from "framer-motion";
import { BrainCircuitIcon, GithubIcon, PanelRightOpen } from "lucide-react";

import { useScrollToBottom } from "@/lib/hooks/use-scroll-to-bottom";
import { getApiBasePath } from "@/lib/utils";
import { useCreditId } from "@/lib/hooks/use-credit-id";

import DownloadTxtButton from "./download-txt";
import { MultimodalInput } from "./input";
import { PreviewMessage, ProgressStep } from "./message";
import { ResearchProgress } from "./research-progress";

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [containerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();
  const creditId = useCreditId();

  // New state to store the final report text
  const [finalReport, setFinalReport] = useState<string | null>(null);
  
  // Function to save report to localStorage
  const saveReportToLocalStorage = (report: string, userQuery: string) => {
    // Generate a unique ID
    const id = uuidv4();
    
    // Create current date string
    const currentDate = new Date().toISOString();
    
    // Create conversation object
    const newConversation = {
      id,
      name: userQuery.substring(0, 20) + (userQuery.length > 20 ? "..." : ""),
      messages: [
        {
          role: "user",
          content: userQuery,
          initImage: "",
          image_gen_params: {},
          reasoning_effort: "medium"
        },
        {
          role: "assistant",
          content: report,
          citations: []
        }
      ],
      model: {
        id: "litellm/claude-3.7-sonnet",
        name: "Claude 3.7 Sonnet",
        icon: "/claude-icon.svg",
        type: "text generation",
        visionEnabled: true,
        context_window: 200000,
        label: "World's most intelligent",
        class: "recommended_chat_models",
        isExtendedThinking: true,
        details: "The new Claude 3.7 Sonnet delivers better-than-Opus capabilities, faster-than-Sonnet speeds, at the same Sonnet prices. Sonnet is particularly good at:\n\n- Coding: New Sonnet scores ~49% on SWE-Bench Verified, higher than the last best score, and without any fancy prompt scaffolding\n- Data science: Augments human data science expertise; navigates unstructured data while using multiple tools for insights\n- Visual processing: excelling at interpreting charts, graphs, and images, accurately transcribing text to derive insights beyond just the text alone\n- Agentic tasks: exceptional tool use, making it great at agentic tasks (i.e. complex, multi-step problem solving tasks that require engaging with other systems)\n\n#multimodal"
      },
      prompt: "\n  You are a friendly, helpful AI assistant.\n  Here is the current date: " + new Date().toString() + ".\n  # General Instructions\n  - Use markdown to format paragraphs, lists, tables, and quotes whenever possible.\n  - Use headings level 2 and 3 to separate sections of your response, like \"## Header\", but NEVER start an answer with a heading or title of any kind.\n  - Use single new lines for lists and double new lines for paragraphs.\n  - Use markdown to render images given in the search results.\n  - NEVER write URLs or links.\n\n  ## Coding\n\n  You MUST use markdown code blocks to write code, specifying the language for syntax highlighting, for example ```bash or```python\n  If the user's query asks for code, you should write the code first and then explain it.\n\n  ## Science and Math\n\n  If the user query is about some simple calculation, only answer with the final result.\n  Follow these rules for writing formulas:\n\n  - Always use \\( and\\) for inline formulas and\\[ and\\] for blocks, for example\\(x^4 = x - 3 \\)\n  - To cite a formula add citations to the end, for example\\[ \\sin(x) \\] [1][2] or \\(x^2-2\\) [4].\n  - Never use $ or $$ to render LaTeX, even if it is present in the user query.\n  - Never use unicode to render math expressions, ALWAYS use LaTeX.\n  - Never use the \\label instruction for LaTeX.\n  - In case of dollar sign as currency, make sure to escape it.\n  ",
      temperature: 1,
      folderId: null,
      created_at: currentDate,
      dataSource: null
    };
    
    // Get existing conversations or create a new array
    let conversationHistory = [];
    try {
      const existingHistory = localStorage.getItem("conversationHistory");
      if (existingHistory) {
        conversationHistory = JSON.parse(existingHistory);
      }
    } catch (error) {
      console.error("Error parsing conversation history:", error);
    }
    
    // Add new conversation to the array
    conversationHistory.unshift(newConversation); // Add to the beginning
    
    // Save back to localStorage
    localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));
    
    console.log("Research report successfully saved to conversationHistory in localStorage with ID:", id);
  };

  // States for interactive feedback workflow
  const [stage, setStage] = useState<"initial" | "feedback" | "researching">(
    "initial"
  );
  const [initialQuery, setInitialQuery] = useState("");

  // Add state for mobile progress panel visibility
  const [showProgress, setShowProgress] = useState(false);

  // New state to track if we're on mobile (using 768px as breakpoint for md)
  const [isMobile, setIsMobile] = useState<boolean>(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update the condition to only be true when there are actual research steps
  const hasStartedResearch =
    progress.filter(
      (step) =>
        // Only count non-report steps or initial report steps
        step.type !== "report" ||
        step.content.includes("Generating") ||
        step.content.includes("Synthesizing")
    ).length > 0;

  // Helper function to call the research endpoint
  const sendResearchQuery = async (
    query: string,
    config: { breadth: number; modelId: string }
  ) => {
    try {
      setIsLoading(true);
      setProgress([]);
      // Inform the user that research has started
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Starting in-depth research based on your inputs...",
        },
      ]);

      const response = await fetch(`${getApiBasePath()}/api/research`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          breadth: config.breadth,
          modelId: config.modelId,
          creditId: creditId,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const textDecoder = new TextDecoder();
      let buffer = "";
      const reportParts: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += textDecoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const jsonStr = part.substring(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === "progress") {
                if (event.step.type !== "report") {
                  // Check for duplicates before adding this progress step.
                  setProgress((prev) => {
                    if (
                      prev.length > 0 &&
                      prev[prev.length - 1].content === event.step.content
                    ) {
                      return prev;
                    }
                    return [...prev, event.step];
                  });
                }
              } else if (event.type === "result") {
                // Save the final report so we can download it later
                setFinalReport(event.report);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    role: "assistant",
                    content: event.report,
                  },
                ]);
                
                // Save the report to localStorage
                saveReportToLocalStorage(event.report, query);
              } else if (event.type === "report_part") {
                reportParts.push(event.content);
              }
            } catch (e) {
              console.error("Error parsing event:", e);
            }
          }
        }
      }

      if (reportParts.length > 0) {
        // In case the report was sent in parts
        const fullReport = reportParts.join("\n");
        setFinalReport(fullReport);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: fullReport,
          },
        ]);
      }
    } catch (error) {
      console.error("Research error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sorry, there was an error conducting the research.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (
    userInput: string,
    config: { breadth: number; modelId: string }
  ) => {
    if (!userInput.trim() || isLoading) return;

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: userInput,
      },
    ]);

    setIsLoading(true);

    if (stage === "initial") {
      // Add thinking message only for initial query
      setMessages((prev) => [
        ...prev,
        {
          id: "thinking",
          role: "assistant",
          content: "Thinking...",
        },
      ]);

      // Handle the user's initial query
      setInitialQuery(userInput);

      try {
        const response = await fetch(`${getApiBasePath()}/api/feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: userInput,
              numQuestions: 3,
              modelId: config.modelId,
              creditId: creditId,
            }),
          });
        const data = await response.json();
        const questions: string[] = data.questions || [];
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== "thinking");
          if (questions.length > 0) {
            const formattedQuestions = questions
              .map((q, index) => `${index + 1}. ${q}`)
              .join("\n\n");
            return [
              ...filtered,
              {
                id: Date.now().toString(),
                role: "assistant",
                content: `Please answer the following follow-up questions to help clarify your research:\n\n${formattedQuestions}`,
              },
            ];
          }
          return filtered;
        });
        setStage("feedback");
      } catch (error) {
        console.error("Feedback generation error:", error);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== "thinking"),
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "Sorry, there was an error generating feedback questions.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    } else if (stage === "feedback") {
      // In feedback stage, combine the initial query and follow-up answers
      const combined = `Deep Research Topic: ${initialQuery}\nFollow-up Answers:\n${userInput}`;
      setStage("researching");
      try {
        await sendResearchQuery(combined, config);
      } finally {
        setIsLoading(false);
        // Reset the stage so further messages will be processed
        setStage("initial");
        // Inform the user that a new research session can be started
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content:
              "Research session complete. You can now ask another question to begin a new research session.",
          },
        ]);
      }
    }
  };

  return (
    <div className="flex w-full h-full relative">
      {/* Main container with dynamic width */}
      <motion.div
        className={`mx-auto flex flex-col h-full pt-10 ${
          hasStartedResearch ? "md:mr-0" : "md:mx-auto"
        }`}
        initial={{ width: "100%", maxWidth: "800px" }}
        animate={{
          width: !isMobile && hasStartedResearch ? "55%" : "100%",
          maxWidth: !isMobile && hasStartedResearch ? "1000px" : "800px",
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Messages Container */}
        <div
          ref={containerRef}
          className={`${
            showProgress ? "hidden md:block" : "block"
          } flex-1 overflow-y-auto relative`}
        >
          {/* Welcome Message (if no research started and no messages) */}
          {!hasStartedResearch && messages.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 100,
                  damping: 20,
                }}
                className="relative text-center space-y-4 p-4 md:p-12
                  before:absolute before:inset-0 
                  before:bg-gradient-to-b before:from-primary/[0.03] before:to-primary/[0.01]
                  before:rounded-[32px] before:blur-xl before:-z-10
                  after:absolute after:inset-0 
                  after:bg-gradient-to-br after:from-primary/[0.08] after:via-transparent after:to-primary/[0.03]
                  after:rounded-[32px] after:blur-md after:-z-20"
              >
                <motion.div
                  animate={{
                    y: [-2, 2, -2],
                    rotate: [-1, 1, -1],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative"
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.05, 1],
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/30 
                      blur-2xl rounded-full -z-10"
                  />
                  <BrainCircuitIcon className="w-12 h-12 mx-auto text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.3)]" />
                </motion.div>

                <div className="space-y-2">
                  <motion.h2
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-base md:text-2xl font-semibold bg-clip-text text-transparent 
                      bg-gradient-to-r from-primary via-primary/90 to-primary/80"
                  >
                    Open Deep Research
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xs md:text-base text-muted-foreground/80 max-w-[340px] mx-auto leading-relaxed"
                  >
                    An open source alternative to OpenAI and Gemini's deep
                    research capabilities. Ask any question to generate a
                    comprehensive report.
                  </motion.p>
                </div>
              </motion.div>
            </div>
          )}

          {/* Messages */}
          <div className="p-4 md:p-6 space-y-6">
            {messages.map((message) => (
              <PreviewMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} className="h-4" />
            {finalReport && (
              <div className="mt-4">
                <DownloadTxtButton reportText={finalReport} />
              </div>
            )}
          </div>
        </div>

        {/* Input - Fixed to bottom */}
        <div className="sticky bottom-0">
          <div className="p-4 md:p-6 mx-auto">
            <MultimodalInput
              onSubmit={handleSubmit}
              isLoading={isLoading}
              placeholder={
                stage === "initial"
                  ? "What would you like to research?"
                  : stage === "feedback"
                  ? "Please provide your answers to the follow-up questions..."
                  : "Research in progress..."
              }
            />
          </div>
        </div>
      </motion.div>

      {/* Research Progress Panel */}
      <motion.div
        className={`
          pt-10 fixed md:relative
          inset-0 md:inset-auto
          bg-background md:bg-transparent
          md:w-[45%]
          ${showProgress ? "flex" : "hidden md:flex"}
          ${hasStartedResearch ? "md:flex" : "md:hidden"}
        `}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
      >
        <ResearchProgress progress={progress} isLoading={isLoading} />
      </motion.div>

      {/* Mobile Toggle Button - Only show when research has started */}
      {hasStartedResearch && (
        <button
          onClick={() => setShowProgress(!showProgress)}
          className={`
            md:hidden
            fixed
            bottom-24
            right-4
            z-50
            p-3
            bg-primary
            text-primary-foreground
            rounded-full
            shadow-lg
            transition-transform
            ${showProgress ? "rotate-180" : ""}
          `}
          aria-label="Toggle research progress"
        >
          <PanelRightOpen className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
