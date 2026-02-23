// ===== BLE-ONLY ACTUATOR CONTROL =====
// Fixed: Background FreeRTOS task for DS18B20 to stop stuttering and 
// allow native blocking reads, which fixes "stuck" cheap/parasitic sensors.
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID        "c191e8aa-fb8a-4c7a-8750-5eb91c7c794a"
#define CHARACTERISTIC_UUID "c191e8ab-fb8a-4c7a-8750-5eb91c7c794a"

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;

// Edge flags from BLE
volatile bool bleStartRequested = false;
volatile bool bleStopRequested  = false;

// Command bytes (match app)
const uint8_t CMD_STOP  = 0x00;  // App STOP sends 0
// Any non-zero byte is treated as START

// Small cooldown after READY to prevent instant retriggers
static unsigned long readyAt = 0;                  // ms timestamp of last READY
const unsigned long READY_COOLDOWN_MS = 500;       // 0.5s gate

// Status de-duplication window to avoid spammy repeats
const unsigned long STATUS_DEDUPE_MS = 250;

// Track last status text + time to dedupe
bool shouldSendStatus(const char* s) {
  static char last[16] = {0};
  static unsigned long lastMs = 0;
  unsigned long now = millis();
  if (strncmp(last, s, sizeof(last)) == 0 && (now - lastMs) < STATUS_DEDUPE_MS) {
    return false;
  }
  strncpy(last, s, sizeof(last) - 1);
  last[sizeof(last) - 1] = 0;
  lastMs = now;
  return true;
}

// Normal notify (respects de-dupe)
void sendStatus(const char* s) {
  if (!pCharacteristic) return;
  if (!shouldSendStatus(s)) return;
  size_t n = strlen(s);
  pCharacteristic->setValue((uint8_t*)s, n);
  pCharacteristic->notify();
  Serial.print("[NTFY] "); Serial.println(s);
}

// Force notify (bypass de-dupe) — for UI-critical transitions like STOP→RETRACT
void sendStatusForce(const char* s) {
  if (!pCharacteristic) return;
  size_t n = strlen(s);
  pCharacteristic->setValue((uint8_t*)s, n);
  pCharacteristic->notify();
  Serial.print("[NTFY*] "); Serial.println(s);
}

// ---- helper to notify temperature (shortened to fit BLE 20-byte MTU limit) ----
void notifyTemperatureC(float tC) {
  if (!pCharacteristic) return;
  char msg[40];
  // 'temperature: 56.69°C' is 21+ bytes. BLE default MTU allows max 20 bytes!
  // We use 'TEMP:' to keep it very short (~11 bytes) so it transmits reliably.
  int n = snprintf(msg, sizeof(msg), "TEMP: %.2f", tC);
  if (n < 0) return;
  pCharacteristic->setValue((uint8_t*)msg, (size_t)n);
  pCharacteristic->notify();
}

// === BLE callbacks ===
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
    Serial.println("[BLE] Device connected");
    if (pCharacteristic) {
      pCharacteristic->setValue((uint8_t*)"READY", 5);
      pCharacteristic->notify();
      readyAt = millis();  // start cooldown after READY
    }
  }
  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    Serial.println("[BLE] Device disconnected");
  }
};

// ===== ACTUATOR / SENSOR PART =====
const int R1 = 26;          // H-bridge / relay input A
const int R2 = 27;          // H-bridge / relay input B
const int SW_PIN = 25;      // Manual safety switch (active LOW)
const int RELAY3 = 33;      // Heater or aux relay (LOW = ON)
const int ONE_WIRE_BUS = 32; // DS18B20 data pin

const unsigned long MAX_EXTEND_TIME = 25000;
long extendBudget = MAX_EXTEND_TIME;
unsigned long lastMillis = 0;

int  currentState      = 0;
bool forceRetracting   = false;
unsigned long forceStartMillis = 0;
const unsigned long FORCE_RETRACT_TIME = 25000;

// --- Retract overrun so we ALWAYS reach home physically ---
const unsigned long RETRACT_OVERRUN_MS = 5000; // 5s overrun
bool retractOverrunActive = false;
unsigned long retractOverrunStart = 0;

// === DS18B20 Temperature Sensor ===
#include <OneWire.h>
#include <DallasTemperature.h>
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

float temperatureC = 0.0;
volatile float currentTempC = -127.0; // Shared with background task
volatile bool newTempReady = false;   // Flag to tell loop() to print

// === Background Temperature Task (FreeRTOS) ===
void tempTask(void *pvParameters) {
  for (;;) {
    // This successfully blocks this task for ~750ms without pausing the motors!
    // It guarantees exact timing for parasitic power and tricky sensors.
    sensors.requestTemperatures(); 
    
    float t = sensors.getTempCByIndex(0);
    if (t != DEVICE_DISCONNECTED_C && t != 85.0) {
      currentTempC = t;
      newTempReady = true;
    }
    
    // Slight rest to yield (combined with above this is ~1 reading/sec)
    vTaskDelay(pdMS_TO_TICKS(250)); 
  }
}

// === Sequence (BLE-only): extend → heat(15m) → retract (emergency retract >120°C) ===
bool     seqActive      = false;
// PHASES: 0=extend, 1=HEAT, 2=COOL (kept), 3=RETRACT
uint8_t  seqPhase       = 0;
unsigned long seqPhaseStart = 0;

const unsigned long MAN_EXTEND_TIME     = 25000;   // 25s extend
const unsigned long MAN_HOLD_TIME       = 900000;  // 15 minutes HEATING
const unsigned long COOL_TIME_MS        = 240000;  // 4 minutes COOLING (unused after change)
const unsigned long MAN_RETRACT_TIMEOUT = 60000;   // 60s safety cap

void relaysStop() {
  digitalWrite(R1, LOW);
  digitalWrite(R2, LOW);
  if (currentState != 0) {
    Serial.println("[ACT] STOP");
  }
  currentState = 0;
}

void extend() {
  if (currentState != 1) Serial.println("[ACT] EXTEND");
  digitalWrite(R1, LOW);
  digitalWrite(R2, HIGH);
  currentState = 1;
}

void retract() {
  if (currentState != -1) Serial.println("[ACT] RETRACT");
  digitalWrite(R1, HIGH);
  digitalWrite(R2, LOW);
  currentState = -1;
}

// === BLE onWrite: 0x00 = STOP, any non-zero = START (if idle & safe) ===
class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *ch) override {
    // Arduino String; empty string represents single 0x00 from app
    String raw = ch->getValue();
    size_t n = raw.length();
    uint8_t cmd = (n == 0) ? CMD_STOP : static_cast<uint8_t>(raw[0]);

    Serial.printf("[BLE] Received byte: %u (len=%u)\n", cmd, (unsigned)n);

    unsigned long now = millis();
    bool cooldownPassed = (now - readyAt) > READY_COOLDOWN_MS;

    if (cmd == CMD_STOP) {
      bleStopRequested = true;
      Serial.println("[BLE] STOP requested");
      return;
    }

    // START on any non-zero byte
    if (!seqActive && !forceRetracting && cooldownPassed && extendBudget > 0) {
      bleStartRequested = true;
    } else {
      Serial.println("[BLE] Start ignored (busy/safety/cooldown)");
    }
  }
};

void setup() {
  Serial.begin(115200);

  // --- BLE setup ---
  BLEDevice::init("VULCANIZER");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->addDescriptor(new BLE2902());
  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->start();
  Serial.println("[BLE] Waiting for a client connection...");

  // --- Pins / sensors ---
  pinMode(R1, OUTPUT);
  pinMode(R2, OUTPUT);
  pinMode(RELAY3, OUTPUT);
  pinMode(SW_PIN, INPUT_PULLUP);

  relaysStop();
  digitalWrite(RELAY3, HIGH); // heater OFF by default on LOW-trigger boards

  // --- Sensor Init & Background Task ---
  sensors.begin();
  sensors.setResolution(12);
  sensors.setWaitForConversion(true); // Must equal true for complex clone sensors

  // Single blocking read at boot so we have an immediate value
  sensors.requestTemperatures();
  temperatureC = sensors.getTempCByIndex(0);

  if (temperatureC == DEVICE_DISCONNECTED_C || temperatureC == 85.0) {
    Serial.println("[BOOT] Initial temp: BAD/DISCONNECTED");
  } else {
    Serial.printf("[BOOT] Initial temp: %.2f °C\n", temperatureC);
  }

  // Create background scanning task on Core 1 (same as loop, but runs concurrently)
  xTaskCreatePinnedToCore(
    tempTask,      // Task function
    "TempTask",    // Name of task
    4096,          // Stack size
    NULL,          // Parameters
    1,             // Priority
    NULL,          // Task handle
    1              // Core (1 = Arduino loop core)
  );

  lastMillis = millis();
}

// Single place to end & broadcast READY
void finalizeToReady() {
  seqActive = false;
  relaysStop();
  extendBudget = MAX_EXTEND_TIME;  // mark as fully retracted (logical)
  digitalWrite(RELAY3, HIGH);      // heater OFF (LOW-trigger board)
  Serial.println("[SEQ] Complete");
  sendStatus("COMPLETE");
  sendStatus("READY");
  readyAt = millis();              // start cooldown after READY
}

void loop() {
  unsigned long now = millis();
  unsigned long elapsed = now - lastMillis;
  lastMillis = now;

  // =========================================================
  // --- Process Temperature Updates from Background Task ---
  // =========================================================
  if (newTempReady) {
    newTempReady = false;
    temperatureC = currentTempC;

    // Print and notify the temperature
    char line[40];
    snprintf(line, sizeof(line), "temperature: %.2f°C", temperatureC);
    Serial.println(line);
    notifyTemperatureC(temperatureC);

    // Emergency over-temp retract (>120°C)
    if (temperatureC > 120 && !forceRetracting) {
      forceRetracting = true;
      forceStartMillis = now;
      digitalWrite(RELAY3, HIGH);  // cut heater
      Serial.println("[SAFE] Over-temp → FORCE RETRACT");
      sendStatusForce("RETRACT");
      sendStatus("SAFE:FORCE");
    }
  }

  // --- Update "position" budget based on motion state ---
  if (currentState == 1) {
    extendBudget -= (long)elapsed;
    if (extendBudget <= 0) {
      extendBudget = 0;
      relaysStop();
    }
  } else if (currentState == -1) {
    if (extendBudget < (long)MAX_EXTEND_TIME) {
      extendBudget += (long)elapsed;
      if (extendBudget > (long)MAX_EXTEND_TIME) extendBudget = MAX_EXTEND_TIME;
    }
  }

  // --- Manual safety switch (active LOW) ---
  if (digitalRead(SW_PIN) == LOW && !forceRetracting) {
    forceRetracting = true;
    forceStartMillis = now;
    digitalWrite(RELAY3, HIGH);
    Serial.println("[SAFE] Switch → FORCE RETRACT");
    sendStatusForce("RETRACT");
    sendStatus("SAFE:FORCE");
  }

  // --- Manual STOP from app (highest priority after safety) ---
  if (bleStopRequested) {
    bleStopRequested = false;
    digitalWrite(RELAY3, HIGH);   // heater OFF

    if (seqActive) {
      // Jump to RETRACT phase (phase 3)
      seqPhase = 3;
      seqPhaseStart = now;
      retractOverrunActive = false;
      Serial.println("[SEQ] ABORT → RETRACT (manual STOP)");
      sendStatusForce("RETRACT");
    } else if (!forceRetracting) {
      forceRetracting = true;
      forceStartMillis = now;
      Serial.println("[SAFE] Manual STOP → FORCE RETRACT");
      sendStatusForce("RETRACT");
    }
    // fall through; let retract logic run
  }

  // --- Safety retract overrides everything ---
  if (forceRetracting) {
    if (now - forceStartMillis < FORCE_RETRACT_TIME) {
      retract();
    } else {
      static bool frOverrun = false;
      static unsigned long frOverrunStart = 0;
      if (!frOverrun) {
        frOverrun = true;
        frOverrunStart = now;
        Serial.println("[SAFE] Force retract overrun start");
        sendStatusForce("RETRACT");
      }
      if (now - frOverrunStart < RETRACT_OVERRUN_MS) {
        retract();
      } else {
        forceRetracting = false;
        frOverrun = false;
        extendBudget = MAX_EXTEND_TIME;
        relaysStop();
        digitalWrite(RELAY3, HIGH);
        Serial.println("[SAFE] Force retract complete");
        sendStatus("SAFE:DONE");
        finalizeToReady();
      }
    }
    return;
  }

  // --- Start sequence by BLE (edge) ---
  if (bleStartRequested && !seqActive && extendBudget > 0) {
    if ((millis() - readyAt) > READY_COOLDOWN_MS) {
      bleStartRequested = false;
      seqActive      = true;
      seqPhase       = 0;
      seqPhaseStart  = now;
      retractOverrunActive = false;
      Serial.println("[SEQ] Start via BLE");
      sendStatusForce("EXTEND");
    }
  }

  // --- Run BLE-only sequence ---
  if (seqActive) {
    switch (seqPhase) {
      case 0: // EXTEND
        if (extendBudget > 0) extend();
        else relaysStop();
        if ((now - seqPhaseStart >= MAN_EXTEND_TIME) || (extendBudget == 0)) {
          seqPhase = 1;
          seqPhaseStart = now;
          relaysStop();
          digitalWrite(RELAY3, LOW);    // HEATER ON (LOW-trigger)
          Serial.println("[SEQ] Phase → HOLD (HEAT 15m)");
          sendStatus("HOLD");
        }
        break;

      case 1: // HEAT for 15 minutes
        relaysStop();              // actuator stopped; stays extended
        digitalWrite(RELAY3, LOW); // heater ON
        if (now - seqPhaseStart >= MAN_HOLD_TIME) {
          // After heating completes, go DIRECTLY to RETRACT
          digitalWrite(RELAY3, HIGH);   // heater OFF
          seqPhase = 3;
          seqPhaseStart = now;
          retractOverrunActive = false;
          Serial.println("[SEQ] Heat done → DIRECT RETRACT");
          sendStatusForce("RETRACT");
        }
        break;

      case 2: // COOL (kept for compatibility; not used after change)
        relaysStop();
        digitalWrite(RELAY3, HIGH); // ensure heater OFF
        if (now - seqPhaseStart >= COOL_TIME_MS) {
          seqPhase = 3;
          seqPhaseStart = now;
          retractOverrunActive = false;
          Serial.println("[SEQ] Phase → RETRACT");
          sendStatusForce("RETRACT");
        }
        break;

      case 3: // RETRACT
        if (!retractOverrunActive) {
          if (extendBudget < (long)MAX_EXTEND_TIME) {
            retract();
          } else {
            retractOverrunActive = true;
            retractOverrunStart = now;
            Serial.println("[SEQ] Retract overrun start");
            sendStatusForce("RETRACT");
          }

          if (now - seqPhaseStart >= MAN_RETRACT_TIMEOUT) {
            finalizeToReady();
          }
        } else {
          if (now - retractOverrunStart < RETRACT_OVERRUN_MS) {
            retract();
          } else {
            finalizeToReady();
          }
        }
        break;
    }
    return;
  }

  relaysStop();
}
