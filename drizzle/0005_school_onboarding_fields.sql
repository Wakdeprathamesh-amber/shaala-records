ALTER TABLE "schools" ADD COLUMN "sanstha_name_en" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "address_en" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "village" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "post_office" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "pincode" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "taluka_en" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "district_en" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "state" text DEFAULT 'महाराष्ट्र';--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "principal_name_en" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "jr_college_index_no" text;