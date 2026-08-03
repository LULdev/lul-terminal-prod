/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ToolCategory =
  | 'text'
  | 'data'
  | 'encoding'
  | 'math'
  | 'security'
  | 'design'
  | 'time'
  | 'web'
  | 'dev'
  | 'network'
  | 'generators'
  | 'reference'
  | 'fun';

export type ToolInputMode = 'none' | 'single' | 'textarea' | 'dual' | 'custom';

export type CustomUi = 'stopwatch' | 'countdown' | 'dice';

export type ToolDefinition = {
  id: string;
  name: string;
  icon: string;
  category: ToolCategory;
  subcategory: string;
  tags: string[];
  description: string;
  inputMode: ToolInputMode;
  customUi?: CustomUi;
  placeholder?: string;
  placeholder2?: string;
  defaultInput?: string;
};

export type ToolExecutor = (
  input: string,
  input2: string,
  extras: Record<string, string>
) => string | Promise<string>;

export type CategoryMeta = {
  id: ToolCategory | 'all';
  label: string;
  icon: string;
};