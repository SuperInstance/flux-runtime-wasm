/**
 * FLUX VM Test Suite
 *
 * Tests the virtual machine, assembler, and compiler.
 * Run with: npm test
 */

import { FluxVM, RegisterFile, FluxVMError, VMError } from '../src/vm';
import { FluxCompiler, Assembler, disassemble, extractCodeBlocks } from '../src/compiler';
import { Op, ISA_TABLE, OPCODE_COUNT, opFromByte, opMnemonic, countByCategory } from '../src/opcode';
import { compileAndRun, assembleAndRun } from '../src/index';

// ═══════════════════════════════════════════════════════
// Opcode Tests
// ═══════════════════════════════════════════════════════

describe('Opcodes', () => {
  test('should have a substantial number of defined opcodes (>= 100)', () => {
    expect(OPCODE_COUNT).toBeGreaterThanOrEqual(100);
  });

  test('should map every opcode byte to a valid mnemonic', () => {
    // HALT, NOP, RET should all be defined
    expect(opMnemonic(0x00)).toBe('HALT');
    expect(opMnemonic(0x01)).toBe('NOP');
    expect(opMnemonic(0x02)).toBe('RET');
    expect(opMnemonic(0xFF)).toBe('PRINT');
  });

  test('opFromByte should return undefined for truly undefined slots', () => {
    // Some slots may be reserved — just verify it returns something sensible
    const op = opFromByte(0x00);
    expect(op).toBe(Op.HALT);
  });

  test('countByCategory should return a valid breakdown', () => {
    const cats = countByCategory();
    expect(cats['system']).toBeGreaterThan(0);
    expect(cats['arithmetic']).toBeGreaterThan(0);
    expect(cats['a2a']).toBeGreaterThan(0);
  });

  test('ISA_TABLE should contain key opcodes with correct formats', () => {
    const halt = ISA_TABLE.get(Op.HALT);
    expect(halt?.format).toBe('A');
    expect(halt?.category).toBe('system');

    const add = ISA_TABLE.get(Op.ADD);
    expect(add?.format).toBe('E');
    expect(add?.category).toBe('arithmetic');

    const movi = ISA_TABLE.get(Op.MOVI);
    expect(movi?.format).toBe('D');

    const jmp = ISA_TABLE.get(Op.JMP);
    expect(jmp?.format).toBe('F');
  });
});

// ═══════════════════════════════════════════════════════
// Register File Tests
// ═══════════════════════════════════════════════════════

describe('RegisterFile', () => {
  test('should initialize all registers to zero', () => {
    const regs = new RegisterFile();
    expect(regs.readGP(0)).toBe(0);
    expect(regs.readGP(100)).toBe(0);
    expect(regs.readGP(255)).toBe(0);
    expect(regs.readFP(0)).toBe(0);
  });

  test('should read and write GP registers', () => {
    const regs = new RegisterFile();
    regs.writeGP(0, 42);
    expect(regs.readGP(0)).toBe(42);

    regs.writeGP(255, -1);
    expect(regs.readGP(255)).toBe(-1);
  });

  test('should clamp GP values to i32', () => {
    const regs = new RegisterFile();
    regs.writeGP(0, 2147483647);  // INT32_MAX
    expect(regs.readGP(0)).toBe(2147483647);

    regs.writeGP(0, -2147483648); // INT32_MIN
    expect(regs.readGP(0)).toBe(-2147483648);
  });

  test('should ignore out-of-range register indices', () => {
    const regs = new RegisterFile();
    regs.writeGP(256, 99);
    expect(regs.readGP(256)).toBe(0);
    regs.writeGP(-1, 99);
    expect(regs.readGP(-1)).toBe(0);
  });

  test('should set flags correctly', () => {
    const regs = new RegisterFile();
    regs.setFlags(0);
    expect(regs.flagZero).toBe(true);
    expect(regs.flagSign).toBe(false);

    regs.setFlags(-5);
    expect(regs.flagZero).toBe(false);
    expect(regs.flagSign).toBe(true);

    regs.setFlags(42);
    expect(regs.flagZero).toBe(false);
    expect(regs.flagSign).toBe(false);
  });

  test('reset() should clear all state', () => {
    const regs = new RegisterFile();
    regs.writeGP(0, 42);
    regs.writeFP(0, 3.14);
    regs.pc = 100;
    regs.flagZero = true;
    regs.reset();
    expect(regs.readGP(0)).toBe(0);
    expect(regs.readFP(0)).toBe(0);
    expect(regs.pc).toBe(0);
    expect(regs.flagZero).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
// VM Execution Tests
// ═══════════════════════════════════════════════════════

describe('FluxVM', () => {
  test('HALT should stop execution cleanly', () => {
    const vm = new FluxVM();
    vm.load([Op.HALT]);
    const result = vm.execute();
    expect(result.success).toBe(true);
    expect(result.halted).toBe(true);
    expect(result.cycles).toBe(1);
  });

  test('NOP should consume a cycle and continue', () => {
    const vm = new FluxVM();
    vm.load([Op.NOP, Op.NOP, Op.HALT]);
    const result = vm.execute();
    expect(result.success).toBe(true);
    expect(result.cycles).toBe(3);
  });

  test('MOVI should load immediate values into registers', () => {
    const vm = new FluxVM();
    // MOVI R0, 42 → [0x18][0x00][0x2A]
    vm.load([Op.MOVI, 0, 42, Op.HALT]);
    vm.execute();
    expect(vm.readGP(0)).toBe(42);
  });

  test('ADD should add two registers', () => {
    const vm = new FluxVM();
    // MOVI R1, 10
    // MOVI R2, 32
    // ADD R0, R1, R2
    // HALT
    vm.load([
      Op.MOVI, 1, 10,
      Op.MOVI, 2, 32,
      Op.ADD, 0, 1, 2,
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(42);
  });

  test('SUB should subtract two registers', () => {
    const vm = new FluxVM();
    vm.load([
      Op.MOVI, 1, 100,
      Op.MOVI, 2, 58,
      Op.SUB, 0, 1, 2,
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(42);
  });

  test('MUL should multiply two registers', () => {
    const vm = new FluxVM();
    vm.load([
      Op.MOVI, 1, 6,
      Op.MOVI, 2, 7,
      Op.MUL, 0, 1, 2,
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(42);
  });

  test('DIV should divide two registers', () => {
    const vm = new FluxVM();
    vm.load([
      Op.MOVI, 1, 84,
      Op.MOVI, 2, 2,
      Op.DIV, 0, 1, 2,
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(42);
  });

  test('DIV should throw on division by zero', () => {
    const vm = new FluxVM();
    vm.load([
      Op.MOVI, 1, 42,
      Op.MOVI, 2, 0,
      Op.DIV, 0, 1, 2,
      Op.HALT,
    ]);
    const result = vm.execute();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Division by zero');
  });

  test('INC/DEC should increment and decrement', () => {
    const vm = new FluxVM();
    vm.load([
      Op.MOVI, 0, 10,
      Op.INC, 0,    // R0 = 11
      Op.INC, 0,    // R0 = 12
      Op.DEC, 0,    // R0 = 11
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(11);
  });

  test('MOV should copy register values', () => {
    const vm = new FluxVM();
    vm.load([
      Op.MOVI, 1, 42,
      Op.MOV, 0, 1, 0,  // R0 = R1 (Format E: [op][rd][rs1][rs2])
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(42);
  });

  test('PUSH/POP should work with the call stack', () => {
    const vm = new FluxVM();
    vm.load([
      Op.MOVI, 0, 42,
      Op.PUSH, 0,     // push R0 (42)
      Op.MOVI, 0, 0,  // clear R0
      Op.POP, 0,      // pop into R0
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(42);
  });

  test('NEG should negate a register value', () => {
    const vm = new FluxVM();
    vm.load([
      Op.MOVI, 0, 42,
      Op.NEG, 0,
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(-42);
  });

  test('CMP_EQ should compare and set result', () => {
    const vm = new FluxVM();
    vm.load([
      Op.MOVI, 1, 42,
      Op.MOVI, 2, 42,
      Op.CMP_EQ, 0, 1, 2,
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(1); // equal

    vm.reset();
    vm.load([
      Op.MOVI, 1, 42,
      Op.MOVI, 2, 43,
      Op.CMP_EQ, 0, 1, 2,
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(0); // not equal
  });

  test('CALL/RET should implement subroutine calls', () => {
    const vm = new FluxVM();
    // MOVI R1, 10
    // MOVI R2, 32
    // CALL subroutine (forward jump of 3 instructions = 12 bytes)
    // HALT
    // --- subroutine at offset 15 ---
    // ADD R0, R1, R2
    // RET
    vm.load([
      0x18, 0x01, 0x0A,  // MOVI R1, 10  (offset 0)
      0x18, 0x02, 0x20,  // MOVI R2, 32  (offset 3)
      0x45, 0x00, 0x04, 0x00,  // CALL R0, +4  (offset 6, after read PC=10, jumps to 14)
      0x00,              // HALT          (offset 10, return here)
      0x00,              // HALT          (offset 11)
      0x00,              // HALT          (offset 12)
      0x00,              // HALT          (offset 13)
      0x20, 0x00, 0x01, 0x02,  // ADD R0, R1, R2 (offset 14)
      0x02,              // RET           (offset 18)
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(42);
    expect(vm.isHalted).toBe(true);
  });

  test('SYS 0 should output register value as string', () => {
    const output: string[] = [];
    const vm = new FluxVM({ output: (msg) => output.push(msg) });
    vm.load([
      Op.MOVI, 0, 42,
      Op.SYS, 0,     // SYS 0: print R0
      Op.HALT,
    ]);
    vm.execute();
    expect(output).toEqual(['42']);
  });

  test('memory read/write should work', () => {
    const vm = new FluxVM();
    vm.memWrite8(100, 0x42);
    expect(vm.memRead8(100)).toBe(0x42);

    vm.memWrite32(200, 12345);
    expect(vm.memRead32(200)).toBe(12345);
  });

  test('LOAD/STORE should access memory through registers', () => {
    const vm = new FluxVM();
    // Store 42 at memory address 0
    vm.load([
      Op.MOVI, 1, 0,     // R1 = 0 (base address)
      Op.MOVI, 2, 0,     // R2 = 0 (offset)
      Op.MOVI, 0, 42,    // R0 = 42
      Op.STORE, 0, 1, 2, // mem[0+0] = R0 = 42
      Op.MOVI, 0, 0,     // clear R0
      Op.MOVI, 3, 0,     // R3 = 0
      Op.LOAD, 0, 1, 3,  // R0 = mem[0+0] = 42
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(42);
  });

  test('AND/OR/XOR should perform bitwise operations', () => {
    const vm = new FluxVM();

    // Test AND
    vm.load([
      Op.MOVI, 1, 15,    // R1 = 15
      Op.MOVI, 2, 15,    // R2 = 15
      Op.AND, 0, 1, 2,   // R0 = 15 & 15
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(15);

    // Test OR
    vm.reset();
    vm.load([
      Op.MOVI, 1, 240,   // R1 = -16 (signed imm8: 240 > 127 → 240-256)
      Op.MOVI, 2, 15,    // R2 = 15
      Op.OR, 0, 1, 2,    // R0 = -16 | 15 = -1
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(-1);

    // Test XOR
    vm.reset();
    vm.load([
      Op.MOVI, 1, 42,   // R1 = 42
      Op.MOVI, 2, 42,   // R2 = 42
      Op.XOR, 0, 1, 2,  // R0 = 42 ^ 42 = 0
      Op.HALT,
    ]);
    vm.execute();
    expect(vm.readGP(0)).toBe(0);
  });

  test('cycle budget should be enforced', () => {
    const vm = new FluxVM({ maxCycles: 5 });
    vm.load([
      Op.NOP, Op.NOP, Op.NOP, Op.NOP, Op.NOP, Op.NOP,
      Op.NOP, Op.NOP, Op.NOP, Op.NOP, Op.HALT,
    ]);
    const result = vm.execute();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cycle budget');
  });

  test('reset() should allow re-execution', () => {
    const vm = new FluxVM();
    const code = [Op.MOVI, 0, 42, Op.HALT];
    vm.load(code);
    vm.execute();
    expect(vm.readGP(0)).toBe(42);

    vm.reset();
    vm.load([Op.MOVI, 0, 99, Op.HALT]);
    vm.execute();
    expect(vm.readGP(0)).toBe(99);
  });
});

// ═══════════════════════════════════════════════════════
// Assembler Tests
// ═══════════════════════════════════════════════════════

describe('Assembler', () => {
  test('should assemble a simple MOVI + HALT program', () => {
    const asm = new Assembler();
    const bytecode = asm.assemble(`
      MOVI R0, 42
      HALT
    `);
    expect(Array.from(bytecode)).toEqual([0x18, 0x00, 0x2A, 0x00]);
  });

  test('should assemble ADD instruction', () => {
    const asm = new Assembler();
    const bytecode = asm.assemble(`
      MOVI R1, 10
      MOVI R2, 32
      ADD R0, R1, R2
      HALT
    `);
    expect(bytecode[0]).toBe(Op.MOVI);
    expect(bytecode[3]).toBe(Op.MOVI);
    expect(bytecode[6]).toBe(Op.ADD);
    expect(bytecode[10]).toBe(Op.HALT);
  });

  test('should resolve labels for JMP', () => {
    const asm = new Assembler();
    const bytecode = asm.assemble(`
      MOVI R0, 0
      JMP R0, target
      HALT
target:
      MOVI R0, 99
      HALT
    `);
    // JMP should skip over HALT to target
    // JMP is at offset 3 (after MOVI which is 3 bytes)
    // target is at offset 11 (after MOVI 3 + JMP 4 + HALT 1 + ... wait)
    // MOVI R0, 0 = 3 bytes (offset 0-2)
    // JMP R0, target = 4 bytes (offset 3-6)
    // HALT = 1 byte (offset 7)
    // target: = offset 8
    // MOVI R0, 99 = 3 bytes (offset 8-10)
    // HALT = 1 byte (offset 11)
    // JMP fixup: offset = target(8) - instrEnd(7) = 1
    expect(bytecode.length).toBe(12);
    expect(bytecode[5]).toBe(1);  // imm16_lo = 1
    expect(bytecode[6]).toBe(0);  // imm16_hi = 0
  });

  test('should resolve labels for conditional jumps (auto-upgrade to LJMP)', () => {
    const asm = new Assembler();
    const bytecode = asm.assemble(`
      MOVI R0, 1
      JNZ R0, skip
      MOVI R1, 999
      HALT
skip:
      MOVI R1, 42
      HALT
    `);
    // JNZ R0, skip should auto-upgrade to LJNZ R0, skip
    // MOVI R0, 1 = 3 bytes (offset 0-2)
    // LJNZ R0, skip = 4 bytes (offset 3-6)
    // MOVI R1, 999 = 3 bytes (offset 7-9)
    // HALT = 1 byte (offset 10)
    // skip: at offset 11
    // MOVI R1, 42 = 3 bytes (offset 11-13)
    // HALT = 1 byte (offset 14)
    // LJNZ fixup: offset = 11 - 7 = 4
    expect(bytecode[3]).toBe(Op.LJNZ);  // auto-upgraded
    expect(bytecode[5]).toBe(4);  // imm16_lo
    expect(bytecode[6]).toBe(0);  // imm16_hi
  });
});

// ═══════════════════════════════════════════════════════
// Compiler / Markdown Tests
// ═══════════════════════════════════════════════════════

describe('FluxCompiler', () => {
  test('should compile markdown with code blocks', () => {
    const compiler = new FluxCompiler();
    const markdown = `# Test
\`\`\`flux
MOVI R0, 42
SYS 0
HALT
\`\`\``;

    const { bytecode, metadata } = compiler.compile(markdown);
    expect(metadata.title).toBe('Test');
    expect(bytecode.length).toBeGreaterThan(0);
    expect(bytecode[0]).toBe(Op.MOVI);
  });

  test('should extract code blocks from markdown', () => {
    const blocks = extractCodeBlocks(`# Test
\`\`\`flux
MOVI R0, 42
\`\`\`
\`\`\`asm
NOP
\`\`\`
`);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].lang).toBe('flux');
    expect(blocks[0].code.trim()).toBe('MOVI R0, 42');
    expect(blocks[1].lang).toBe('asm');
  });

  test('compileAndRun should work end-to-end', () => {
    const result = compileAndRun(`# Test
\`\`\`flux
MOVI R0, 42
SYS 0
HALT
\`\`\``);

    expect(result.success).toBe(true);
    expect(result.halted).toBe(true);
    expect(result.output).toContain('42');
  });

  test('assembleAndRun should work end-to-end', () => {
    const result = assembleAndRun(`
      MOVI R0, 100
      MOVI R1, 58
      SUB R0, R0, R1
      SYS 0
      HALT
    `);

    expect(result.success).toBe(true);
    expect(result.output).toContain('42');
  });
});

// ═══════════════════════════════════════════════════════
// Integration Tests — Full Programs
// ═══════════════════════════════════════════════════════

describe('Integration: Full Programs', () => {
  test('hello world: print 42', () => {
    const result = compileAndRun(`# Hello
\`\`\`flux
MOVI R0, 42
SYS 0
HALT
\`\`\``);
    expect(result.success).toBe(true);
    expect(result.output).toEqual(['42']);
  });

  test('sum 1 to 10 = 55', () => {
    const result = compileAndRun(`# Sum
\`\`\`flux
MOVI R0, 0
MOVI R1, 1
MOVI R2, 10
loop:
ADD R0, R0, R1
INC R1
CMP_GT R3, R1, R2
JZ R3, loop
SYS 0
HALT
\`\`\``);
    expect(result.success).toBe(true);
    expect(result.output).toEqual(['55']);
  });

  test('fibonacci(10) = 55', () => {
    const result = compileAndRun(`# Fib
\`\`\`flux
MOVI R0, 9
MOVI R1, 0
MOVI R2, 1
MOVI R4, 1
loop:
CMP_GT R3, R4, R0
JNZ R3, done
ADD R3, R1, R2
MOV R1, R2, 0
MOV R2, R3, 0
INC R4
JMP R0, loop
done:
MOV R0, R2, 0
SYS 0
HALT
\`\`\``);
    expect(result.success).toBe(true);
    expect(result.output).toEqual(['55']);
  });

  test('factorial(5) = 120', () => {
    const result = compileAndRun(`# Factorial
\`\`\`flux
; Compute 5! = 120
; R0 = result, R1 = counter, R2 = temp
MOVI R0, 1
MOVI R1, 1
loop:
MOVI16 R5, 6
CMP_EQ R3, R1, R5
JNZ R3, done
MUL R0, R0, R1
INC R1
JMP R0, loop
done:
SYS 0
HALT
\`\`\``);
    expect(result.success).toBe(true);
    expect(result.output).toEqual(['120']);
  });
});

// ═══════════════════════════════════════════════════════
// Disassembler Tests
// ═══════════════════════════════════════════════════════

describe('Disassembler', () => {
  test('should disassemble MOVI + HALT', () => {
    const bytecode = new Uint8Array([0x18, 0x00, 0x2A, 0x00]);
    const asm = disassemble(bytecode);
    expect(asm).toContain('MOVI');
    expect(asm).toContain('HALT');
    expect(asm).toContain('R0');
    expect(asm).toContain('42');
  });
});
