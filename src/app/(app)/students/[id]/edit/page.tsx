import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { StudentForm } from "@/components/StudentForm";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { studentFormLabels } from "@/lib/studentFormLabels";
import { updateStudent } from "@/domain/students/actions";
import { byId, enrollmentHistory } from "@/domain/students/repo";

export const metadata = { title: "बदल — Edit student" };

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCtx();
  const { id } = await params;
  const t = await getT();

  const student = await byId(ctx, id);
  if (!student) notFound();

  const history = await enrollmentHistory(ctx, id);
  const current = history.find((e) => e.academicYearId === ctx.academicYearId) ?? null;

  return (
    <>
      <PageHeader
        title={`${t("action.edit")} — ${student.firstNameMr} ${student.lastNameMr}`}
        subtitle={`${t("students.gr")} ${student.grNumber}`}
      />
      <StudentForm
        action={updateStudent}
        labels={studentFormLabels(t)}
        student={student as unknown as Record<string, unknown>}
        enrollment={current}
        cancelHref={`/students/${id}`}
      />
    </>
  );
}
