const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");
const router = express.Router();
router.use(authMiddleware);
router.use(requireRole("Faculty","Admin"));
function fid(req){return Number(req.user.id);}
function isAdmin(req){return req.user.role==="Admin";}

router.get("/", async (req,res)=>{
  try {
    const params=[]; let sql=`SELECT id, faculty_user_id AS facultyUserId, subject, class_name AS className, day_of_week AS dayOfWeek, start_time AS startTime, end_time AS endTime, room_number AS room, created_at AS createdAt FROM timetable_entries WHERE 1=1`;
    if(!isAdmin(req)){sql+=" AND faculty_user_id=?";params.push(fid(req));}
    sql+=" ORDER BY FIELD(day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), start_time";
    const [rows]=await db.query(sql,params);
    res.json({success:true,data:rows});
  } catch(e){res.status(500).json({success:false,message:"Failed to load timetable"});}
});

router.post("/", async (req,res)=>{
  try {
    const {subject,className,class_name,dayOfWeek,startTime,endTime,room}=req.body;
    const cls=class_name||className;
    if(!subject||!subject.trim()) return res.status(400).json({success:false,message:"Subject required"});
    if(!cls||!cls.trim()) return res.status(400).json({success:false,message:"Class required"});
    if(!dayOfWeek) return res.status(400).json({success:false,message:"Day required"});
    if(!startTime||!endTime) return res.status(400).json({success:false,message:"Start and end time required"});
    // conflict check
    const [conf]=await db.query(`SELECT id FROM timetable_entries WHERE day_of_week=? AND room_number=? AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?))`,
      [dayOfWeek, room||null, endTime, startTime, startTime, endTime]);
    if(conf&&conf.length) return res.status(409).json({success:false,message:"Room conflict"});
    const [r]=await db.query(`INSERT INTO timetable_entries (faculty_user_id,subject,class_name,day_of_week,start_time,end_time,room_number) VALUES (?,?,?,?,?,?,?)`,
      [fid(req),subject.trim(),cls.trim(),dayOfWeek,startTime,endTime,room?room.trim():null]);
    res.status(201).json({success:true,data:{id:r.insertId}});
  } catch(e){console.error(e);res.status(500).json({success:false,message:"Failed to create entry"});}
});

router.delete("/:id", async (req,res)=>{
  try {
    const params=[req.params.id]; let sql=`DELETE FROM timetable_entries WHERE id=?`;
    if(!isAdmin(req)){sql+=" AND faculty_user_id=?";params.push(fid(req));}
    const [r]=await db.query(sql,params);
    if(r.affectedRows===0) return res.status(404).json({success:false,message:"Not found"});
    res.json({success:true,message:"Deleted"});
  } catch(e){res.status(500).json({success:false,message:"Failed to delete"});}
});

module.exports=router;