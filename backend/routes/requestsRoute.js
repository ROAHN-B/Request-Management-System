const express = require("express");
const router = express.Router();
const mqtt = require("mqtt"); 

module.exports = (io, db) => {
    
    router.get("/active", (req, res) => {
        const sql = "SELECT * FROM requests WHERE status = 'ACTIVE' ORDER BY sender_time DESC";
        db.query(sql, (err, results) => {
            if (err) return res.status(500).json({ error: "DATABASE ERROR" });
            res.json(results);
        });
    });

    router.get("/history", (req, res) => {
        const sql = "SELECT * FROM requests WHERE status = 'COMPLETED' ORDER BY receiver_time DESC";
        db.query(sql, (err, results) => {
            if (err) return res.status(500).json({ error: "DATABASE ERROR" });
            res.json(results);
        });
    });

   
    const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

    mqttClient.on("connect", () => {
        console.log("Connected to MQTT Broker");
        mqttClient.subscribe("hospital/request", (err) => {
            if (!err) console.log("Subscribed to hospital/request");
        });
    });

    
    mqttClient.on("message", (topic, message) => {
        if (topic === "hospital/request") {
            try {
                const data = JSON.parse(message.toString());
                const { ward_number, status } = data;

                if (!ward_number) return;

                
                
                if (status === "COMPLETED") {
                    const updateRequestQuery = `
                        UPDATE requests 
                        SET receiver_time = NOW(), 
                            status = 'COMPLETED',
                            total_time = TIMESTAMPDIFF(SECOND, sender_time, NOW())
                        WHERE ward_number = ? AND status = 'ACTIVE'
                        ORDER BY sender_time DESC 
                        LIMIT 1
                    `;

                    db.execute(updateRequestQuery, [ward_number], (err, result) => {
                        if (err) return console.error("MQTT Update Error:", err);
                        if (result.affectedRows > 0) {
                            io.emit("request-update", { ward_number, status: "IDLE" });
                            console.log(`Ward ${ward_number} Completed via MQTT`);
                        }
                    });

                } else {
                    // Check for active request
                    db.execute("SELECT id FROM requests WHERE ward_number = ? AND status = 'ACTIVE'", [ward_number], (err, results) => {
                        if (err) return console.error("MQTT Select Error:", err);
                        
                        if (results.length === 0) {
                            const insertRequestQuery = `
                                INSERT INTO requests (ward_number, sender_time, status) 
                                VALUES (?, NOW(), 'ACTIVE')
                            `;
                            db.execute(insertRequestQuery, [ward_number], (err) => {
                                if (err) return console.error("MQTT Insert Error:", err);
                                io.emit("new-request", { ward_number, status: "ACTIVE" });
                                console.log(`Ward ${ward_number} Active via MQTT`);
                            });
                        }
                    });
                }
            } catch (e) {
                console.error("Invalid MQTT Payload", e);
            }
        }
    });

    return router;
};