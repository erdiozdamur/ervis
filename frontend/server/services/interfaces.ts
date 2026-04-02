export interface ModelProvider {
  generate(input: { prompt: string; context?: string[] }): Promise<string>;
}

export interface EmbeddingProvider {
  embed(input: string): Promise<number[]>;
}

export interface ToolExecutor {
  execute(tool: string, payload: Record<string, unknown>): Promise<unknown>;
}

export interface OrchestrationEngine {
  runWorkflow(input: { workflowId: string; actorId: string }): Promise<void>;
}
