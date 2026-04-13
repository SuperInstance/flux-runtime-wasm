/**
 * FLUX Unified ISA — Complete Opcode Table (v3)
 *
 * Three agents, one ISA. The converged opcode space:
 *   Oracle1 🔮: 115 base opcodes (Python runtime, semantic layer)
 *   JetsonClaw1 ⚡: 128 opcodes (C runtime, hardware layer)
 *   Babel 🌐: 120 opcodes (multilingual layer)
 *
 * Encoding: Variable-length by FORMAT (A=1B through G=5B)
 * All multi-byte formats are little-endian for immediate fields.
 *
 * Opcode ranges:
 *   0x00-0x03  Format A  System control
 *   0x04-0x07  Format A  Interrupt/debug
 *   0x08-0x0F  Format B  Single register ops
 *   0x10-0x17  Format C  Immediate-only ops
 *   0x18-0x1F  Format D  Register + imm8
 *   0x20-0x2F  Format E  Integer arithmetic (3-reg)
 *   0x30-0x3F  Format E  Float/memory/control (3-reg)
 *   0x40-0x47  Format F  Register + imm16
 *   0x48-0x4F  Format G  Register + register + imm16
 *   0x50-0x5F  Format E  Agent-to-Agent (fleet ops)
 *   0x60-0x6F  Format E  Confidence-aware variants
 *   0x70-0x7F  Format E  Viewpoint ops (Babel)
 *   0x80-0x8F  Format E  Biology/sensor ops (JetsonClaw1)
 *   0x90-0x9F  Format E  Extended math/crypto
 *   0xA0-0xAF  Format D  String/collection ops
 *   0xB0-0xBF  Format E  Vector/SIMD ops
 *   0xC0-0xCF  Format E  Tensor/neural ops
 *   0xD0-0xDF  Format G  Extended memory/mapped I/O
 *   0xE0-0xEF  Format F  Long jumps/calls
 *   0xF0-0xFF  Format A  Extended system/debug
 */

/** Instruction format sizes in bytes */
export const FORMAT_SIZE: Record<string, number> = {
  A: 1,
  B: 2,
  C: 2,
  D: 3,
  E: 4,
  F: 4,
  G: 5,
};

/** Opcode categories for introspection */
export type OpcodeCategory =
  | 'system'
  | 'debug'
  | 'arithmetic'
  | 'logic'
  | 'shift'
  | 'compare'
  | 'move'
  | 'stack'
  | 'control'
  | 'memory'
  | 'float'
  | 'convert'
  | 'concurrency'
  | 'confidence'
  | 'a2a'
  | 'viewpoint'
  | 'biology'
  | 'crypto'
  | 'string'
  | 'simd'
  | 'tensor'
  | 'io'
  | 'reserved';

/** Instruction format type */
export type InstructionFormat = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/** Full opcode descriptor for introspection */
export interface OpcodeInfo {
  code: number;
  mnemonic: string;
  format: InstructionFormat;
  operands: string;
  description: string;
  category: OpcodeCategory;
  confidence: boolean;
}

/** The FLUX opcode enum — 247 defined opcodes + 9 reserved slots */
export enum Op {
  // ═══════════════════════════════════════════════════════
  // 0x00-0x03: Format A — System Control
  // ═══════════════════════════════════════════════════════
  HALT   = 0x00, // Stop execution
  NOP    = 0x01, // No operation (pipeline sync)
  RET    = 0x02, // Return from subroutine
  IRET   = 0x03, // Return from interrupt handler

  // ═══════════════════════════════════════════════════════
  // 0x04-0x07: Format A — Interrupt/Debug
  // ═══════════════════════════════════════════════════════
  BRK    = 0x04, // Breakpoint (trap to debugger)
  WFI    = 0x05, // Wait for interrupt (low-power idle)
  RESET  = 0x06, // Soft reset of register file
  SYN    = 0x07, // Memory barrier / synchronize

  // ═══════════════════════════════════════════════════════
  // 0x08-0x0F: Format B — Single Register
  // ═══════════════════════════════════════════════════════
  INC    = 0x08, // rd = rd + 1
  DEC    = 0x09, // rd = rd - 1
  NOT    = 0x0A, // rd = ~rd (bitwise NOT)
  NEG    = 0x0B, // rd = -rd (arithmetic negate)
  PUSH   = 0x0C, // Push rd onto stack
  POP    = 0x0D, // Pop stack into rd
  CONF_LD = 0x0E, // Load confidence register
  CONF_ST = 0x0F, // Store confidence register

  // ═══════════════════════════════════════════════════════
  // 0x10-0x17: Format C — Immediate Only
  // ═══════════════════════════════════════════════════════
  SYS    = 0x10, // System call imm8
  TRAP   = 0x11, // Software interrupt vector imm8
  DBG    = 0x12, // Debug print register imm8
  CLF    = 0x13, // Clear flags register bits imm8
  SEMA   = 0x14, // Semaphore operation imm8
  YIELD  = 0x15, // Yield execution for imm8 cycles
  CACHE  = 0x16, // Cache control (flush/invalidate)
  STRIPCF = 0x17, // Strip confidence from next imm8 ops

  // ═══════════════════════════════════════════════════════
  // 0x18-0x1F: Format D — Register + Imm8
  // ═══════════════════════════════════════════════════════
  MOVI   = 0x18, // rd = sign_extend(imm8)
  ADDI   = 0x19, // rd = rd + imm8
  SUBI   = 0x1A, // rd = rd - imm8
  ANDI   = 0x1B, // rd = rd & imm8
  ORI    = 0x1C, // rd = rd | imm8
  XORI   = 0x1D, // rd = rd ^ imm8
  SHLI   = 0x1E, // rd = rd << imm8
  SHRI   = 0x1F, // rd = rd >> imm8

  // ═══════════════════════════════════════════════════════
  // 0x20-0x2F: Format E — Integer Arithmetic (3-reg)
  // ═══════════════════════════════════════════════════════
  ADD    = 0x20, // rd = rs1 + rs2
  SUB    = 0x21, // rd = rs1 - rs2
  MUL    = 0x22, // rd = rs1 * rs2
  DIV    = 0x23, // rd = rs1 / rs2 (signed)
  MOD    = 0x24, // rd = rs1 % rs2
  AND    = 0x25, // rd = rs1 & rs2
  OR     = 0x26, // rd = rs1 | rs2
  XOR    = 0x27, // rd = rs1 ^ rs2
  SHL    = 0x28, // rd = rs1 << rs2
  SHR    = 0x29, // rd = rs1 >> rs2
  MIN    = 0x2A, // rd = min(rs1, rs2)
  MAX    = 0x2B, // rd = max(rs1, rs2)
  CMP_EQ = 0x2C, // rd = (rs1 == rs2) ? 1 : 0
  CMP_LT = 0x2D, // rd = (rs1 < rs2) ? 1 : 0
  CMP_GT = 0x2E, // rd = (rs1 > rs2) ? 1 : 0
  CMP_NE = 0x2F, // rd = (rs1 != rs2) ? 1 : 0

  // ═══════════════════════════════════════════════════════
  // 0x30-0x3F: Format E — Float, Memory, Control
  // ═══════════════════════════════════════════════════════
  FADD   = 0x30, // rd = f(rs1) + f(rs2)
  FSUB   = 0x31, // rd = f(rs1) - f(rs2)
  FMUL   = 0x32, // rd = f(rs1) * f(rs2)
  FDIV   = 0x33, // rd = f(rs1) / f(rs2)
  FMIN   = 0x34, // rd = fmin(rs1, rs2)
  FMAX   = 0x35, // rd = fmax(rs1, rs2)
  FTOI   = 0x36, // rd = int(f(rs1))
  ITOF   = 0x37, // rd = float(rs1)
  LOAD   = 0x38, // rd = mem[rs1 + rs2]
  STORE  = 0x39, // mem[rs1 + rs2] = rd
  MOV    = 0x3A, // rd = rs1
  SWP    = 0x3B, // swap(rd, rs1)
  JZ     = 0x3C, // if rd == 0: pc += rs1
  JNZ    = 0x3D, // if rd != 0: pc += rs1
  JLT    = 0x3E, // if rd < 0: pc += rs1
  JGT    = 0x3F, // if rd > 0: pc += rs1

  // ═══════════════════════════════════════════════════════
  // 0x40-0x47: Format F — Register + Imm16
  // ═══════════════════════════════════════════════════════
  MOVI16 = 0x40, // rd = imm16
  ADDI16 = 0x41, // rd = rd + imm16
  SUBI16 = 0x42, // rd = rd - imm16
  JMP    = 0x43, // pc += imm16 (relative)
  JAL    = 0x44, // rd = pc; pc += imm16
  CALL   = 0x45, // push(pc); pc = rd + imm16
  LOOP   = 0x46, // rd--; if rd > 0: pc -= imm16
  SELECT = 0x47, // pc += imm16 * rd (computed jump)

  // ═══════════════════════════════════════════════════════
  // 0x48-0x4F: Format G — Register + Register + Imm16
  // ═══════════════════════════════════════════════════════
  LOADOFF = 0x48, // rd = mem[rs1 + imm16]
  STOREOF = 0x49, // mem[rs1 + imm16] = rd
  LOADI   = 0x4A, // rd = mem[rs1] + imm16
  STOREI  = 0x4B, // mem[rs1 + imm16] = rd
  ENTER   = 0x4C, // push regs; sp -= imm16; rd=old_sp
  LEAVE   = 0x4D, // sp += imm16; pop regs; rd=ret
  COPY    = 0x4E, // memcpy(rd, rs1, imm16)
  FILL    = 0x4F, // memset(rd, rs1, imm16)

  // ═══════════════════════════════════════════════════════
  // 0x50-0x5F: Format E — Agent-to-Agent (Fleet Ops)
  // ═══════════════════════════════════════════════════════
  TELL    = 0x50, // Send rs2 to agent rs1, tag rd
  ASK     = 0x51, // Request rs2 from agent rs1, resp→rd
  DELEG   = 0x52, // Delegate task rs2 to agent rs1
  BCAST   = 0x53, // Broadcast rs2 to fleet, tag rd
  ACCEPT  = 0x54, // Accept delegated task, ctx→rd
  DECLINE = 0x55, // Decline task with reason rs2
  REPORT  = 0x56, // Report task status rs2 to rd
  MERGE   = 0x57, // Merge results from rs1,rs2→rd
  FORK    = 0x58, // Spawn child agent, state→rd
  JOIN    = 0x59, // Wait for child rs1, result→rd
  SIGNAL  = 0x5A, // Emit named signal rs2 on channel rd
  AWAIT   = 0x5B, // Wait for signal rs2, data→rd
  TRUST   = 0x5C, // Set trust level rs2 for agent rs1
  DISCOV  = 0x5D, // Discover fleet agents, list→rd
  STATUS  = 0x5E, // Query agent rs1 status, result→rd
  HEARTBT = 0x5F, // Emit heartbeat, load→rd

  // ═══════════════════════════════════════════════════════
  // 0x60-0x6F: Format E — Confidence-Aware Variants
  // ═══════════════════════════════════════════════════════
  CADD    = 0x60, // Conf-aware ADD
  CSUB    = 0x61, // Conf-aware SUB
  CMUL    = 0x62, // Conf-aware MUL
  CDIV    = 0x63, // Conf-aware DIV
  CMOD    = 0x64, // Conf-aware MOD
  CMOV    = 0x65, // Conf-aware MOV
  CLOAD   = 0x66, // Conf-aware LOAD
  CSTORE  = 0x67, // Conf-aware STORE
  CJZ     = 0x68, // Conf-aware JZ
  CJNZ    = 0x69, // Conf-aware JNZ
  CPUSH   = 0x6A, // Conf-aware PUSH
  CPOP    = 0x6B, // Conf-aware POP
  CCALL   = 0x6C, // Conf-aware CALL
  CRET    = 0x6D, // Conf-aware RET
  CCONF   = 0x6E, // Combine confidences
  CRES    = 0x6F, // Resolve confidence

  // ═══════════════════════════════════════════════════════
  // 0x70-0x7F: Format E — Viewpoint Ops (Babel)
  // ═══════════════════════════════════════════════════════
  VWLOAD  = 0x70, // Load viewpoint context
  VWSTORE = 0x71, // Store viewpoint context
  VSWITCH = 0x72, // Switch viewpoint
  VMERGE = 0x73, // Merge viewpoints
  VFILTER = 0x74, // Filter viewpoint
  VTRANS = 0x75, // Transform viewpoint
  VCREATE = 0x76, // Create viewpoint
  VDESTROY = 0x77, // Destroy viewpoint
  VQUERY = 0x78, // Query viewpoint
  VUPDATE = 0x79, // Update viewpoint
  VLOCK  = 0x7A, // Lock viewpoint
  VUNLOCK = 0x7B, // Unlock viewpoint
  VSHARE = 0x7C, // Share viewpoint across agents
  VRX    = 0x7D, // Receive viewpoint update
  VCONF  = 0x7E, // Viewpoint confidence
  _VRES7F = 0x7F, // Reserved (viewpoint)

  // ═══════════════════════════════════════════════════════
  // 0x80-0x8F: Format E — Biology/Sensor Ops (JetsonClaw1)
  // ═══════════════════════════════════════════════════════
  SREAD  = 0x80, // Read sensor channel
  SWRITE = 0x81, // Write sensor/actuator channel
  SADC   = 0x82, // Read ADC channel
  SDAC   = 0x83, // Write DAC channel
  SPWM   = 0x84, // Set PWM duty cycle
  SGPIO  = 0x85, // Read/write GPIO pin
  SSCAN  = 0x86, // Scan I2C/SPI bus
  SCAL   = 0x87, // Apply sensor calibration
  SDEBG  = 0x88, // Sensor debug dump
  SINTG  = 0x89, // Numerical integration
  SDERIV = 0x8A, // Numerical derivative
  SFILT  = 0x8B, // Apply digital filter
  STHRES = 0x8C, // Threshold compare
  SMUX   = 0x8D, // Multiplex sensor input
  SIRQ   = 0x8E, // Configure sensor interrupt
  _SRES8F = 0x8F, // Reserved (sensor)

  // ═══════════════════════════════════════════════════════
  // 0x90-0x9F: Format E — Extended Math/Crypto
  // ═══════════════════════════════════════════════════════
  ABS    = 0x90, // rd = |rs1|
  SQRT   = 0x91, // rd = sqrt(rs1)
  POW    = 0x92, // rd = rs1 ^ rs2
  LOGMATH    = 0x93, // rd = log(rs1)
  EXP    = 0x94, // rd = exp(rs1)
  SIN    = 0x95, // rd = sin(rs1)
  COS    = 0x96, // rd = cos(rs1)
  TAN    = 0x97, // rd = tan(rs1)
  ATAN2  = 0x98, // rd = atan2(rs1, rs2)
  FLOOR  = 0x99, // rd = floor(rs1)
  CEIL   = 0x9A, // rd = ceil(rs1)
  ROUND  = 0x9B, // rd = round(rs1)
  CLAMP  = 0x9C, // rd = clamp(rs1, rs2, rs3)
  LERP   = 0x9D, // rd = lerp(rs1, rs2, t)
  HASH   = 0x9E, // rd = hash(rs1)
  CRC32  = 0x9F, // rd = crc32(rs1, rs2)

  // ═══════════════════════════════════════════════════════
  // 0xA0-0xAF: Format D — String/Collection Ops
  // ═══════════════════════════════════════════════════════
  SLEN   = 0xA0, // rd = strlen(rd)
  SCHAR  = 0xA1, // rd = char at index imm8
  SCAT   = 0xA2, // Concatenate string
  SSUB   = 0xA3, // Substring
  SFIND  = 0xA4, // Find substring
  SCMP   = 0xA5, // String compare
  SPLIT  = 0xA6, // Split string
  SJOIN  = 0xA7, // Join collection
  ARLEN  = 0xA8, // Array length
  ARGET  = 0xA9, // Array get
  ARSET  = 0xAA, // Array set
  ARPOP  = 0xAB, // Array pop
  ARPUSH = 0xAC, // Array push
  MAPNEW = 0xAD, // Map/new object
  MAPGET = 0xAE, // Map get key
  MAPSET = 0xAF, // Map set key

  // ═══════════════════════════════════════════════════════
  // 0xB0-0xBF: Format E — Vector/SIMD Ops
  // ═══════════════════════════════════════════════════════
  VADD   = 0xB0, // Vector add
  VSUB   = 0xB1, // Vector sub
  VMUL   = 0xB2, // Vector mul
  VDOT   = 0xB3, // Dot product
  VCROSS = 0xB4, // Cross product
  VLEN   = 0xB5, // Vector length
  VNORM  = 0xB6, // Vector normalize
  VLERP  = 0xB7, // Vector lerp
  VVLOAD  = 0xB8, // Vector load
  VVSTORE = 0xB9, // Vector store
  VMASK  = 0xBA, // Vector mask load
  VSCAT  = 0xBB, // Vector scatter
  VRED   = 0xBC, // Vector reduce
  VSHUF  = 0xBD, // Vector shuffle
  VBROAD = 0xBE, // Vector broadcast
  _VRESBF = 0xBF, // Reserved (vector)

  // ═══════════════════════════════════════════════════════
  // 0xC0-0xCF: Format E — Tensor/Neural Ops
  // ═══════════════════════════════════════════════════════
  TNEW   = 0xC0, // Allocate tensor
  TSHAPE = 0xC1, // Get tensor shape
  TGET   = 0xC2, // Tensor element get
  TSET   = 0xC3, // Tensor element set
  TMATMUL = 0xC4, // Matrix multiply
  TTRANS  = 0xC5, // Transpose
  TCONV   = 0xC6, // 2D convolution
  TPOOL   = 0xC7, // Pooling (max/avg)
  TACT    = 0xC8, // Activation function
  TNORM   = 0xC9, // Batch normalize
  TDROP   = 0xCA, // Dropout
  TSOFTMX = 0xCB, // Softmax
  TRELU   = 0xCC, // ReLU
  TSIGM   = 0xCD, // Sigmoid
  TTANH   = 0xCE, // Tanh
  _TRESCF = 0xCF, // Reserved (tensor)

  // ═══════════════════════════════════════════════════════
  // 0xD0-0xDF: Format G — Extended Memory/Mapped I/O
  // ═══════════════════════════════════════════════════════
  MIO_RD = 0xD0, // Memory-mapped I/O read
  MIO_WR = 0xD1, // Memory-mapped I/O write
  MIO_CFG = 0xD2, // MIO configuration
  DMA_XFR = 0xD3, // DMA transfer
  DMA_WAIT = 0xD4, // Wait for DMA complete
  PG_LOAD = 0xD5, // Page load
  PG_STORE = 0xD6, // Page store
  PG_MAP  = 0xD7, // Page map
  PG_UNMAP = 0xD8, // Page unmap
  PG_PROT = 0xD9, // Page protection
  HEAP_ALC = 0xDA, // Heap allocate
  HEAP_FRE = 0xDB, // Heap free
  HEAP_RES = 0xDC, // Heap resize
  HEAP_INF = 0xDD, // Heap info
  IO_INP  = 0xDE, // Port input
  IO_OUT  = 0xDF, // Port output

  // ═══════════════════════════════════════════════════════
  // 0xE0-0xEF: Format F — Long Jumps/Calls
  // ═══════════════════════════════════════════════════════
  LJMP   = 0xE0, // Long jump (imm16 offset)
  LJZ    = 0xE1, // Long jump if zero
  LJNZ   = 0xE2, // Long jump if not zero
  LJLT   = 0xE3, // Long jump if less than
  LJGT   = 0xE4, // Long jump if greater than
  LCALL  = 0xE5, // Long call (imm16 offset)
  LRET   = 0xE6, // Long return
  LLOOP  = 0xE7, // Long loop (imm16 iterations)
  LCASE  = 0xE8, // Switch/case dispatch
  LTBL   = 0xE9, // Jump table
  LRANGE = 0xEA, // Range check + jump
  LINDR  = 0xEB, // Indirect long jump
  LINDC  = 0xEC, // Indirect long call
  LEVENT = 0xED, // Event handler jump
  LEXH   = 0xEE, // Exception handler
  _LRESEF = 0xEF, // Reserved (long control)

  // ═══════════════════════════════════════════════════════
  // 0xF0-0xFF: Format A — Extended System/Debug
  // ═══════════════════════════════════════════════════════
  DEBUG  = 0xF0, // Enter debug mode
  PROF   = 0xF1, // Profiler control
  TRACE  = 0xF2, // Execution trace
  LOG    = 0xF3, // Log message
  ASSERT = 0xF4, // Assertion check
  PANIC  = 0xF5, // Panic halt with error
  GC     = 0xF6, // Garbage collection trigger
  VER    = 0xF7, // Version query
  FEATURE = 0xF8, // Feature detect
  CFG_RD = 0xF9, // Config read
  CFG_WR = 0xFA, // Config write
  SAVE   = 0xFB, // Save state
  RESTORE = 0xFC, // Restore state
  SNAPSHOT = 0xFD, // Snapshot state
  DUMP   = 0xFE, // Core dump
  PRINT  = 0xFF, // Print register to output
}

/**
 * Decode a byte to an Op enum value. Returns undefined for reserved/unknown opcodes.
 */
export function opFromByte(byte: number): Op | undefined {
  // Filter out values that aren't valid Op members
  if (byte >= 0x00 && byte <= 0xFF && Op[byte] !== undefined) {
    return byte as Op;
  }
  return undefined;
}

/**
 * Get the mnemonic name for an opcode value.
 */
export function opMnemonic(op: number): string {
  return Op[op] ?? `UNKNOWN_0x${op.toString(16).toUpperCase().padStart(2, '0')}`;
}

/**
 * Full ISA table: maps opcode byte → complete metadata.
 */
export const ISA_TABLE: Map<number, OpcodeInfo> = new Map([
  // System Control (0x00-0x03)
  [0x00, { code: 0x00, mnemonic: 'HALT',   format: 'A', operands: '-',        description: 'Stop execution',                        category: 'system',   confidence: false }],
  [0x01, { code: 0x01, mnemonic: 'NOP',    format: 'A', operands: '-',        description: 'No operation (pipeline sync)',            category: 'system',   confidence: false }],
  [0x02, { code: 0x02, mnemonic: 'RET',    format: 'A', operands: '-',        description: 'Return from subroutine',                  category: 'system',   confidence: false }],
  [0x03, { code: 0x03, mnemonic: 'IRET',   format: 'A', operands: '-',        description: 'Return from interrupt handler',           category: 'system',   confidence: false }],
  // Interrupt/Debug (0x04-0x07)
  [0x04, { code: 0x04, mnemonic: 'BRK',    format: 'A', operands: '-',        description: 'Breakpoint (trap to debugger)',           category: 'debug',    confidence: false }],
  [0x05, { code: 0x05, mnemonic: 'WFI',    format: 'A', operands: '-',        description: 'Wait for interrupt',                      category: 'system',   confidence: false }],
  [0x06, { code: 0x06, mnemonic: 'RESET',  format: 'A', operands: '-',        description: 'Soft reset of register file',             category: 'system',   confidence: false }],
  [0x07, { code: 0x07, mnemonic: 'SYN',    format: 'A', operands: '-',        description: 'Memory barrier / synchronize',            category: 'system',   confidence: false }],
  // Single Register (0x08-0x0F)
  [0x08, { code: 0x08, mnemonic: 'INC',    format: 'B', operands: 'rd',       description: 'rd = rd + 1',                            category: 'arithmetic', confidence: false }],
  [0x09, { code: 0x09, mnemonic: 'DEC',    format: 'B', operands: 'rd',       description: 'rd = rd - 1',                            category: 'arithmetic', confidence: false }],
  [0x0A, { code: 0x0A, mnemonic: 'NOT',    format: 'B', operands: 'rd',       description: 'rd = ~rd',                               category: 'logic',     confidence: false }],
  [0x0B, { code: 0x0B, mnemonic: 'NEG',    format: 'B', operands: 'rd',       description: 'rd = -rd',                               category: 'arithmetic', confidence: false }],
  [0x0C, { code: 0x0C, mnemonic: 'PUSH',   format: 'B', operands: 'rd',       description: 'Push rd onto stack',                     category: 'stack',     confidence: false }],
  [0x0D, { code: 0x0D, mnemonic: 'POP',    format: 'B', operands: 'rd',       description: 'Pop stack into rd',                      category: 'stack',     confidence: false }],
  [0x0E, { code: 0x0E, mnemonic: 'CONF_LD',format: 'B', operands: 'rd',       description: 'Load confidence register',               category: 'confidence', confidence: true }],
  [0x0F, { code: 0x0F, mnemonic: 'CONF_ST',format: 'B', operands: 'rd',       description: 'Store confidence register',              category: 'confidence', confidence: true }],
  // Immediate Only (0x10-0x17)
  [0x10, { code: 0x10, mnemonic: 'SYS',    format: 'C', operands: 'imm8',     description: 'System call',                            category: 'system',     confidence: false }],
  [0x11, { code: 0x11, mnemonic: 'TRAP',   format: 'C', operands: 'imm8',     description: 'Software interrupt',                      category: 'system',     confidence: false }],
  [0x12, { code: 0x12, mnemonic: 'DBG',    format: 'C', operands: 'imm8',     description: 'Debug print register',                   category: 'debug',      confidence: false }],
  [0x13, { code: 0x13, mnemonic: 'CLF',    format: 'C', operands: 'imm8',     description: 'Clear flags',                            category: 'system',     confidence: false }],
  [0x14, { code: 0x14, mnemonic: 'SEMA',   format: 'C', operands: 'imm8',     description: 'Semaphore operation',                     category: 'concurrency', confidence: false }],
  [0x15, { code: 0x15, mnemonic: 'YIELD',  format: 'C', operands: 'imm8',     description: 'Yield execution',                         category: 'concurrency', confidence: false }],
  [0x16, { code: 0x16, mnemonic: 'CACHE',  format: 'C', operands: 'imm8',     description: 'Cache control',                           category: 'system',     confidence: false }],
  [0x17, { code: 0x17, mnemonic: 'STRIPCF',format: 'C', operands: 'imm8',     description: 'Strip confidence',                        category: 'confidence', confidence: true }],
  // Register + Imm8 (0x18-0x1F)
  [0x18, { code: 0x18, mnemonic: 'MOVI',   format: 'D', operands: 'rd, imm8', description: 'rd = sign_extend(imm8)',                  category: 'move',       confidence: false }],
  [0x19, { code: 0x19, mnemonic: 'ADDI',   format: 'D', operands: 'rd, imm8', description: 'rd = rd + imm8',                          category: 'arithmetic', confidence: false }],
  [0x1A, { code: 0x1A, mnemonic: 'SUBI',   format: 'D', operands: 'rd, imm8', description: 'rd = rd - imm8',                          category: 'arithmetic', confidence: false }],
  [0x1B, { code: 0x1B, mnemonic: 'ANDI',   format: 'D', operands: 'rd, imm8', description: 'rd = rd & imm8',                          category: 'logic',      confidence: false }],
  [0x1C, { code: 0x1C, mnemonic: 'ORI',    format: 'D', operands: 'rd, imm8', description: 'rd = rd | imm8',                          category: 'logic',      confidence: false }],
  [0x1D, { code: 0x1D, mnemonic: 'XORI',   format: 'D', operands: 'rd, imm8', description: 'rd = rd ^ imm8',                          category: 'logic',      confidence: false }],
  [0x1E, { code: 0x1E, mnemonic: 'SHLI',   format: 'D', operands: 'rd, imm8', description: 'rd = rd << imm8',                         category: 'shift',      confidence: false }],
  [0x1F, { code: 0x1F, mnemonic: 'SHRI',   format: 'D', operands: 'rd, imm8', description: 'rd = rd >> imm8',                         category: 'shift',      confidence: false }],
  // Integer Arithmetic (0x20-0x2F)
  [0x20, { code: 0x20, mnemonic: 'ADD',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1 + rs2',                          category: 'arithmetic', confidence: false }],
  [0x21, { code: 0x21, mnemonic: 'SUB',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1 - rs2',                          category: 'arithmetic', confidence: false }],
  [0x22, { code: 0x22, mnemonic: 'MUL',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1 * rs2',                          category: 'arithmetic', confidence: false }],
  [0x23, { code: 0x23, mnemonic: 'DIV',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1 / rs2',                          category: 'arithmetic', confidence: false }],
  [0x24, { code: 0x24, mnemonic: 'MOD',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1 % rs2',                          category: 'arithmetic', confidence: false }],
  [0x25, { code: 0x25, mnemonic: 'AND',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1 & rs2',                          category: 'logic',      confidence: false }],
  [0x26, { code: 0x26, mnemonic: 'OR',     format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1 | rs2',                          category: 'logic',      confidence: false }],
  [0x27, { code: 0x27, mnemonic: 'XOR',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1 ^ rs2',                          category: 'logic',      confidence: false }],
  [0x28, { code: 0x28, mnemonic: 'SHL',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1 << rs2',                         category: 'shift',      confidence: false }],
  [0x29, { code: 0x29, mnemonic: 'SHR',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1 >> rs2',                         category: 'shift',      confidence: false }],
  [0x2A, { code: 0x2A, mnemonic: 'MIN',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = min(rs1, rs2)',                      category: 'arithmetic', confidence: false }],
  [0x2B, { code: 0x2B, mnemonic: 'MAX',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = max(rs1, rs2)',                      category: 'arithmetic', confidence: false }],
  [0x2C, { code: 0x2C, mnemonic: 'CMP_EQ', format: 'E', operands: 'rd,rs1,rs2',description: 'rd = (rs1 == rs2) ? 1 : 0',               category: 'compare',    confidence: false }],
  [0x2D, { code: 0x2D, mnemonic: 'CMP_LT', format: 'E', operands: 'rd,rs1,rs2',description: 'rd = (rs1 < rs2) ? 1 : 0',                category: 'compare',    confidence: false }],
  [0x2E, { code: 0x2E, mnemonic: 'CMP_GT', format: 'E', operands: 'rd,rs1,rs2',description: 'rd = (rs1 > rs2) ? 1 : 0',                category: 'compare',    confidence: false }],
  [0x2F, { code: 0x2F, mnemonic: 'CMP_NE', format: 'E', operands: 'rd,rs1,rs2',description: 'rd = (rs1 != rs2) ? 1 : 0',               category: 'compare',    confidence: false }],
  // Float, Memory, Control (0x30-0x3F)
  [0x30, { code: 0x30, mnemonic: 'FADD',   format: 'E', operands: 'rd,rs1,rs2',description: 'rd = f(rs1) + f(rs2)',                     category: 'float',      confidence: false }],
  [0x31, { code: 0x31, mnemonic: 'FSUB',   format: 'E', operands: 'rd,rs1,rs2',description: 'rd = f(rs1) - f(rs2)',                     category: 'float',      confidence: false }],
  [0x32, { code: 0x32, mnemonic: 'FMUL',   format: 'E', operands: 'rd,rs1,rs2',description: 'rd = f(rs1) * f(rs2)',                     category: 'float',      confidence: false }],
  [0x33, { code: 0x33, mnemonic: 'FDIV',   format: 'E', operands: 'rd,rs1,rs2',description: 'rd = f(rs1) / f(rs2)',                     category: 'float',      confidence: false }],
  [0x34, { code: 0x34, mnemonic: 'FMIN',   format: 'E', operands: 'rd,rs1,rs2',description: 'rd = fmin(rs1, rs2)',                      category: 'float',      confidence: false }],
  [0x35, { code: 0x35, mnemonic: 'FMAX',   format: 'E', operands: 'rd,rs1,rs2',description: 'rd = fmax(rs1, rs2)',                      category: 'float',      confidence: false }],
  [0x36, { code: 0x36, mnemonic: 'FTOI',   format: 'E', operands: 'rd,rs1,-',  description: 'rd = int(f(rs1))',                        category: 'convert',    confidence: false }],
  [0x37, { code: 0x37, mnemonic: 'ITOF',   format: 'E', operands: 'rd,rs1,-',  description: 'rd = float(rs1)',                         category: 'convert',    confidence: false }],
  [0x38, { code: 0x38, mnemonic: 'LOAD',   format: 'E', operands: 'rd,rs1,rs2',description: 'rd = mem[rs1 + rs2]',                     category: 'memory',     confidence: false }],
  [0x39, { code: 0x39, mnemonic: 'STORE',  format: 'E', operands: 'rd,rs1,rs2',description: 'mem[rs1 + rs2] = rd',                     category: 'memory',     confidence: false }],
  [0x3A, { code: 0x3A, mnemonic: 'MOV',    format: 'E', operands: 'rd,rs1,-',  description: 'rd = rs1',                                category: 'move',       confidence: false }],
  [0x3B, { code: 0x3B, mnemonic: 'SWP',    format: 'E', operands: 'rd,rs1,-',  description: 'swap(rd, rs1)',                           category: 'move',       confidence: false }],
  [0x3C, { code: 0x3C, mnemonic: 'JZ',     format: 'E', operands: 'rd,rs1,-',  description: 'if rd==0: pc+=rs1',                       category: 'control',    confidence: false }],
  [0x3D, { code: 0x3D, mnemonic: 'JNZ',    format: 'E', operands: 'rd,rs1,-',  description: 'if rd!=0: pc+=rs1',                       category: 'control',    confidence: false }],
  [0x3E, { code: 0x3E, mnemonic: 'JLT',    format: 'E', operands: 'rd,rs1,-',  description: 'if rd<0: pc+=rs1',                        category: 'control',    confidence: false }],
  [0x3F, { code: 0x3F, mnemonic: 'JGT',    format: 'E', operands: 'rd,rs1,-',  description: 'if rd>0: pc+=rs1',                        category: 'control',    confidence: false }],
  // Register + Imm16 (0x40-0x47)
  [0x40, { code: 0x40, mnemonic: 'MOVI16', format: 'F', operands: 'rd, imm16', description: 'rd = imm16',                              category: 'move',       confidence: false }],
  [0x41, { code: 0x41, mnemonic: 'ADDI16', format: 'F', operands: 'rd, imm16', description: 'rd = rd + imm16',                         category: 'arithmetic', confidence: false }],
  [0x42, { code: 0x42, mnemonic: 'SUBI16', format: 'F', operands: 'rd, imm16', description: 'rd = rd - imm16',                         category: 'arithmetic', confidence: false }],
  [0x43, { code: 0x43, mnemonic: 'JMP',    format: 'F', operands: 'rd, imm16', description: 'pc += imm16 (relative)',                  category: 'control',    confidence: false }],
  [0x44, { code: 0x44, mnemonic: 'JAL',    format: 'F', operands: 'rd, imm16', description: 'rd = pc; pc += imm16',                    category: 'control',    confidence: false }],
  [0x45, { code: 0x45, mnemonic: 'CALL',   format: 'F', operands: 'rd, imm16', description: 'push(pc); pc = rd + imm16',               category: 'control',    confidence: false }],
  [0x46, { code: 0x46, mnemonic: 'LOOP',   format: 'F', operands: 'rd, imm16', description: 'rd--; if rd>0: pc -= imm16',               category: 'control',    confidence: false }],
  [0x47, { code: 0x47, mnemonic: 'SELECT', format: 'F', operands: 'rd, imm16', description: 'Computed jump: pc += imm16*rd',           category: 'control',    confidence: false }],
  // Register + Register + Imm16 (0x48-0x4F)
  [0x48, { code: 0x48, mnemonic: 'LOADOFF',format: 'G', operands: 'rd,rs1,imm16',description: 'rd = mem[rs1 + imm16]',                  category: 'memory',     confidence: false }],
  [0x49, { code: 0x49, mnemonic: 'STOREOF',format: 'G', operands: 'rd,rs1,imm16',description: 'mem[rs1 + imm16] = rd',                  category: 'memory',     confidence: false }],
  [0x4A, { code: 0x4A, mnemonic: 'LOADI',  format: 'G', operands: 'rd,rs1,imm16',description: 'rd = mem[rs1] + imm16',                  category: 'memory',     confidence: false }],
  [0x4B, { code: 0x4B, mnemonic: 'STOREI', format: 'G', operands: 'rd,rs1,imm16',description: 'mem[rs1 + imm16] = rd',                  category: 'memory',     confidence: false }],
  [0x4C, { code: 0x4C, mnemonic: 'ENTER',  format: 'G', operands: 'rd,rs1,imm16',description: 'Function prologue',                       category: 'stack',      confidence: false }],
  [0x4D, { code: 0x4D, mnemonic: 'LEAVE',  format: 'G', operands: 'rd,rs1,imm16',description: 'Function epilogue',                      category: 'stack',      confidence: false }],
  [0x4E, { code: 0x4E, mnemonic: 'COPY',   format: 'G', operands: 'rd,rs1,imm16',description: 'memcpy(rd, rs1, imm16)',                  category: 'memory',     confidence: false }],
  [0x4F, { code: 0x4F, mnemonic: 'FILL',   format: 'G', operands: 'rd,rs1,imm16',description: 'memset(rd, rs1, imm16)',                  category: 'memory',     confidence: false }],
  // A2A Fleet Ops (0x50-0x5F)
  [0x50, { code: 0x50, mnemonic: 'TELL',   format: 'E', operands: 'rd,rs1,rs2',description: 'Send to agent',                            category: 'a2a',        confidence: false }],
  [0x51, { code: 0x51, mnemonic: 'ASK',    format: 'E', operands: 'rd,rs1,rs2',description: 'Request from agent',                        category: 'a2a',        confidence: false }],
  [0x52, { code: 0x52, mnemonic: 'DELEG',  format: 'E', operands: 'rd,rs1,rs2',description: 'Delegate task',                            category: 'a2a',        confidence: false }],
  [0x53, { code: 0x53, mnemonic: 'BCAST',  format: 'E', operands: 'rd,rs1,rs2',description: 'Broadcast to fleet',                       category: 'a2a',        confidence: false }],
  [0x54, { code: 0x54, mnemonic: 'ACCEPT', format: 'E', operands: 'rd,rs1,rs2',description: 'Accept task',                              category: 'a2a',        confidence: false }],
  [0x55, { code: 0x55, mnemonic: 'DECLINE',format: 'E', operands: 'rd,rs1,rs2',description: 'Decline task',                             category: 'a2a',        confidence: false }],
  [0x56, { code: 0x56, mnemonic: 'REPORT', format: 'E', operands: 'rd,rs1,rs2',description: 'Report status',                            category: 'a2a',        confidence: false }],
  [0x57, { code: 0x57, mnemonic: 'MERGE',  format: 'E', operands: 'rd,rs1,rs2',description: 'Merge results',                            category: 'a2a',        confidence: false }],
  [0x58, { code: 0x58, mnemonic: 'FORK',   format: 'E', operands: 'rd,rs1,rs2',description: 'Spawn child agent',                        category: 'a2a',        confidence: false }],
  [0x59, { code: 0x59, mnemonic: 'JOIN',   format: 'E', operands: 'rd,rs1,rs2',description: 'Wait for child',                           category: 'a2a',        confidence: false }],
  [0x5A, { code: 0x5A, mnemonic: 'SIGNAL', format: 'E', operands: 'rd,rs1,rs2',description: 'Emit signal',                             category: 'a2a',        confidence: false }],
  [0x5B, { code: 0x5B, mnemonic: 'AWAIT',  format: 'E', operands: 'rd,rs1,rs2',description: 'Wait for signal',                          category: 'a2a',        confidence: false }],
  [0x5C, { code: 0x5C, mnemonic: 'TRUST',  format: 'E', operands: 'rd,rs1,rs2',description: 'Set trust level',                          category: 'a2a',        confidence: false }],
  [0x5D, { code: 0x5D, mnemonic: 'DISCOV', format: 'E', operands: 'rd,rs1,rs2',description: 'Discover agents',                          category: 'a2a',        confidence: false }],
  [0x5E, { code: 0x5E, mnemonic: 'STATUS', format: 'E', operands: 'rd,rs1,rs2',description: 'Query agent status',                       category: 'a2a',        confidence: false }],
  [0x5F, { code: 0x5F, mnemonic: 'HEARTBT',format: 'E', operands: 'rd,rs1,rs2',description: 'Emit heartbeat',                          category: 'a2a',        confidence: false }],
  // Confidence (0x60-0x6F)
  [0x60, { code: 0x60, mnemonic: 'CADD',   format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware ADD',                           category: 'confidence', confidence: true }],
  [0x61, { code: 0x61, mnemonic: 'CSUB',   format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware SUB',                           category: 'confidence', confidence: true }],
  [0x62, { code: 0x62, mnemonic: 'CMUL',   format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware MUL',                           category: 'confidence', confidence: true }],
  [0x63, { code: 0x63, mnemonic: 'CDIV',   format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware DIV',                           category: 'confidence', confidence: true }],
  [0x64, { code: 0x64, mnemonic: 'CMOD',   format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware MOD',                           category: 'confidence', confidence: true }],
  [0x65, { code: 0x65, mnemonic: 'CMOV',   format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware MOV',                           category: 'confidence', confidence: true }],
  [0x66, { code: 0x66, mnemonic: 'CLOAD',  format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware LOAD',                          category: 'confidence', confidence: true }],
  [0x67, { code: 0x67, mnemonic: 'CSTORE', format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware STORE',                         category: 'confidence', confidence: true }],
  [0x68, { code: 0x68, mnemonic: 'CJZ',    format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware JZ',                            category: 'confidence', confidence: true }],
  [0x69, { code: 0x69, mnemonic: 'CJNZ',   format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware JNZ',                           category: 'confidence', confidence: true }],
  [0x6A, { code: 0x6A, mnemonic: 'CPUSH',  format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware PUSH',                          category: 'confidence', confidence: true }],
  [0x6B, { code: 0x6B, mnemonic: 'CPOP',   format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware POP',                           category: 'confidence', confidence: true }],
  [0x6C, { code: 0x6C, mnemonic: 'CCALL',  format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware CALL',                          category: 'confidence', confidence: true }],
  [0x6D, { code: 0x6D, mnemonic: 'CRET',   format: 'E', operands: 'rd,rs1,rs2',description: 'Conf-aware RET',                           category: 'confidence', confidence: true }],
  [0x6E, { code: 0x6E, mnemonic: 'CCONF',  format: 'E', operands: 'rd,rs1,rs2',description: 'Combine confidences',                      category: 'confidence', confidence: true }],
  [0x6F, { code: 0x6F, mnemonic: 'CRES',   format: 'E', operands: 'rd,rs1,rs2',description: 'Resolve confidence',                       category: 'confidence', confidence: true }],
  // Extended Math/Crypto (0x90-0x9F)
  [0x90, { code: 0x90, mnemonic: 'ABS',    format: 'E', operands: 'rd,rs1,-',  description: 'rd = |rs1|',                               category: 'crypto',     confidence: false }],
  [0x91, { code: 0x91, mnemonic: 'SQRT',   format: 'E', operands: 'rd,rs1,-',  description: 'rd = sqrt(rs1)',                           category: 'crypto',     confidence: false }],
  [0x92, { code: 0x92, mnemonic: 'POW',    format: 'E', operands: 'rd,rs1,rs2',description: 'rd = rs1^rs2',                            category: 'crypto',     confidence: false }],
  [0x93, { code: 0x93, mnemonic: 'LOG',    format: 'E', operands: 'rd,rs1,-',  description: 'rd = log(rs1)',                            category: 'crypto',     confidence: false }],
  [0x94, { code: 0x94, mnemonic: 'EXP',    format: 'E', operands: 'rd,rs1,-',  description: 'rd = exp(rs1)',                            category: 'crypto',     confidence: false }],
  [0x95, { code: 0x95, mnemonic: 'SIN',    format: 'E', operands: 'rd,rs1,-',  description: 'rd = sin(rs1)',                            category: 'crypto',     confidence: false }],
  [0x96, { code: 0x96, mnemonic: 'COS',    format: 'E', operands: 'rd,rs1,-',  description: 'rd = cos(rs1)',                            category: 'crypto',     confidence: false }],
  [0x97, { code: 0x97, mnemonic: 'TAN',    format: 'E', operands: 'rd,rs1,-',  description: 'rd = tan(rs1)',                            category: 'crypto',     confidence: false }],
  [0x98, { code: 0x98, mnemonic: 'ATAN2',  format: 'E', operands: 'rd,rs1,rs2',description: 'rd = atan2(rs1,rs2)',                      category: 'crypto',     confidence: false }],
  [0x99, { code: 0x99, mnemonic: 'FLOOR',  format: 'E', operands: 'rd,rs1,-',  description: 'rd = floor(rs1)',                           category: 'crypto',     confidence: false }],
  [0x9A, { code: 0x9A, mnemonic: 'CEIL',   format: 'E', operands: 'rd,rs1,-',  description: 'rd = ceil(rs1)',                            category: 'crypto',     confidence: false }],
  [0x9B, { code: 0x9B, mnemonic: 'ROUND',  format: 'E', operands: 'rd,rs1,-',  description: 'rd = round(rs1)',                           category: 'crypto',     confidence: false }],
  [0x9C, { code: 0x9C, mnemonic: 'CLAMP',  format: 'E', operands: 'rd,rs1,rs2',description: 'rd = clamp(rs1)',                          category: 'crypto',     confidence: false }],
  [0x9D, { code: 0x9D, mnemonic: 'LERP',   format: 'E', operands: 'rd,rs1,rs2',description: 'rd = lerp(rs1,rs2,t)',                     category: 'crypto',     confidence: false }],
  [0x9E, { code: 0x9E, mnemonic: 'HASH',   format: 'E', operands: 'rd,rs1,rs2',description: 'rd = hash(rs1,rs2)',                       category: 'crypto',     confidence: false }],
  [0x9F, { code: 0x9F, mnemonic: 'CRC32',  format: 'E', operands: 'rd,rs1,rs2',description: 'rd = crc32(rs1,rs2)',                      category: 'crypto',     confidence: false }],
  // System/Debug (0xF0-0xFF)
  // Long Jumps/Calls (0xE0-0xEF)
  [0xE0, { code: 0xE0, mnemonic: 'LJMP',  format: 'F', operands: 'rd, imm16', description: 'Long jump (imm16 offset)',                  category: 'control',    confidence: false }],
  [0xE1, { code: 0xE1, mnemonic: 'LJZ',   format: 'F', operands: 'rd, imm16', description: 'Long jump if zero',                        category: 'control',    confidence: false }],
  [0xE2, { code: 0xE2, mnemonic: 'LJNZ',  format: 'F', operands: 'rd, imm16', description: 'Long jump if not zero',                    category: 'control',    confidence: false }],
  [0xE3, { code: 0xE3, mnemonic: 'LJLT',  format: 'F', operands: 'rd, imm16', description: 'Long jump if less than',                    category: 'control',    confidence: false }],
  [0xE4, { code: 0xE4, mnemonic: 'LJGT',  format: 'F', operands: 'rd, imm16', description: 'Long jump if greater than',                  category: 'control',    confidence: false }],
  [0xE5, { code: 0xE5, mnemonic: 'LCALL', format: 'F', operands: 'rd, imm16', description: 'Long call (imm16 offset)',                   category: 'control',    confidence: false }],
  [0xE6, { code: 0xE6, mnemonic: 'LRET',  format: 'A', operands: '-',        description: 'Long return',                               category: 'control',    confidence: false }],
  [0xE7, { code: 0xE7, mnemonic: 'LLOOP', format: 'F', operands: 'rd, imm16', description: 'Long loop',                                 category: 'control',    confidence: false }],
  // System/Debug (0xF0-0xFF)
  [0xF0, { code: 0xF0, mnemonic: 'DEBUG',  format: 'A', operands: '-',        description: 'Enter debug mode',                          category: 'debug',      confidence: false }],
  [0xF1, { code: 0xF1, mnemonic: 'PROF',   format: 'A', operands: '-',        description: 'Profiler control',                          category: 'debug',      confidence: false }],
  [0xF2, { code: 0xF2, mnemonic: 'TRACE',  format: 'A', operands: '-',        description: 'Execution trace',                           category: 'debug',      confidence: false }],
  [0xF3, { code: 0xF3, mnemonic: 'LOG',    format: 'A', operands: '-',        description: 'Log message',                              category: 'debug',      confidence: false }],
  [0xF4, { code: 0xF4, mnemonic: 'ASSERT', format: 'A', operands: '-',        description: 'Assertion check',                           category: 'debug',      confidence: false }],
  [0xF5, { code: 0xF5, mnemonic: 'PANIC',  format: 'A', operands: '-',        description: 'Panic halt with error',                     category: 'system',     confidence: false }],
  [0xF6, { code: 0xF6, mnemonic: 'GC',     format: 'A', operands: '-',        description: 'Garbage collection',                        category: 'system',     confidence: false }],
  [0xF7, { code: 0xF7, mnemonic: 'VER',    format: 'A', operands: '-',        description: 'Version query',                            category: 'system',     confidence: false }],
  [0xF8, { code: 0xF8, mnemonic: 'FEATURE',format: 'A', operands: '-',        description: 'Feature detect',                            category: 'system',     confidence: false }],
  [0xF9, { code: 0xF9, mnemonic: 'CFG_RD', format: 'A', operands: '-',        description: 'Config read',                              category: 'system',     confidence: false }],
  [0xFA, { code: 0xFA, mnemonic: 'CFG_WR', format: 'A', operands: '-',        description: 'Config write',                             category: 'system',     confidence: false }],
  [0xFB, { code: 0xFB, mnemonic: 'SAVE',   format: 'A', operands: '-',        description: 'Save state',                               category: 'system',     confidence: false }],
  [0xFC, { code: 0xFC, mnemonic: 'RESTORE',format: 'A', operands: '-',        description: 'Restore state',                            category: 'system',     confidence: false }],
  [0xFD, { code: 0xFD, mnemonic: 'SNAPSHOT',format: 'A', operands: '-',        description: 'Snapshot state',                           category: 'system',     confidence: false }],
  [0xFE, { code: 0xFE, mnemonic: 'DUMP',   format: 'A', operands: '-',        description: 'Core dump',                                category: 'debug',      confidence: false }],
  [0xFF, { code: 0xFF, mnemonic: 'PRINT',  format: 'A', operands: '-',        description: 'Print register to output',                 category: 'debug',      confidence: false }],
]);

/** Total count of defined opcodes in the ISA */
export const OPCODE_COUNT = ISA_TABLE.size;

/** Count opcodes by category */
export function countByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const info of ISA_TABLE.values()) {
    counts[info.category] = (counts[info.category] || 0) + 1;
  }
  return counts;
}
