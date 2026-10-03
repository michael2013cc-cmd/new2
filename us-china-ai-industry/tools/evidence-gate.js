#!/usr/bin/env node
/**
 * evidence-gate.js — 证据门禁最小原型（零依赖，纯本地，Node >= 12）
 *
 * 来源：us-china-ai-industry 仓库 C4.2 第一条——把本仓库的固定流程纪律
 * （★级来源不采数字 / 引用带证据级注 / 禁用"必然"叙事 / 47.5% 带口径注 /
 *  厂商 KPI 宣传隔离 / 模块文件带核对节）写成可执行的 gate 检查。
 *
 * 用法：
 *   node evidence-gate.js                    # 检查仓库默认目标（modules/*.md、final-report.md、outline.md）
 *   node evidence-gate.js <文件或目录> ...    # 检查指定路径（目录递归 .md）
 *   node evidence-gate.js --selftest         # 内置判例自测（期望值即 ground truth）
 *
 * 退出码：有 ERROR → 1；仅 WARN 或全净 → 0。
 * 注意：这是"提示复核"而非真理判定——WARN 级命中需要人（或 agent）读上下文后裁决，
 * 正如 B4 纪律本身：工具做的是拦截，不是结论。
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ---------- 规则定义 ----------
// 每条规则：{ id, level: 'ERROR'|'WARN', desc, test(line) -> boolean }
const GUARD = /不采|零采|待核|存疑|口径|方向|氛围|降级|证伪|禁用|禁止|纪律|宣传|厂商|原文|隔离|防|警惕|核实|目的论|✓|未见可靠|无法独立/;

const RULES = [
  {
    id: 'R1-口径注',
    level: 'ERROR',
    desc: '"47.5%" 渗透率引用必须同行带口径限定（口径存疑/待核/降级/核实/未见可靠来源等）——裸引即违例',
    test: (l) => l.includes('47.5%') && !/口径|存疑|待核|降级|核实|验证|未见可靠|无法独立/.test(l),
  },
  {
    id: 'R2-必然叙事',
    level: 'ERROR',
    desc: '禁用"必然胜利/必然崩溃"式叙事（除非该行本身在陈述纪律/证伪它）',
    test: (l) => /必然(胜利|崩溃|取代|赢|输)/.test(l) && !GUARD.test(l),
  },
  {
    id: 'R3-★级采数',
    level: 'WARN',
    desc: '含孤★（非★★/★★★）来源的行出现了具体数字且未标"只采方向/不采信/待核"——★级只作氛围',
    test: (l) => {
      const hasLoneStar = /(^|[^★])★($|[^★])/.test(l);
      const hasNumber = /\d+(?:\.\d+)?\s*(?:%|pct|万|亿|台|家|元|小时|例|款|个|人)/.test(l);
      return hasLoneStar && hasNumber && !GUARD.test(l);
    },
  },
  {
    id: 'R4-引用缺级',
    level: 'WARN',
    desc: '正文行内引用了 URL 但同行没有任何 ★ 证据级标注（引用应带级）',
    test: (l) => /https?:\/\//.test(l) && !l.includes('★') && !/^\s*[-*]?\s*(https?:\/\/\S+\s*)+$/.test(l) && !/^#/.test(l),
  },
  {
    id: 'R5-KPI来源闸',
    level: 'WARN',
    desc: 'KPI 语境（OEE/良率/检出率/提效/降本/渗透率）+ 量化增幅，但同行无"宣传/厂商/口径/待核"隔离词——先查出处再进财务模型',
    test: (l) => {
      const kpi = /OEE|良率|检出率|提效|降本|渗透率|效率提升/.test(l);
      const qty = /[+＋]\s*\d|提高\s*\d|\d+(?:\.\d+)?\s*(?:%|pct|个百分点)/.test(l);
      return kpi && qty && !GUARD.test(l);
    },
  },
];

// R6：模块文件结构闸（文件级，非行级）
const R6 = {
  id: 'R6-核对节缺失',
  level: 'WARN',
  desc: '模块文件（modules/A*/B*/C*）应含"数据核对记录"与"遗留待办"两节',
};

// ---------- 执行 ----------
function checkLines(label, text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((l, i) => {
    for (const r of RULES) {
      let hit = false;
      try { hit = r.test(l); } catch (e) { /* 规则自身容错 */ }
      if (hit) findings.push({ rule: r.id, level: r.level, line: i + 1, text: l.trim().slice(0, 120), desc: r.desc });
    }
  });
  // R6 结构闸：仅对 modules 下的编号文件
  if (/modules[\\/][ABC]\d/.test(label) && !/README/.test(label)) {
    if (!/数据核对记录/.test(text) || !/遗留待办/.test(text)) {
      findings.push({ rule: R6.id, level: R6.level, line: 0, text: '(文件级)', desc: R6.desc });
    }
  }
  return findings;
}

function collectFiles(targets) {
  const out = [];
  for (const t of targets) {
    const st = fs.statSync(t);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(t)) {
        const p = path.join(t, f);
        const s2 = fs.statSync(p);
        if (s2.isDirectory()) out.push(...collectFiles([p]));
        else if (f.endsWith('.md')) out.push(p);
      }
    } else if (t.endsWith('.md')) out.push(t);
  }
  return out;
}

// ---------- 自测（ground truth 判例） ----------
function selftest() {
  const cases = [
    // [名称, 行, 期望命中的规则 id 数组]
    ['判例:47.5%裸引', '渗透率达 47.5%，中国全球领先。', ['R1-口径注', 'R5-KPI来源闸']], // 双规则命中：既是口径注违例也是无来源 KPI 量化
    ['判例:47.5%合规引用', 'IDC"47.5% 渗透率"（口径存疑，B1 已列待核）。', []],
    ['判例:47.5%元陈述', '核查结果："47.5%"这个数字本身无法独立验证口径，降级处理。', []],
    ['判例:必然崩溃论', '美国遏制必然崩溃，中国必然胜利。', ['R2-必然叙事']],
    ['判例:纪律陈述', '禁用"必然胜利/必然崩溃"叙事——两侧同样适用（B4 纪律）。', []],
    ['判例:★源采数', '某博客（★）称订单 3000 万、装机 5 万台。', ['R3-★级采数']],
    ['判例:★源采方向', '某博客（★）称订单爆发，只采方向、数字零采信。', []],
    ['判例:KPI宣传', '视觉质检上线后 OEE 提升 30%。', ['R5-KPI来源闸']],
    ['判例:KPI已隔离', '36氪宣传 OEE+30pct，原文口径为 +3–10pct（厂商宣传不进财务模型）。', []],
    ['判例:URL无级', '参考 https://example.gov.cn/page 的报道。', ['R4-引用缺级']],
    ['判例:URL带级', '发改委（★★★）：https://www.ndrc.gov.cn/xxgk/x.pdf', []],
    // 误报防护：纯数字列表行不该触发 R3
    ['判例:无★纯数字', '2026-07-30 工信部公告废除梯次利用准入。', []],
  ];
  let pass = 0;
  for (const [name, line, expected] of cases) {
    const found = checkLines('selftest', line).map((f) => f.rule).sort();
    const ok = JSON.stringify(found) === JSON.stringify([...expected].sort());
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : `  期望=[${expected}] 实际=[${found}]`));
    if (ok) pass++;
  }
  console.log(`\nselftest: ${pass}/${cases.length}`);
  return pass === cases.length;
}

// ---------- CLI ----------
function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) {
    process.exit(selftest() ? 0 : 1);
  }
  const repoRoot = path.resolve(__dirname, '..');
  let targets = args.filter((a) => !a.startsWith('--'));
  if (targets.length === 0) {
    targets = [path.join(repoRoot, 'modules'), path.join(repoRoot, 'final-report.md'), path.join(repoRoot, 'outline.md')]
      .filter((t) => fs.existsSync(t));
  }
  const files = collectFiles(targets);
  let errors = 0, warns = 0;
  console.log(`evidence-gate: 检查 ${files.length} 个文件\n`);
  for (const f of files) {
    const findings = checkLines(f, fs.readFileSync(f, 'utf8'));
    if (findings.length === 0) continue;
    console.log(f + ':');
    for (const x of findings) {
      if (x.level === 'ERROR') errors++; else warns++;
      console.log(`  [${x.level}] ${x.rule} @L${x.line || '-'}  ${x.text}`);
      console.log(`         ${x.desc}`);
    }
    console.log('');
  }
  console.log(`合计：ERROR ${errors}，WARN ${warns}（WARN 需人工/agent 读上下文裁决，非自动定罪）`);
  process.exit(errors > 0 ? 1 : 0);
}

if (require.main === module) main();
module.exports = { checkLines, RULES, selftest, collectFiles };
