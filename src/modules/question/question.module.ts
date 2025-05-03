import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config"; // ✅ Import ConfigModule
import { TypeOrmModule } from "@nestjs/typeorm"; // ✅ Import TypeOrmModule
import { HttpModule } from "@nestjs/axios"; // ✅ Import HttpModule
import { QuestionEntity } from "./question.entity";
import { QuestionService } from "./question.service";
import { QuestionController } from "./question.controller";

@Module({
  imports: [
    ConfigModule, // ✅ Correct usage without .forRoot()
    TypeOrmModule.forFeature([QuestionEntity]),
    HttpModule,
  ],
  providers: [QuestionService],
  controllers: [QuestionController],
})
export class QuestionModule {}
