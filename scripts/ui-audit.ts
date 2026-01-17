#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read --allow-env

/**
 * UI/UX Business Value Audit Script
 *
 * Analyzes the frontend to find all interactive elements and their business value.
 *
 * Usage:
 *   deno run --allow-net --allow-write --allow-read scripts/ui-audit.ts
 *
 * Options:
 *   --url=<base_url>  Base URL to audit (default: http://localhost:5173)
 *   --output=<file>   Output file path (default: ui-audit-report.json)
 */

interface InteractiveElement {
  type: 'button' | 'link' | 'input' | 'select' | 'form' | 'modal-trigger';
  text: string;
  selector: string;
  route: string;
  action?: string;
  apiEndpoint?: string;
  businessValue?: 'high' | 'medium' | 'low' | 'unknown';
  issues: string[];
}

interface RouteAudit {
  path: string;
  title: string;
  userType: 'public' | 'creator' | 'investor' | 'production' | 'admin';
  elements: InteractiveElement[];
  emptyStates: string[];
  loadingStates: boolean;
  errorHandling: boolean;
  mobileResponsive: boolean;
  score: number;
}

// Routes to audit by user type
const ROUTES_TO_AUDIT = {
  public: [
    '/',
    '/browse',
    '/marketplace',
    '/login/creator',
    '/login/investor',
    '/login/production',
    '/register',
    '/how-it-works',
    '/about',
  ],
  creator: [
    '/creator/dashboard',
    '/creator/pitch/new',
    '/creator/pitches',
    '/creator/ndas',
    '/creator/analytics',
    '/creator/team/members',
    '/creator/portfolio',
    '/creator/messages',
    '/creator/settings',
  ],
  investor: [
    '/investor/dashboard',
    '/investor/portfolio',
    '/investor/discover',
    '/investor/saved',
    '/investor/nda-requests',
    '/investor/analytics',
    '/investor/wallet',
    '/investor/settings',
  ],
  production: [
    '/production/dashboard',
    '/production/submissions',
    '/production/submissions/new',
    '/production/projects',
    '/production/analytics',
    '/production/settings',
  ],
};

// Business value classification rules
const HIGH_VALUE_PATTERNS = [
  /create.*pitch/i,
  /publish/i,
  /request.*nda/i,
  /approve/i,
  /sign.*nda/i,
  /invest/i,
  /make.*offer/i,
  /upgrade/i,
  /subscribe/i,
  /checkout/i,
  /payment/i,
];

const MEDIUM_VALUE_PATTERNS = [
  /save/i,
  /follow/i,
  /shortlist/i,
  /bookmark/i,
  /share/i,
  /download/i,
  /upload/i,
  /edit/i,
];

const LOW_VALUE_PATTERNS = [
  /cancel/i,
  /close/i,
  /back/i,
  /view.*more/i,
  /see.*all/i,
];

function classifyBusinessValue(text: string): InteractiveElement['businessValue'] {
  const normalizedText = text.toLowerCase();

  for (const pattern of HIGH_VALUE_PATTERNS) {
    if (pattern.test(normalizedText)) return 'high';
  }

  for (const pattern of MEDIUM_VALUE_PATTERNS) {
    if (pattern.test(normalizedText)) return 'medium';
  }

  for (const pattern of LOW_VALUE_PATTERNS) {
    if (pattern.test(normalizedText)) return 'low';
  }

  return 'unknown';
}

function findIssues(element: Partial<InteractiveElement>): string[] {
  const issues: string[] = [];

  // Check for missing text
  if (!element.text || element.text.trim() === '') {
    issues.push('Missing or empty button/link text');
  }

  // Check for unclear CTAs
  if (element.text && element.text.length < 3) {
    issues.push('CTA text too short - may be unclear');
  }

  // Check for generic text
  const genericTexts = ['click here', 'submit', 'ok', 'go'];
  if (element.text && genericTexts.includes(element.text.toLowerCase())) {
    issues.push('Generic CTA text - should be more specific');
  }

  // Check for missing action
  if (element.type === 'button' && !element.action && !element.apiEndpoint) {
    issues.push('Button has no clear action or API call');
  }

  return issues;
}

// Static analysis of component files
async function analyzeComponentFile(filePath: string): Promise<InteractiveElement[]> {
  const elements: InteractiveElement[] = [];

  try {
    const content = await Deno.readTextFile(filePath);

    // Find buttons
    const buttonMatches = content.matchAll(/<button[^>]*>([^<]*)<\/button>/gi);
    for (const match of buttonMatches) {
      const text = match[1].trim();
      if (text) {
        const el: InteractiveElement = {
          type: 'button',
          text,
          selector: `button:contains("${text}")`,
          route: filePath,
          businessValue: classifyBusinessValue(text),
          issues: [],
        };
        el.issues = findIssues(el);
        elements.push(el);
      }
    }

    // Find onClick handlers with navigate
    const navigateMatches = content.matchAll(/onClick=\{[^}]*navigate\(['"`]([^'"`]+)['"`]\)/gi);
    for (const match of navigateMatches) {
      elements.push({
        type: 'link',
        text: 'Navigate action',
        selector: `[onClick*="navigate"]`,
        route: filePath,
        action: `Navigate to ${match[1]}`,
        businessValue: 'medium',
        issues: [],
      });
    }

    // Find API calls
    const apiMatches = content.matchAll(/fetch\(['"`]([^'"`]+)['"`]|api\.[a-z]+\(['"`]([^'"`]+)['"`]/gi);
    for (const match of apiMatches) {
      const endpoint = match[1] || match[2];
      if (endpoint.startsWith('/api')) {
        elements.push({
          type: 'form',
          text: 'API Call',
          selector: '',
          route: filePath,
          apiEndpoint: endpoint,
          businessValue: endpoint.includes('auth') || endpoint.includes('payment') ? 'high' : 'medium',
          issues: [],
        });
      }
    }

    // Find select/dropdown elements
    const selectMatches = content.matchAll(/<select[^>]*>|<Select[^>]*/gi);
    for (const _match of selectMatches) {
      elements.push({
        type: 'select',
        text: 'Dropdown',
        selector: 'select',
        route: filePath,
        businessValue: 'medium',
        issues: [],
      });
    }

  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error);
  }

  return elements;
}

async function scanDirectory(dir: string): Promise<Map<string, InteractiveElement[]>> {
  const results = new Map<string, InteractiveElement[]>();

  try {
    for await (const entry of Deno.readDir(dir)) {
      const fullPath = `${dir}/${entry.name}`;

      if (entry.isDirectory) {
        const subResults = await scanDirectory(fullPath);
        for (const [path, elements] of subResults) {
          results.set(path, elements);
        }
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
        const elements = await analyzeComponentFile(fullPath);
        if (elements.length > 0) {
          results.set(fullPath, elements);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error);
  }

  return results;
}

async function generateReport() {
  console.log('🔍 Starting UI/UX Business Value Audit...\n');

  const frontendDir = './frontend/src';

  // Scan pages
  console.log('📂 Scanning pages...');
  const pageElements = await scanDirectory(`${frontendDir}/pages`);

  // Scan components
  console.log('📂 Scanning components...');
  const componentElements = await scanDirectory(`${frontendDir}/components`);

  // Combine results
  const allElements = new Map([...pageElements, ...componentElements]);

  // Generate summary
  const summary = {
    totalFiles: allElements.size,
    totalElements: 0,
    byBusinessValue: {
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    },
    byType: {
      button: 0,
      link: 0,
      input: 0,
      select: 0,
      form: 0,
      'modal-trigger': 0,
    },
    issues: [] as { file: string; element: string; issues: string[] }[],
    apiEndpoints: new Set<string>(),
  };

  for (const [file, elements] of allElements) {
    summary.totalElements += elements.length;

    for (const el of elements) {
      summary.byBusinessValue[el.businessValue || 'unknown']++;
      summary.byType[el.type]++;

      if (el.issues.length > 0) {
        summary.issues.push({
          file: file.replace(frontendDir, ''),
          element: el.text,
          issues: el.issues,
        });
      }

      if (el.apiEndpoint) {
        summary.apiEndpoints.add(el.apiEndpoint);
      }
    }
  }

  // Print report
  console.log('\n' + '='.repeat(60));
  console.log('📊 UI/UX BUSINESS VALUE AUDIT REPORT');
  console.log('='.repeat(60) + '\n');

  console.log('📁 FILES ANALYZED:', summary.totalFiles);
  console.log('🔘 TOTAL INTERACTIVE ELEMENTS:', summary.totalElements);

  console.log('\n📈 BY BUSINESS VALUE:');
  console.log(`   🔴 High Value:    ${summary.byBusinessValue.high}`);
  console.log(`   🟡 Medium Value:  ${summary.byBusinessValue.medium}`);
  console.log(`   🟢 Low Value:     ${summary.byBusinessValue.low}`);
  console.log(`   ⚪ Unknown:       ${summary.byBusinessValue.unknown}`);

  console.log('\n📦 BY ELEMENT TYPE:');
  console.log(`   Buttons:  ${summary.byType.button}`);
  console.log(`   Links:    ${summary.byType.link}`);
  console.log(`   Forms:    ${summary.byType.form}`);
  console.log(`   Selects:  ${summary.byType.select}`);

  console.log('\n🔌 API ENDPOINTS FOUND:', summary.apiEndpoints.size);
  for (const endpoint of [...summary.apiEndpoints].slice(0, 10)) {
    console.log(`   - ${endpoint}`);
  }
  if (summary.apiEndpoints.size > 10) {
    console.log(`   ... and ${summary.apiEndpoints.size - 10} more`);
  }

  if (summary.issues.length > 0) {
    console.log('\n⚠️  ISSUES FOUND:', summary.issues.length);
    for (const issue of summary.issues.slice(0, 10)) {
      console.log(`\n   ${issue.file}`);
      console.log(`   Element: "${issue.element}"`);
      for (const i of issue.issues) {
        console.log(`   ❌ ${i}`);
      }
    }
    if (summary.issues.length > 10) {
      console.log(`\n   ... and ${summary.issues.length - 10} more issues`);
    }
  }

  // Save full report
  const outputPath = Deno.args.find(a => a.startsWith('--output='))?.split('=')[1] || 'ui-audit-report.json';

  const fullReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      ...summary,
      apiEndpoints: [...summary.apiEndpoints],
    },
    routes: ROUTES_TO_AUDIT,
    elements: Object.fromEntries(allElements),
  };

  await Deno.writeTextFile(outputPath, JSON.stringify(fullReport, null, 2));
  console.log(`\n💾 Full report saved to: ${outputPath}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ AUDIT COMPLETE');
  console.log('='.repeat(60));

  // Recommendations
  console.log('\n📋 RECOMMENDATIONS:');
  console.log('');

  if (summary.byBusinessValue.unknown > summary.totalElements * 0.3) {
    console.log('1. ⚠️  Many elements have unknown business value');
    console.log('   → Review and add clear CTA text');
  }

  if (summary.issues.length > 0) {
    console.log(`2. ⚠️  ${summary.issues.length} UI issues found`);
    console.log('   → Fix missing/unclear button text');
  }

  if (summary.byBusinessValue.high < 10) {
    console.log('3. ⚠️  Few high-value CTAs detected');
    console.log('   → Ensure conversion CTAs are prominent');
  }

  console.log('\n💡 Next steps:');
  console.log('   1. Run visual regression tests');
  console.log('   2. Check mobile responsiveness');
  console.log('   3. Add analytics tracking to high-value CTAs');
  console.log('   4. A/B test CTA text variations');
}

// Run
generateReport().catch(console.error);
