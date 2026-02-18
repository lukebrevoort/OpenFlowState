# EE 390 Microprocessor Systems - Study Guide

## Course Overview
This study guide covers the material from Lectures 1-9, which include number systems, logic design, Boolean algebra, combinational logic, and sequential logic.

---

## **SECTION 1: Number Systems & Conversions (Lectures 1-2)**

### Key Topics:
- Binary number system (base-2)
- Hexadecimal number system (base-16)
- Decimal conversions
- Signed vs. unsigned numbers

### Binary to Decimal Conversion:
Each bit represents a power of 2, starting from the right (2⁰).

**Example:** Convert 1110₂ to decimal
- Position: 3 2 1 0
- Values:   1 1 1 0
- Calculation: (1×2³) + (1×2²) + (1×2¹) + (0×2⁰) = 8 + 4 + 2 + 0 = **14**

### Binary to Hexadecimal Conversion:
Group binary digits into sets of 4 (from right), then convert each group.

**Example:** Convert 11 0001₂ to hexadecimal
- 0011 = 3
- 0001 = 1
- Result: **31₁₆**

**Example:** Convert 1001 1011₂ to hexadecimal
- 1001 = 9
- 1011 = B
- Result: **9B₁₆**

### Decimal with Fractions to Binary:
For the integer part: Repeated division by 2
For the fractional part: Repeated multiplication by 2

**Example:** Convert 21.328125₁₀ to binary
- Integer (21): 10101
- Fraction (0.328125):
  - 0.328125 × 2 = 0.65625 → 0
  - 0.65625 × 2 = 1.3125 → 1
  - 0.3125 × 2 = 0.625 → 0
  - 0.625 × 2 = 1.25 → 1
  - 0.25 × 2 = 0.5 → 0
  - 0.5 × 2 = 1.0 → 1
- Result: **10101.010101₂**

### Two's Complement (9-bit Signed Numbers):
Range: -256 to +255

**To convert negative decimal to two's complement:**
1. Convert absolute value to binary
2. Invert all bits (one's complement)
3. Add 1

**Example:** Convert -59 to 9-bit two's complement
1. 59 = 0000111011
2. Invert: 1111000100
3. Add 1: 1111000101

**Overflow Detection:**
- If decimal value > 255 or < -256 → **Overflow!**
- Example: 257₁₀ cannot be represented in 9-bit two's complement (max is 255)
- Example: -256₁₀ is the minimum value (100000000 in two's complement)

### Binary Addition (Unsigned):
Add bit by bit with carry.

**Example:** 10100001₂ + 01011111₂
```
  10100001
+ 01011111
-----------
 100000000
```
Result: 256₁₀, but **overflows 8-bit** (result requires 9 bits)

### Binary Addition (Signed - Two's Complement):
Same addition process, but interpret result as signed.

**Overflow in Signed Addition:**
- Occurs when adding two positives yields negative, or two negatives yield positive
- Check: If carry into sign bit ≠ carry out of sign bit

---

## **SECTION 2: Boolean Algebra & Logic Gates (Lectures 3-4)**

### Basic Logic Gates:
| Gate | Symbol | Boolean Expression | Truth Table |
|------|--------|-------------------|-------------|
| AND | A · B | Y = AB | 1 only if both inputs are 1 |
| OR | A + B | Y = A + B | 1 if either input is 1 |
| NOT | Ā | Y = Ā | Inverts input |
| NAND | | Y = AB̄ | AND followed by NOT |
| NOR | | Y = A + B̄ | OR followed by NOT |
| XOR | ⊕ | Y = A ⊕ B | 1 if inputs are different |
| XNOR | ⊙ | Y = A ⊙ B | 1 if inputs are same |

### Boolean Algebra Laws:

**Commutative:**
- A + B = B + A
- AB = BA

**Associative:**
- A + (B + C) = (A + B) + C
- A(BC) = (AB)C

**Distributive:**
- A(B + C) = AB + AC
- A + BC = (A + B)(A + C)

**Identity:**
- A + 0 = A
- A · 1 = A

**Null:**
- A + 1 = 1
- A · 0 = 0

**Idempotent:**
- A + A = A
- A · A = A

**Complement:**
- A + Ā = 1
- A · Ā = 0

**Double Negation:**
- Ā̄ = A

**DeMorgan's Theorems:**
- **(A + B)̄ = Ā · B̄** (NOR = bubbled AND)
- **(AB)̄ = Ā + B̄** (NAND = bubbled OR)

### Writing Boolean Equations from Truth Tables:

**Sum of Products (SOP):**
1. Identify rows where output = 1
2. For each row, AND the inputs (complement if 0)
3. OR all the product terms together

**Example:** Truth Table
| A | B | Y |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | 1 |
| 1 | 0 | 1 |
| 1 | 1 | 0 |

Rows with Y=1: (0,1) and (1,0)
- Row (0,1): ĀB
- Row (1,0): AḂ
- **SOP: Y = ĀB + AḂ** (This is XOR!)

**Product of Sums (POS):**
1. Identify rows where output = 0
2. For each row, OR the inputs (complement if 1)
3. AND all the sum terms together

### Perfect Induction (Truth Table Proof):
To prove Boolean equations, build truth tables for both sides and verify they're identical.

**Example:** Prove Y + X̄Z + XȲ = X + Y + Z
- Create truth table with all combinations of X, Y, Z
- Calculate left side and right side for each row
- Verify they match

---

## **SECTION 3: Karnaugh Maps (K-Maps) (Lecture 5)**

### 2-Variable K-Map:
```
       A
     0   1
   +---+---+  
B 0 |   |   |
   +---+---+  
  1 |   |   |
   +---+---+  
```

### 3-Variable K-Map:
```
       AB
     00  01  11  10
   +----+----+----+----+  
C 0|    |    |    |    |
   +----+----+----+----+  
  1|    |    |    |    |
   +----+----+----+----+  
```
Note: Gray code ordering (00, 01, 11, 10) - only 1 bit changes between adjacent cells!

### 4-Variable K-Map:
```
       AB
     00  01  11  10
   +----+----+----+----+  
CD 00|    |    |    |    |
   +----+----+----+----+  
  01|    |    |    |    |
   +----+----+----+----+  
  11|    |    |    |    |
   +----+----+----+----+  
  10|    |    |    |    |
   +----+----+----+----+  
```

### K-Map Simplification Rules:
1. **Groups must be rectangular** (1, 2, 4, 8, or 16 cells)
2. **Groups should be as large as possible**
3. **Use minimum number of groups**
4. **Groups can wrap around edges** (toroidal)
5. **Groups can overlap**

### Procedure:
1. Fill in K-map with 1s from truth table
2. Circle groups of 1s (powers of 2)
3. For each group, identify variables that stay constant
4. Write simplified SOP expression

**Example:** 3-input K-map from truth table
| A | B | C | Y |
|---|---|---|---|
| 0 | 0 | 0 | 0 |
| 0 | 0 | 1 | 0 |
| 0 | 1 | 0 | 1 |
| 0 | 1 | 1 | 0 |
| 1 | 0 | 0 | 0 |
| 1 | 0 | 1 | 0 |
| 1 | 1 | 0 | 0 |
| 1 | 1 | 1 | 1 |

K-map:
```
       AB
     00  01  11  10
   +----+----+----+----+  
C 0|  0 |  1 |  0 |  0 |
   +----+----+----+----+  
  1|  0 |  0 |  1 |  0 |
   +----+----+----+----+  
```

Groups:
- (01,0): ḂC̄ (A=0, B=1, C=0) → Wait, let me recalculate
- Cell (0,1,0) = ĀBC̄
- Cell (1,1,1) = ABC

These are not adjacent, so no simplification possible.
**Result: Y = ĀBC̄ + ABC**

### Don't Cares (X):
- Marked as X in K-map
- Can be treated as 0 or 1 to make larger groups
- Useful for further simplification

**Example:** From HW2 Problem 5
Replace 0 outputs with X when B=0, then simplify.

---

## **SECTION 4: Combinational Logic (Lectures 6-7)**

### Combinational Logic Blocks:
- Output depends only on current inputs
- No memory or feedback
- Examples: Adders, Multiplexers, Decoders, Comparators

### Key Components:

**Half Adder:**
- Adds two single bits
- Sum = A ⊕ B
- Carry = AB

**Full Adder:**
- Adds three bits (A, B, and carry-in)
- Uses two half adders and an OR gate

**Multiplexer (MUX):**
- Selects one of N inputs based on select lines
- 2:1 MUX: 1 select line, 2 inputs
- 4:1 MUX: 2 select lines, 4 inputs

**Decoder:**
- N inputs, 2^N outputs
- Only one output is active at a time
- Example: 2-to-4 decoder

### Timing Concepts:
- **Propagation delay:** Time for signal to pass through gate
- **Critical path:** Longest delay path in circuit
- **Setup time:** Input must be stable before clock edge
- **Hold time:** Input must be stable after clock edge

---

## **SECTION 5: Sequential Logic (Lectures 8-9)**

### Latches vs. Flip-Flops:
| Latch | Flip-Flop |
|-------|-----------|
| Level-sensitive | Edge-sensitive |
| Transparent when enabled | Captures input on clock edge |
| Can be transparent | Never transparent |

### Types of Latches:

**SR Latch (Set-Reset):**
- S=1, R=0: Set (Q=1)
- S=0, R=1: Reset (Q=0)
- S=0, R=0: Hold
- S=1, R=1: Invalid

**D Latch:**
- Single data input (D)
- When enabled: Q follows D
- When disabled: Q holds value

### Types of Flip-Flops:

**D Flip-Flop:**
- Captures D input on clock edge
- Q(next) = D
- Most common type

**JK Flip-Flop:**
- J=0, K=0: Hold
- J=0, K=1: Reset (Q=0)
- J=1, K=0: Set (Q=1)
- J=1, K=1: Toggle (Q = Q̄)

**T Flip-Flop:**
- T=0: Hold
- T=1: Toggle

### Finite State Machines (FSMs):

**Components:**
1. State register (flip-flops)
2. Next state logic (combinational)
3. Output logic (combinational)

**Moore Machine:**
- Outputs depend **only on current state**
- Output = f(state)
- Outputs change only on clock edges

**Mealy Machine:**
- Outputs depend on **state and inputs**
- Output = f(state, input)
- Outputs can change asynchronously

### FSM Design Process:
1. Define states and state encoding
2. Create state diagram
3. Create state transition table
4. Derive next-state equations
5. Derive output equations
6. Implement with flip-flops and logic gates

### State Transition Table Format:
| Current State | Input | Next State | Output |
|---------------|-------|------------|--------|
| S0 | 0 | S0 | 0 |
| S0 | 1 | S1 | 0 |
| S1 | 0 | S0 | 1 |
| S1 | 1 | S2 | 1 |

---

## **PRACTICE PROBLEMS** (From Homework)

### Problem Set 1: Number Systems
1. Convert 1110₂ to decimal
2. Convert 110 1001 1010 0100₂ to hexadecimal
3. Convert 101010.101010₂ to decimal
4. Convert 21.328125₁₀ to binary
5. Convert -59₁₀ to 9-bit two's complement

### Problem Set 2: Boolean Algebra
1. Write SOP expression for:
   | A | B | Y |
   |---|---|---|
   | 0 | 0 | 0 |
   | 0 | 1 | 1 |
   | 1 | 0 | 1 |
   | 1 | 1 | 0 |

2. Simplify using DeMorgan's: E = QRS + QR̄S̄ + (Q + R̄ + S̄)̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄̄

3. Prove using perfect induction: Y + X̄Z + XȲ = X + Y + Z

### Problem Set 3: K-Maps
1. Simplify using 3-variable K-map:
   | A | B | C | Y |
   |---|---|---|---|
   | 0 | 0 | 0 | 0 |
   | 0 | 0 | 1 | 0 |
   | 0 | 1 | 0 | 1 |
   | 0 | 1 | 1 | 0 |
   | 1 | 0 | 0 | 0 |
   | 1 | 0 | 1 | 0 |
   | 1 | 1 | 0 | 0 |
   | 1 | 1 | 1 | 1 |

2. Create 4-input K-map and simplify (refer to HW2 Problem 1c)

---

## **KEY FORMULAS TO MEMORIZE**

### Number Systems:
- 2ⁿ = number of unique values with n bits
- Two's complement range: -2^(n-1) to +(2^(n-1) - 1)
- Overflow occurs when result exceeds representable range

### Boolean Algebra:
- DeMorgan's: (A + B)̄ = ĀB̄ and (AB)̄ = Ā + B̄
- Absorption: A + AB = A and A(A + B) = A
- Consensus: AB + ĀC + BC = AB + ĀC

### K-Maps:
- 2-variable: 2² = 4 cells
- 3-variable: 2³ = 8 cells
- 4-variable: 2⁴ = 16 cells
- Group sizes: 1, 2, 4, 8, 16 (powers of 2)

---

## **EXAM TIPS**

1. **Show your work!** Partial credit is important.
2. **Double-check conversions** - common source of errors
3. **For K-maps:** Always use largest possible groups
4. **For FSMs:** Draw the state diagram first, then create tables
5. **Watch for don't cares** - they can simplify your answer significantly
6. **Practice timing** - know how long each problem type takes you

## **CONCEPT CHECKLIST**

Before the exam, make sure you can:
- [ ] Convert between binary, decimal, and hexadecimal
- [ ] Perform binary addition (signed and unsigned)
- [ ] Detect overflow conditions
- [ ] Write Boolean expressions from truth tables (SOP and POS)
- [ ] Apply Boolean algebra theorems
- [ ] Use DeMorgan's theorem
- [ ] Create and simplify K-maps (2, 3, and 4 variable)
- [ ] Design basic combinational circuits
- [ ] Understand latch and flip-flop operations
- [ ] Design simple FSMs (Moore machines)
- [ ] Create state diagrams and transition tables

---

**Good luck on your exam!**

*This study guide was generated based on EE 390 course materials from Spring 2026.*
