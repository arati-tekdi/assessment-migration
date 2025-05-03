import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { QuestionSectionEntity } from "./question_section.entity";

@Injectable()
export class QuestionSectionService {
  private readonly logger = new Logger(QuestionSectionService.name);
  private readonly logFile = path.join(__dirname, "../../logs/migration.log");
  constructor(
    @InjectRepository(QuestionSectionEntity)
    private readonly questionSectionRepo: Repository<QuestionSectionEntity>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}
  async generateQuestionSectionRequestBodies(record: any) {
    if (!record) throw new Error("Question section not found");

    return {
      dbId: record.Id,
      details: {
        request: {
          questionset: {
            name: record.name || "Untitled QuestionSet",
            mimeType: "application/vnd.sunbird.questionset",
            primaryCategory: "Practice Question Set",
            code: uuidv4(),
            createdBy: this.configService.get("USER_ID"),
            framework: this.configService.get("FRAMEWORK_ID"),
          },
        },
      },
    };
  }
  async updateQuestionSectionInDB(id: number, obj: any): Promise<void> {
    await this.questionSectionRepo.update(id, obj);
  }
  async importAllQuestionSection(requestBodies: any[]) {
    //create question section
    const endpoint = `${this.configService.get(
      "INTERFACE_BASE_URL"
    )}/action/questionset/v2/create`;
    const results = await Promise.allSettled(
      requestBodies.map(async (req, index) => {
        this.logger.log(`requestBody:`, req);
        try {
          const response = await axios.post(endpoint, req.request, {
            headers: {
              "Content-Type": "application/json",
              tenantId: this.configService.get("TENANT_ID"),
              Authorization: `Bearer ${this.configService.get("TOKEN")}`,
            },
          });
          this.logger.log(`✅ [${index}] Success:`, response.data.result);

          return { index, status: "success", data: response.data };
        } catch (error: any) {
          this.logger.error(
            `❌ [${index}] Error:`,
            error.response?.data || error.message
          );
          await this.updateQuestionSectionInDB(req.dbId, {
            isMigrated: 2,
          });
          return {
            index,
            status: "error",
            error: error.response?.data || error.message,
          };
        }
      })
    );
    return results;
  }
  async migrateQuestionSection(limit = 1) {
    try {
      this.logger.log(`Starting question import with limit: ${limit}`);

      // ✅ Fetch questions from `Questions` table with migrated value 0
      const questionsSections = await this.questionSectionRepo.query(`
        SELECT *
        FROM Questions 
        WHERE isMigrated = 0
        LIMIT ${limit}
    `);
      this.logger.log(`1. ✅ Question sections fetched successfully from DB.`);
      if (questionsSections.length === 0) {
        this.logger.log("No new Question sections to import.");
        return;
        // }
        // const requestBodies = await this.createQuestionSet(questionsSections);
        this.logger.log(`2. ✅ Request bodies generated successfully.`);
      }
    } catch (e) {
      this.logger.error("Error in migrateQuestionSection", e);
      throw e;
    }
  }

  async createQuestionSets(records: any): Promise<any[]> {
    const results = [];

    for (const record of records) {
      const payload = {
        request: {
          questionset: {
            name: record.name,
            mimeType: "application/vnd.sunbird.questionset",
            primaryCategory: "Practice Question Set",
            code: uuidv4(),
            createdBy: this.configService.get("USER_ID"),
            framework: this.configService.get("FRAMEWORK_ID"),
          },
        },
      };

      try {
        const endpoint = `${this.configService.get(
          "INTERFACE_BASE_URL"
        )} /action/questionset/v2/create`;
        const response = await axios.post(endpoint, payload, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.configService.get("TOKEN")}`,
            tenantid: this.configService.get("TENANT_ID"),
          },
        });

        results.push({
          name: record.name,
          status: "success",
          data: response.data,
        });
      } catch (error) {
        results.push({
          name: record.name,
          status: "error",
          error: error,
        });
      }
    }

    return results;
  }
}
