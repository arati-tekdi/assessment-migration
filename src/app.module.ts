import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { QuestionModule } from "./modules/question/question.module";
import { QuestionSectionModule } from "./modules/question_Section/question_section.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // ✅ Make ConfigModule global
    TypeOrmModule.forRoot({
      type: "mysql",
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER ?? "root",
      password: process.env.DB_PASS ?? "root",
      database: process.env.DB_NAME ?? "youthmanagement",
      autoLoadEntities: true,
      synchronize: true,
    }),
    HttpModule,
    QuestionModule,
    QuestionSectionModule,
  ],
})
export class AppModule {}
