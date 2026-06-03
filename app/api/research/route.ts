import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

import {
  deepResearch,
  generateFeedback,
  writeFinalReport,
} from "@/lib/deep-research";
import { createModel, type AIModel } from "@/lib/deep-research/ai/providers";

export async function POST(req: NextRequest) {
  try {
    const {
      query,
      breadth: rawBreadth = 3,
      depth = 2,
      modelId = "openai/gpt-5.3-chat",
      creditId,
    } = await req.json();

    // Server-side breadth validation — enforce min 2, max 8
    const MAX_BREADTH = 8;
    const MIN_BREADTH = 2;
    const breadth = Math.min(MAX_BREADTH, Math.max(MIN_BREADTH, Math.floor(Number(rawBreadth) || MIN_BREADTH)));

    // Retrieve firecrawl key from secure cookies
    const firecrawlKey = req.cookies.get("firecrawl-key")?.value;

    if (!creditId) {
      return Response.json(
        { error: "Credit ID is required" },
        { status: 400 }
      );
    }

    // Pre-research credit check — verify user has sufficient balance before starting
    try {
      const creditCheckUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/credits/balance`;
      const creditCheckRes = await fetch(creditCheckUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credit_id: creditId }),
      });
      if (creditCheckRes.ok) {
        const creditData = await creditCheckRes.json();
        if (creditData.balance !== undefined && creditData.balance <= 0) {
          return Response.json(
            { error: "Insufficient credits to start deep research" },
            { status: 402 }
          );
        }
      }
    } catch (err) {
      console.error("Credit check failed, proceeding anyway:", err);
    }

    // Add API key validation
    if (process.env.NEXT_PUBLIC_ENABLE_API_KEYS === "true") {
      if (!firecrawlKey) {
        return Response.json(
          { error: "FireCrawl API key is required but not provided" },
          { status: 401 }
        );
      }
    }

    console.log("\n🔬 [RESEARCH ROUTE] === Request Started ===");
    console.log("Model ID:", modelId);
    console.log("Configuration:", {
      breadth,
      depth,
    });
    console.log("API Keys Present:", {
      FireCrawl: firecrawlKey ? "✅" : "❌",
    });

    try {
      const model = createModel(modelId as AIModel, creditId);
      console.log("\n🤖 [RESEARCH ROUTE] === Model Created ===");
      console.log("Using Model:", modelId);

      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      (async () => {
        try {
          console.log("\n🚀 [RESEARCH ROUTE] === Research Started ===");

          const feedbackQuestions = await generateFeedback({
            query,
            modelId,
            creditId,
          });
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "progress",
                step: {
                  type: "query",
                  content: "Generated feedback questions",
                },
              })}\n\n`
            )
          );

          const { learnings, visitedUrls } = await deepResearch({
            query,
            breadth,
            depth,
            model,
            firecrawlKey,
            creditId,
            onProgress: async (update: string) => {
              console.log("\n📊 [RESEARCH ROUTE] Progress Update:", update);
              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "progress",
                    step: {
                      type: "research",
                      content: update,
                    },
                  })}\n\n`
                )
              );
            },
          });

          console.log("\n✅ [RESEARCH ROUTE] === Research Completed ===");
          console.log("Learnings Count:", learnings.length);
          console.log("Visited URLs Count:", visitedUrls.length);

          const report = await writeFinalReport({
            prompt: query,
            learnings,
            visitedUrls,
            model,
          });

          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "result",
                feedbackQuestions,
                learnings,
                visitedUrls,
                report,
              })}\n\n`
            )
          );
        } catch (error) {
          console.error("\n❌ [RESEARCH ROUTE] === Research Process Error ===");
          console.error("Error:", error);
          Sentry.captureException(error, {
            tags: { route: "research", model_id: modelId },
            extra: { breadth, depth, creditIdPrefix: creditId?.substring(0, 5) },
          });
          // Forward a short user-facing message — capped to limit any
          // internal detail (URLs, tokens) that may appear in raw errors.
          // Full error stays in Sentry via captureException above.
          const rawMessage =
            error instanceof Error ? error.message : String(error);
          const errorMessage = rawMessage.slice(0, 200);
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message: errorMessage,
              })}\n\n`
            )
          );
        } finally {
          await writer.close();
        }
      })();

      return new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (error) {
      console.error("\n💥 [RESEARCH ROUTE] === Route Error ===");
      console.error("Error:", error);
      Sentry.captureException(error, {
        tags: { route: "research", phase: "setup", model_id: modelId },
      });
      return Response.json({ error: "Research failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("\n💥 [RESEARCH ROUTE] === Parse Error ===");
    console.error("Error:", error);
    Sentry.captureException(error, {
      tags: { route: "research", phase: "parse" },
    });
    return Response.json({ error: "Research failed" }, { status: 500 });
  }
}
