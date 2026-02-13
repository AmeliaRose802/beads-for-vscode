const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Load the module source so we can test the pure function.
// The file uses ESM export syntax, so we do a light transform.
function loadRenderMarkdown() {
  const src = fs.readFileSync(
    path.join(ROOT, 'webview', 'markdown-utils.js'),
    'utf8'
  );
  // Convert ESM → CJS by replacing export and keeping the rest
  const cjs = src
    .replace(/^export\s+/gm, '')
    .replace(/export\s*\{[^}]*\}/g, '');
  // Wrap and evaluate
  const fn = new Function(
    'module', 'exports',
    cjs + '\nmodule.exports = { renderMarkdown };'
  );
  const mod = { exports: {} };
  fn(mod, mod.exports);
  return mod.exports.renderMarkdown;
}

const renderMarkdown = loadRenderMarkdown();

suite('renderMarkdown', () => {
  // ── Edge cases ──────────────────────────────────────────────────
  test('returns empty string for null/undefined/empty', () => {
    assert.strictEqual(renderMarkdown(null), '');
    assert.strictEqual(renderMarkdown(undefined), '');
    assert.strictEqual(renderMarkdown(''), '');
  });

  test('returns empty string for non-string input', () => {
    assert.strictEqual(renderMarkdown(42), '');
    assert.strictEqual(renderMarkdown({}), '');
  });

  // ── Headers ─────────────────────────────────────────────────────
  test('renders h1 through h6 headers', () => {
    const md = '# Title\n## Sub\n### Sub2\n#### H4\n##### H5\n###### H6';
    const html = renderMarkdown(md);
    assert.ok(html.includes('<h1 class="md-heading md-h1">Title</h1>'));
    assert.ok(html.includes('<h2 class="md-heading md-h2">Sub</h2>'));
    assert.ok(html.includes('<h3 class="md-heading md-h3">Sub2</h3>'));
    assert.ok(html.includes('<h4'));
    assert.ok(html.includes('<h5'));
    assert.ok(html.includes('<h6'));
  });

  // ── Bold / Italic ──────────────────────────────────────────────
  test('renders bold text', () => {
    const html = renderMarkdown('This is **bold** text');
    assert.ok(html.includes('<strong>bold</strong>'));
  });

  test('renders italic text', () => {
    const html = renderMarkdown('This is *italic* text');
    assert.ok(html.includes('<em>italic</em>'));
  });

  test('renders bold-italic text', () => {
    const html = renderMarkdown('This is ***both*** styled');
    assert.ok(html.includes('<strong><em>both</em></strong>'));
  });

  // ── Inline code ─────────────────────────────────────────────────
  test('renders inline code', () => {
    const html = renderMarkdown('Use `npm install` here');
    assert.ok(html.includes('<code class="md-inline-code">npm install</code>'));
  });

  // ── Code blocks ─────────────────────────────────────────────────
  test('renders fenced code blocks', () => {
    const md = '```\nconst x = 1;\nconsole.log(x);\n```';
    const html = renderMarkdown(md);
    assert.ok(html.includes('<pre class="md-code-block"><code>'));
    assert.ok(html.includes('const x = 1;'));
    assert.ok(html.includes('</code></pre>'));
  });

  test('escapes HTML inside code blocks', () => {
    const md = '```\n<script>alert("xss")</script>\n```';
    const html = renderMarkdown(md);
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });

  // ── Lists ───────────────────────────────────────────────────────
  test('renders unordered lists', () => {
    const md = '- Item one\n- Item two\n- Item three';
    const html = renderMarkdown(md);
    assert.ok(html.includes('<ul class="md-list">'));
    assert.ok(html.includes('<li>Item one</li>'));
    assert.ok(html.includes('<li>Item two</li>'));
    assert.ok(html.includes('</ul>'));
  });

  test('renders ordered lists', () => {
    const md = '1. First\n2. Second\n3. Third';
    const html = renderMarkdown(md);
    assert.ok(html.includes('<ol class="md-list">'));
    assert.ok(html.includes('<li>First</li>'));
    assert.ok(html.includes('</ol>'));
  });

  // ── Links ───────────────────────────────────────────────────────
  test('renders links', () => {
    const html = renderMarkdown('Visit [GitHub](https://github.com)');
    assert.ok(html.includes('<a class="md-link"'));
    assert.ok(html.includes('href="https://github.com"'));
    assert.ok(html.includes('>GitHub</a>'));
  });

  // ── Paragraphs ─────────────────────────────────────────────────
  test('wraps plain text in paragraphs', () => {
    const html = renderMarkdown('Hello world');
    assert.ok(html.includes('<p class="md-paragraph">Hello world</p>'));
  });

  test('separates paragraphs on blank lines', () => {
    const md = 'Paragraph one.\n\nParagraph two.';
    const html = renderMarkdown(md);
    assert.ok(html.includes('Paragraph one.'));
    assert.ok(html.includes('Paragraph two.'));
    // Both should be in separate <p> tags
    const pCount = (html.match(/<p /g) || []).length;
    assert.strictEqual(pCount, 2);
  });

  // ── XSS prevention ─────────────────────────────────────────────
  test('escapes HTML entities in regular text', () => {
    const html = renderMarkdown('Use <div> & "quotes"');
    assert.ok(!html.includes('Use <div>'));
    assert.ok(html.includes('&lt;div&gt;'));
    assert.ok(html.includes('&amp;'));
    assert.ok(html.includes('&quot;'));
  });

  // ── Unclosed code block ─────────────────────────────────────────
  test('handles unclosed code block gracefully', () => {
    const md = '```\nconst x = 1;';
    const html = renderMarkdown(md);
    assert.ok(html.includes('<pre class="md-code-block"><code>'));
    assert.ok(html.includes('const x = 1;'));
  });

  // ── Mixed content ──────────────────────────────────────────────
  test('renders complex mixed Markdown', () => {
    const md = [
      '## Bug Report',
      '',
      'The `parser` fails when given **invalid** input.',
      '',
      '- Step 1: open the app',
      '- Step 2: enter data',
      '',
      '```',
      'error.log',
      '```'
    ].join('\n');

    const html = renderMarkdown(md);
    assert.ok(html.includes('<h2'));
    assert.ok(html.includes('Bug Report'));
    assert.ok(html.includes('<code class="md-inline-code">parser</code>'));
    assert.ok(html.includes('<strong>invalid</strong>'));
    assert.ok(html.includes('<ul'));
    assert.ok(html.includes('<pre'));
  });
});

suite('IssueCardDetails uses MarkdownRenderer', () => {
  test('IssueCardDetails imports MarkdownRenderer', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'webview', 'components', 'IssueCardDetails.jsx'),
      'utf8'
    );
    assert.ok(
      source.includes("import MarkdownRenderer from './MarkdownRenderer'"),
      'IssueCardDetails should import MarkdownRenderer'
    );
  });

  test('IssueCardDetails uses MarkdownRenderer for description', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'webview', 'components', 'IssueCardDetails.jsx'),
      'utf8'
    );
    assert.ok(
      source.includes('<MarkdownRenderer'),
      'IssueCardDetails should use MarkdownRenderer component'
    );
    assert.ok(
      !source.includes('{detailedData?.description || issue.description}</div>'),
      'Should no longer render raw description text'
    );
  });
});

suite('Markdown CSS styles', () => {
  test('styles.css defines markdown rendering classes', () => {
    const css = fs.readFileSync(
      path.join(ROOT, 'webview', 'styles.css'),
      'utf8'
    );
    assert.ok(css.includes('.md-rendered'), 'CSS should define .md-rendered');
    assert.ok(css.includes('.md-code-block'), 'CSS should define .md-code-block');
    assert.ok(css.includes('.md-inline-code'), 'CSS should define .md-inline-code');
    assert.ok(css.includes('.md-heading'), 'CSS should define .md-heading');
    assert.ok(css.includes('.md-list'), 'CSS should define .md-list');
    assert.ok(css.includes('.md-link'), 'CSS should define .md-link');
  });
});
