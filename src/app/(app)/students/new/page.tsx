import { PageHeader } from "@/components/PageHeader";
import { StudentForm } from "@/components/StudentForm";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { studentFormLabels } from "@/lib/studentFormLabels";
import { createStudent } from "@/domain/students/actions";

export const metadata = { title: "नवीन विद्यार्थी — New student" };

export default async function NewStudentPage() {
  await requireCtx();
  const t = await getT();

  return (
    <>
      <PageHeader title={t("students.new")} />
      <StudentForm
        action={createStudent}
        labels={studentFormLabels(t)}
        cancelHref="/students"
      />
    </>
  );
}
