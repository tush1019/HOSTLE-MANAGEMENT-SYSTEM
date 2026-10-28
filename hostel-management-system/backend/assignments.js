const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");
const router = express.Router();
router.use(authMiddleware);
router.use(requireRole("Faculty", "Admin"));
function fid(req){return Number(req.user.id);}
function isAdmin(req){return req.user.role==="Admin";}

router.get("/", async (req,res)=>{
  try {
    const params=[]; let sql=`SELECT id, assignment_code AS assignmentCode, faculty_user_id AS facultyUserId, title, instructions, subject, class_name AS className, deadline, status, created_at AS createdAt FROM assignments WHERE 1=1`;
    if(!isAdmin(req)){sql+=" AND faculty_user_id=?";params.push(fid(req));}
    sql+=" ORDER BY deadline DESC LIMIT 200";
    const [rows]=await db.query(sql,params);
    res.json({success:true,data:rows});
  } catch(e){res.status(500).json({success:false,message:"Failed to load assignments"});}
});

router.post("/", async (req,res)=>{
  try {
    const {title,instructions,subject,className,class_name,deadline,status}=req.body;
    const cls=class_name||className;
    if(!title||!title.trim()) return res.status(400).json({success:false,message:"Title required"});
    if(!subject||!subject.trim()) return res.status(400).json({success:false,message:"Subject required"});
    if(!cls||!cls.trim()) return res.status(400).json({success:false,message:"Class required"});
    if(!deadline) return res.status(400).json({success:false,message:"Deadline required"});
    const st=["Draft","Published","Archived"].includes(status)?status:"Draft";
    const code="ASN"+Date.now().toString(36).toUpperCase();
    const [r]=await db.query(`INSERT INTO assignments (assignment_code,faculty_user_id,title,instructions,subject,class_name,deadline,status) VALUES (?,?,?,?,?,?,?,?)`,
      [code,fid(req),title.trim(),instructions||null,subject.trim(),cls.trim(),deadline,st]);
    const [rows]=await db.query(`SELECT id, assignment_code AS assignmentCode, title, subject, class_name AS className, deadline, status FROM assignments WHERE id=?`,[r.insertId]);
    res.status(201).json({success:true,data:rows[0]});
  } catch(e){console.error(e);res.status(500).json({success:false,message:"Failed to create assignment"});}
});

router.put("/:id", async (req,res)=>{
  try {
    const {title,instructions,subject,className,class_name,deadline,status}=req.body;
    const cls=class_name||className;
    const params=[]; let sql=`UPDATE assignments SET title=COALESCE(?,title), instructions=COALESCE(?,instructions), subject=COALESCE(?,subject), class_name=COALESCE(?,class_name), deadline=COALESCE(?,deadline), status=COALESCE(?,status), updated_at=CURRENT_TIMESTAMP WHERE id=?`;
    params.push(title?title.trim():null, instructions!==undefined?instructions:null, subject?subject.trim():null, cls?cls.trim():null, deadline||null, status||null, req.params.id);
    if(!isAdmin(req)){sql+=" AND faculty_user_id=?";params.push(fid(req));}
    const [r]=await db.query(sql,params);
    if(r.affectedRows===0) return res.status(404).json({success:false,message:"Not found"});
    res.json({success:true,message:"Updated"});
  } catch(e){res.status(500).json({success:false,message:"Failed to update"});}
});

router.delete("/:id", async (req,res)=>{
  try {
    const params=[req.params.id]; let sql=`DELETE FROM assignments WHERE id=?`;
    if(!isAdmin(req)){sql+=" AND faculty_user_id=?";params.push(fid(req));}
    const [r]=await db.query(sql,params);
    if(r.affectedRows===0) return res.status(404).json({success:false,message:"Not found"});
    res.json({success:true,message:"Deleted"});
  } catch(e){res.status(500).json({success:false,message:"Failed to delete"});}
});

router.get("/:id/submissions", async (req,res)=>{
  try {
    const [rows]=await db.query(`SELECT s.id AS studentId, s.name AS studentName, s.student_code AS studentCode,
      sub.id, sub.submitted_at AS submittedAt, sub.marks, sub.feedback, sub.status
      FROM students s LEFT JOIN assignment_submissions sub ON sub.student_id=s.id AND sub.assignment_id=?
      ORDER BY s.name`, [req.params.id]);
    res.json({success:true,data:rows});
  } catch(e){res.status(500).json({success:false,message:"Failed to load submissions"});}
});

router.put("/:id/submissions", async (req,res)=>{
  try {
    const records=Array.isArray(req.body.records)?req.body.records:[];
    for(const r of records){
      const sid=Number(r.student_id||r.studentId); if(!Number.isFinite(sid)) continue;
      const status=["Not Submitted","Submitted","Graded"].includes(r.status)?r.status:"Not Submitted";
      const marks=r.marks===undefined||r.marks===""?null:Number(r.marks);
      const feedback=r.feedback||null;
      const submitted=r.submitted_at|| (status!=="Not Submitted"?new Date().toISOString().slice(0,19).replace("T"," "):null);
      const [ex]=await db.query(`SELECT id FROM assignment_submissions WHERE assignment_id=? AND student_id=?`,[req.params.id,sid]);
      if(ex&&ex.length){
        await db.query(`UPDATE assignment_submissions SET status=?, marks=?, feedback=?, submitted_at=COALESCE(?,submitted_at), updated_at=CURRENT_TIMESTAMP WHERE assignment_id=? AND student_id=?`,
          [status,marks,feedback,submitted,req.params.id,sid]);
      } else {
        await db.query(`INSERT INTO assignment_submissions (assignment_id,student_id,status,marks,feedback,submitted_at) VALUES (?,?,?,?,?,?)`,
          [req.params.id,sid,status,marks,feedback,submitted]);
      }
    }
    res.json({success:true,message:"Saved"});
  } catch(e){console.error(e);res.status(500).json({success:false,message:"Failed to save submissions"});}
});

module.exports=router;