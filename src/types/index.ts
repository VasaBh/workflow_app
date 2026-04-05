export type UserRole = 'admin' | 'editor' | 'executor' | 'viewer';
export type BlueprintStatus = 'draft' | 'published' | 'archived';
export type RunStatus = 'not_started' | 'in_progress' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type StepType = 'manual' | 'script' | 'approval';
export type StepStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'pending_approval' | 'blocked';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  last_login?: string;
  created_at: string;
}

export interface Blueprint {
  id: string;
  name: string;
  description?: string;
  status: BlueprintStatus;
  version: number;
  step_count: number;
  run_count: number;
  sequential: boolean;
  created_at: string;
  updated_at: string;
}

export interface Step {
  id: string;
  blueprint_id: string;
  name: string;
  type: StepType;
  parent_id?: string;
  order: number;
  script_id?: string;
  script_params?: Record<string, unknown>;
  entry?: string;
  dependencies: string[];
  on_failure: 'block' | 'skip' | 'retry';
  retry_count: number;
  timeout_seconds: number;
  validation_rules?: Record<string, unknown>;
  children?: Step[];
}

export interface Run {
  id: string;
  blueprint_id: string;
  blueprint_name?: string;
  status: RunStatus;
  progress: number;
  triggered_by?: string;
  started_at?: string;
  completed_at?: string;
  duration?: number;
  context?: Record<string, unknown>;
  created_at: string;
}

export interface StepRun {
  id: string;
  run_id: string;
  step_id: string;
  name: string;
  type: StepType;
  status: StepStatus;
  started_at?: string;
  completed_at?: string;
  duration?: number;
  output?: Record<string, unknown>;
  error?: string;
  error_line?: number;
  children?: StepRun[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  message: string;
}

export interface Script {
  id: string;
  name: string;
  description?: string;
  language: string;
  entry: string;
  code: string;
  version: number;
  parameters: ScriptParameter[];
  updated_by?: string;
  updated_at: string;
  created_at: string;
}

export interface ScriptParameter {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  default?: string;
}

export interface Schedule {
  id: string;
  name: string;
  blueprint_id: string;
  blueprint_name?: string;
  cron_expression: string;
  timezone: string;
  context?: Record<string, unknown>;
  status: 'active' | 'paused';
  next_run_at?: string;
  last_run_at?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  event_type: string;
  title: string;
  message: string;
  run_id?: string;
  step_id?: string;
  read: boolean;
  created_at: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  last_delivery_status?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
