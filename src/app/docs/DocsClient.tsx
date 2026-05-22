'use client';

import React, {useState, useEffect} from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Search,
  Terminal,
  Cpu,
  Database,
  Sparkles,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';

export interface DocSection {
  id: string;
  title: string;
  filePath: string;
  htmlContent: string;
  category: 'wallet' | 'utility' | 'example';
}

interface DocsClientProps {
  sections: DocSection[];
  introHtml: string;
  introTitle: string;
}

export default function DocsClient({
  sections,
  introHtml,
  introTitle,
}: DocsClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('');

  // Set initial active section
  useEffect(() => {
    if (sections.length > 0 && !activeSection) {
      setActiveSection(sections[0]?.id || '');
    }
  }, [sections, activeSection]);

  // Filter sections by search query
  const filteredSections = sections.filter(sec => {
    const query = searchQuery.toLowerCase();
    const titleMatch = sec.title.toLowerCase().includes(query);
    const fileMatch = sec.filePath.toLowerCase().includes(query);
    // Basic check inside raw HTML for text matches
    const textMatch = sec.htmlContent
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .includes(query);
    return titleMatch || fileMatch || textMatch;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'wallet':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
            <Terminal className="h-3.5 w-3.5" />
            Wallet API
          </span>
        );
      case 'utility':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
            <Database className="h-3.5 w-3.5" />
            Script Utility
          </span>
        );
      case 'example':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <Sparkles className="h-3.5 w-3.5" />
            E2E Workflow
          </span>
        );
      default:
        return null;
    }
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  };

  // Dynamic active navigation on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  // Attach dynamic Copy Buttons to code blocks rendered inside dangerouslySetInnerHTML
  useEffect(() => {
    const preElements = document.querySelectorAll('pre');
    preElements.forEach(pre => {
      const parent = pre.parentElement;
      if (parent && parent.classList.contains('code-block-wrapper')) return;

      // Create a wrapper container
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper relative group w-full mt-2 mb-6';

      // Insert wrapper in DOM before pre
      if (pre.parentNode) {
        pre.parentNode.insertBefore(wrapper, pre);
        // Move pre into the wrapper
        wrapper.appendChild(pre);
        // Reset margins on pre to let wrapper handle spacing
        pre.style.margin = '0';
      }

      const button = document.createElement('button');
      button.className =
        'copy-btn absolute right-3 top-3 p-1.5 rounded bg-slate-900/90 ' +
        'border border-slate-800 text-slate-400 hover:text-white ' +
        'hover:bg-slate-800 opacity-0 group-hover:opacity-100 ' +
        'focus:opacity-100 transition-all z-10 shadow-md backdrop-blur-sm';
      button.title = 'Copy code';
      button.innerHTML = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
      `;

      button.addEventListener('click', () => {
        const code = pre.querySelector('code');
        if (code) {
          navigator.clipboard.writeText(code.innerText);
          button.innerHTML = `
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-emerald-400"
            >
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          `;
          setTimeout(() => {
            button.innerHTML = `
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            `;
          }, 2000);
        }
      });

      wrapper.appendChild(button);
    });
  }, [activeSection, searchQuery, filteredSections]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 antialiased">
      {/* Dynamic Grid Background Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-40" />

      {/* Decorative Glow */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-violet-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                SmallC IDE{' '}
                <span className="text-xs font-normal text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  Script Runner API
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Reference manual for smart contract execution scripts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3.5 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 hover:border-slate-700 transition-all shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to IDE</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Workspace Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 relative">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Navigation / Search Panel */}
          <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-24 h-fit">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 backdrop-blur-sm shadow-xl relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search functions & variables..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9.5 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Sidebar Menu */}
              <div className="space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 scrollbar-thin">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2 flex items-center justify-between">
                    <span>API Reference Modules</span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md">
                      {filteredSections.length}
                    </span>
                  </h3>
                  <div className="space-y-1">
                    {filteredSections.map(section => (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${
                          activeSection === section.id
                            ? 'bg-indigo-500/10 border-l-4 border-indigo-500 text-indigo-300 shadow-sm'
                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                        }`}
                      >
                        <span className="truncate">{section.title}</span>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 transition-transform ${activeSection === section.id ? 'translate-x-0.5 text-indigo-400' : 'text-slate-600'}`}
                        />
                      </button>
                    ))}
                    {filteredSections.length === 0 && (
                      <div className="text-xs text-slate-500 text-center py-6">
                        No modules found matching search
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main API Documentation View */}
          <main className="flex-1 min-w-0">
            {/* Introductory Hero Card */}
            {introHtml && (
              <div className="mb-12 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-6 md:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/5 blur-3xl rounded-full" />
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400 shrink-0">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mb-4">
                      {introTitle || 'Contract Script Runner API Manual'}
                    </h2>
                    <div
                      className="text-sm md:text-base text-slate-400 max-w-3xl leading-relaxed
                        [&_p]:mb-4 [&_p:last-child]:mb-0
                        [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_ol]:mb-4
                        [&_li_strong]:text-indigo-400 [&_li_code]:text-indigo-300 [&_li_code]:bg-slate-950 [&_li_code]:px-1.5 [&_li_code]:py-0.5 [&_li_code]:rounded [&_li_code]:text-xs [&_li_code]:font-mono"
                      dangerouslySetInnerHTML={{__html: introHtml}}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* API Sections */}
            <div className="space-y-16">
              {filteredSections.map(section => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 group relative"
                >
                  {/* Module Header Card */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 shadow-lg backdrop-blur-sm relative transition-all duration-300 hover:border-slate-700/80">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-800/80 pb-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold text-white tracking-tight">
                          {section.title}
                        </h2>
                        {getCategoryBadge(section.category)}
                      </div>
                      {section.filePath && (
                        <div className="text-xs font-mono text-slate-500 bg-slate-950/80 border border-slate-800/80 px-3 py-1.5 rounded-lg flex items-center gap-1.5 self-start md:self-auto">
                          <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                          <span>{section.filePath}</span>
                        </div>
                      )}
                    </div>

                    {/* Pre-compiled Markdown HTML content with complete styling variants */}
                    <div
                      className={
                        'text-slate-300 text-sm md:text-base leading-relaxed ' +
                        '[&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-8 ' +
                        '[&_h3]:mb-4 [&_h3]:tracking-wide [&_h3]:uppercase ' +
                        '[&_h3]:text-slate-400 ' +
                        '[&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-indigo-400 ' +
                        '[&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:font-mono [&_h4]:flex ' +
                        '[&_h4]:items-center [&_h4]:gap-1.5 ' +
                        '[&_p]:text-slate-300 [&_p]:mb-4 [&_p]:leading-relaxed ' +
                        '[&_pre]:bg-slate-950/80 [&_pre]:border [&_pre]:border-slate-800 ' +
                        '[&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto ' +
                        '[&_pre]:mb-6 [&_pre]:mt-2 [&_pre]:scrollbar-thin ' +
                        '[&_code]:text-xs [&_code]:font-mono [&_code]:text-indigo-300 ' +
                        '[&_code]:bg-slate-950/40 [&_code]:px-1.5 [&_code]:py-0.5 ' +
                        '[&_code]:rounded ' +
                        '[&_pre_code]:text-xs [&_pre_code]:text-slate-300 ' +
                        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:block ' +
                        '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ul]:mb-6 ' +
                        '[&_li]:text-slate-300 ' +
                        '[&_table]:w-full [&_table]:border-collapse [&_table]:rounded-xl ' +
                        '[&_table]:overflow-hidden [&_table]:border ' +
                        '[&_table]:border-slate-800/80 [&_table]:my-6 [&_table]:text-sm ' +
                        '[&_thead]:bg-slate-900/60 [&_thead]:text-slate-400 ' +
                        '[&_thead]:font-semibold [&_th]:px-4 [&_th]:py-3 ' +
                        '[&_th]:border-b [&_th]:border-slate-800 ' +
                        '[&_tbody]:divide-y [&_tbody]:divide-slate-800/50 ' +
                        '[&_tr]:hover:bg-slate-900/10 [&_tr]:transition-colors ' +
                        '[&_td]:px-4 [&_td]:py-3.5 [&_td]:text-slate-300'
                      }
                      dangerouslySetInnerHTML={{__html: section.htmlContent}}
                    />
                  </div>
                </section>
              ))}

              {filteredSections.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-12 text-center">
                  <Terminal className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-slate-300 mb-1">
                    No API matches found
                  </h3>
                  <p className="text-sm text-slate-500">
                    Try searching for different keywords or function names.
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
