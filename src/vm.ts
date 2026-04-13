/**
 * FLUX Virtual Machine — WebAssembly-targeted register-based interpreter.
 *
 * Architecture:
 *   - 256 general-purpose integer registers (i32)
 *   - 256 floating-point registers (f64)
 *   - 64KB linear memory (byte-addressable)
 *   - Call stack (separate from data stack)
 *   - Program counter (32-bit)
 *   - Flags: zero, sign, carry, overflow
 *
 * The VM is designed to be compilable to WASM via Emscripten or AssemblyScript.
 * All operations use 32-bit integers and 64-bit floats to match WASM types.
 *
 * Instruction encoding follows the FLUX Unified ISA v3:
 *   Format A: [op]                          (1 byte)
 *   Format B: [op][rd]                      (2 bytes)
 *   Format C: [op][imm8]                    (2 bytes)
 *   Format D: [op][rd][imm8]                (3 bytes)
 *   Format E: [op][rd][rs1][rs2]            (4 bytes)
 *   Format F: [op][rd][imm16_lo][imm16_hi]  (4 bytes)
 *   Format G: [op][rd][rs1][imm16_lo][imm16_hi] (5 bytes)
 */

import { Op, ISA_TABLE, FORMAT_SIZE, type InstructionFormat, opMnemonic } from './opcode';

/** Memory size: 64KB */
const MEM_SIZE = 65536;

/** Maximum stack depth */
const MAX_STACK = 4096;

/** Default cycle budget */
const DEFAULT_MAX_CYCLES = 10_000_000;

/** Output callback type */
export type OutputCallback = (message: string) => void;

/** VM error types */
export enum VMError {
  InvalidOpcode = 'InvalidOpcode',
  InvalidRegister = 'InvalidRegister',
  StackOverflow = 'StackOverflow',
  StackUnderflow = 'StackUnderflow',
  DivisionByZero = 'DivisionByZero',
  CycleBudgetExceeded = 'CycleBudgetExceeded',
  MemoryOutOfBounds = 'MemoryOutOfBounds',
  Halted = 'Halted',
  Unimplemented = 'Unimplemented',
}

/** VM execution error with context */
export class FluxVMError extends Error {
  constructor(
    public readonly type: VMError,
    message: string,
    public readonly pc?: number,
    public readonly opcode?: number,
  ) {
    super(message);
    this.name = 'FluxVMError';
  }
}

/** Register file: 256 GP (i32) + 256 FP (f64) + PC + flags */
export class RegisterFile {
  readonly gp: Int32Array;   // 256 general-purpose
  readonly fp: Float64Array; // 256 floating-point
  pc: number = 0;
  sp: number = 0;
  flagZero: boolean = false;
  flagSign: boolean = false;
  flagCarry: boolean = false;
  flagOverflow: boolean = false;

  constructor() {
    this.gp = new Int32Array(256);
    this.fp = new Float64Array(256);
  }

  reset(): void {
    this.gp.fill(0);
    this.fp.fill(0);
    this.pc = 0;
    this.sp = 0;
    this.flagZero = false;
    this.flagSign = false;
    this.flagCarry = false;
    this.flagOverflow = false;
  }

  readGP(idx: number): number {
    if (idx < 0 || idx > 255) return 0;
    return this.gp[idx];
  }

  writeGP(idx: number, val: number): void {
    if (idx >= 0 && idx <= 255) {
      this.gp[idx] = val | 0; // Ensure i32
    }
  }

  readFP(idx: number): number {
    if (idx < 0 || idx > 255) return 0;
    return this.fp[idx];
  }

  writeFP(idx: number, val: number): void {
    if (idx >= 0 && idx <= 255) {
      this.fp[idx] = val;
    }
  }

  setFlags(result: number): void {
    this.flagZero = (result & 0xFFFFFFFF) === 0;
    this.flagSign = (result & 0x80000000) !== 0;
  }
}

/** VM execution result */
export interface VMResult {
  success: boolean;
  cycles: number;
  halted: boolean;
  error?: string;
}

/** VM configuration */
export interface VMConfig {
  maxCycles?: number;
  output?: OutputCallback;
  trace?: boolean;
}

/** The FLUX Virtual Machine */
export class FluxVM {
  readonly regs: RegisterFile;
  readonly memory: Uint8Array;
  private stack: Int32Array;
  private stackPtr: number = 0;
  private halted = false;
  private cycleCount = 0;
  private maxCycles: number;
  private output: OutputCallback;
  private trace: boolean;
  private bytecode: Uint8Array;

  constructor(config: VMConfig = {}) {
    this.regs = new RegisterFile();
    this.memory = new Uint8Array(MEM_SIZE);
    this.stack = new Int32Array(MAX_STACK);
    this.maxCycles = config.maxCycles ?? DEFAULT_MAX_CYCLES;
    this.output = config.output ?? ((_msg: string) => {});
    this.trace = config.trace ?? false;
    this.bytecode = new Uint8Array(0);
  }

  /** Load bytecode into the VM */
  load(bytecode: Uint8Array | number[]): void {
    this.bytecode = new Uint8Array(bytecode);
    this.reset();
  }

  /** Load from a FLUX.MD source (must be compiled first) */
  loadBinary(buffer: ArrayBuffer): void {
    this.bytecode = new Uint8Array(buffer);
    this.reset();
  }

  /** Reset VM state to initial */
  reset(): void {
    this.regs.reset();
    this.stack.fill(0);
    this.stackPtr = 0;
    this.halted = false;
    this.cycleCount = 0;
    this.memory.fill(0);
  }

  /** Read a byte at PC and advance PC */
  private fetchU8(): number {
    if (this.regs.pc >= this.bytecode.length) return Op.HALT;
    return this.bytecode[this.regs.pc++];
  }

  /** Read a signed 8-bit immediate */
  private fetchI8(): number {
    const v = this.fetchU8();
    return v > 127 ? v - 256 : v;
  }

  /** Read a signed 16-bit little-endian immediate */
  private fetchI16(): number {
    const lo = this.fetchU8();
    const hi = this.fetchU8();
    const val = lo | (hi << 8);
    return val > 32767 ? val - 65536 : val;
  }

  /** Read an unsigned 16-bit little-endian immediate */
  private fetchU16(): number {
    const lo = this.fetchU8();
    const hi = this.fetchU8();
    return lo | (hi << 8);
  }

  /** Push a value onto the call stack */
  private push(val: number): void {
    if (this.stackPtr >= MAX_STACK) {
      throw new FluxVMError(VMError.StackOverflow, 'Stack overflow', this.regs.pc);
    }
    this.stack[this.stackPtr++] = val;
  }

  /** Pop a value from the call stack */
  private pop(): number {
    if (this.stackPtr <= 0) {
      throw new FluxVMError(VMError.StackUnderflow, 'Stack underflow', this.regs.pc);
    }
    return this.stack[--this.stackPtr];
  }

  /** Read a byte from memory */
  memRead8(addr: number): number {
    if (addr < 0 || addr >= MEM_SIZE) {
      throw new FluxVMError(VMError.MemoryOutOfBounds, `Memory read out of bounds: 0x${addr.toString(16)}`);
    }
    return this.memory[addr];
  }

  /** Write a byte to memory */
  memWrite8(addr: number, val: number): void {
    if (addr < 0 || addr >= MEM_SIZE) {
      throw new FluxVMError(VMError.MemoryOutOfBounds, `Memory write out of bounds: 0x${addr.toString(16)}`);
    }
    this.memory[addr] = val & 0xFF;
  }

  /** Read an i32 from memory (little-endian) */
  memRead32(addr: number): number {
    const b0 = this.memRead8(addr);
    const b1 = this.memRead8(addr + 1);
    const b2 = this.memRead8(addr + 2);
    const b3 = this.memRead8(addr + 3);
    return b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
  }

  /** Write an i32 to memory (little-endian) */
  memWrite32(addr: number, val: number): void {
    this.memWrite8(addr, val & 0xFF);
    this.memWrite8(addr + 1, (val >> 8) & 0xFF);
    this.memWrite8(addr + 2, (val >> 16) & 0xFF);
    this.memWrite8(addr + 3, (val >> 24) & 0xFF);
  }

  /** Read a GP register */
  readGP(idx: number): number {
    return this.regs.readGP(idx);
  }

  /** Write a GP register */
  writeGP(idx: number, val: number): void {
    this.regs.writeGP(idx, val);
  }

  /** Get current stack depth */
  get stackDepth(): number {
    return this.stackPtr;
  }

  /** Get cycle count from last execution */
  get cycles(): number {
    return this.cycleCount;
  }

  /** Check if VM is halted */
  get isHalted(): boolean {
    return this.halted;
  }

  /** Trace output helper */
  private traceLog(msg: string): void {
    if (this.trace) {
      this.output(`[TRACE PC=${this.regs.pc}] ${msg}`);
    }
  }

  /**
   * Execute bytecode until HALT or error.
   * Returns the number of cycles consumed.
   */
  execute(): VMResult {
    this.halted = false;
    this.cycleCount = 0;

    try {
      while (!this.halted && this.cycleCount < this.maxCycles) {
        const pc = this.regs.pc;
        if (pc >= this.bytecode.length) break;

        const opByte = this.fetchU8();
        this.cycleCount++;

        const opInfo = ISA_TABLE.get(opByte);
        if (!opInfo) {
          throw new FluxVMError(
            VMError.InvalidOpcode,
            `Invalid opcode: 0x${opByte.toString(16).toUpperCase().padStart(2, '0')}`,
            pc,
            opByte,
          );
        }

        const fmt: InstructionFormat = opInfo.format;
        const rd = fmt !== 'A' && fmt !== 'C' ? this.fetchU8() : 0;
        let rs1 = 0, rs2 = 0, imm8 = 0, imm16 = 0;

        switch (fmt) {
          case 'C':
            imm8 = opByte & 0xFF; // Already read with fetchU8, use directly
            // Re-read as proper imm8
            break;
          case 'B':
            // rd already fetched
            break;
          case 'D':
            imm8 = this.fetchU8();
            break;
          case 'E':
            rs1 = this.fetchU8();
            rs2 = this.fetchU8();
            break;
          case 'F':
            imm16 = this.fetchI16();
            break;
          case 'G':
            rs1 = this.fetchU8();
            imm16 = this.fetchI16();
            break;
        }

        this.executeInstruction(opByte, fmt, rd, rs1, rs2, imm8, imm16);
      }

      if (this.cycleCount >= this.maxCycles && !this.halted) {
        return {
          success: false,
          cycles: this.cycleCount,
          halted: false,
          error: `Cycle budget exceeded: ${this.maxCycles}`,
        };
      }

      return { success: true, cycles: this.cycleCount, halted: this.halted };
    } catch (e) {
      if (e instanceof FluxVMError) {
        return { success: false, cycles: this.cycleCount, halted: this.halted, error: e.message };
      }
      throw e;
    }
  }

  /** Execute a single decoded instruction */
  private executeInstruction(
    op: number,
    fmt: InstructionFormat,
    rd: number,
    rs1: number,
    rs2: number,
    imm8: number,
    imm16: number,
  ): void {
    // ═══════════════════════════════════════════════════
    // System Control (0x00-0x07)
    // ═══════════════════════════════════════════════════
    if (op === Op.HALT) {
      this.traceLog('HALT');
      this.halted = true;
      return;
    }
    if (op === Op.NOP) {
      this.traceLog('NOP');
      return;
    }
    if (op === Op.RET) {
      this.traceLog('RET');
      const retAddr = this.pop();
      this.regs.pc = retAddr;
      return;
    }
    if (op === Op.IRET) {
      this.traceLog('IRET');
      const retAddr = this.pop();
      this.regs.pc = retAddr;
      return;
    }
    if (op === Op.BRK) {
      this.traceLog('BRK');
      this.output(`[BREAKPOINT at PC=${this.regs.pc}]`);
      return;
    }
    if (op === Op.WFI) {
      this.traceLog('WFI');
      return; // No-op in single-threaded WASM
    }
    if (op === Op.RESET) {
      this.traceLog('RESET');
      this.regs.gp.fill(0);
      this.regs.fp.fill(0);
      this.regs.flagZero = false;
      this.regs.flagSign = false;
      this.regs.flagCarry = false;
      this.regs.flagOverflow = false;
      return;
    }
    if (op === Op.SYN) {
      this.traceLog('SYN');
      return; // Memory barrier — no-op in WASM
    }

    // ═══════════════════════════════════════════════════
    // Single Register (0x08-0x0F) — Format B
    // ═══════════════════════════════════════════════════
    if (op === Op.INC) {
      const r = (this.regs.readGP(rd) + 1) | 0;
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      this.traceLog(`INC R${rd} → ${r}`);
      return;
    }
    if (op === Op.DEC) {
      const r = (this.regs.readGP(rd) - 1) | 0;
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      this.traceLog(`DEC R${rd} → ${r}`);
      return;
    }
    if (op === Op.NOT) {
      const r = ~this.regs.readGP(rd);
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      this.traceLog(`NOT R${rd} → ${r}`);
      return;
    }
    if (op === Op.NEG) {
      const r = (-this.regs.readGP(rd)) | 0;
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      this.traceLog(`NEG R${rd} → ${r}`);
      return;
    }
    if (op === Op.PUSH) {
      this.push(this.regs.readGP(rd));
      this.traceLog(`PUSH R${rd}`);
      return;
    }
    if (op === Op.POP) {
      const val = this.pop();
      this.regs.writeGP(rd, val);
      this.traceLog(`POP → R${rd} = ${val}`);
      return;
    }

    // ═══════════════════════════════════════════════════
    // Immediate Only (0x10-0x17) — Format C
    // ═══════════════════════════════════════════════════
    if (op === Op.SYS) {
      this.traceLog(`SYS ${rd}`);
      this.handleSyscall(rd);
      return;
    }
    if (op === Op.DBG) {
      this.traceLog(`DBG R${rd}`);
      this.output(`[DBG] R${rd} = ${this.regs.readGP(rd)}`);
      return;
    }
    if (op === Op.YIELD) {
      this.traceLog('YIELD');
      return;
    }

    // ═══════════════════════════════════════════════════
    // Register + Imm8 (0x18-0x1F) — Format D
    // ═══════════════════════════════════════════════════
    if (op === Op.MOVI) {
      const val = imm8 > 127 ? imm8 - 256 : imm8;
      this.regs.writeGP(rd, val);
      this.traceLog(`MOVI R${rd}, ${val}`);
      return;
    }
    if (op === Op.ADDI) {
      const val = (this.regs.readGP(rd) + imm8) | 0;
      this.regs.writeGP(rd, val);
      this.regs.setFlags(val);
      this.traceLog(`ADDI R${rd}, ${imm8} → ${val}`);
      return;
    }
    if (op === Op.SUBI) {
      const val = (this.regs.readGP(rd) - imm8) | 0;
      this.regs.writeGP(rd, val);
      this.regs.setFlags(val);
      this.traceLog(`SUBI R${rd}, ${imm8} → ${val}`);
      return;
    }
    if (op === Op.MOVI16) {
      const val = imm16 > 32767 ? imm16 - 65536 : imm16;
      this.regs.writeGP(rd, val);
      this.traceLog(`MOVI16 R${rd}, ${val}`);
      return;
    }
    if (op === Op.ADDI16) {
      const val = (this.regs.readGP(rd) + imm16) | 0;
      this.regs.writeGP(rd, val);
      this.regs.setFlags(val);
      this.traceLog(`ADDI16 R${rd}, ${imm16} → ${val}`);
      return;
    }
    if (op === Op.SUBI16) {
      const val = (this.regs.readGP(rd) - imm16) | 0;
      this.regs.writeGP(rd, val);
      this.regs.setFlags(val);
      this.traceLog(`SUBI16 R${rd}, ${imm16} → ${val}`);
      return;
    }

    // ═══════════════════════════════════════════════════
    // Integer Arithmetic (0x20-0x2F) — Format E
    // ═══════════════════════════════════════════════════
    if (op === Op.ADD) {
      const a = this.regs.readGP(rs1);
      const b = this.regs.readGP(rs2);
      const r = (a + b) | 0;
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      return;
    }
    if (op === Op.SUB) {
      const a = this.regs.readGP(rs1);
      const b = this.regs.readGP(rs2);
      const r = (a - b) | 0;
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      return;
    }
    if (op === Op.MUL) {
      const a = this.regs.readGP(rs1);
      const b = this.regs.readGP(rs2);
      const r = Math.imul(a, b);
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      return;
    }
    if (op === Op.DIV) {
      const b = this.regs.readGP(rs2);
      if (b === 0) {
        throw new FluxVMError(VMError.DivisionByZero, 'Division by zero', this.regs.pc);
      }
      const a = this.regs.readGP(rs1);
      const r = (a / b) | 0;
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      return;
    }
    if (op === Op.MOD) {
      const b = this.regs.readGP(rs2);
      if (b === 0) {
        throw new FluxVMError(VMError.DivisionByZero, 'Modulo by zero', this.regs.pc);
      }
      const a = this.regs.readGP(rs1);
      const r = a % b;
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      return;
    }
    if (op === Op.AND) {
      const r = this.regs.readGP(rs1) & this.regs.readGP(rs2);
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      return;
    }
    if (op === Op.OR) {
      const r = this.regs.readGP(rs1) | this.regs.readGP(rs2);
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      return;
    }
    if (op === Op.XOR) {
      const r = this.regs.readGP(rs1) ^ this.regs.readGP(rs2);
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      return;
    }
    if (op === Op.SHL) {
      const r = this.regs.readGP(rs1) << (this.regs.readGP(rs2) & 31);
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      return;
    }
    if (op === Op.SHR) {
      const r = this.regs.readGP(rs1) >> (this.regs.readGP(rs2) & 31);
      this.regs.writeGP(rd, r);
      this.regs.setFlags(r);
      return;
    }
    if (op === Op.MIN) {
      const r = Math.min(this.regs.readGP(rs1), this.regs.readGP(rs2));
      this.regs.writeGP(rd, r);
      return;
    }
    if (op === Op.MAX) {
      const r = Math.max(this.regs.readGP(rs1), this.regs.readGP(rs2));
      this.regs.writeGP(rd, r);
      return;
    }
    if (op === Op.CMP_EQ) {
      this.regs.writeGP(rd, this.regs.readGP(rs1) === this.regs.readGP(rs2) ? 1 : 0);
      return;
    }
    if (op === Op.CMP_LT) {
      this.regs.writeGP(rd, this.regs.readGP(rs1) < this.regs.readGP(rs2) ? 1 : 0);
      return;
    }
    if (op === Op.CMP_GT) {
      this.regs.writeGP(rd, this.regs.readGP(rs1) > this.regs.readGP(rs2) ? 1 : 0);
      return;
    }
    if (op === Op.CMP_NE) {
      this.regs.writeGP(rd, this.regs.readGP(rs1) !== this.regs.readGP(rs2) ? 1 : 0);
      return;
    }

    // ═══════════════════════════════════════════════════
    // Float ops (0x30-0x35) — Format E
    // ═══════════════════════════════════════════════════
    if (op === Op.FADD) {
      this.regs.writeFP(rd, this.regs.readFP(rs1) + this.regs.readFP(rs2));
      return;
    }
    if (op === Op.FSUB) {
      this.regs.writeFP(rd, this.regs.readFP(rs1) - this.regs.readFP(rs2));
      return;
    }
    if (op === Op.FMUL) {
      this.regs.writeFP(rd, this.regs.readFP(rs1) * this.regs.readFP(rs2));
      return;
    }
    if (op === Op.FDIV) {
      this.regs.writeFP(rd, this.regs.readFP(rs1) / this.regs.readFP(rs2));
      return;
    }
    if (op === Op.FTOI) {
      this.regs.writeGP(rd, Math.trunc(this.regs.readFP(rs1)) | 0);
      return;
    }
    if (op === Op.ITOF) {
      this.regs.writeFP(rd, this.regs.readGP(rs1));
      return;
    }

    // ═══════════════════════════════════════════════════
    // Memory (0x38-0x39) — Format E
    // ═══════════════════════════════════════════════════
    if (op === Op.LOAD) {
      const addr = this.regs.readGP(rs1) + this.regs.readGP(rs2);
      const val = this.memRead32(addr);
      this.regs.writeGP(rd, val);
      this.traceLog(`LOAD R${rd}, [R${rs1}+R${rs2}] = 0x${addr.toString(16)} → ${val}`);
      return;
    }
    if (op === Op.STORE) {
      const addr = this.regs.readGP(rs1) + this.regs.readGP(rs2);
      this.memWrite32(addr, this.regs.readGP(rd));
      this.traceLog(`STORE [R${rs1}+R${rs2}] = 0x${addr.toString(16)} ← R${rd}`);
      return;
    }

    // ═══════════════════════════════════════════════════
    // Move / Control (0x3A-0x3F) — Format E
    // ═══════════════════════════════════════════════════
    if (op === Op.MOV) {
      this.regs.writeGP(rd, this.regs.readGP(rs1));
      return;
    }
    if (op === Op.SWP) {
      const a = this.regs.readGP(rd);
      const b = this.regs.readGP(rs1);
      this.regs.writeGP(rd, b);
      this.regs.writeGP(rs1, a);
      return;
    }
    if (op === Op.JZ) {
      if (this.regs.readGP(rd) === 0) {
        this.regs.pc += this.regs.readGP(rs1);
        this.traceLog(`JZ R${rd}=0 → PC += ${this.regs.readGP(rs1)}`);
      }
      return;
    }
    if (op === Op.JNZ) {
      if (this.regs.readGP(rd) !== 0) {
        this.regs.pc += this.regs.readGP(rs1);
        this.traceLog(`JNZ R${rd}=${this.regs.readGP(rd)} → PC += ${this.regs.readGP(rs1)}`);
      }
      return;
    }
    if (op === Op.JLT) {
      if (this.regs.readGP(rd) < 0) {
        this.regs.pc += this.regs.readGP(rs1);
      }
      return;
    }
    if (op === Op.JGT) {
      if (this.regs.readGP(rd) > 0) {
        this.regs.pc += this.regs.readGP(rs1);
      }
      return;
    }

    // ═══════════════════════════════════════════════════
    // Register + Imm16 (0x40-0x47) — Format F
    // ═══════════════════════════════════════════════════
    if (op === Op.JMP) {
      this.regs.pc += imm16;
      this.traceLog(`JMP ${imm16} → PC = ${this.regs.pc}`);
      return;
    }
    if (op === Op.JAL) {
      this.regs.writeGP(rd, this.regs.pc);
      this.regs.pc += imm16;
      this.traceLog(`JAL R${rd}, ${imm16}`);
      return;
    }
    if (op === Op.CALL) {
      this.push(this.regs.pc);
      this.regs.pc += imm16;
      this.traceLog(`CALL ${imm16} → PC = ${this.regs.pc}`);
      return;
    }
    if (op === Op.LOOP) {
      const val = (this.regs.readGP(rd) - 1) | 0;
      this.regs.writeGP(rd, val);
      if (val > 0) {
        this.regs.pc -= imm16;
      }
      this.traceLog(`LOOP R${rd}=${val}, ${imm16}`);
      return;
    }

    // ═══════════════════════════════════════════════════
    // Extended Memory (0x48-0x4F) — Format G
    // ═══════════════════════════════════════════════════
    if (op === Op.LOADOFF) {
      const addr = this.regs.readGP(rs1) + imm16;
      this.regs.writeGP(rd, this.memRead32(addr));
      return;
    }
    if (op === Op.STOREOF) {
      const addr = this.regs.readGP(rs1) + imm16;
      this.memWrite32(addr, this.regs.readGP(rd));
      return;
    }
    if (op === Op.FILL) {
      const startAddr = this.regs.readGP(rd);
      const fillVal = this.regs.readGP(rs1) & 0xFF;
      const count = imm16;
      for (let i = 0; i < count; i++) {
        this.memWrite8(startAddr + i, fillVal);
      }
      return;
    }

    // ═══════════════════════════════════════════════════
    // Extended Math (0x90-0x9F) — Format E
    // ═══════════════════════════════════════════════════
    if (op === Op.ABS) {
      this.regs.writeGP(rd, Math.abs(this.regs.readGP(rs1)));
      return;
    }
    if (op === Op.SQRT) {
      this.regs.writeFP(rd, Math.sqrt(this.regs.readFP(rs1)));
      return;
    }

    // ═══════════════════════════════════════════════════
    // Long jumps (0xE0-0xE4) — Format F
    // ═══════════════════════════════════════════════════
    if (op === Op.LJMP) {
      this.regs.pc += imm16;
      return;
    }
    if (op === Op.LJZ) {
      if (this.regs.readGP(rd) === 0) this.regs.pc += imm16;
      return;
    }
    if (op === Op.LJNZ) {
      if (this.regs.readGP(rd) !== 0) this.regs.pc += imm16;
      return;
    }
    if (op === Op.LJLT) {
      if (this.regs.readGP(rd) < 0) this.regs.pc += imm16;
      return;
    }
    if (op === Op.LJGT) {
      if (this.regs.readGP(rd) > 0) this.regs.pc += imm16;
      return;
    }
    if (op === Op.LCALL) {
      this.push(this.regs.pc);
      this.regs.pc += imm16;
      return;
    }

    // ═══════════════════════════════════════════════════
    // System/Debug (0xF0-0xFF) — Format A
    // ═══════════════════════════════════════════════════
    if (op === Op.PRINT) {
      this.output(`R0=${this.regs.readGP(0)} R1=${this.regs.readGP(1)} R2=${this.regs.readGP(2)} R3=${this.regs.readGP(3)}`);
      return;
    }
    if (op === Op.PANIC) {
      this.output(`[PANIC at PC=${this.regs.pc}]`);
      this.halted = true;
      return;
    }
    if (op === Op.VER) {
      this.regs.writeGP(0, 3); // ISA v3
      return;
    }

    // ═══════════════════════════════════════════════════
    // Unimplemented opcodes — NOP with trace warning
    // ═══════════════════════════════════════════════════
    this.traceLog(`NOP (unimplemented: 0x${op.toString(16).padStart(2, '0')} ${opMnemonic(op)})`);
  }

  /** Handle SYS calls */
  private handleSyscall(code: number): void {
    switch (code) {
      case 0: {
        // SYS 0: Print R0 as integer
        this.output(String(this.regs.readGP(0)));
        break;
      }
      case 1: {
        // SYS 1: Print R0 as char
        this.output(String.fromCharCode(this.regs.readGP(0) & 0xFF));
        break;
      }
      case 2: {
        // SYS 2: Print R0,R1 as string (R0=start, R1=length)
        const start = this.regs.readGP(0);
        const len = this.regs.readGP(1);
        let s = '';
        for (let i = 0; i < len; i++) {
          s += String.fromCharCode(this.memRead8(start + i));
        }
        this.output(s);
        break;
      }
      case 3: {
        // SYS 3: Print all GP registers
        const lines: string[] = [];
        for (let i = 0; i < 16; i++) {
          const v = this.regs.readGP(i);
          if (v !== 0) lines.push(`R${i}=${v}`);
        }
        this.output(lines.length ? lines.join(' ') : '(all registers zero)');
        break;
      }
      default:
        this.traceLog(`SYS ${code} (unknown syscall)`);
    }
  }

  /** Dump VM state for debugging */
  dump(): string {
    const lines: string[] = [
      `=== FLUX VM State ===`,
      `PC: ${this.regs.pc}  SP: ${this.stackPtr}  Cycles: ${this.cycleCount}`,
      `Halted: ${this.halted}`,
      `Flags: Z=${this.regs.flagZero ? 1 : 0} S=${this.regs.flagSign ? 1 : 0}`,
    ];

    // Show non-zero GP registers
    const gpRegs: string[] = [];
    for (let i = 0; i < 256; i++) {
      const v = this.regs.readGP(i);
      if (v !== 0) gpRegs.push(`R${i}=${v}`);
    }
    lines.push(`GP: ${gpRegs.length ? gpRegs.join(' ') : '(all zero)'}`);

    // Show stack
    if (this.stackPtr > 0) {
      lines.push(`Stack (${this.stackPtr}):`);
      for (let i = Math.max(0, this.stackPtr - 8); i < this.stackPtr; i++) {
        lines.push(`  [${i}] = ${this.stack[i]}`);
      }
    }

    return lines.join('\n');
  }

  /** Export state as a serializable object */
  exportState(): object {
    return {
      pc: this.regs.pc,
      gp: Array.from(this.regs.gp.slice(0, 32)), // First 32 registers
      fp: Array.from(this.regs.fp.slice(0, 8)),
      halted: this.halted,
      cycles: this.cycleCount,
      stackDepth: this.stackPtr,
    };
  }
}
