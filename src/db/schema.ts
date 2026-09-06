/**
 * Single source of truth for the database. Implements PRD Section 7.
 *
 * OWNED BY FOUNDATION — read-only to feature workers. If you need a column,
 * request the change rather than editing this file, so migrations stay linear.
 *
 * Two rules hold everywhere:
 *   1. Every table except `schools` carries `schoolId` with an FK and an index.
 *      The tenant layer (src/lib/tenant.ts) relies on this being universal.
 *   2. Nothing that has legal weight is ever hard-deleted. Students carry a
 *      status; issued documents are immutable.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** No delete path exists for a student. `left` = left normally, `tc_issued` =
 *  transfer certificate issued, which freezes the record. */
export const studentStatus = pgEnum("student_status", [
  "studying",
  "left",
  "tc_issued",
]);

export const userRole = pgEnum("user_role", ["principal", "clerk"]);

export const docType = pgEnum("doc_type", ["lc", "bonafide", "id_card"]);

export const gender = pgEnum("gender", ["male", "female", "other"]);

export const exportTarget = pgEnum("export_target", ["udise", "saral"]);

export const importStatus = pgEnum("import_status", [
  "staged",
  "committed",
  "failed",
]);

// ---------------------------------------------------------------------------
// Tenant root
// ---------------------------------------------------------------------------

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  nameMr: text("name_mr").notNull(),
  nameEn: text("name_en").notNull(),
  udiseCode: text("udise_code").notNull(),
  boardIndex: text("board_index"),
  managementType: text("management_type"),
  medium: text("medium"),
  address: text("address"),
  taluka: text("taluka"),
  district: text("district"),
  logoPath: text("logo_path"),
  principalNameMr: text("principal_name_mr"),
  signaturePath: text("signature_path"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const academicYears = pgTable(
  "academic_years",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    label: text("label").notNull(), // "2026-27"
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
  },
  (t) => [
    index("academic_years_school_idx").on(t.schoolId),
    unique("academic_years_school_label_uq").on(t.schoolId, t.label),
  ],
);

// ---------------------------------------------------------------------------
// People with logins
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    role: userRole("role").notNull(),
    passwordHash: text("password_hash").notNull(),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("users_school_idx").on(t.schoolId),
    // Login is by phone OR email, so both must be unique per school when present.
    unique("users_school_phone_uq").on(t.schoolId, t.phone),
    unique("users_school_email_uq").on(t.schoolId, t.email),
  ],
);

/** Server-side sessions (PRD principle 7 — no third-party auth service).
 *  The cookie carries only the token; everything else lives here. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** SHA-256 of the cookie token, never the token itself. A leaked database
     *  dump must not hand the reader a set of live sessions. */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sessions_school_idx").on(t.schoolId),
    index("sessions_token_hash_idx").on(t.tokenHash),
  ],
);

// ---------------------------------------------------------------------------
// The register itself
// ---------------------------------------------------------------------------

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),

    grNumber: text("gr_number").notNull(),
    apaarId: text("apaar_id"),
    aadhaarVerified: boolean("aadhaar_verified").notNull().default(false),

    // Marathi is the statutory name; English is for government uploads.
    firstNameMr: text("first_name_mr").notNull(),
    middleNameMr: text("middle_name_mr"),
    lastNameMr: text("last_name_mr").notNull(),
    firstNameEn: text("first_name_en").notNull(),
    middleNameEn: text("middle_name_en"),
    lastNameEn: text("last_name_en").notNull(),

    dob: date("dob").notNull(),
    /** The LC prints the date of birth in Marathi words. Stored rather than
     *  derived, because a correction to the generator must not silently change
     *  what a previously issued certificate said. */
    dobInWordsMr: text("dob_in_words_mr"),
    gender: gender("gender").notNull(),

    motherNameMr: text("mother_name_mr"),
    motherNameEn: text("mother_name_en"),
    fatherNameMr: text("father_name_mr"),
    fatherNameEn: text("father_name_en"),

    caste: text("caste"),
    subCaste: text("sub_caste"),
    category: text("category"), // OPEN / SC / ST / OBC / VJNT / SBC / EWS
    religion: text("religion"),
    nationality: text("nationality").default("Indian"),
    motherTongue: text("mother_tongue"),

    birthVillage: text("birth_village"),
    birthTaluka: text("birth_taluka"),
    birthDistrict: text("birth_district"),
    birthState: text("birth_state"),

    bloodGroup: text("blood_group"),
    admissionDate: date("admission_date").notNull(),
    admissionClass: text("admission_class"),
    previousSchool: text("previous_school"),
    lastClassPassed: text("last_class_passed"),
    photoPath: text("photo_path"),

    status: studentStatus("status").notNull().default("studying"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("students_school_idx").on(t.schoolId),
    index("students_status_idx").on(t.schoolId, t.status),
    // The register's integrity. A duplicate GR number is a corrupt register.
    unique("students_school_gr_uq").on(t.schoolId, t.grNumber),
  ],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    class: text("class").notNull(),
    division: text("division"),
    rollNo: integer("roll_no"),
  },
  (t) => [
    index("enrollments_school_idx").on(t.schoolId),
    index("enrollments_year_class_idx").on(t.schoolId, t.academicYearId, t.class),
    unique("enrollments_student_year_uq").on(t.studentId, t.academicYearId),
  ],
);

// ---------------------------------------------------------------------------
// Documents — immutable once issued
// ---------------------------------------------------------------------------

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    docType: docType("doc_type").notNull(),
    serialNo: integer("serial_no").notNull(),
    issuedOn: date("issued_on").notNull(),
    issuedByUserId: uuid("issued_by_user_id")
      .notNull()
      .references(() => users.id),
    isDuplicate: boolean("is_duplicate").notNull().default(false),
    /** The snapshot. Everything printed on the certificate, frozen at issue
     *  time. Editing the student afterwards must never change an issued
     *  document — this column is why that holds. */
    payloadJson: jsonb("payload_json").notNull(),
    pdfPath: text("pdf_path"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("documents_school_idx").on(t.schoolId),
    index("documents_student_idx").on(t.schoolId, t.studentId),
    // Statutory serial continuity: no gaps, no reuse, per school per type.
    unique("documents_school_type_serial_uq").on(t.schoolId, t.docType, t.serialNo),
  ],
);

export const lcDetails = pgTable("lc_details", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => documents.id),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id),
  dateOfLeaving: date("date_of_leaving").notNull(),
  lastAttended: date("last_attended"),
  reasonMr: text("reason_mr"),
  progress: text("progress"),
  conduct: text("conduct"),
  duesCleared: boolean("dues_cleared").notNull().default(true),
  remarksMr: text("remarks_mr"),
});

/** One row per (school, docType). Serial allocation takes a row lock on this
 *  inside the issuance transaction — see src/domain/documents/serial.ts. */
export const documentCounters = pgTable(
  "document_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    docType: docType("doc_type").notNull(),
    nextSerial: integer("next_serial").notNull().default(1),
  },
  (t) => [unique("document_counters_school_type_uq").on(t.schoolId, t.docType)],
);

// ---------------------------------------------------------------------------
// Government export and bulk import
// ---------------------------------------------------------------------------

export const exportRuns = pgTable(
  "export_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    target: exportTarget("target").notNull(),
    /** Which versioned column mapping produced this file. Government templates
     *  change by resolution; we must be able to say which one we used. */
    templateVersion: text("template_version").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    filePath: text("file_path"),
    validationSummaryJson: jsonb("validation_summary_json"),
  },
  (t) => [index("export_runs_school_idx").on(t.schoolId)],
);

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    filename: text("filename").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    status: importStatus("status").notNull().default("staged"),
    mappingJson: jsonb("mapping_json"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("import_batches_school_idx").on(t.schoolId)],
);

export const importRows = pgTable(
  "import_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id),
    rowNumber: integer("row_number").notNull(),
    rawJson: jsonb("raw_json").notNull(),
    errorsJson: jsonb("errors_json"),
    studentId: uuid("student_id").references(() => students.id),
  },
  (t) => [
    index("import_rows_school_idx").on(t.schoolId),
    index("import_rows_batch_idx").on(t.batchId),
  ],
);

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    userId: uuid("user_id").references(() => users.id),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_school_idx").on(t.schoolId),
    index("audit_log_entity_idx").on(t.schoolId, t.entity, t.entityId),
  ],
);

// ---------------------------------------------------------------------------
// Inferred types — import these rather than redeclaring shapes.
// ---------------------------------------------------------------------------

export type School = typeof schools.$inferSelect;
export type AcademicYear = typeof academicYears.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type Enrollment = typeof enrollments.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type LcDetail = typeof lcDetails.$inferSelect;
export type ExportRun = typeof exportRuns.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type ImportRow = typeof importRows.$inferSelect;
