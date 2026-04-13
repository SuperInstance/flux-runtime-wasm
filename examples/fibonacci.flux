# Fibonacci Sequence

Compute Fibonacci(10) = 55 using FLUX assembly.
Demonstrates: loops, conditional jumps, register operations.

```flux
; FLUX Fibonacci Calculator
; Computes fib(10) using iterative approach
; Result: R0 = 55, then printed via SYS 0
;
; Register allocation:
;   R0 = N (input, 10)
;   R1 = a (fib(n-2))
;   R2 = b (fib(n-1))
;   R3 = temp
;   R4 = loop counter

    MOVI R0, 10        ; N = 10
    MOVI R1, 0         ; a = fib(0) = 0
    MOVI R2, 1         ; b = fib(1) = 1
    MOVI R4, 1         ; counter = 1

loop:
    ; if counter > N, jump to done
    CMP_GT R3, R4, R0  ; R3 = (counter > N) ? 1 : 0
    JNZ R3, done       ; if counter > N, exit loop

    ; temp = a + b
    ADD R3, R1, R2     ; R3 = a + b
    MOV R1, R2, 0      ; a = b
    MOV R2, R3, 0      ; b = temp

    ; counter++
    INC R4

    ; jump back to loop
    JMP R0, loop

done:
    ; Print result
    MOV R0, R2, 0      ; R0 = b (the fibonacci result)
    SYS 0              ; System call: print R0 as integer
    HALT
```
