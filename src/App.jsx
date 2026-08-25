import { useEffect, useRef } from 'react'
import './dashboard.css'
import bodyMarkup from './bodyMarkup.html?raw'
import { initDashboard } from './dashboardLogic.js'

/*
  ETDA Household Digital Economy Dashboard — React (Vite) version
  -----------------------------------------------------------------
  โครงสร้างนี้ยังคง "ตรรกะ" เดิมของแดชบอร์ดไว้ทั้งหมด (การ query DOM,
  การสร้างกราฟด้วย Chart.js, ฟิลเตอร์) ไว้ใน dashboardLogic.js
  ส่วน App.jsx นี้ทำหน้าที่ mount โครง HTML แล้วเรียก initDashboard()
  ครั้งเดียวตอนโหลดหน้า — เหมือนที่ตอนนี้แก้ไขงาน Hotel DM Radar ผ่าน App.jsx

  ถ้าต้องการแก้ไข:
  - แก้ "โครงหน้าเว็บ/ข้อความ/เลย์เอาต์" → แก้ไฟล์ src/bodyMarkup.html
  - แก้ "สี/ธีม/ระยะห่าง" → แก้ไฟล์ src/dashboard.css
  - แก้ "การคำนวณ/กราฟ" → แก้ไฟล์ src/dashboardLogic.js
  - แก้ "ข้อมูลดิบ" → แก้ไฟล์ src/data.js
*/
export default function App() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    initDashboard()
  }, [])

  return <div dangerouslySetInnerHTML={{ __html: bodyMarkup }} />
}
