CREATE TYPE "public"."doc_type" AS ENUM('lc', 'bonafide', 'id_card');--> statement-breakpoint
CREATE TYPE "public"."export_target" AS ENUM('udise', 'saral');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('staged', 'committed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('studying', 'left', 'tc_issued');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('principal', 'clerk');--> statement-breakpoint
CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"label" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	CONSTRAINT "academic_years_school_label_uq" UNIQUE("school_id","label")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"next_serial" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "document_counters_school_type_uq" UNIQUE("school_id","doc_type")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"serial_no" integer NOT NULL,
	"issued_on" date NOT NULL,
	"issued_by_user_id" uuid NOT NULL,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"payload_json" jsonb NOT NULL,
	"pdf_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_school_type_serial_uq" UNIQUE("school_id","doc_type","serial_no")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"class" text NOT NULL,
	"division" text,
	"roll_no" integer,
	CONSTRAINT "enrollments_student_year_uq" UNIQUE("student_id","academic_year_id")
);
--> statement-breakpoint
CREATE TABLE "export_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"target" "export_target" NOT NULL,
	"template_version" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_path" text,
	"validation_summary_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"status" "import_status" DEFAULT 'staged' NOT NULL,
	"mapping_json" jsonb,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_json" jsonb NOT NULL,
	"errors_json" jsonb,
	"student_id" uuid
);
--> statement-breakpoint
CREATE TABLE "lc_details" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"date_of_leaving" date NOT NULL,
	"last_attended" date,
	"reason_mr" text,
	"progress" text,
	"conduct" text,
	"dues_cleared" boolean DEFAULT true NOT NULL,
	"remarks_mr" text
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_mr" text NOT NULL,
	"name_en" text NOT NULL,
	"udise_code" text NOT NULL,
	"board_index" text,
	"management_type" text,
	"medium" text,
	"address" text,
	"taluka" text,
	"district" text,
	"logo_path" text,
	"principal_name_mr" text,
	"signature_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"gr_number" text NOT NULL,
	"apaar_id" text,
	"aadhaar_verified" boolean DEFAULT false NOT NULL,
	"first_name_mr" text NOT NULL,
	"middle_name_mr" text,
	"last_name_mr" text NOT NULL,
	"first_name_en" text NOT NULL,
	"middle_name_en" text,
	"last_name_en" text NOT NULL,
	"dob" date NOT NULL,
	"dob_in_words_mr" text,
	"gender" "gender" NOT NULL,
	"mother_name_mr" text,
	"mother_name_en" text,
	"father_name_mr" text,
	"father_name_en" text,
	"caste" text,
	"sub_caste" text,
	"category" text,
	"religion" text,
	"nationality" text DEFAULT 'Indian',
	"mother_tongue" text,
	"birth_village" text,
	"birth_taluka" text,
	"birth_district" text,
	"birth_state" text,
	"blood_group" text,
	"admission_date" date NOT NULL,
	"admission_class" text,
	"previous_school" text,
	"last_class_passed" text,
	"photo_path" text,
	"status" "student_status" DEFAULT 'studying' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_school_gr_uq" UNIQUE("school_id","gr_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"role" "user_role" NOT NULL,
	"password_hash" text NOT NULL,
	"last_login" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_school_phone_uq" UNIQUE("school_id","phone"),
	CONSTRAINT "users_school_email_uq" UNIQUE("school_id","email")
);
--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_runs" ADD CONSTRAINT "export_runs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_runs" ADD CONSTRAINT "export_runs_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lc_details" ADD CONSTRAINT "lc_details_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lc_details" ADD CONSTRAINT "lc_details_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_years_school_idx" ON "academic_years" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "audit_log_school_idx" ON "audit_log" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("school_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "documents_school_idx" ON "documents" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "documents_student_idx" ON "documents" USING btree ("school_id","student_id");--> statement-breakpoint
CREATE INDEX "enrollments_school_idx" ON "enrollments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "enrollments_year_class_idx" ON "enrollments" USING btree ("school_id","academic_year_id","class");--> statement-breakpoint
CREATE INDEX "export_runs_school_idx" ON "export_runs" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "import_batches_school_idx" ON "import_batches" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "import_rows_school_idx" ON "import_rows" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "import_rows_batch_idx" ON "import_rows" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "sessions_school_idx" ON "sessions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "students_school_idx" ON "students" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "students_status_idx" ON "students" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "users_school_idx" ON "users" USING btree ("school_id");