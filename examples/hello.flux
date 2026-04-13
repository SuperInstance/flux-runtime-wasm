# Hello World

A minimal FLUX program that prints "42" to output.

```flux
; FLUX Hello World
; Demonstrates: MOVI, SYS, HALT
;
; Registers:
;   R0 = value to print

MOVI R0, 42     ; Load 42 into R0
SYS 0           ; System call: print R0 as integer
HALT            ; Stop execution
```
