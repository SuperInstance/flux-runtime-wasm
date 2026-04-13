/**
 * FLUX Runtime WASM — Public API / Entry Point
 *
 * This is the main entry point for the flux-runtime-wasm package.
 * It exposes the VM, compiler, and opcodes for use in both
 * Node.js and browser environments.
 *
 * Usage:
 *   import { compileAndRun, FluxVM, FluxCompiler, Op } from '@superinstance/flux-runtime-wasm';
 *
 *   // Quick: compile markdown and run
 *   const result = compileAndRun('# Hello\n```flux\nMOVI R0, 42\nSYS 0\nHALT\n```');
 *   console.log(result.output); // "42"
 *
 *   // Advanced: use VM directly
 *   const vm = new FluxVM({ output: console.log });
 *   vm.load(bytecode);
 *   vm.execute();
 */

// Import for local use
import { FluxVM, type OutputCallback, type VMConfig } from './vm';
import { FluxCompiler, type FluxMetadata } from './compiler';

// Re-export everything from the core modules
export { Op, ISA_TABLE, FORMAT_SIZE, OPCODE_COUNT, opFromByte, opMnemonic, countByCategory } from './opcode';
export type { OpcodeInfo, OpcodeCategory, InstructionFormat } from './opcode';

export {
  FluxVM,
  RegisterFile,
  FluxVMError,
  VMError,
} from './vm';
export type { VMResult, VMConfig, OutputCallback } from './vm';

export {
  FluxCompiler,
  Assembler,
  disassemble,
  extractCodeBlocks,
  extractMetadata,
  CompilationError,
} from './compiler';
export type { FluxMetadata } from './compiler';

// ═══════════════════════════════════════════════════════
// Convenience API
// ═══════════════════════════════════════════════════════

/** Result from compileAndRun */
export interface CompileAndRunResult {
  success: boolean;
  cycles: number;
  halted: boolean;
  output: string[];
  error?: string;
  dump?: string;
}

/**
 * One-shot: compile FLUX markdown and execute in a fresh VM.
 * Collects all output lines and returns them.
 */
export function compileAndRun(
  markdown: string,
  options?: { trace?: boolean; maxCycles?: number; dumpOnError?: boolean },
): CompileAndRunResult {
  const compiler = new FluxCompiler();
  const outputLines: string[] = [];

  let bytecode: Uint8Array;
  try {
    const result = compiler.compile(markdown);
    bytecode = result.bytecode;
  } catch (e) {
    return {
      success: false,
      cycles: 0,
      halted: false,
      output: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const vm = new FluxVM({
    output: (msg) => outputLines.push(msg),
    trace: options?.trace ?? false,
    maxCycles: options?.maxCycles ?? 10_000_000,
  });

  vm.load(bytecode);
  const result = vm.execute();

  if (!result.success && options?.dumpOnError) {
    return {
      ...result,
      output: outputLines,
      dump: vm.dump(),
    };
  }

  return {
    ...result,
    output: outputLines,
  };
}

/**
 * One-shot: compile raw assembly and execute.
 */
export function assembleAndRun(
  assembly: string,
  options?: { trace?: boolean; maxCycles?: number },
): CompileAndRunResult {
  const compiler = new FluxCompiler();
  const outputLines: string[] = [];

  let bytecode: Uint8Array;
  try {
    bytecode = compiler.compileAssembly(assembly);
  } catch (e) {
    return {
      success: false,
      cycles: 0,
      halted: false,
      output: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const vm = new FluxVM({
    output: (msg) => outputLines.push(msg),
    trace: options?.trace ?? false,
    maxCycles: options?.maxCycles ?? 10_000_000,
  });

  vm.load(bytecode);
  const result = vm.execute();

  return {
    ...result,
    output: outputLines,
  };
}

/**
 * Create a pre-configured VM from a FLUX markdown source.
 * Returns the VM in a ready-to-execute state.
 */
export function createVM(
  markdown: string,
  options?: { output?: (msg: string) => void; trace?: boolean },
): { vm: FluxVM; metadata: FluxMetadata } | { error: string } {
  const compiler = new FluxCompiler();
  try {
    const { bytecode, metadata } = compiler.compile(markdown);
    const vm = new FluxVM({
      output: options?.output ?? ((_msg: string) => {}),
      trace: options?.trace ?? false,
    });
    vm.load(bytecode);
    return { vm, metadata };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Package version */
export const VERSION = '0.1.0';

/** ISA version */
export const ISA_VERSION = 3;
