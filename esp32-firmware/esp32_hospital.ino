#include <WiFi.h>
#include <HTTPClient.h>
#include "time.h"


// WIFI CONFIG
const char* ssid = "Redmi 12 5G";
const char* password = "123456789";

// SERVER CONFIG
const char* serverName = "http://10.16.62.85:3000";   

const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;   // IST
const int daylightOffset_sec = 0;

// PINS
int senderPins[4]   = {25, 27, 33, 18};
int receiverPins[4] = {26, 32, 4, 19};

bool requestActive[4] = {false, false, false, false};
unsigned long senderEpoch[4];

String getTimeStamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "0000-00-00 00:00:00";
  }

  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buffer);
}


void sendRequestToServer(int ward, String senderTime) {

  HTTPClient http;
  String url = String(serverName) + "/request";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String body = "{\"ward_number\":" + String(ward) +
                ",\"sender_time\":\"" + senderTime + "\"}";

  int httpResponseCode = http.POST(body);

  Serial.print("Request API Response: ");
  Serial.println(httpResponseCode);

  http.end();
}



void completeRequestToServer(int ward, String receiverTime, unsigned long totalSeconds) {

  HTTPClient http;
  String url = String(serverName) + "/complete";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String body = "{\"ward_number\":" + String(ward) +
                ",\"receiver_time\":\"" + receiverTime +
                "\",\"total_seconds\":" + String(totalSeconds) + "}";

  int httpResponseCode = http.POST(body);

  Serial.print("Complete API Response: ");
  Serial.println(httpResponseCode);

  http.end();
}

void setup() {

  Serial.begin(115200);

  // Setup pins
  for (int i = 0; i < 4; i++) {
    pinMode(senderPins[i], INPUT_PULLUP);
    pinMode(receiverPins[i], INPUT_PULLUP);
  }

  // Connect WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");

  // Sync Time
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  Serial.println("Time Synced!");
}

void loop() {

  for (int i = 0; i < 4; i++) {

    //sender button
    if (digitalRead(senderPins[i]) == LOW && !requestActive[i]) {

      String senderTime = getTimeStamp();
      senderEpoch[i] = time(NULL);
      requestActive[i] = true;

      Serial.println("===============================");
      Serial.print("WARD ");
      Serial.print(i + 1);
      Serial.println(" REQUEST SENT");
      Serial.println(senderTime);

      sendRequestToServer(i + 1, senderTime);

      delay(300);
    }

    //receiver button
    if (digitalRead(receiverPins[i]) == LOW && requestActive[i]) {

      String receiverTime = getTimeStamp();
      unsigned long receiverEpoch = time(NULL);
      unsigned long totalSeconds = receiverEpoch - senderEpoch[i];

      Serial.println("===============================");
      Serial.print("WARD ");
      Serial.print(i + 1);
      Serial.println(" REQUEST COMPLETED");
      Serial.println(receiverTime);

      Serial.print("Total Time: ");
      Serial.print(totalSeconds);
      Serial.println(" seconds");

      completeRequestToServer(i + 1, receiverTime, totalSeconds);

      requestActive[i] = false;

      delay(300);
    }
  }
}