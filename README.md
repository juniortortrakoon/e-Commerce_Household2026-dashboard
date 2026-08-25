# ETDA Household Digital Economy Dashboard — React (Vite)

โปรเจกต์นี้ทำโครงสร้างให้เหมือนกับงาน Hotel DM Radar (React + Vite)
เพื่อให้แก้ไขงานได้ในรูปแบบเดียวกัน คือแก้ที่ `src/App.jsx` เป็นหลัก

## วิธีรันครั้งแรก
```
npm install
npm run dev
```
เปิดลิงก์ที่ terminal แสดง (ปกติ http://localhost:5173) เพื่อดูตัวอย่าง

## วิธีแก้ไข
| อยากแก้อะไร | ไปแก้ไฟล์ไหน |
|---|---|
| โครงหน้าเว็บ / ข้อความ / เลย์เอาต์ (HTML) | `src/bodyMarkup.html` |
| สี / ธีม / ระยะห่าง (CSS) | `src/dashboard.css` |
| การคำนวณ / การสร้างกราฟ (JS logic) | `src/dashboardLogic.js` |
| ข้อมูลดิบจากแบบสำรวจ | `src/data.js` |
| จุดเริ่มต้น/ประกอบร่างทั้งหมด | `src/App.jsx` |

แก้เสร็จแล้ว `npm run dev` จะรีเฟรชให้อัตโนมัติ (hot reload)

## Deploy
```
npm run build
```
จะได้โฟลเดอร์ `dist/` เป็น static files พร้อม deploy ขึ้น Vercel/Netlify/GitHub Pages
(บน Vercel/Netlify แค่เชื่อม repo แล้วตั้ง Build command เป็น `npm run build`,
Output directory เป็น `dist` — ระบบจะ build ให้อัตโนมัติทุกครั้งที่ push โค้ดใหม่)

## ที่มา
ETDA — โครงการวัดมูลค่าพาณิชย์อิเล็กทรอนิกส์และสถานะการเปลี่ยนผ่านด้านดิจิทัล
ภาคครัวเรือน (ผู้ประกอบการที่ไม่ได้จดทะเบียนนิติบุคคล) · n = 3,473
