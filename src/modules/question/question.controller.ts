import { Controller, Post, Param, Body } from "@nestjs/common";
import { QuestionService } from "./question.service";

@Controller("questions")
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Post("assessment-import")
  async assessmentImport() {
    return this.questionService.migrateQuestion();
  }
}
