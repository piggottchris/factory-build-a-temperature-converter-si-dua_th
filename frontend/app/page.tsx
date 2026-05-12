"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";

export default function Home() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="haiku_agent" showDevConsole>
      <main className="flex h-screen w-screen flex-col bg-white">
        <header className="border-b px-6 py-4">
          <h1 className="text-xl font-semibold">darkpoc spike — haiku agent</h1>
          <p className="text-sm text-gray-500">
            FastAPI + Microsoft Agent Framework, served via AG-UI to CopilotKit.
          </p>
        </header>
        <div className="flex-1 overflow-y-auto">
          <CopilotChat
            className="mx-auto h-full w-full max-w-3xl"
            instructions="Ask for a haiku; if you don't supply a topic the agent will pick one."
          />
        </div>
      </main>
    </CopilotKit>
  );
}
