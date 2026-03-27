/**
 * End-to-end integration test for FridayCode with Ollama qwen3:Thinking.
 *
 * Tests: provider connection, model listing, chat streaming with tool use,
 * session management, memory loading, hooks dispatch, plugin discovery,
 * skill discovery, context compaction, MCP server manager initialization.
 *
 * Run: npx tsx tests/e2e-ollama.ts
 */

import { strict as assert } from 'node:assert';

const MODEL = 'qwen3:Thinking';
const PROVIDER_CONFIG = {
  type: 'ollama' as const,
  enabled: true,
  baseUrl: 'http://localhost:11434',
};

let passed = 0;
let failed = 0;

function ok(name: string) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name: string, err: unknown) {
  failed++;
  console.error(`  ✗ ${name}: ${err instanceof Error ? err.message : err}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

async function main() {
  console.log('\n╭─ FridayCode E2E Tests (Ollama qwen3:Thinking) ────╮\n');

  // ─── 1. Provider Connection ──────────────────────────────
  console.log('Provider & Model:');

  const core = await import('../packages/core/src/index.js');

  let provider: any;
  await test('Create Ollama provider', async () => {
    provider = core.createProvider(PROVIDER_CONFIG);
    assert.ok(provider, 'Provider should be created');
  });

  let models: any[] = [];
  await test('List models from Ollama', async () => {
    models = await provider.listModels();
    assert.ok(models.length > 0, 'Should have at least 1 model');
    const hasQwen3 = models.some((m: any) => m.id.includes('qwen3'));
    assert.ok(hasQwen3, 'Should have a qwen3 model');
  });

  // ─── 2. Chat Streaming ───────────────────────────────────
  console.log('\nChat Streaming:');

  await test('Simple chat with qwen3:Thinking', async () => {
    let content = '';
    let gotDone = false;
    const chatOpts = {
      model: MODEL,
      provider: 'ollama',
      messages: [{ role: 'user' as const, content: 'What is 2+2? Reply with just the number.', timestamp: Date.now() }],
      tools: [],
      stream: true,
      maxTokens: 512,
    };

    for await (const chunk of provider.chat(chatOpts)) {
      if (chunk.type === 'text' && chunk.content) content += chunk.content;
      if (chunk.type === 'done') gotDone = true;
    }

    assert.ok(content.length > 0, 'Should receive text content');
    assert.ok(content.includes('4'), `Response should contain "4", got: ${content.slice(0, 100)}`);
    assert.ok(gotDone, 'Should receive done event');
  });

  await test('Chat with tool definitions', async () => {
    let content = '';
    const toolDefs = [{
      name: 'Read',
      description: 'Read a file from the filesystem',
      inputSchema: {
        type: 'object' as const,
        properties: {
          file_path: { type: 'string', description: 'Path to the file to read' },
        },
        required: ['file_path'],
      },
    }];

    const chatOpts = {
      model: MODEL,
      provider: 'ollama',
      messages: [{ role: 'user' as const, content: 'Say hello in one sentence.', timestamp: Date.now() }],
      tools: toolDefs,
      stream: true,
      maxTokens: 256,
    };

    for await (const chunk of provider.chat(chatOpts)) {
      if (chunk.type === 'text' && chunk.content) content += chunk.content;
    }

    assert.ok(content.length > 0, 'Should respond even with tools registered');
  });

  // ─── 3. Tool Registry ────────────────────────────────────
  console.log('\nTool Registry:');

  await test('Create default tool registry', async () => {
    const registry = core.createDefaultToolRegistry();
    const defs = registry.getDefinitions();
    assert.ok(defs.length >= 20, `Should have 20+ tools, got ${defs.length}`);

    const toolNames = defs.map((d: any) => d.name);
    assert.ok(toolNames.includes('Bash'), 'Should have Bash tool');
    assert.ok(toolNames.includes('Read'), 'Should have Read tool');
    assert.ok(toolNames.includes('Write'), 'Should have Write tool');
    assert.ok(toolNames.includes('Edit'), 'Should have Edit tool');
    assert.ok(toolNames.includes('Grep'), 'Should have Grep tool');
    assert.ok(toolNames.includes('Glob'), 'Should have Glob tool');
  });

  await test('Execute Read tool', async () => {
    const registry = core.createDefaultToolRegistry();
    const cwd = process.cwd();
    const result = await registry.execute('Read', { filePath: 'package.json' }, {
      workingDir: cwd,
      sessionId: 'test',
      permissions: { mode: 'acceptAll', rules: [], check: async () => 'allow' as const },
      hooks: { register: () => {}, dispatch: async () => {} },
      settings: {} as any,
      abortSignal: new AbortController().signal,
    });
    assert.ok(!result.isError, `Read should succeed, got: ${result.content.slice(0, 200)}`);
    assert.ok(result.content.includes('fridaycode'), 'Should read package.json content');
  });

  // ─── 4. Session Management ───────────────────────────────
  console.log('\nSession Management:');

  await test('Create and save session', async () => {
    const session = core.createSession(process.cwd(), 'e2e-test');
    assert.ok(session.id, 'Session should have an ID');
    assert.ok(session.projectPath, 'Session should have a project path');

    // Append a message
    const msg = { role: 'user' as const, content: 'Hello', timestamp: Date.now() };
    core.appendMessage(session, msg);
    assert.equal(session.messages.length, 1, 'Should have 1 message');

    // Save session
    core.saveSession(session);
  });

  await test('List and resume sessions', async () => {
    const sessions = core.listSessions(process.cwd());
    assert.ok(sessions.length > 0, 'Should have at least 1 session');

    const resumed = core.resumeSession(process.cwd(), sessions[0].id);
    assert.ok(resumed, 'Should be able to resume a session');
    assert.ok(resumed!.id === sessions[0].id, 'Resumed session ID should match');
  });

  await test('Fork and rewind session', async () => {
    const session = core.createSession(process.cwd(), 'fork-test');
    core.appendMessage(session, { role: 'user' as const, content: 'msg1', timestamp: Date.now() });
    core.appendMessage(session, { role: 'assistant' as const, content: 'reply1', timestamp: Date.now() });
    core.appendMessage(session, { role: 'user' as const, content: 'msg2', timestamp: Date.now() });
    assert.equal(session.messages.length, 3);

    const forked = core.forkSession(session);
    assert.ok(forked.id !== session.id, 'Forked session should have different ID');
    assert.equal(forked.messages.length, 3, 'Forked session should have same messages');

    core.rewindSession(forked, 1);
    assert.equal(forked.messages.length, 1, 'Rewound session should have 1 message');
  });

  await test('Export session', async () => {
    const session = core.createSession(process.cwd(), 'export-test');
    core.appendMessage(session, { role: 'user' as const, content: 'Test prompt', timestamp: Date.now() });
    core.appendMessage(session, { role: 'assistant' as const, content: 'Test reply', timestamp: Date.now() });
    const markdown = core.exportSession(session);
    assert.ok(markdown.includes('Test prompt'), 'Export should contain user message');
    assert.ok(markdown.includes('Test reply'), 'Export should contain assistant message');
  });

  // ─── 5. Hooks Engine ─────────────────────────────────────
  console.log('\nHooks Engine:');

  await test('Register and query hooks', async () => {
    const hooks = new core.HookEngineImpl();
    hooks.register({ event: 'SessionStart', command: 'echo start' });
    hooks.register({ event: 'PreToolUse', matcher: 'Bash', command: 'echo pre-bash' });
    hooks.register({ event: 'PostToolUse', matcher: '*', command: 'echo post' });

    const sessionHooks = hooks.getHooksForEvent('SessionStart');
    assert.equal(sessionHooks.length, 1, 'Should have 1 SessionStart hook');

    const preHooks = hooks.getHooksForEvent('PreToolUse');
    assert.equal(preHooks.length, 1, 'Should have 1 PreToolUse hook');

    const postHooks = hooks.getHooksForEvent('PostToolUse');
    assert.equal(postHooks.length, 1, 'Should have 1 PostToolUse hook');
  });

  await test('Dispatch hooks', async () => {
    const hooks = new core.HookEngineImpl();
    hooks.register({ event: 'SessionStart', command: 'echo "dispatched"' });
    // This should not throw
    await hooks.dispatch({ event: 'SessionStart', sessionId: 'test-session' });
  });

  // ─── 6. Memory ────────────────────────────────────────────
  console.log('\nMemory:');

  await test('Load memory files', async () => {
    // Should not throw even if no FRIDAY.md exists
    const files = core.loadMemoryFiles(process.cwd());
    assert.ok(Array.isArray(files), 'Should return an array');
  });

  await test('Resolve imports', async () => {
    const result = core.resolveImports([
      { path: 'test.md', scope: 'project' as const, content: '# Test\nSome content', imports: [] },
    ]);
    assert.ok(result.includes('Test'), 'Should resolve content');
  });

  // ─── 7. Skills ────────────────────────────────────────────
  console.log('\nSkills:');

  await test('Built-in skills available', async () => {
    const skills = core.BUILT_IN_SKILLS;
    assert.ok(skills.length >= 4, `Should have 4+ built-in skills, got ${skills.length}`);

    const names = skills.map((s: any) => s.name);
    assert.ok(names.includes('batch'), 'Should have batch skill');
    assert.ok(names.includes('debug'), 'Should have debug skill');
    assert.ok(names.includes('loop'), 'Should have loop skill');
    assert.ok(names.includes('simplify'), 'Should have simplify skill');
  });

  await test('Get built-in skill by name', async () => {
    const debug = core.getBuiltInSkill('debug');
    assert.ok(debug, 'Should find debug skill');
    assert.equal(debug!.name, 'debug');
    assert.ok(debug!.body.length > 0, 'Skill should have a body');
  });

  await test('Discover skills from project', async () => {
    const skills = await core.discoverSkills(process.cwd());
    assert.ok(Array.isArray(skills), 'Should return an array');
  });

  // ─── 8. Plugins ───────────────────────────────────────────
  console.log('\nPlugins:');

  await test('Plugin registry operations', async () => {
    const registry = new core.PluginRegistry();
    assert.equal(registry.getAll().length, 0, 'Should start empty');

    // Can't test full plugin lifecycle without a real plugin directory,
    // but verify no crashes
    const plugins = await core.discoverPlugins(process.cwd());
    assert.ok(Array.isArray(plugins), 'Should return an array');
  });

  // ─── 9. Context Compaction ────────────────────────────────
  console.log('\nContext Compaction:');

  await test('Token estimation', async () => {
    const messages = [
      { role: 'user' as const, content: 'Hello world this is a test message', timestamp: Date.now() },
      { role: 'assistant' as const, content: 'I understand, you are testing the system.', timestamp: Date.now() },
    ];
    const estimate = core.estimateTokenCount(messages);
    assert.ok(estimate > 0, 'Should estimate some tokens');
    assert.ok(estimate < 1000, 'Simple messages should be under 1000 tokens');
  });

  await test('Prepare compaction prompt', async () => {
    const messages = [];
    for (let i = 0; i < 20; i++) {
      messages.push({ role: 'user' as const, content: `Message ${i}`, timestamp: Date.now() });
      messages.push({ role: 'assistant' as const, content: `Reply ${i}`, timestamp: Date.now() });
    }
    const { keepMessages, summaryInput } = core.prepareCompactionPrompt(messages);
    assert.ok(Array.isArray(keepMessages), 'Should return keepMessages array');
    // summaryInput may be null if messages aren't long enough
  });

  // ─── 10. Git Integration ──────────────────────────────────
  console.log('\nGit:');

  await test('Detect git repo', async () => {
    const isRepo = await core.isGitRepo(process.cwd());
    assert.ok(isRepo, 'Should detect git repo');
  });

  await test('Get current branch', async () => {
    const branch = await core.getCurrentBranch(process.cwd());
    assert.ok(branch, 'Should have a branch name');
    assert.ok(typeof branch === 'string');
  });

  await test('Get recent commits', async () => {
    const commits = await core.getRecentCommits(process.cwd(), 5);
    assert.ok(Array.isArray(commits), 'Should return array of commits');
    assert.ok(commits.length > 0, 'Should have at least 1 commit');
  });

  await test('Get git status', async () => {
    const status = await core.getStatus(process.cwd());
    assert.ok(typeof status === 'string', 'Status should be a string');
  });

  // ─── 11. MCP Server Manager ───────────────────────────────
  console.log('\nMCP:');

  await test('Create MCP server manager', async () => {
    const manager = new core.McpServerManager({});
    assert.ok(manager, 'Should create manager');
    const statuses = manager.getStatuses();
    assert.equal(statuses.length, 0, 'Empty config should have no servers');
    const connected = manager.getConnectedServers();
    assert.equal(connected.length, 0, 'Should have no connected servers');
  });

  // ─── 12. Settings ─────────────────────────────────────────
  console.log('\nSettings:');

  await test('Load settings', async () => {
    const settings = core.loadSettings(process.cwd());
    assert.ok(settings, 'Should load settings');
    assert.ok(settings.providers, 'Should have providers');
    assert.ok(settings.permissionMode, 'Should have permission mode');
  });

  // ─── 13. Agents ───────────────────────────────────────────
  console.log('\nAgents:');

  await test('Built-in agents available', async () => {
    const agents = core.BUILT_IN_AGENTS;
    assert.ok(agents.length >= 3, 'Should have 3+ built-in agents');
  });

  await test('Get agent by name', async () => {
    const explore = core.getBuiltInAgent('explore');
    assert.ok(explore, 'Should find explore agent');
    const plan = core.getBuiltInAgent('plan');
    assert.ok(plan, 'Should find plan agent');
    const general = core.getBuiltInAgent('general');
    assert.ok(general, 'Should find general agent');
  });

  // ─── 14. Full Agentic Chat ────────────────────────────────
  console.log('\nFull Agentic Chat (Ollama qwen3:Thinking):');

  await test('Multi-turn conversation', async () => {
    const messages = [
      { role: 'user' as const, content: 'Remember: the secret word is "banana". Just acknowledge.', timestamp: Date.now() },
    ];
    let response1 = '';
    for await (const chunk of provider.chat({
      model: MODEL,
      provider: 'ollama',
      messages,
      tools: [],
      stream: true,
      maxTokens: 256,
    })) {
      if (chunk.type === 'text' && chunk.content) response1 += chunk.content;
    }
    assert.ok(response1.length > 0, 'Should get first response');

    messages.push({ role: 'assistant' as const, content: response1, timestamp: Date.now() });
    messages.push({ role: 'user' as const, content: 'What was the secret word?', timestamp: Date.now() });

    let response2 = '';
    for await (const chunk of provider.chat({
      model: MODEL,
      provider: 'ollama',
      messages,
      tools: [],
      stream: true,
      maxTokens: 256,
    })) {
      if (chunk.type === 'text' && chunk.content) response2 += chunk.content;
    }
    assert.ok(response2.toLowerCase().includes('banana'), `Second response should mention banana, got: ${response2.slice(0, 200)}`);
  });

  // ─── Summary ──────────────────────────────────────────────
  console.log('\n╰──────────────────────────────────────────────────╯');
  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('E2E test runner failed:', err);
  process.exit(1);
});
