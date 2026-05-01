export type TodoStatus = "open" | "done";

export interface TodoItem {
  text: string;
  status: TodoStatus;
  children: TodoItem[];
}

export interface InferredGroup {
  parentPath: number[];
  reason: string;
}

export interface ScanResult {
  items: TodoItem[];
  inferredGroups: InferredGroup[];
  unparsed: string[];
}

export type Provider = "anthropic" | "openai";
