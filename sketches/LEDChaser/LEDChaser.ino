/*
  LEDChaser.ino
  ----------------
  Sequentially lights a row of LEDs from left to right,
  then right to left, creating a "chaser" effect.

  Wiring example:
  - Connect LEDs (through ~220 ohm resistors) to pins 2,3,4,5,6
  - Connect LED cathodes to GND
*/

// Pins used for the chaser LEDs (edit to match your wiring)
const uint8_t LED_PINS[] = {2, 3, 4, 5, 6};
const uint8_t LED_COUNT = sizeof(LED_PINS) / sizeof(LED_PINS[0]);

// Delay between steps (milliseconds)
const unsigned long STEP_DELAY_MS = 120;

void setup() {
  // Configure each LED pin as an output and ensure it starts OFF
  for (uint8_t i = 0; i < LED_COUNT; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
}

void lightOnly(uint8_t indexToLight) {
  // Turn on only one LED at a time for a clean chase effect
  for (uint8_t i = 0; i < LED_COUNT; i++) {
    digitalWrite(LED_PINS[i], (i == indexToLight) ? HIGH : LOW);
  }
}

void loop() {
  // Sweep left -> right
  for (uint8_t i = 0; i < LED_COUNT; i++) {
    lightOnly(i);
    delay(STEP_DELAY_MS);
  }

  // Sweep right -> left (avoid repeating ends for smoother motion)
  for (int i = LED_COUNT - 2; i > 0; i--) {
    lightOnly(i);
    delay(STEP_DELAY_MS);
  }
}
