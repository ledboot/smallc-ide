import fs from 'fs';
import path from 'path';
import {marked} from 'marked';
import type {Metadata} from 'next';
import DocsClient, {type DocSection} from './DocsClient';

export const metadata: Metadata = {
  title: 'SmallC IDE - Script Runner API Manual',
  description:
    'Comprehensive reference manual for smart contract execution scripts in the SmallC IDE',
};

export default async function DocsPage() {
  const filePath = path.join(process.cwd(), 'docs/TS_SCRIPT_API.md');
  const markdown = fs.readFileSync(filePath, 'utf-8');

  const parts = markdown.split(/\n(?=##\s)/);
  const sections: DocSection[] = [];
  let introHtml = '';
  let introTitle = 'Contract Script Runner API Manual';

  const firstPart = parts[0];
  if (firstPart !== undefined && !firstPart.trim().startsWith('## ')) {
    const rawIntro = parts.shift() || '';

    // Extract main document title from first # heading if present
    const titleMatch = rawIntro.match(/^#\s+(.+)$/m);
    if (titleMatch && titleMatch[1] !== undefined) {
      introTitle = titleMatch[1].replace(/`/g, '');
    }

    // Remove the main # title line from introduction content
    const cleanedIntro = rawIntro.replace(/^#\s+.+$/m, '').trim();
    introHtml = await marked.parse(cleanedIntro);
  }

  // Parse each section from ## headings
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      const firstLineEnd = trimmed.indexOf('\n');
      const headerLine =
        firstLineEnd !== -1 ? trimmed.substring(0, firstLineEnd) : trimmed;
      const content =
        firstLineEnd !== -1 ? trimmed.substring(firstLineEnd + 1) : '';

      const rawTitle = headerLine.replace(/^##\s+/, '').trim();
      const cleanTitle = rawTitle.replace(/`/g, '');

      // Generate a unique DOM element slug/id
      const id = cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Map to UI categories
      let category: 'wallet' | 'utility' | 'example' = 'utility';
      const lowerTitle = cleanTitle.toLowerCase();
      if (lowerTitle.includes('wallet')) {
        category = 'wallet';
      } else if (
        lowerTitle.includes('example') ||
        lowerTitle.includes('workflow')
      ) {
        category = 'example';
      }

      // Extract file reference path from section body if declared
      const filePathMatch = content.match(
        /\*\*(Source Reference|File Path)\*\*:\s*\[([^\]]+)\]/i,
      );
      const sectionFilePath =
        filePathMatch && filePathMatch[2] ? filePathMatch[2] : '';

      // Clean the file reference path line out from the body to avoid duplicate rendering
      const cleanedContent = content.replace(
        /\*\*(Source Reference|File Path)\*\*:\s*\[[^\]]+\]\([^\)]+\)\s*\n*/i,
        '',
      );

      // Compile Markdown content to safe HTML
      const htmlContent = await marked.parse(cleanedContent);

      sections.push({
        id,
        title: cleanTitle,
        filePath: sectionFilePath,
        htmlContent,
        category,
      });
    }
  }

  return (
    <DocsClient
      sections={sections}
      introHtml={introHtml}
      introTitle={introTitle}
    />
  );
}
