# Arduino Web LED Chaser Simulation

A LAN-accessible browser simulation of an Arduino LED chaser sketch.

## Run

```bash
node server.js
```

Serves on:
- `http://0.0.0.0:8787` (all interfaces)
- Health check: `http://<host-ip>:8787/health`

## What it simulates faithfully

- A single `HIGH` LED moving back and forth across 10 LEDs.
- Timing based on per-step delay (equivalent to `delay(stepDelayMs)`).
- Direction reversal on strip endpoints.
- Equivalent pin semantics for D2..D11.

## Fidelity limits vs real Arduino hardware

- No AVR/ARM MCU instruction-level emulation.
- Browser timer jitter can slightly affect exact real-time behavior.
- No real electrical behavior (GPIO voltage/current, wiring faults, LED electrical characteristics).

This is a logic-faithful behavioral simulation suitable for demos/workbench UI, not hardware validation.
