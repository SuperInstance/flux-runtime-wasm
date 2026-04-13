/**
 * FLUX Markdown-to-Bytecode Compiler
 *
 * Parses FLUX markdown files (.flux, .md) containing structured
 * code blocks and compiles them to FLUX bytecode.
 *
 * File format:
 *   # Title
 *   ## Description
 *   ```flux
 *     ; FLUX assembly here
 *     MOVI R0, 42
 *     SYS 0         ; print R0
 *     HALT
 *   ```
 *
 * The compiler performs:
 *   1. Markdown extraction — pulls code blocks from .flux/.md
 *   2. Assembly — two-pass assembler with label resolution
 *   3. Bytecode emission — produces Uint8Array for the VM
 */

import { Op, ISA_TABLE, opMnemonic } from './opcode';

/** Compilation error */
export class CompilationError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly source?: string,
  ) {
    super(message);
    this.name = 'CompilationError';
  }
}

/** Parsed instruction operand types */
type Operand = { type: 'reg'; value: number } | { type: 'imm'; value: number } | { type: 'label'; name: string };

/** Parsed instruction line */
interface ParsedLine {
  label?: string;
  mnemonic: string;
  operands: Operand[];
  comment?: string;
  lineNum: number;
}

/** Opcode lookup by mnemonic (case-insensitive) */
const MNEMONIC_MAP = new Map<string, number>();
for (const [code, info] of ISA_TABLE) {
  MNEMONIC_MAP.set(info.mnemonic.toUpperCase(), code);
}

/** Get the instruction byte size for a given opcode */
function instrSize(opcode: number): number {
  const info = ISA_TABLE.get(opcode);
  if (!info) return 1;
  return { A: 1, B: 2, C: 2, D: 3, E: 4, F: 4, G: 5 }[info.format] ?? 1;
}

/** Parse a register operand (R0-R255) */
function parseReg(s: string, lineNum: number): Operand {
  const cleaned = s.trim().toUpperCase();
  if (cleaned.startsWith('R')) {
    const num = parseInt(cleaned.slice(1), 10);
    if (isNaN(num) || num < 0 || num > 255) {
      throw new CompilationError(`Invalid register: ${s}`, lineNum);
    }
    return { type: 'reg', value: num };
  }
  throw new CompilationError(`Expected register, got: ${s}`, lineNum);
}

/** Parse an immediate value (decimal, hex, or label) */
function parseImmOrLabel(s: string): Operand {
  const cleaned = s.trim();
  // Hex literal
  if (cleaned.startsWith('0x') || cleaned.startsWith('0X')) {
    return { type: 'imm', value: parseInt(cleaned, 16) };
  }
  // Binary literal
  if (cleaned.startsWith('0b') || cleaned.startsWith('0B')) {
    return { type: 'imm', value: parseInt(cleaned.slice(2), 2) };
  }
  // Numeric
  if (/^-?\d+$/.test(cleaned)) {
    return { type: 'imm', value: parseInt(cleaned, 10) };
  }
  // Label reference
  if (/^[a-zA-Z_]\w*$/.test(cleaned)) {
    return { type: 'label', name: cleaned };
  }
  // Try as number anyway
  const num = Number(cleaned);
  if (!isNaN(num)) {
    return { type: 'imm', value: num | 0 };
  }
  throw new CompilationError(`Cannot parse operand: ${cleaned}`);
}

/** Parse a single assembly line into structured form */
function parseLine(raw: string, lineNum: number): ParsedLine | null {
  // Strip comments (everything after ';')
  const commentIdx = raw.indexOf(';');
  let code = commentIdx >= 0 ? raw.slice(0, commentIdx) : raw;
  const comment = commentIdx >= 0 ? raw.slice(commentIdx + 1).trim() : undefined;

  // Check for label (name:)
  let label: string | undefined;
  const labelMatch = code.match(/^(\w+):\s*(.*)/);
  if (labelMatch) {
    label = labelMatch[1];
    code = labelMatch[2].trim();
  }

  if (code.trim() === '') {
    // Line with just a label
    if (label) {
      return { label, mnemonic: '', operands: [], comment, lineNum };
    }
    return null;
  }

  // Split into mnemonic and operands
  const parts = code.trim().split(/[\s,]+/).filter(Boolean);
  const mnemonic = parts[0].toUpperCase();
  const operands = parts.slice(1).map(p => {
    const upper = p.toUpperCase();
    if (upper.startsWith('R')) return parseReg(p, lineNum);
    return parseImmOrLabel(p);
  });

  return { label, mnemonic, operands, comment, lineNum };
}

/**
 * The FLUX Assembler — converts assembly text to bytecode.
 */
export class Assembler {
  private labels = new Map<string, number>();
  private output: number[] = [];
  private fixups: { pos: number; instrEnd: number; label: string }[] = [];
  private lines: ParsedLine[] = [];

  /** Assemble FLUX assembly source to bytecode */
  assemble(source: string): Uint8Array {
    this.labels.clear();
    this.output = [];
    this.fixups = [];
    this.lines = [];

    const rawLines = source.split('\n');

    // Phase 1: Parse all lines
    for (let i = 0; i < rawLines.length; i++) {
      const parsed = parseLine(rawLines[i], i + 1);
      if (parsed) {
        this.lines.push(parsed);
      }
    }

    // Phase 2: Calculate positions and find labels (Pass 1)
    let pos = 0;
    for (const line of this.lines) {
      if (line.label) {
        this.labels.set(line.label, pos);
      }
      if (line.mnemonic === '') continue; // Label-only line

      const opcode = MNEMONIC_MAP.get(line.mnemonic);
      if (opcode === undefined) {
        throw new CompilationError(
          `Unknown instruction: ${line.mnemonic}`,
          line.lineNum,
          line.mnemonic,
        );
      }
      pos += instrSize(opcode);
    }

    // Phase 3: Emit bytecode (Pass 2)
    for (const line of this.lines) {
      if (line.mnemonic === '') continue;
      this.emitInstruction(line);
    }

    // Phase 4: Apply label fixups
    for (const fixup of this.fixups) {
      const target = this.labels.get(fixup.label);
      if (target === undefined) {
        throw new CompilationError(`Undefined label: ${fixup.label}`);
      }
      const offset = target - fixup.instrEnd;
      // Write as signed i16 little-endian
      const lo = offset & 0xFF;
      const hi = (offset >> 8) & 0xFF;
      this.output[fixup.pos] = lo;
      this.output[fixup.pos + 1] = hi;
    }

    return new Uint8Array(this.output);
  }

  /** Emit a single instruction */
  private emitInstruction(line: ParsedLine): void {
    let mnemonic = line.mnemonic;
    let opcode = MNEMONIC_MAP.get(mnemonic);
    if (opcode === undefined) return;

    let info = ISA_TABLE.get(opcode);
    if (!info) return;

    const pos = this.output.length;
    const ops = line.operands;

    // Auto-upgrade Format E conditional jumps with labels to Format F long jumps.
    // JZ R0, label → LJZ R0, label  (both 4 bytes, so Pass 1 sizes are correct)
    const LONG_JUMP_MAP: Record<string, string> = {
      'JZ': 'LJZ', 'JNZ': 'LJNZ', 'JLT': 'LJLT', 'JGT': 'LJGT',
    };
    const hasLabelOperand = ops.some(o => o.type === 'label');
    if (info.format === 'E' && hasLabelOperand && LONG_JUMP_MAP[mnemonic]) {
 mnemonic = LONG_JUMP_MAP[mnemonic];
      opcode = MNEMONIC_MAP.get(mnemonic)!;
      info = ISA_TABLE.get(opcode)!;
    }

    switch (info.format) {
      case 'A':
        this.output.push(opcode);
        break;

      case 'B': {
        // Format B: [op][rd]
        const rd = ops[0]?.type === 'reg' ? ops[0].value : 0;
        this.output.push(opcode, rd);
        break;
      }

      case 'C': {
        // Format C: [op][imm8]
        const imm = ops[0]?.type === 'reg' ? ops[0].value
                  : ops[0]?.type === 'imm' ? (ops[0].value & 0xFF)
                  : 0;
        this.output.push(opcode, imm);
        break;
      }

      case 'D': {
        // Format D: [op][rd][imm8]
        const rd = ops[0]?.type === 'reg' ? ops[0].value : 0;
        let imm = 0;
        if (ops[1]?.type === 'imm') imm = ops[1].value & 0xFF;
        else if (ops[1]?.type === 'label') {
          this.fixups.push({ pos: pos + 2, instrEnd: pos + 3, label: ops[1].name });
        }
        this.output.push(opcode, rd, imm);
        break;
      }

      case 'E': {
        // Format E: [op][rd][rs1][rs2]
        const rd = ops[0]?.type === 'reg' ? ops[0].value : 0;
        let rs1 = ops[1]?.type === 'reg' ? ops[1].value : 0;
        let rs2 = 0;

        if (ops.length >= 3 && ops[2]?.type === 'reg') {
          rs2 = ops[2].value;
        } else if (ops.length >= 2 && ops[1]?.type === 'reg') {
          rs1 = ops[1].value;
        }

        this.output.push(opcode, rd, rs1, rs2);
        break;
      }

      case 'F': {
        // Format F: [op][rd][imm16_lo][imm16_hi]
        const rd = ops[0]?.type === 'reg' ? ops[0].value : 0;
        let imm16 = 0;
        if (ops[1]?.type === 'imm') {
          imm16 = ops[1].value & 0xFFFF;
        } else if (ops[1]?.type === 'label') {
          this.fixups.push({ pos: pos + 2, instrEnd: pos + 4, label: ops[1].name });
        }
        this.output.push(opcode, rd, imm16 & 0xFF, (imm16 >> 8) & 0xFF);
        break;
      }

      case 'G': {
        // Format G: [op][rd][rs1][imm16_lo][imm16_hi]
        const rd = ops[0]?.type === 'reg' ? ops[0].value : 0;
        const rs1 = ops[1]?.type === 'reg' ? ops[1].value : 0;
        let imm16 = 0;
        if (ops[2]?.type === 'imm') {
          imm16 = ops[2].value & 0xFFFF;
        } else if (ops[2]?.type === 'label') {
          this.fixups.push({ pos: pos + 3, instrEnd: pos + 5, label: ops[2].name });
        }
        this.output.push(opcode, rd, rs1, imm16 & 0xFF, (imm16 >> 8) & 0xFF);
        break;
      }
    }
  }
}

/**
 * Extract FLUX code blocks from markdown source.
 *
 * Supports:
 *   ```flux    ...    ```
 *   ```asm     ...    ```
 *   ```        ...    ```  (unnamed, inferred from context)
 */
export function extractCodeBlocks(markdown: string): { lang: string; code: string; lineNum: number }[] {
  const blocks: { lang: string; code: string; lineNum: number }[] = [];
  const lines = markdown.split('\n');
  let inBlock = false;
  let currentLang = '';
  let currentCode: string[] = [];
  let blockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^```(\w*)\s*$/);

    if (fenceMatch) {
      if (!inBlock) {
        inBlock = true;
        currentLang = fenceMatch[1].toLowerCase();
        currentCode = [];
        blockStartLine = i + 1;
      } else {
        inBlock = false;
        if (currentCode.length > 0) {
          blocks.push({
            lang: currentLang,
            code: currentCode.join('\n'),
            lineNum: blockStartLine,
          });
        }
      }
    } else if (inBlock) {
      currentCode.push(line);
    }
  }

  return blocks;
}

/** Parse FLUX metadata from markdown frontmatter and headers */
export interface FluxMetadata {
  title?: string;
  description?: string;
  version?: string;
  author?: string;
  registers?: number;
}

export function extractMetadata(markdown: string): FluxMetadata {
  const meta: FluxMetadata = {};

  // Extract title from first # heading
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (titleMatch) meta.title = titleMatch[1].trim();

  // Extract description from ## heading
  const descMatch = markdown.match(/^##\s+(.+)$/m);
  if (descMatch) meta.description = descMatch[1].trim();

  // Extract key-value metadata from markdown
  const versionMatch = markdown.match(/version:\s*(\S+)/i);
  if (versionMatch) meta.version = versionMatch[1];

  const authorMatch = markdown.match(/author:\s*(.+)/i);
  if (authorMatch) meta.author = authorMatch[1].trim();

  return meta;
}

/**
 * Main FLUX Compiler — compiles markdown to bytecode.
 */
export class FluxCompiler {
  private assembler = new Assembler();

  /** Compile a FLUX markdown file to bytecode */
  compile(markdown: string): { bytecode: Uint8Array; metadata: FluxMetadata } {
    const metadata = extractMetadata(markdown);
    const blocks = extractCodeBlocks(markdown);

    if (blocks.length === 0) {
      throw new CompilationError('No code blocks found in FLUX markdown');
    }

    // Concatenate all code blocks
    const combinedSource = blocks.map(b => b.code).join('\n');

    // Assemble
    const bytecode = this.assembler.assemble(combinedSource);

    return { bytecode, metadata };
  }

  /** Compile raw assembly text (no markdown wrapper) */
  compileAssembly(assembly: string): Uint8Array {
    return this.assembler.assemble(assembly);
  }
}

/**
 * Disassemble bytecode to human-readable FLUX assembly.
 */
export function disassemble(bytecode: Uint8Array): string {
  const lines: string[] = [];
  let i = 0;

  while (i < bytecode.length) {
    const pc = i;
    const opByte = bytecode[i];
    const info = ISA_TABLE.get(opByte);
    const mnemonic = info?.mnemonic ?? `UNKNOWN_0x${opByte.toString(16).toUpperCase().padStart(2, '0')}`;
    const fmt = info?.format ?? 'A';

    const hexBytes: string[] = [];
    const startI = i;

    switch (fmt) {
      case 'A':
        i += 1;
        lines.push(`  0x${pc.toString(16).padStart(4, '0')}:  ${mnemonic}`);
        break;

      case 'B': {
        const rd = bytecode[i + 1] ?? 0;
        i += 2;
        lines.push(`  0x${pc.toString(16).padStart(4, '0')}:  ${mnemonic} R${rd}`);
        break;
      }

      case 'C': {
        const imm = bytecode[i + 1] ?? 0;
        i += 2;
        lines.push(`  0x${pc.toString(16).padStart(4, '0')}:  ${mnemonic} ${imm}`);
        break;
      }

      case 'D': {
        const rd = bytecode[i + 1] ?? 0;
        const imm8 = bytecode[i + 2] ?? 0;
        i += 3;
        const signedImm = imm8 > 127 ? imm8 - 256 : imm8;
        lines.push(`  0x${pc.toString(16).padStart(4, '0')}:  ${mnemonic} R${rd}, ${signedImm}`);
        break;
      }

      case 'E': {
        const rd = bytecode[i + 1] ?? 0;
        const rs1 = bytecode[i + 2] ?? 0;
        const rs2 = bytecode[i + 3] ?? 0;
        i += 4;
        lines.push(`  0x${pc.toString(16).padStart(4, '0')}:  ${mnemonic} R${rd}, R${rs1}, R${rs2}`);
        break;
      }

      case 'F': {
        const rd = bytecode[i + 1] ?? 0;
        const imm16Lo = bytecode[i + 2] ?? 0;
        const imm16Hi = bytecode[i + 3] ?? 0;
        i += 4;
        const imm16 = imm16Lo | (imm16Hi << 8);
        const signedImm = imm16 > 32767 ? imm16 - 65536 : imm16;
        lines.push(`  0x${pc.toString(16).padStart(4, '0')}:  ${mnemonic} R${rd}, ${signedImm}`);
        break;
      }

      case 'G': {
        const rd = bytecode[i + 1] ?? 0;
        const rs1 = bytecode[i + 2] ?? 0;
        const imm16Lo = bytecode[i + 3] ?? 0;
        const imm16Hi = bytecode[i + 4] ?? 0;
        i += 5;
        const imm16 = imm16Lo | (imm16Hi << 8);
        const signedImm = imm16 > 32767 ? imm16 - 65536 : imm16;
        lines.push(`  0x${pc.toString(16).padStart(4, '0')}:  ${mnemonic} R${rd}, R${rs1}, ${signedImm}`);
        break;
      }

      default:
        i += 1;
        lines.push(`  0x${pc.toString(16).padStart(4, '0')}:  ${mnemonic}`);
    }
  }

  return lines.join('\n');
}
