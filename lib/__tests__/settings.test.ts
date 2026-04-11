import { describe, it, expect } from 'vitest';
import { resolveFilename } from '../settings';

describe('resolveFilename', () => {
  const defaultPattern = 'elysium-{domain}-{timestamp}';

  it('substitutes {domain} from a valid URL', () => {
    const result = resolveFilename(defaultPattern, 'png', 'https://example.com/page');
    expect(result).toMatch(/^elysium-example-com-/);
    expect(result).toMatch(/\.png$/);
  });

  it('falls back domain to "page" for invalid URLs', () => {
    const result = resolveFilename(defaultPattern, 'png', '');
    expect(result).toMatch(/^elysium-page-/);
  });

  it('falls back domain to "page" for non-URL strings', () => {
    const result = resolveFilename(defaultPattern, 'png', 'not-a-url');
    expect(result).toMatch(/^elysium-page-/);
  });

  it('substitutes {date} token correctly (YYYY-MM-DD)', () => {
    const result = resolveFilename('{date}', 'jpg', 'https://test.com');
    // Should be ISO date followed by .jpg
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}\.jpg$/);
  });

  it('substitutes {time} token correctly (HH-MM-SS)', () => {
    const result = resolveFilename('{time}', 'webp', 'https://test.com');
    expect(result).toMatch(/^\d{2}-\d{2}-\d{2}\.webp$/);
  });

  it('substitutes {timestamp} token correctly', () => {
    const result = resolveFilename('{timestamp}', 'png', 'https://test.com');
    // ISO timestamp with colons/dots replaced by dashes, 19 chars
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/);
  });

  it('falls back to default pattern when pattern is empty', () => {
    const result = resolveFilename('', 'png', 'https://example.com');
    expect(result).toMatch(/^elysium-example-com-/);
  });

  it('falls back to default pattern when pattern is whitespace', () => {
    const result = resolveFilename('   ', 'png', 'https://example.com');
    expect(result).toMatch(/^elysium-example-com-/);
  });

  it('sanitizes dangerous filename characters: < > : " | ? * \\ /', () => {
    const result = resolveFilename('test<>:"|?*\\/file', 'png', 'https://x.com');
    expect(result).not.toMatch(/[<>:"|?*\\/]/);
    expect(result).toBe('test_________file.png');
  });

  it('strips path traversal sequences', () => {
    const result = resolveFilename('../../etc/passwd', 'png', 'https://x.com');
    // Backslashes and forward slashes are replaced by _
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
  });

  it('appends the correct file extension', () => {
    expect(resolveFilename('test', 'png', '')).toBe('test.png');
    expect(resolveFilename('test', 'jpg', '')).toBe('test.jpg');
    expect(resolveFilename('test', 'webp', '')).toBe('test.webp');
    expect(resolveFilename('test', 'pdf', '')).toBe('test.pdf');
  });

  it('handles complex URLs with subdomains', () => {
    const result = resolveFilename('{domain}', 'png', 'https://sub.example.co.uk:8080/path?q=1');
    // URL.hostname strips the port, so only the hostname is used
    expect(result).toBe('sub-example-co-uk.png');
  });
});
