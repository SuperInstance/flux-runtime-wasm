<p align="center">
  <pre>
     ██████╗ ██████╗ ██████╗ ███████╗
     ██╔══██╗██╔═══╝ ██╔══██╗██╔════╝
     ██████╔╝██║     ██║  ██║█████╗
     ██╔═══╝ ██║     ██║  ██║██╔══╝
     ██║     ╚██████╗██████╔╝███████╗
     ╚═╝      ╚═════╝╚═════╝ ╚══════╝

     Fluid Language Universal eXecution
  </pre>
  <p><strong>FLUX VM — WebAssembly Runtime</strong></p>
  <p>
    <code>npm install @superinstance/flux-runtime-wasm</code> &nbsp;·&nbsp;
    <a href="https://github.com/SuperInstance/flux-runtime-wasm">GitHub</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/typescript-5.3+-blue.svg" alt="TypeScript 5.3+">
    <img src="https://img.shields.io/badge/tests-35+brightgreen.svg" alt="Tests: 35+">
    <img src="https://img.shields.io/badge/deps-0-success.svg" alt="Runtime Dependencies: 0">
    <img src="https://img.shields.io/badge/opcodes-160+-orange.svg" alt="Opcodes: 160+">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  </p>
</p>

---

## What is flux-runtime-wasm?

**flux-runtime-wasm** is the WebAssembly port of the [FLUX runtime](https://github.com/SuperInstance/flux-runtime). It implements the complete FLUX bytecode virtual machine in TypeScript, designed for compilation to WASM and execution in browsers, edge workers, and serverless environments.

FLUX is a **markdown-to-bytecode runtime** — you write structured markdown files containing assembly code blocks, and the FLUX compiler produces optimized bytecode that runs on a register-based Micro-VM.

This package is part of the SuperInstance FLUX fleet, alongside:
- **[flux-runtime](https://github.com/SuperInstance/flux-runtime)** — Python reference implementation (2037 tests, zero deps)
- **[flux-core](https://github.com/SuperInstance/flux-core)** — Rust crate (zero deps, ~100ns per execution)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  flux-runtime-wasm (TypeScript → WASM)              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  .flux / .md files                                  │
│       │                                             │
│       ▼                                             │
│  ┌──────────────┐    ┌──────────────────────────┐  │
│  │  Compiler     │───▶│  Bytecode (Uint8Array)   │  │
│  │  (markdown →  │    └──────────┬───────────────┘  │
│  │   assembly →  │               │                  │
│  │   bytecode)   │               ▼                  │
│  └──────────────┘    ┌──────────────────────────┐  │
│                       │  FLUX VM                 │  │
│                       │  ┌───────────────────┐  │  │
│                       │  │ 256 GP registers   │  │  │
│                       │  │ 256 FP registers   │  │  │
│                       │  │ 64KB memory        │  │  │
│                       │  │ Call stack (4K)    │  │  │
│                       │  │ 160+ opcodes       │  │  │
│                       │  └───────────────────┘  │  │
│                       └──────────────────────────┘  │
│                                                     │
│  Target: WASM (Emscripten / AssemblyScript)          │
│  Also runs: Node.js 18+ / Browser (direct)          │
└─────────────────────────────────────────────────────┘
```

### ISA v3 — Unified Opcode Space

160+ opcodes organized by format and function:

| Range | Format | Category |
|-------|--------|----------|
| `0x00-0x07` | A | System control / debug |
| `0x08-0x0F` | B | Single-register ops (INC, DEC, PUSH, POP) |
| `0x10-0x17` | C | Immediate-only (SYS, YIELD) |
| `0x18-0x1F` | D | Register + imm8 (MOVI, ADDI) |
| `0x20-0x2F` | E | Integer arithmetic (ADD, SUB, MUL, DIV) |
| `0x30-0x3F` | E | Float, memory, control (LOAD, STORE, MOV) |
| `0x40-0x47` | F | Register + imm16 (JMP, CALL, MOVI16) |
| `0x48-0x4F` | G | Register + register + imm16 |
| `0x50-0x5F` | E | Agent-to-Agent fleet ops (TELL, ASK, BCAST) |
| `0x60-0x6F` | E | Confidence-aware variants |
| `0x70-0x7F` | E | Viewpoint ops (Babel) |
| `0x80-0x8F` | E | Biology/sensor ops (JetsonClaw1) |
| `0x90-0x9F` | E | Extended math/crypto (ABS, SQRT, HASH) |
| `0xA0-0xAF` | D | String/collection ops |
| `0xB0-0xBF` | E | Vector/SIMD ops |
| `0xC0-0xCF` | E | Tensor/neural ops |
| `0xD0-0xDF` | G | Extended memory/mapped I/O |
| `0xE0-0xEF` | F | Long jumps/calls |
| `0xF0-0xFF` | A | Extended system/debug (PRINT, PANIC) |

## Quick Start

```bash
npm install @superinstance/flux-runtime-wasm
```

### Compile and Run

```typescript
import { compileAndRun } from '@superinstance/flux-runtime-wasm';

const result = compileAndRun(`
# Hello World
\`\`\`flux
MOVI R0, 42
SYS 0
HALT
\`\`\`
`);

console.log(result.output); // ['42']
```

### Use the VM Directly

```typescript
import { FluxVM, FluxCompiler, Op } from '@superinstance/flux-runtime-wasm';

// Build bytecode manually
const vm = new FluxVM({
  output: (msg) => console.log(msg),
});

vm.load([
  Op.MOVI, 0, 10,
  Op.MOVI, 1, 32,
  Op.ADD, 0, 0, 1,
  Op.SYS, 0,
  Op.HALT,
]);

const result = vm.execute();
console.log(vm.readGP(0)); // 42
```

### Use the Compiler

```typescript
import { FluxCompiler, FluxVM, disassemble } from '@superinstance/flux-runtime-wasm';

const compiler = new FluxCompiler();
const { bytecode, metadata } = compiler.compile(`
# My Program
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
\`\`\`
`);

// Disassemble
console.log(disassemble(bytecode));

// Execute
const vm = new FluxVM({ output: console.log });
vm.load(bytecode);
vm.execute(); // prints: 55
```

## FLUX Assembly Reference

### Instruction Formats

| Format | Size | Encoding | Example |
|--------|------|----------|---------|
| A | 1B | `[op]` | `HALT`, `NOP` |
| B | 2B | `[op][rd]` | `INC R0`, `PUSH R1` |
| C | 2B | `[op][imm8]` | `SYS 0`, `YIELD 1` |
| D | 3B | `[op][rd][imm8]` | `MOVI R0, 42` |
| E | 4B | `[op][rd][rs1][rs2]` | `ADD R0, R1, R2` |
| F | 4B | `[op][rd][imm16]` | `JMP R0, label` |
| G | 5B | `[op][rd][rs1][imm16]` | `LOADOFF R0, R1, 100` |

### Core Instructions

```
; Data movement
MOVI  R0, 42         ; Load immediate
MOV   R0, R1, 0      ; Copy register (Format E)
PUSH  R0             ; Push to stack
POP   R0             ; Pop from stack

; Arithmetic
ADD   R0, R1, R2     ; R0 = R1 + R2
SUB   R0, R1, R2     ; R0 = R1 - R2
MUL   R0, R1, R2     ; R0 = R1 * R2
DIV   R0, R1, R2     ; R0 = R1 / R2
INC   R0             ; R0++
DEC   R0             ; R0--

; Comparison
CMP_EQ R0, R1, R2   ; R0 = (R1 == R2) ? 1 : 0
CMP_GT R0, R1, R2   ; R0 = (R1 > R2) ? 1 : 0
CMP_LT R0, R1, R2   ; R0 = (R1 < R2) ? 1 : 0

; Control flow
JMP   R0, label      ; Unconditional jump (Format F)
JNZ   R0, label      ; Jump if R0 != 0 (auto-upgrades to LJNZ)
JZ    R0, label      ; Jump if R0 == 0 (auto-upgrades to LJZ)
CALL  R0, label      ; Call subroutine
RET                  ; Return from subroutine

; Memory
LOAD  R0, R1, R2     ; R0 = mem[R1 + R2]
STORE R0, R1, R2     ; mem[R1 + R2] = R0

; System
SYS   0              ; Print R0 as integer
SYS   1              ; Print R0 as character
HALT                 ; Stop execution
```

## Examples

### Hello World

```flux
MOVI R0, 42
SYS 0
HALT
```

### Loop: Sum 1 to 10

```flux
MOVI R0, 0         ; sum = 0
MOVI R1, 1         ; counter = 1
MOVI R2, 10        ; limit = 10
loop:
ADD R0, R0, R1     ; sum += counter
INC R1             ; counter++
CMP_GT R3, R1, R2  ; R3 = (counter > limit)
JZ R3, loop        ; if not exceeded, loop
SYS 0              ; print sum (55)
HALT
```

### Fibonacci(10) = 55

```flux
MOVI R0, 10        ; N = 10
MOVI R1, 0         ; a = 0
MOVI R2, 1         ; b = 1
MOVI R4, 1         ; counter = 1
loop:
CMP_GT R3, R4, R0  ; counter > N?
JNZ R3, done       ; exit if so
ADD R3, R1, R2     ; temp = a + b
MOV R1, R2, 0      ; a = b
MOV R2, R3, 0      ; b = temp
INC R4             ; counter++
JMP R0, loop       ; repeat
done:
MOV R0, R2, 0      ; result = b
SYS 0
HALT
```

## Building

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run example
node dist/cli.js run examples/hello.flux
```

## WASM Compilation (Future)

The TypeScript source is designed for WASM compilation:

```bash
# Via AssemblyScript (planned)
npm run build:wasm

# Via Emscripten (planned)  
npm run build:emscripten
```

## Bytecode Compatibility

The bytecode format is **compatible** with the Rust [flux-core](https://github.com/SuperInstance/flux-core) crate where instruction formats overlap. The unified ISA v3 extends the original flux-core opcodes with:
- 256 register slots (vs 16 GP + 16 FP in flux-core)
- 160+ opcodes (vs 30+ in flux-core)
- Confidence-aware instruction variants
- Agent-to-Agent protocol opcodes
- Extended math, crypto, and tensor operations

## License

MIT — SuperInstance (DiGennaro et al.)
