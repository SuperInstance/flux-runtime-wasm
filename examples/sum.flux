# Sum 1 to 10

Compute the sum of integers from 1 to 10.
Expected output: 55

```flux
; FLUX Sum Calculator
; Computes sum(1..10) = 55
;
; Register allocation:
;   R0 = accumulator (running sum)
;   R1 = counter (current number)
;   R2 = limit (10)
;   R3 = temp for comparison

    MOVI R0, 0         ; sum = 0
    MOVI R1, 1         ; counter = 1
    MOVI R2, 10        ; limit = 10

loop:
    ; Add counter to sum
    ADD R0, R0, R1     ; sum += counter

    ; Increment counter
    INC R1

    ; if counter <= limit, continue loop
    CMP_GT R3, R1, R2  ; R3 = (counter > limit) ? 1 : 0
    JZ R3, loop        ; if counter <= limit (R3==0), go back

    ; Print result
    SYS 0              ; print R0 = 55
    HALT
```
