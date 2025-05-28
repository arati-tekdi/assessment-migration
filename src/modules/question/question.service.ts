import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { QuestionEntity } from "./question.entity";
import * as path from "path";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import * as fs from "fs";

@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name);
  private readonly logFile = path.join(__dirname, "../../logs/migration.log");
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async generateQuestionRequestBodyMCQ(record: any) {
    if (!record) throw new Error("Question not found");

    let options = [];
    for (let i = 0; i <= 3; i++) {
      const key = `option${i}`;
      const rawValue = record[key];
      this.logger.log("type:", typeof rawValue);
      this.logger.log("rawValue: ", rawValue);
      if (rawValue) options.push(rawValue);
    }

    const ansIndex = parseInt(record.ansOption, 10)
      ? parseInt(record.ansOption, 10)
      : 0;

    const editorOptions = options.map((opt, index) => ({
      answer: index === ansIndex,
      value: {
        body: `<p>${opt}</p>`,
        value: index,
      },
    }));

    const interactionOptions = options.map((opt, index) => ({
      label: `<p>${opt}</p>`,
      value: index,
    }));
    const subDomainArray = record.subDomain
      ? record.subDomain.split(",").map((item: any) => item.trim())
      : [];

    const subjectArray = record.subject
      ? record.subject.split(",").map((item: any) => item.trim())
      : [];

    return {
      request: {
        question: {
          code: uuidv4(),
          mimeType: "application/vnd.sunbird.question",
          media: [] as any,
          editorState: {
            options: editorOptions,
            question: `<p>${record.question}</p>`,
          },
          templateId: "mcq-vertical",
          answer: `<div class='answer-container'><div class='answer-body'><p>${options[ansIndex]}</p></div></div>`,
          maxScore: record.maxScore,
          name: record.question,
          responseDeclaration: {
            response1: {
              cardinality: "single",
              type: "integer",
              correctResponse: {
                value: ansIndex,
              },
              mapping: [
                {
                  value: ansIndex,
                  score: record.maxScore,
                },
              ],
            },
          },
          outcomeDeclaration: {
            maxScore: {
              cardinality: "single",
              type: "integer",
              defaultValue: record.maxScore,
            },
          },
          interactionTypes: ["choice"],
          interactions: {
            response1: {
              type: "choice",
              options: interactionOptions,
            },
          },
          qType: "MCQ",
          primaryCategory: "Multiple Choice Question",
          body: `<div class='question-body' tabindex='-1'><div class='mcq-title' tabindex='0'><p>${record.question}</p></div><div data-choice-interaction='response1' class='mcq-vertical'></div></div>`,
          solutions: {},
          author: record.author,
          channel: this.configService.get("CHANNEL_ID"),
          framework: this.configService.get("FRAMEWORK_ID"),
          domain: record.domain,
          subDomain: subDomainArray,
          subject: subjectArray,
        },
      },
    };
  }
  async generateQuestionRequestBodyArrange(record: any) {
    const uniqueCode = uuidv4();
    const hintId = uuidv4();
    const subDomainArray = record.subDomain
      ? record.subDomain.split(",").map((item: any) => item.trim())
      : [];

    const subjectArray = record.subject
      ? record.subject.split(",").map((item: any) => item.trim())
      : [];
    const answerValues = Object.entries(record)
      .filter(
        ([key, value]) =>
          /^option\d+$/.test(key) && value !== null && value !== undefined
      )
      .sort(([aKey], [bKey]) => {
        const aNum = parseInt(aKey.replace("option", ""), 10);
        const bNum = parseInt(bKey.replace("option", ""), 10);
        return aNum - bNum;
      })
      .map(([, value]) => value);
    const options = answerValues.map((val: any, index: any) => ({
      value: {
        body: `<p>${val}</p>`,
        value: index,
      },
    }));

    const interactionOptions = answerValues.map((val: any, index: any) => ({
      label: `<p>${val}</p>`,
      value: index,
    }));

    const answerHtml = answerValues
      .map((val: any) => `<div class='answer-body'><p>${val}</p></div>`)
      .join("");

    const responseDeclarationMapping = answerValues.map(
      (_: any, index: any) => ({
        value: index,
        score: 1 / answerValues.length,
      })
    );

    return {
      request: {
        question: {
          answer: `<div class='answer-container'>${answerHtml}</div>`,
          author: record.author,
          body: `<div class='question-body' tabindex='-1'><div class='asq-title' tabindex='0'><p>${record.question}</p></div><div data-order-interaction='response1' class='asq-vertical'></div></div>`,
          channel: this.configService.get("CHANNEL_ID"),
          code: uniqueCode,
          domain: record.domain,
          editorState: {
            options: options,
            question: `<p>${record.question}</p>`,
          },
          framework: this.configService.get("FRAMEWORK_ID"),
          interactions: {
            response1: {
              type: "order",
              options: interactionOptions,
              validation: { required: "Yes" },
            },
          },
          interactionTypes: ["order"],
          maxScore: record.maxScore,
          media: [] as any,
          mimeType: "application/vnd.sunbird.question",
          name: record.question,
          outcomeDeclaration: {
            maxScore: {
              cardinality: "ordered",
              type: "integer",
              defaultValue: record.maxScore,
            },
            hint: {
              cardinality: "single",
              type: "string",
              defaultValue: hintId,
            },
          },
          primaryCategory: "Arrange Sequence Question",
          qType: "ASQ",
          responseDeclaration: {
            response1: {
              cardinality: "ordered",
              type: "integer",
              correctResponse: {
                value: answerValues.map((_: any, i: any) => i),
              },
              mapping: responseDeclarationMapping,
            },
          },
          solutions: {},
          subDomain: subDomainArray,
          subject: subjectArray,
          templateId: "asq-vertical",
        },
      },
    };
  }
  async generateQuestionRequestBodyMatch(record: any) {
    if (!record) throw new Error("Question not found");
    const options: any[] = [];
    const subDomainArray = record.subDomain
      ? record.subDomain.split(",").map((item: any) => item.trim())
      : [];

    const subjectArray = record.subject
      ? record.subject.split(",").map((item: any) => item.trim())
      : [];

    for (let i = 0; i <= 3; i++) {
      const key = `option${i}`;
      const rawValue = record[key];
      console.log("type:", typeof rawValue);
      console.log("rawValue: ", rawValue);
      if (typeof rawValue === "string" && rawValue.trim() !== "") {
        try {
          const parsed = JSON.parse(rawValue);
          options.push(parsed);
        } catch (err) {
          console.warn(`❌ Failed to parse ${key}:`, err);
          this.logError(
            `Failed to parse ${key} : ${err} in generateQuestionRequestBodyMatch`
          );
        }
      }
    }

    const uniqueCode = uuidv4();
    const hintId = uuidv4();

    const leftOptions = options.map((pair: any, index) => ({
      value: { body: `<p>${pair.left}</p>`, value: index },
    }));

    const rightOptions = options.map((pair: any, index) => ({
      value: { body: `<p>${pair.right}</p>`, value: index },
    }));

    const interactionLeft = options.map((pair: any, index) => ({
      label: `<p>${pair.left}</p>`,
      value: index,
    }));

    const interactionRight = options.map((pair: any, index) => ({
      label: `<p>${pair.right}</p>`,
      value: index,
    }));

    const correctResponse = options.map((_, index) => ({
      left: index,
      right: [index],
    }));

    const mapping = options.map((_, index) => ({
      value: { left: index, right: index },
      score: record.maxScore / options.length,
    }));

    const leftHtml = options
      .map((pair: any) => `<div class='left-option'><p>${pair.left}</p></div>`)
      .join("");
    const rightHtml = options
      .map(
        (pair: any) => `<div class='right-option'><p>${pair.right}</p></div>`
      )
      .join("");
    const answerHtml = `<div class='match-container'><div class='left-options'>${leftHtml}</div><div class='right-options'>${rightHtml}</div></div>`;
    const assessmentType = record.questionType + " Test";
    return {
      request: {
        question: {
          body: `<div class='question-body' tabindex='-1'><div class='mtf-title' tabindex='0'><p>${record.question}</p></div><div data-match-interaction='response1' class='mtf-vertical'></div></div>`,
          answer: answerHtml,
          author: record.author,
          channel: this.configService.get("CHANNEL_ID"),
          code: uniqueCode,
          domain: record.domain,
          editorState: {
            options: {
              left: leftOptions,
              right: rightOptions,
            },
            question: `<p>${record.questionText}</p>`,
          },
          framework: this.configService.get("FRAMEWORK_ID"),
          interactions: {
            response1: {
              type: "match",
              options: {
                left: interactionLeft,
                right: interactionRight,
              },
              validation: { required: "Yes" },
            },
          },
          interactionTypes: ["match"],
          maxScore: record.maxScore,
          media: [] as any,
          mimeType: "application/vnd.sunbird.question",
          name: record.question,
          outcomeDeclaration: {
            maxScore: {
              cardinality: "multiple",
              type: "integer",
              defaultValue: record.maxScore,
            },
            hint: {
              cardinality: "single",
              type: "string",
              defaultValue: hintId,
            },
          },
          primaryCategory: "Match The Following Question",
          qType: "MTF",
          responseDeclaration: {
            response1: {
              cardinality: "multiple",
              type: "map",
              correctResponse: {
                value: correctResponse,
              },
              mapping: mapping,
            },
          },
          solutions: {},
          subDomain: subDomainArray,
          subject: subjectArray,
          templateId: "mtf-vertical",
        },
      },
    };
  }
  async generateAllQuestionRequestBodies(records: any[]): Promise<any[]> {
    const allRequests = [];

    for (const record of records) {
      try {
        let details;
        console.log("record.questionType ", record.questionType);
        let recordTypeArr = [
          "MULTIPLE CHOICE",
          "TRUE OR FALSE",
          "MATCHING PAIR",
          "ARRANGE SEQUENCE",
        ];
        if (!recordTypeArr.includes(record.questionType)) {
          this.logger.error(`Error invalid type of question`, record);
          return;
        }
        // check type of record
        if (
          record.questionType == "MULTIPLE CHOICE" ||
          record.questionType == "TRUE OR FALSE"
        ) {
          const request = await this.generateQuestionRequestBodyMCQ(record);
          details = {
            request: request,
            dbId: record.id,
          };
        } else if (record.questionType == "MATCHING PAIR") {
          const request = await this.generateQuestionRequestBodyMatch(record);
          details = {
            request: request,
            dbId: record.id,
          };
        } else if (record.questionType == "ARRANGE SEQUENCE") {
          const request = await this.generateQuestionRequestBodyArrange(record);
          details = {
            request: request,
            dbId: record.id,
          };
        }

        console.log("details: ", JSON.stringify(details));
        allRequests.push(details);
      } catch (error) {
        this.logError(
          `Error generating request for record: ${record}, ${error}`
        );
      }
    }

    return allRequests;
  }

  async importAllQuestions(requestBodies: any[]) {
    const endpoint = `${this.configService.get(
      "INTERFACE_BASE_URL"
    )}/action/question/v2/create`;
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
          await this.publishQuestion(response.data.result.identifier, req.dbId);
          return { index, status: "success", data: response.data };
        } catch (error: any) {
          console.log(
            "error.response.data.result: ",
            error.response.data.result
          );
          this.logError(`❌ [${index}] Error: ${error.message}`);
          await this.updateQuestionInDB(req.dbId, {
            isMigrated: 2,
          });
        }
      })
    );
    return results;
  }
  async updateQuestionInDB(id: number, obj: any): Promise<void> {
    await this.questionRepo.update(id, obj);
  }

  async migrateQuestion(limit = 20) {
    try {
      this.logger.log(`Starting question import with limit: ${limit}`);

      // Update query for quettions to migrated to 2 if migrated values is 0 and questionType IN ('MULTIPLE SELECT');
      await this.questionRepo.query(`
        UPDATE QuestionsData 
        SET isMigrated = 2 
        WHERE isMigrated = 0 AND questionType IN ('MULTIPLE SELECT')
      `);
      
      this.logger.log(
        `✅ Updated all MULTIPLE SELECT questions to isMigrated = 2`
      );

      // ✅ Fetch questions from `Questions` table with migrated value 0
      const questions = await this.questionRepo.query(`
        SELECT *
        FROM QuestionsData 
        WHERE isMigrated = 0
        LIMIT ${limit}
    `);
      this.logger.log(`1. ✅ Questions fetched successfully from DB.`);
      if (questions.length === 0) {
        this.logger.log("No new Questions to import.");
        return;
      }

      const requestBodies = await this.generateAllQuestionRequestBodies(
        questions
      );
      this.logger.log(`2. ✅ Request bodies generated successfully.`);
      const results = await this.importAllQuestions(requestBodies);

      this.logger.log(`3. ✅ All questions imported successfully.`);
    } catch (error: any) {
      this.logError(`❌ Error in createQuestion: ${error}`);
    }
  }
  async publishQuestion(doId: string, dbId: number) {
    const endpoint = `${this.configService.get(
      "INTERFACE_BASE_URL"
    )}/action/question/v2/publish/${doId}`;
    try {
      const response = await this.retryRequest(
        () =>
          axios.post(
            endpoint,
            {
              request: {
                question: {},
              },
            },
            {
              headers: {
                "Content-Type": "application/json",
                tenantId: this.configService.get("TENANT_ID"),
                Authorization: `Bearer ${this.configService.get("TOKEN")}`,
              },
            }
          ),
        3,
        2000,
        "Publish Question"
      );
      this.logger.log(`4. ✅ publish Success:`, response.data.result);
      await this.updateQuestionInDB(dbId, {
        isMigrated: 1,
        do_id: response.data.result.identifier,
        versionKey: response.data.result.versionKey,
      });

      return { status: "success", data: response.data };
    } catch (error: any) {
      this.logError(
        `❌  Error: while publish ${doId} and dbId ${dbId} ${error.message}`
      );
      await this.updateQuestionInDB(dbId, {
        isMigrated: 2,
      });
    }
  }
  private logError(message: string) {
    const logDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logDir, "migration.log");
    const logEntry = `[${new Date().toISOString()}] ${message}\n`;

    console.log("logFile", logFile);
    console.log("logDir", logDir);
    try {
      // Ensure /logs directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Create log file if it doesn't exist and append log entries
      fs.appendFileSync(logFile, logEntry);

      // Log to console
      console.error(message);
    } catch (err) {
      console.error("Failed to write to log file:", err);
    }
  }
  private async retryRequest<T>(
    fn: () => Promise<T>,
    retries = 3,
    delayMs = 2000,
    label = "API"
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ ${label} attempt ${attempt} failed: ${message}`);
        if (attempt < retries) {
          await new Promise((res) => setTimeout(res, delayMs));
        } else {
          this.handleApiError(label, error);
          throw error;
        }
      }
    }
    throw new Error(`${label} failed after ${retries} retries`);
  }
  private handleApiError(
    methodName: string,
    error: unknown,
    contentId?: string
  ) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const logMessage =
      `❌ API Error in ${methodName}: ${errorMessage}` +
      (contentId ? ` (Content ID: ${contentId})` : "");

    // ✅ Print error in console for debugging
    console.error(logMessage);

    // ✅ Log error to file
    this.logErrorToFile(logMessage);
  }
  private logErrorToFile(logMessage: string): void {
    const logFilePath = path.join(process.cwd(), "error.log"); // Ensures log is in a fixed location

    // ✅ Write log to `error.log`
    fs.appendFile(
      logFilePath,
      `${new Date().toISOString()} - ${logMessage}\n`,
      (err) => {
        if (err) console.error("❌ Failed to write to error.log", err);
      }
    );
  }
}
