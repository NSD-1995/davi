-- AddForeignKey
ALTER TABLE "AdmissionEnquiry" ADD CONSTRAINT "AdmissionEnquiry_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionEnquiry" ADD CONSTRAINT "AdmissionEnquiry_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionEnquiry" ADD CONSTRAINT "AdmissionEnquiry_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentMovement" ADD CONSTRAINT "EnrollmentMovement_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentMovement" ADD CONSTRAINT "EnrollmentMovement_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentMovement" ADD CONSTRAINT "EnrollmentMovement_fromSectionId_fkey" FOREIGN KEY ("fromSectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentMovement" ADD CONSTRAINT "EnrollmentMovement_toSectionId_fkey" FOREIGN KEY ("toSectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

