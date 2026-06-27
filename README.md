# 🔋 BatteryLoop — Smart Recycling System

## 🌟 About the Project
BatteryLoop is an innovative IoT-based Smart Bin system designed to incentivize the recycling of old batteries and e-waste. By integrating a physical smart bin with a modern web platform, it bridges the gap between environmental sustainability and user engagement. Users are rewarded with points for every battery they drop, which can be spent on real-world perks in the Rewards Store.

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS, custom Glassmorphism UI, Firebase Auth (Google Sign-in)
- **Backend**: Node.js, Express.js, JSON Web Tokens (JWT) for API security
- **Database**: MongoDB Atlas (Mongoose ORM)
- **Hardware**: NodeMCU ESP8266 (v3 Wemos), HC-SR04 Ultrasonic Sensor, TM1637 4-Digit Display, LEDs

---

## ⚙️ How it Works (A to Z)

1. **User Dashboard:** The user logs in via Google and clicks "Generate Deposit Code" (e.g., for 3 batteries). 
2. **Backend Sync:** The Node.js backend saves this "Pending Deposit" to a MongoDB database.
3. **Smart Bin Polling:** The physical bin (powered by a NodeMCU ESP8266) quietly polls the backend every 3 seconds over WiFi. It immediately detects the pending deposit.
4. **Code Display:** The bin's 7-segment display lights up with the user's secret 4-digit deposit code, proving it is ready.
5. **Battery Detection:** As the user drops batteries, an Ultrasonic Sensor counts them. The display switches from the code to a countdown (3, 2, 1, 0).
6. **Points Awarded:** When the count hits zero, the bin sends a success signal back to the server. The user instantly receives points on their web dashboard!
7. **Admin & Rewards:** The Admin can create "Coupons" in their control centre. These coupons automatically appear in the user's "Rewards Store", where they can be purchased using earned points.

---

## 💻 Running the Software on Your PC

To run the web dashboard and backend on a new computer, follow these steps:

### 1. Prerequisites
- Download and install **Node.js**
- You need a MongoDB Atlas account (or use the existing MongoDB URI).

### 2. Installation
Open your terminal in the `batteryloop-backend` folder and run:
```bash
npm install
```

### 3. Environment Variables
Create a file named `.env` in the `batteryloop-backend` folder and add the following:
```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string_here
JWT_SECRET=super_secret_jwt_key
ADMIN_EMAILS=your_email@gmail.com
```
*(Make sure to put your actual Google email in `ADMIN_EMAILS` so you get access to the Admin Dashboard).*

### 4. Start the Server
```bash
node server.js
```
- **User Dashboard:** Open `http://localhost:3000/` in your browser.
- **Admin Dashboard:** Open `http://localhost:3000/admin.html` in your browser.

---

## 🔌 Hardware Setup (NodeMCU v3 Wemos)

Here is the complete, non-negotiable wiring guide for the physical bin.

### POWER (USB Type-B)
* USB Type-B cable from 5V adapter → Plug into NodeMCU v3's USB Type-B port.
* *(Powers the entire board. No extra wiring needed).*

### HC-SR04 ULTRASONIC SENSOR (4 wires)
* **VCC** → NodeMCU `3V3` pin
* **GND** → NodeMCU `GND` pin
* **TRIG** → NodeMCU `D6` (GPIO12)
* **ECHO** → NodeMCU `D5` (GPIO14)

### HW-069 DISPLAY (4 wires)
* **VCC** → NodeMCU `3V3` pin
* **GND** → NodeMCU `GND` pin
* **CLK** → NodeMCU `D1` (GPIO5)
* **DIO** → NodeMCU `D2` (GPIO4)

### LEDs (You MUST use 220Ω resistors)
* **RED LED:** Positive (long leg) → 220Ω resistor → `D4` | Negative (short) → `GND`
* **GREEN LED:** Positive (long leg) → 220Ω resistor → `D7` | Negative (short) → `GND`
* **YELLOW LED:** Positive (long leg) → 220Ω resistor → `D8` | Negative (short) → `GND`

---

## ⚠️ CRITICAL CHANGES FOR THE ARDUINO CODE

Before flashing the Arduino code to the NodeMCU, **you MUST change the following** in the code below:

1. **`VERCEL_APP_URL`**: Change `https://your-app.vercel.app` to your actual Vercel deployment URL.

*Note: The Arduino will automatically scan for and connect to the strongest open (no password) WiFi network it can find!*

---

## 📜 Complete Arduino Code (ESP8266)

Copy and paste this into your Arduino IDE. Make sure to install the `TM1637` library from the Library Manager!

```cpp
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h> 
#include <TM1637Display.h>

// ============== PIN CONFIGURATION ==============
#define TRIG_PIN D6        
#define ECHO_PIN D5        
#define DISPLAY_CLK D1     
#define DISPLAY_DIO D2     
#define RED_LED D4         
#define GREEN_LED D7       
#define YELLOW_LED D8      

// ============== WIFI CONFIGURATION ==============
// The bin will automatically scan for and connect to an OPEN WiFi network.

// ⚠️ CHANGE THIS TO YOUR VERCEL URL ⚠️
const char* VERCEL_APP_URL = "https://ebin1.vercel.app";
String API_POST_DATA = String(VERCEL_APP_URL) + "/api/sensor-data";
String API_GET_PENDING = String(VERCEL_APP_URL) + "/api/sensor-data/pending/BIN-01";

// ============== SENSOR CONFIGURATION ==============
#define MAX_BIN_DISTANCE 50
#define SAFE_ZONE 15        
#define TRIGGER_ZONE 10     
#define BIN_FULL_DISTANCE 7 
#define DEBOUNCE_TIME 2000  

// ============== DISPLAY SETUP ==============
TM1637Display display(DISPLAY_CLK, DISPLAY_DIO);

// ============== VARIABLES ==============
int targetCount = 0;
int currentCount = 0;
int displayCode = 0;               
bool showDepositCode = false;      
float previousDistance = 0;
unsigned long lastCountTime = 0;
unsigned long lastPollTime = 0;
bool itemInZone = false;           
bool binFull = false;

ESP8266WebServer server(80);

// ============== FUNCTION PROTOTYPES ==============
float measureDistance();
void detectBattery();
void updateDisplay();
void updateLEDs();
void sendStatusToDashboard();
void pollDashboardForTargets();

// ============== SETUP ==============
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n=== BatteryLoop Bin Starting ===");
  
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(YELLOW_LED, OUTPUT);
  
  display.setBrightness(0x0f);
  display.showNumberDec(0);
  
  Serial.println("Scanning for Open WiFi networks...");
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  int n = WiFi.scanNetworks();
  bool connected = false;
  
  if (n == 0) {
    Serial.println("No networks found.");
  } else {
    for (int i = 0; i < n; ++i) {
      if (WiFi.encryptionType(i) == ENC_TYPE_NONE) {
        Serial.print("Connecting to open network: ");
        Serial.println(WiFi.SSID(i));
        WiFi.begin(WiFi.SSID(i));
        
        int timeout = 0;
        while (WiFi.status() != WL_CONNECTED && timeout < 20) {
          delay(500);
          Serial.print(".");
          timeout++;
        }
        
        if (WiFi.status() == WL_CONNECTED) {
          connected = true;
          break;
        }
      }
    }
  }

  if (connected) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to any open WiFi network.");
  }
  
  server.begin();
  Serial.println("=== Ready to sync with Dashboard ===\n");
}

// ============== MAIN LOOP ==============
void loop() {
  server.handleClient();
  
  if (targetCount == 0) {
    pollDashboardForTargets();
  }
  
  float currentDistance = measureDistance();
  bool isInTriggerZone = (currentDistance < TRIGGER_ZONE);
  
  if (isInTriggerZone && !itemInZone) {
    itemInZone = true;
    if (currentCount > 0 && (millis() - lastCountTime) > DEBOUNCE_TIME) {
      detectBattery();
      lastCountTime = millis();
    }
  }
  
  if (!isInTriggerZone && itemInZone) {
    itemInZone = false;
  }
  
  binFull = (currentDistance < BIN_FULL_DISTANCE);
  previousDistance = currentDistance;
  
  updateDisplay();
  updateLEDs();
  
  delay(100); 
}

// ============== FETCH TARGET FROM DASHBOARD ==============
void pollDashboardForTargets() {
  if (millis() - lastPollTime < 3000) return; 
  lastPollTime = millis();
  
  if (WiFi.status() != WL_CONNECTED) return;
  
  WiFiClientSecure client;
  client.setInsecure(); // Required for HTTPS to Vercel
  HTTPClient http;
  
  http.begin(client, API_GET_PENDING);
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    if (payload.indexOf("\"hasPending\":true") > 0) {
      int targetIndex = payload.indexOf("\"targetCount\":");
      int newTarget = 0;
      if (targetIndex > 0) {
        int startIndex = targetIndex + 14;
        int endIndex = payload.indexOf(",", startIndex);
        if (endIndex == -1) endIndex = payload.indexOf("}", startIndex);
        newTarget = payload.substring(startIndex, endIndex).toInt();
      }
      
      int codeIndex = payload.indexOf("\"depositCode\":\"BAT");
      if (codeIndex > 0 && newTarget > 0) {
        int codeStartIndex = codeIndex + 18;
        displayCode = payload.substring(codeStartIndex, codeStartIndex + 4).toInt();
        
        targetCount = newTarget;
        currentCount = newTarget;
        showDepositCode = true; 
        
        Serial.print("\n=== NEW DEPOSIT! Code: ");
        Serial.print(displayCode);
        Serial.print(" | Target: ");
        Serial.print(targetCount);
        Serial.println(" ===");
      }
    }
  }
  http.end();
}

// ============== MEASURE DISTANCE (HC-SR04) ==============
float measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  float distance = duration / 58.0;
  if (distance > MAX_BIN_DISTANCE || distance < 2) return previousDistance;
  return distance;
}

// ============== DETECT BATTERY ==============
void detectBattery() {
  if (currentCount > 0) {
    currentCount--;
    showDepositCode = false; 
    Serial.println("✓✓✓ BATTERY COUNTED! ✓✓✓");
    
    if (currentCount == 0) {
      Serial.println("✓✓✓ TARGET REACHED! Sending to server... ✓✓✓");
      sendStatusToDashboard();
    }
  }
}

// ============== UPDATE DISPLAY & LEDS ==============
void updateDisplay() {
  if (targetCount == 0) {
    display.showNumberDec(0, true);
  } else if (showDepositCode) {
    display.showNumberDec(displayCode, true);
  } else {
    display.showNumberDec(currentCount, false);
  }
}

void updateLEDs() {
  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(YELLOW_LED, LOW);
  
  if (currentCount > 0) {
    digitalWrite(YELLOW_LED, HIGH);
  } else if (currentCount == 0 && binFull) {
    digitalWrite(RED_LED, HIGH);
  } else if (currentCount == 0 && !binFull) {
    digitalWrite(GREEN_LED, HIGH);
  }
}

// ============== SEND STATUS TO DASHBOARD ==============
void sendStatusToDashboard() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  WiFiClientSecure client;
  client.setInsecure(); // Required for HTTPS to Vercel
  HTTPClient http;
  
  http.begin(client, API_POST_DATA);
  http.addHeader("Content-Type", "application/json");
  
  String jsonPayload = "{\"binId\":\"BIN-01\", \"detectedCount\":" + String(targetCount) + "}";
  int httpResponseCode = http.POST(jsonPayload);
  
  if (httpResponseCode > 0) {
    Serial.println("Success! Points awarded to user.");
    targetCount = 0; 
    currentCount = 0;
    showDepositCode = false;
  } else {
    Serial.print("Error sending POST request. Error code: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

void handleSetTarget() { server.send(200, "text/plain", "Use the web dashboard instead!"); }
void handleGetStatus() { server.send(200, "text/plain", "Active"); }
```
