const express = require("express");
const router = express.Router();

module.exports = (io, db) => {
    
    
    router.get("/active", (req, res) => {
        const sql = `
            SELECT * FROM requests 
            WHERE status = 'ACTIVE' 
            ORDER BY sender_time DESC
        `;
        
        db.query(sql, (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "DATABASE ERROR" });
            }
            res.json(results);
        });
    });

    
    router.get("/history", (req, res) => {
        const sql = `
            SELECT * FROM requests 
            WHERE status = 'COMPLETED' 
            ORDER BY receiver_time DESC
        `;

        db.query(sql, (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "DATABASE ERROR" });
            }
            res.json(results);
        });
    });

    
    router.post("/request", (req, res) => {
        const { ward_number, status } = req.body;

        if (!ward_number) {
            return res.status(400).json({ error: "Missing ward_number" });
        }

        // NURSE RECEIVER LOGIC (COMPLETING A REQUEST)
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
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: "DATABASE ERROR DURING COMPLETION" });
                }
                if (result.affectedRows === 0) return res.status(404).json({ error: "No active request found" });

                // Update the dashboard
                io.emit("request-update", { ward_number, status: "IDLE" });
                return res.status(200).json({ message: "SUCCESS: REQUEST COMPLETED" });
            });

        
        } else {
            
            db.execute("SELECT id FROM requests WHERE ward_number = ? AND status = 'ACTIVE'", [ward_number], (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: "DATABASE ERROR" });
                }
                
                if (results && results.length > 0) {
                    return res.status(400).json({ error: "Ward already has an active request" });
                }

                const insertRequestQuery = `
                    INSERT INTO requests (ward_number, sender_time, status) 
                    VALUES (?, NOW(), 'ACTIVE')
                `;

                db.execute(insertRequestQuery, [ward_number], (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: "DATABASE ERROR DURING GENERATION" });
                    }
                    io.emit("new-request", { ward_number, status: "ACTIVE" });
                    return res.status(200).json({ message: "SUCCESS: REQUEST GENERATED" });
                });
            });
        }
    });

    return router;
};