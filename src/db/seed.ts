/**
 * Seeds one pilot school so the app is usable the moment the database exists.
 * Run with `npm run db:seed`. Idempotent: re-running replaces the seed data
 * rather than duplicating it.
 *
 * The sample students are fictional but shaped like real register entries —
 * Marathi names as the statutory record, English for government uploads,
 * a scatter of missing optional fields so validation and the export
 * pre-flight have something realistic to complain about.
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";
import { hashPassword } from "../lib/auth/password";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url || url.includes("PROJECT_REF")) {
  console.error("\n  ✗ DATABASE_URL is not configured — see docs/SETUP-SUPABASE.md\n");
  process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1)/.test(url);
const sql = postgres(url, { ssl: isLocal ? false : "require", prepare: false, max: 1 });
const db = drizzle(sql, { schema, casing: "snake_case" });

const { schools, academicYears, users, students, enrollments, documentCounters } = schema;

const UDISE = "27251000101";

// Marathi given / middle / surname triples with their English transliterations.
const NAMES: Array<[string, string, string, string, string, string, "male" | "female"]> = [
  ["आदित्य", "संजय", "पाटील", "Aditya", "Sanjay", "Patil", "male"],
  ["स्नेहा", "विठ्ठल", "जाधव", "Sneha", "Vitthal", "Jadhav", "female"],
  ["रोहित", "बाळासाहेब", "देशमुख", "Rohit", "Balasaheb", "Deshmukh", "male"],
  ["प्रिया", "रमेश", "कुलकर्णी", "Priya", "Ramesh", "Kulkarni", "female"],
  ["सागर", "दत्तात्रय", "शिंदे", "Sagar", "Dattatray", "Shinde", "male"],
  ["ऐश्वर्या", "प्रकाश", "गायकवाड", "Aishwarya", "Prakash", "Gaikwad", "female"],
  ["निखिल", "अशोक", "मोरे", "Nikhil", "Ashok", "More", "male"],
  ["पूजा", "सुरेश", "पवार", "Pooja", "Suresh", "Pawar", "female"],
  ["ओंकार", "नितीन", "भोसले", "Omkar", "Nitin", "Bhosale", "male"],
  ["श्रद्धा", "गणेश", "सावंत", "Shraddha", "Ganesh", "Sawant", "female"],
  ["कार्तिक", "महेश", "चव्हाण", "Kartik", "Mahesh", "Chavan", "male"],
  ["मानसी", "अनिल", "जोशी", "Manasi", "Anil", "Joshi", "female"],
  ["सिद्धार्थ", "राजेंद्र", "साळुंखे", "Siddharth", "Rajendra", "Salunkhe", "male"],
  ["तेजस्विनी", "भारत", "थोरात", "Tejaswini", "Bharat", "Thorat", "female"],
  ["अजिंक्य", "शिवाजी", "काळे", "Ajinkya", "Shivaji", "Kale", "male"],
  ["वैष्णवी", "दिलीप", "राणे", "Vaishnavi", "Dilip", "Rane", "female"],
  ["प्रथमेश", "उमेश", "घाडगे", "Prathamesh", "Umesh", "Ghadge", "male"],
  ["सानिका", "योगेश", "माने", "Sanika", "Yogesh", "Mane", "female"],
  ["हर्षल", "किशोर", "वाघ", "Harshal", "Kishor", "Wagh", "male"],
  ["गायत्री", "मंगेश", "शेलार", "Gayatri", "Mangesh", "Shelar", "female"],
  ["ऋषिकेश", "संतोष", "बोराटे", "Rushikesh", "Santosh", "Borate", "male"],
  ["अनुष्का", "विजय", "खंडागळे", "Anushka", "Vijay", "Khandagale", "female"],
  ["सर्वेश", "नंदकुमार", "लोखंडे", "Sarvesh", "Nandkumar", "Lokhande", "male"],
  ["इशा", "अरुण", "निकम", "Isha", "Arun", "Nikam", "female"],
  ["अथर्व", "प्रमोद", "सोनवणे", "Atharva", "Pramod", "Sonawane", "male"],
];

const CATEGORIES = ["OPEN", "OBC", "SC", "ST", "VJNT", "SBC", "EWS"];
const CLASSES = ["5", "6", "7", "8", "9", "10"];
const DIVISIONS = ["अ", "ब"];

async function main() {
  console.log("\n  Seeding pilot school ...");

  // Idempotency: drop any previous seed for this UDISE code, children first.
  const [existing] = await db.select().from(schools).where(eq(schools.udiseCode, UDISE)).limit(1);
  if (existing) {
    console.log("  - clearing previous seed");
    await db.delete(schema.auditLog).where(eq(schema.auditLog.schoolId, existing.id));
    await db.delete(schema.importRows).where(eq(schema.importRows.schoolId, existing.id));
    await db.delete(schema.importBatches).where(eq(schema.importBatches.schoolId, existing.id));
    await db.delete(schema.exportRuns).where(eq(schema.exportRuns.schoolId, existing.id));
    await db.delete(schema.lcDetails).where(eq(schema.lcDetails.schoolId, existing.id));
    await db.delete(schema.documents).where(eq(schema.documents.schoolId, existing.id));
    await db.delete(documentCounters).where(eq(documentCounters.schoolId, existing.id));
    await db.delete(enrollments).where(eq(enrollments.schoolId, existing.id));
    await db.delete(students).where(eq(students.schoolId, existing.id));
    await db.delete(schema.sessions).where(eq(schema.sessions.schoolId, existing.id));
    await db.delete(users).where(eq(users.schoolId, existing.id));
    await db.delete(academicYears).where(eq(academicYears.schoolId, existing.id));
    await db.delete(schools).where(eq(schools.id, existing.id));
  }

  const [school] = await db
    .insert(schools)
    .values({
      nameMr: "जिल्हा परिषद प्राथमिक व माध्यमिक विद्यालय, वडगाव",
      nameEn: "Zilla Parishad Primary & Secondary School, Wadgaon",
      udiseCode: UDISE,
      boardIndex: "P-11.1.001",
      managementType: "Local body",
      medium: "Marathi",
      address: "मु. पो. वडगाव, ता. हवेली",
      taluka: "हवेली",
      district: "पुणे",
      principalNameMr: "श्रीमती. सुनीता रामचंद्र देशपांडे",
    })
    .returning();

  const [year] = await db
    .insert(academicYears)
    .values({
      schoolId: school.id,
      label: "2026-27",
      startDate: "2026-06-15",
      endDate: "2027-04-30",
      isCurrent: true,
    })
    .returning();

  // Development credentials only. The real deployment creates users through
  // Settings; nothing here should ever reach production.
  const principalPw = await hashPassword("principal-dev-2026");
  const clerkPw = await hashPassword("clerk-dev-2026");

  await db.insert(users).values([
    {
      schoolId: school.id,
      name: "सुनीता देशपांडे",
      email: "principal@wadgaon.test",
      phone: "9800000001",
      role: "principal",
      passwordHash: principalPw,
    },
    {
      schoolId: school.id,
      name: "महेश कुलकर्णी",
      email: "clerk@wadgaon.test",
      phone: "9800000002",
      role: "clerk",
      passwordHash: clerkPw,
    },
  ]);

  // Serial counters start at 1 for each document type.
  await db.insert(documentCounters).values([
    { schoolId: school.id, docType: "lc", nextSerial: 1 },
    { schoolId: school.id, docType: "bonafide", nextSerial: 1 },
    { schoolId: school.id, docType: "id_card", nextSerial: 1 },
  ]);

  const rows = NAMES.map((n, i) => {
    const [fMr, mMr, lMr, fEn, mEn, lEn, sex] = n;
    const birthYear = 2010 + (i % 6);
    const cls = CLASSES[i % CLASSES.length];
    return {
      student: {
        schoolId: school.id,
        grNumber: String(1001 + i),
        firstNameMr: fMr,
        middleNameMr: mMr,
        lastNameMr: lMr,
        firstNameEn: fEn,
        middleNameEn: mEn,
        lastNameEn: lEn,
        dob: `${birthYear}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
        gender: sex,
        motherNameMr: `सौ. ${mMr.slice(0, 3)}ाबाई ${lMr}`,
        // Every fifth record is left missing its English parent names, which
        // is what the UDISE pre-flight is meant to catch. Without a few real
        // gaps the export screen looks like it does nothing.
        motherNameEn: i % 5 === 0 ? null : `${mEn.slice(0, 3)}abai ${lEn}`,
        fatherNameMr: `${mMr} ${lMr}`,
        fatherNameEn: i % 5 === 0 ? null : `${mEn} ${lEn}`,
        category: CATEGORIES[i % CATEGORIES.length],
        religion: "हिंदू",
        nationality: "Indian",
        motherTongue: "मराठी",
        birthVillage: "वडगाव",
        birthTaluka: "हवेली",
        birthDistrict: "पुणे",
        birthState: "महाराष्ट्र",
        admissionDate: `${2020 + (i % 5)}-06-15`,
        admissionClass: CLASSES[i % 3],
        // Deliberately incomplete on some rows, so export validation has
        // something real to catch during the pilot.
        apaarId: i % 4 === 0 ? null : `APAAR${String(100000 + i)}`,
        aadhaarVerified: i % 3 !== 0,
        bloodGroup: i % 5 === 0 ? null : ["A+", "B+", "O+", "AB+"][i % 4],
        status: "studying" as const,
      },
      cls,
      division: DIVISIONS[i % 2],
      rollNo: Math.floor(i / CLASSES.length) + 1,
    };
  });

  const inserted = await db
    .insert(students)
    .values(rows.map((r) => r.student))
    .returning({ id: students.id, gr: students.grNumber });

  await db.insert(enrollments).values(
    inserted.map((s, i) => ({
      schoolId: school.id,
      studentId: s.id,
      academicYearId: year.id,
      class: rows[i].cls,
      division: rows[i].division,
      rollNo: rows[i].rollNo,
    })),
  );

  console.log(`  ✓ ${school.nameEn}`);
  console.log(`  ✓ academic year ${year.label}`);
  console.log(`  ✓ ${inserted.length} students, ${inserted.length} enrollments`);
  console.log("\n  Sign in with either:");
  console.log("    principal@wadgaon.test  /  principal-dev-2026");
  console.log("    clerk@wadgaon.test      /  clerk-dev-2026\n");
}

main()
  .catch((err) => {
    console.error("\n  ✗ Seed failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => sql.end());
