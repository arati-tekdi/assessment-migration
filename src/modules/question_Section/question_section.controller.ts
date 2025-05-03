import { Controller, Post, Param, Body } from "@nestjs/common";
import { QuestionSectionService } from "./question_section.service";

@Controller("questions_section")
export class QuestionSectionController {
  constructor(
    private readonly questionSectionService: QuestionSectionService
  ) {}

  @Post("questionSet-import")
  async assessmentImport() {
    return this.questionSectionService.migrateQuestionSection();
  }
}
