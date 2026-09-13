ALTER TYPE "public"."doc_type" ADD VALUE 'character';--> statement-breakpoint
ALTER TYPE "public"."doc_type" ADD VALUE 'noc';--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "caste_cert_no" text;