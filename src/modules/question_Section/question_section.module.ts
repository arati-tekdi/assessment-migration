import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config"; // ✅ Import ConfigModule
import { TypeOrmModule } from "@nestjs/typeorm"; // ✅ Import TypeOrmModule
import { HttpModule } from "@nestjs/axios"; // ✅ Import HttpModule
import { QuestionSectionController } from "./question_section.controller";
import { QuestionSectionService } from "./question_section.service";
import { QuestionSet } from "./question_section.entity";

@Module({
  imports: [
    ConfigModule, // ✅ Correct usage without .forRoot()
    TypeOrmModule.forFeature([QuestionSet]),
    HttpModule,
  ],
  providers: [QuestionSectionService],
  controllers: [QuestionSectionController],
})
export class QuestionSectionModule {}
