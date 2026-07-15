/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PasteLanguage = {
  id: string;
  label: string;
  icon: string;
};

export const PASTE_LANGUAGES: PasteLanguage[] = [
  { id: 'plaintext', label: 'Plain Text', icon: '📄' },
  { id: 'markdown', label: 'Markdown', icon: '📝' },
  { id: 'javascript', label: 'JavaScript', icon: '⚡' },
  { id: 'typescript', label: 'TypeScript', icon: '🔷' },
  { id: 'python', label: 'Python', icon: '🐍' },
  { id: 'bash', label: 'Bash / Shell', icon: '🐚' },
  { id: 'json', label: 'JSON', icon: '{ }' },
  { id: 'html', label: 'HTML', icon: '🌐' },
  { id: 'css', label: 'CSS', icon: '🎨' },
  { id: 'sql', label: 'SQL', icon: '🗃️' },
  { id: 'rust', label: 'Rust', icon: '🦀' },
  { id: 'go', label: 'Go', icon: '🔵' },
  { id: 'java', label: 'Java', icon: '☕' },
  { id: 'csharp', label: 'C#', icon: '💜' },
  { id: 'php', label: 'PHP', icon: '🐘' },
  { id: 'cpp', label: 'C / C++', icon: '⚙️' },
  { id: 'yaml', label: 'YAML', icon: '📋' },
  { id: 'xml', label: 'XML', icon: '📰' },
  { id: 'dockerfile', label: 'Dockerfile', icon: '🐳' },
  { id: 'powershell', label: 'PowerShell', icon: '💻' },
];

export const PASTE_EXPIRY_OPTIONS = [
  { id: '10m', label: '10 minutes' },
  { id: '1h', label: '1 hour' },
  { id: '1d', label: '1 day' },
  { id: '1w', label: '1 week' },
  { id: '1m', label: '1 month' },
  { id: 'never', label: 'Never' },
] as const;

export type PasteExpiry = (typeof PASTE_EXPIRY_OPTIONS)[number]['id'];

export const PASTE_VISIBILITY_OPTIONS = [
  { id: 'public', label: 'Public', desc: 'Anyone with the link · listed in archive', icon: '🌐' },
  { id: 'private', label: 'Private', desc: 'Only you can view · hidden from archive', icon: '🔒' },
  { id: 'protected', label: 'Password protected', desc: 'Requires password · hidden from archive', icon: '🔑' },
] as const;

export type PasteVisibility = (typeof PASTE_VISIBILITY_OPTIONS)[number]['id'];

export function languageLabel(id: string): string {
  return PASTE_LANGUAGES.find((l) => l.id === id)?.label ?? id;
}

export function visibilityLabel(id: string): string {
  const opt = PASTE_VISIBILITY_OPTIONS.find((o) => o.id === id);
  if (opt) return opt.label;
  if (id === 'unlisted') return 'Private';
  return id;
}

export function visibilityIcon(id: string): string {
  const opt = PASTE_VISIBILITY_OPTIONS.find((o) => o.id === id);
  if (opt) return opt.icon;
  if (id === 'unlisted') return '🔒';
  return '📄';
}

export type PasteTemplate = {
  id: string;
  label: string;
  icon: string;
  language: string;
  title: string;
  content: string;
};

export const PASTE_TEMPLATES: PasteTemplate[] = [
  {
    id: 'hello-js',
    label: 'Hello World (JS)',
    icon: '⚡',
    language: 'javascript',
    title: 'Hello World',
    content: `// Quick start snippet\nfunction greet(name = 'Terminal') {\n  console.log(\`Hello, \${name}!\`);\n}\n\ngreet();`,
  },
  {
    id: 'react-component',
    label: 'React Component',
    icon: '⚛️',
    language: 'typescript',
    title: 'React Component',
    content: `import React from 'react';\n\ntype Props = { label: string };\n\nexport function Badge({ label }: Props) {\n  return <span className="badge">{label}</span>;\n}`,
  },
  {
    id: 'python-cli',
    label: 'Python CLI',
    icon: '🐍',
    language: 'python',
    title: 'Python CLI stub',
    content: `#!/usr/bin/env python3\nimport argparse\n\ndef main():\n    parser = argparse.ArgumentParser()\n    parser.add_argument('--name', default='world')\n    args = parser.parse_args()\n    print(f"Hello, {args.name}!")\n\nif __name__ == '__main__':\n    main()`,
  },
  {
    id: 'docker-compose',
    label: 'Docker Compose',
    icon: '🐳',
    language: 'yaml',
    title: 'docker-compose.yml',
    content: `services:\n  app:\n    image: node:22-alpine\n    ports:\n      - "3000:3000"\n    volumes:\n      - .:/app\n    command: npm run dev`,
  },
  {
    id: 'env-example',
    label: '.env template',
    icon: '🔧',
    language: 'plaintext',
    title: '.env.example',
    content: `# Copy to .env and fill in values\nPORT=3000\nNODE_ENV=development\nAPI_KEY=your_key_here`,
  },
  {
    id: 'markdown-readme',
    label: 'README.md',
    icon: '📝',
    language: 'markdown',
    title: 'README',
    content: `# Project Title\n\n> Short description\n\n## Features\n\n- Item one\n- Item two\n\n## Usage\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\``,
  },
];