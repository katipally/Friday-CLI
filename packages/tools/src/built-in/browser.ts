import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from '../types.js';

const NAVIGATION_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 10_000;

type BrowserAction =
  | 'navigate'
  | 'screenshot'
  | 'click'
  | 'type'
  | 'evaluate'
  | 'extract'
  | 'close';

// Lazy-loaded puppeteer types
type PuppeteerBrowser = import('puppeteer-core').Browser;
type PuppeteerPage = import('puppeteer-core').Page;

const CHROME_PATHS = [
  process.env['CHROME_PATH'],
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  // Windows (common paths via WSL or native)
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean) as string[];

let browserInstance: PuppeteerBrowser | null = null;
let activePage: PuppeteerPage | null = null;

async function findChromePath(): Promise<string> {
  const { accessSync } = await import('node:fs');
  for (const chromePath of CHROME_PATHS) {
    try {
      accessSync(chromePath);
      return chromePath;
    } catch {
      // not found, try next
    }
  }
  throw new Error(
    'Could not find Chrome or Chromium. Install Google Chrome or set the CHROME_PATH environment variable to point to your browser executable.',
  );
}

async function getBrowser(): Promise<PuppeteerBrowser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  const puppeteer = await import('puppeteer-core');
  const executablePath = await findChromePath();

  browserInstance = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  return browserInstance;
}

async function getPage(): Promise<PuppeteerPage> {
  if (activePage && !activePage.isClosed()) {
    return activePage;
  }

  const browser = await getBrowser();
  activePage = await browser.newPage();
  activePage.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  activePage.setDefaultTimeout(ACTION_TIMEOUT_MS);

  return activePage;
}

async function closeBrowser(): Promise<void> {
  if (activePage && !activePage.isClosed()) {
    await activePage.close().catch(() => {});
    activePage = null;
  }
  if (browserInstance && browserInstance.connected) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}

async function handleNavigate(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const url = args.url as string | undefined;
  if (!url) {
    return { success: false, output: 'Missing required parameter: url' };
  }

  if (context.checkPermission) {
    const allowed = await context.checkPermission('network', url);
    if (!allowed) {
      return {
        success: false,
        output: `Permission denied: network access to ${url}`,
      };
    }
  }

  const page = await getPage();
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  const title = await page.title();
  const finalUrl = page.url();
  const status = response?.status() ?? 'unknown';

  return {
    success: true,
    output: `Navigated to ${finalUrl}\nTitle: ${title}\nStatus: ${status}`,
    metadata: { url: finalUrl, title, status },
  };
}

async function handleScreenshot(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const page = await getPage();
  const selector = args.selector as string | undefined;

  const filename = `screenshot-${Date.now()}.png`;
  const filePath = path.join(context.cwd, filename);

  if (selector) {
    const element = await page.$(selector);
    if (!element) {
      return {
        success: false,
        output: `Element not found: ${selector}`,
      };
    }
    await element.screenshot({ path: filePath });
  } else {
    await page.screenshot({ path: filePath, fullPage: false });
  }

  return {
    success: true,
    output: `Screenshot saved to ${filePath}`,
    metadata: { filePath },
  };
}

async function handleClick(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const selector = args.selector as string | undefined;
  if (!selector) {
    return { success: false, output: 'Missing required parameter: selector' };
  }

  const page = await getPage();
  const element = await page.$(selector);
  if (!element) {
    return { success: false, output: `Element not found: ${selector}` };
  }

  await element.click();
  return {
    success: true,
    output: `Clicked element: ${selector}`,
    metadata: { selector },
  };
}

async function handleType(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const selector = args.selector as string | undefined;
  const text = args.text as string | undefined;
  if (!selector) {
    return { success: false, output: 'Missing required parameter: selector' };
  }
  if (!text) {
    return { success: false, output: 'Missing required parameter: text' };
  }

  const page = await getPage();
  const element = await page.$(selector);
  if (!element) {
    return { success: false, output: `Element not found: ${selector}` };
  }

  await element.type(text);
  return {
    success: true,
    output: `Typed text into ${selector}`,
    metadata: { selector, textLength: text.length },
  };
}

async function handleEvaluate(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const script = args.script as string | undefined;
  if (!script) {
    return { success: false, output: 'Missing required parameter: script' };
  }

  const page = await getPage();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await page.evaluate(script);

  let output: string;
  if (result === undefined) {
    output = 'undefined';
  } else if (typeof result === 'string') {
    output = result;
  } else {
    output = JSON.stringify(result, null, 2);
  }

  return {
    success: true,
    output,
    metadata: { resultType: typeof result },
  };
}

async function handleExtract(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const selector = args.selector as string | undefined;
  const format = (args.format as string | undefined) || 'text';

  const page = await getPage();

  let output: string;

  if (selector) {
    const element = await page.$(selector);
    if (!element) {
      return { success: false, output: `Element not found: ${selector}` };
    }

    if (format === 'html') {
      const html = await page.evaluate(
        (el) => (el as unknown as { outerHTML: string }).outerHTML,
        element,
      );
      output = html;
    } else {
      const text = await page.evaluate(
        (el) => (el as unknown as { textContent: string | null }).textContent ?? '',
        element,
      );
      output = text.trim();
    }
  } else {
    if (format === 'html') {
      output = await page.content();
    } else {
      const text = await page.evaluate('document.body ? document.body.textContent || "" : ""');
      output = typeof text === 'string' ? text.trim() : String(text);
    }
  }

  // Truncate very large extractions
  const maxLen = 100_000;
  let truncated = false;
  if (output.length > maxLen) {
    output = output.slice(0, maxLen);
    truncated = true;
    output += '\n\n[Content truncated]';
  }

  return {
    success: true,
    output,
    metadata: { selector: selector ?? 'full page', format, truncated },
  };
}

async function handleClose(): Promise<ToolResult> {
  await closeBrowser();
  return {
    success: true,
    output: 'Browser closed.',
  };
}

export const browserTool: Tool = {
  name: 'browser',
  description:
    'Browse a webpage, take screenshots, click elements, and extract content using a headless browser.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['navigate', 'screenshot', 'click', 'type', 'evaluate', 'extract', 'close'],
        description:
          'The browser action to perform: navigate to a URL, take a screenshot, click an element, type into an input, evaluate JavaScript, extract page content, or close the browser.',
      },
      url: {
        type: 'string',
        description: 'URL to navigate to (required for navigate action)',
      },
      selector: {
        type: 'string',
        description:
          'CSS selector for the target element (required for click and type; optional for screenshot and extract)',
      },
      text: {
        type: 'string',
        description: 'Text to type into the selected element (required for type action)',
      },
      script: {
        type: 'string',
        description: 'JavaScript code to evaluate in the page context (required for evaluate action)',
      },
      format: {
        type: 'string',
        enum: ['text', 'html'],
        description: 'Output format for extract action (default: text)',
      },
    },
    required: ['action'],
  },

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const action = args.action as BrowserAction | undefined;
    if (!action) {
      return { success: false, output: 'Missing required parameter: action' };
    }

    try {
      switch (action) {
        case 'navigate':
          return await handleNavigate(args, context);
        case 'screenshot':
          return await handleScreenshot(args, context);
        case 'click':
          return await handleClick(args);
        case 'type':
          return await handleType(args);
        case 'evaluate':
          return await handleEvaluate(args);
        case 'extract':
          return await handleExtract(args);
        case 'close':
          return await handleClose();
        default:
          return {
            success: false,
            output: `Unknown action: ${action as string}. Valid actions: navigate, screenshot, click, type, evaluate, extract, close`,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Provide a more helpful message for common errors
      if (message.includes('Could not find Chrome')) {
        return { success: false, output: message };
      }
      if (message.includes('net::ERR_')) {
        return {
          success: false,
          output: `Network error: ${message}`,
          metadata: { action },
        };
      }
      if (message.includes('timeout') || message.includes('Timeout')) {
        return {
          success: false,
          output: `Action timed out: ${message}`,
          metadata: { action },
        };
      }

      return {
        success: false,
        output: `Browser ${action} failed: ${message}`,
        metadata: { action },
      };
    }
  },
};

// Auto-cleanup on process exit
process.on('exit', () => {
  void closeBrowser();
});
