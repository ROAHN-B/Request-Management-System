const express = require("express");
const router = express.Router();

module.exports = (io,db)=> {
    router.post("/request", (req,res)=>{
        const { ward_number,sender_time }=req.body;

        // if data is not present in database
        if (!ward_number || !sender_time){
            return res.statusCode(400).json({error:"Missing data"});
        }
        const sql=`
            insert into requests (ward_number,sender_time,status)
            values (?,?,'ACTIVE')
        `;
        // error handling
        db.query(sql,[ward_number,sender_time],(err,result)=>{
            if(err){
                console.error(err);
                return res.statusCode(500).json({error:"DATABASE ERROR"});
            }

            io.emit("new_request",{
                id:result.insertId,
                ward_number,
                sender_time,
                status:"ACTIVE"
            });
            res.json({message: "Request created"})
        });
    });

    router.post("/complete",(req,res)=>{

        const { ward_number,receiver_time,total_time }=req.body;

        if (!ward_number||!receiver_time||total_time==null){
            return res.statusCode(400).json({ error: "Missing data" });
        }

        const sql=`
            update requests 
            set receiver_time = ?, total_time = ?, status = 'COMPLETED'
            where ward_number = ? AND status = 'ACTIVE'
        `;
        db.query(sql,[receiver_time,total_time,ward_number],(err,result)=>{
            if (err){
                console.error(err);
                return res.status(500).json({ error: "DATABASE ERROR" });
            }

            io.emit("request_completed",{
                ward_number,
                receiver_time,
                total_time
            });
            res.json({ message: "Request completed" });
        });
    });
    
    //get active requests
    router.get("/active",(req,res)=>{

        const sql = `
            select  * from requests
            where status='ACTIVE'
            order by sender_time desc
        `;
        // error handling
        db.query(sql,(err,results)=>{
            if (err){
                console.error(err);
                return res.status(500).json({error: "DATABASE ERROR"});
            }
            res.json(results);
        });
    });

    // get complete history
    router.get("/history", (req, res) => {
    const sql = `
      SELECT * FROM requests
      WHERE status = 'COMPLETED'
      ORDER BY receiver_time DESC
    `;

    db.query(sql, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      res.json(results);
    });
  });

  return router;
};
