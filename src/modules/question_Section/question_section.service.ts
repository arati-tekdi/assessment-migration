import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { QuestionSet } from "./question_section.entity";
import * as fs from "fs";

interface QuestionSetInput {
  total_maxscore: any;
  sectionName: string;
  language: any;
  subDomain: any;
  domain: any;
  testName: string;
  questionSetId: string;
  name: string;
  program: string[];
  medium: string[];
  gradeLevel: string[];
  subject: string[];
  courseType: string[];
  author: string;
  maxTime: number;
  description: string;
  board: string;
  assessmentType: string;
  maxAttempts: number;
  maxScore: number;
  lastUpdatedBy: string;
}
interface SectionInput {
  total_maxscore: any;
  sectionName: any;
  questionSetId: any;
  parentQuestionSetId: string;
  name: string;
  description: string;
  instructions: string;
  userId: string;
}
interface RequestBody {
  request: {
    data: {
      nodesModified: {
        [key: string]: {
          root: boolean;
          objectType: "QuestionSet";
          metadata: {
            appIcon: string;
            name: string;
            program: string[];
            medium: string[];
            gradeLevel: string[];
            subject: string[];
            courseType: string[];
            showTimer: boolean;
            requiresSubmit: string;
            author: string;
            primaryCategory: string;
            attributions: any[];
            timeLimits: {
              questionSet: {
                max: number;
                min: number;
              };
            };
            description: string;
            board: string;
            assessmentType: string;
            maxAttempts: number;
            summaryType: string;
            outcomeDeclaration: {
              maxScore: {
                cardinality: string;
                type: string;
                defaultValue: number;
              };
            };
          };
          isNew: boolean;
        };
      };
      hierarchy: {
        [key: string]: {
          name: string;
          children: any[];
          root: boolean;
        };
      };
      lastUpdatedBy: string;
    };
  };
}
interface SectionInput {
  id: string;
  name: string;
  description: string;
}

interface CreateRequestInput {
  doId: string;
  userId: string;
  questionSetName: string;
  questionSetDescription: string;
  author: string;
  contentLanguage: string;
  sections: SectionInput[];
}

@Injectable()
export class QuestionSectionService {
  private readonly logger = new Logger(QuestionSectionService.name);
  private readonly logFile = path.join(__dirname, "../../logs/migration.log");
  constructor(
    @InjectRepository(QuestionSet)
    private readonly questionSectionRepo: Repository<QuestionSet>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async updateQuestionSectionInDB(id: number, obj: any): Promise<void> {
    await this.questionSectionRepo.update(id, obj);
  }

  async migrateQuestionSection(limit = 1) {
    try {
      this.logger.log(`Starting question import with limit: ${limit}`);

      // ✅ Fetch questions from `Questions` table with migrated value 0
      let questionsSet = await this.questionSectionRepo.query(`
        SELECT DISTINCT testName
        FROM QuestionSet where isMigrated = 0
        limit ${limit}
    `);
      this.logger.log(`✅ Question sets fetched successfully from DB.`);
      this.logger.log("questionsSets: ", questionsSet);
      if (questionsSet.length === 0) {
        this.logger.log("No new Question set to import.");
        return;
      }
      for (const set of questionsSet) {
        let questionsSections = await this.questionSectionRepo.query(`
          SELECT * FROM QuestionSet where testName = '${set.testName}' and isMigrated = 0
      `);
        this.logger.log(
          `✅ Question setions fetched successfully from DB. for test ${set.testName}`
        );
        this.logger.log("questionsSections: ", questionsSections);

        const resultOfSets = await this.createQuestionSets(questionsSections);
        this.logger.log("resultOfSets: ", JSON.stringify(resultOfSets));
        this.logger.log(`✅et and sections generated successfully.`);
      }
    } catch (error: any) {
      this.logError(
        `Error in fetching sections for migration ${error.message}`
      );
      throw error;
    }
  }

  async createQuestionSets(records: any): Promise<any[]> {
    try {
      const endpointCreate = `${this.configService.get(
        "INTERFACE_BASE_URL"
      )}/action/questionset/v2/create`;
      const endpointUpdate = `${this.configService.get(
        "INTERFACE_BASE_URL"
      )}/action/questionset/v2/hierarchy/update`;

      //for (const record of records) {
      const createSetPayload = {
        request: {
          questionset: {
            name: records[0].sectionName + " " + records[0].testName,
            mimeType: "application/vnd.sunbird.questionset",
            primaryCategory: "Practice Question Set",
            code: uuidv4(),
            createdBy: this.configService.get("USER_ID"),
            framework: this.configService.get("FRAMEWORK_ID"),
            channel: this.configService.get("CHANNEL_ID"),
          },
        },
      };

      //Step 1.create questionSet
      const createSetResponse = await this.retryRequest(
        () =>
          axios.post(endpointCreate, createSetPayload, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.configService.get("TOKEN")}`,
              tenantid: this.configService.get("TENANT_ID"),
              "X-Channel-Id": this.configService.get("CHANNEL_ID"),
            },
          }),
        3,
        2000,
        "Create Set"
      );

      records[0].questionSetId = createSetResponse.data.result.identifier;
      this.logger.log(
        `Step 1. Question set created successfully ${records[0].questionSetId}`
      );
      //Step 2.Update set
      const payloadSetUpdate = JSON.stringify(
        this.buildQuestionSetRequest(records[0])
      );
      this.logger.log("payloadSetUpdate: ", payloadSetUpdate);
      const updateSetResponse = await this.retryRequest(
        () =>
          axios.patch(endpointUpdate, payloadSetUpdate, {
            headers: {
              "Content-Type": "application/json",
              "X-Channel-Id": this.configService.get("CHANNEL_ID"),
              Authorization: `Bearer ${this.configService.get("TOKEN")}`,
              tenantid: this.configService.get("TENANT_ID"),
            },
          }),
        3,
        2000,
        "Update Set"
      );
      if (updateSetResponse.status !== 200) {
        this.logError(
          `Error in updating question set ${records[0].questionSetId} - ${updateSetResponse.statusText}`
        );
        throw new Error(
          `Failed to update question set ${records[0].questionSetId}`
        );
      }
      this.logger.log(
        `Step 2.Question set updated successfully ${records[0].questionSetId}`
      );
      const updateTestDoId = await this.updateTestDoId(
        records[0].questionSetId,
        records.map((record: any) => record.id)
      );

      this.logger.log(
        "Question set updated in DB successfully: ",
        records[0].questionSetId
      );
      let sectionArr: any[] = [];
      for (const record of records) {
        record.uuid = uuidv4();
        let tempSection = {
          id: record.uuid,
          name: record.sectionName,
          description: record.description || "NA",
        };
        sectionArr.push(tempSection);
      }
      let questionSetName = "";
      if (this.configService.get("PROGRAM") === "Vocational Training")
        questionSetName = records[0].testName;
      else questionSetName = records[0].sectionName + " " + records[0].testName;
      let input = {
        doId: records[0].questionSetId,
        userId: this.configService.get("USER_ID"),
        questionSetName: questionSetName,
        questionSetDescription: records[0].description || "NA",
        contentLanguage: records[0].language,
        author: "Manas",
        sections: sectionArr,
      };
      //create all set
      const payloadAllSections = JSON.stringify(
        this.createQuestionSetRequest(input)
      );
      this.logger.log("payloadAllSections: ", payloadAllSections);
      const createSectionsResponse = await this.retryRequest(
        () =>
          axios.patch(endpointUpdate, payloadAllSections, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.configService.get("TOKEN")}`,
              tenantid: this.configService.get("TENANT_ID"),
              "X-Channel-Id": this.configService.get("CHANNEL_ID"),
            },
          }),
        3,
        2000,
        "Create Sections"
      );
      this.logger.log("createSectionResponse: ", createSectionsResponse.data);
      const identifiers = createSectionsResponse.data.result.identifiers;

      const newSectionsArr: any = this.mapSectionIdentifiers(
        records,
        identifiers
      );
      this.logger.log(
        `Step 3.Question section created successfully ${JSON.stringify(
          newSectionsArr
        )}`
      );
      await this.updateDoIds(newSectionsArr);

      //Step 4.map questions to sections
      for (const record of newSectionsArr) {
        const resultOfQuestionMapping = await this.mapQuestionsToSection(
          record.id
        );
        this.logger.log(
          `Section ${record.sectionName} mapped to doId: ${record.sections_do_Id}`
        );
      }

      this.logger.log(`Step 4.Questions mapped to the section Successfully`);
      //Step 5.publish questionset
      const result = await this.questionSetPublish(records[0].questionSetId);
      this.logger.log(
        `Step 5. Question set published successfully for ${records[0].questionSetId}`
      );

      //update DB
      for (const record of records) {
        await this.questionSectionRepo.update(record.id, {
          isMigrated: 1,
        });
      }

      this.logger.log(
        `Question set migrated successfully for ${records[0].testName} and setId ${records[0].questionSetId}`
      );
      //}
      return [];
    } catch (error: any) {
      this.logError(`Error in createQuestionSets ${error.message}`);
    }
  }
  mapSectionIdentifiers(
    sections: any[],
    identifiers: Record<string, string>
  ): SectionInput[] {
    return sections.map((section) => {
      const mappedId = identifiers[section.uuid];
      return {
        ...section,
        sections_do_Id: mappedId || section.id, // fallback if no match found
      };
    });
  }
  async updateDoIds(records: any[]): Promise<any> {
    for (const record of records) {
      await this.questionSectionRepo.update(
        { id: Number(record.id) },
        { sections_do_Ids: [record.sections_do_Id] }
      );
    }
  }

  buildQuestionSetRequest(input: any): any {
    try {
      const {
        program,
        subject,
        subDomain,
        testName,
        description,
        assessmentType,
        domain,
        language,
        maxAttempts,
        questionSetId,
        total_maxscore,
      } = input;
      let questionSetName;
      //
      input.program = input.program.trimEnd();
      if (this.configService.get("PROGRAM") === "Vocational Training")
        questionSetName = input.testName;
      else questionSetName = input.sectionName + " " + input.testName;
      //let programString = program + "".trimEnd();
      const reqObj: any = {
        request: {
          data: {
            nodesModified: {
              [questionSetId]: {
                root: true,
                objectType: "QuestionSet",
                metadata: {
                  appIcon: "",
                  name: questionSetName,
                  program: [this.configService.get("PROGRAM")],
                  subject: Array.isArray(subject) ? subject : [subject],
                  subDomain: Array.isArray(subDomain) ? subDomain : [subDomain],
                  targetAgeGroup: ["18 yrs +"],
                  primaryUser: ["Learners/Children"],
                  showTimer: false,
                  requiresSubmit: "No",
                  author: "",
                  primaryCategory: "Practice Question Set",
                  attributions: [],
                  timeLimits: {
                    questionSet: {
                      max: 0,
                      min: 0,
                    },
                  },
                  description: description || "NA",
                  instructions: "<p>NA</p>",
                  assessmentType: `${assessmentType.trim()} Test`,
                  domain,
                  contentLanguage: language,
                  maxAttempts: maxAttempts || 0,
                  summaryType: "Score & Duration",
                  outcomeDeclaration: {
                    maxScore: {
                      cardinality: "single",
                      type: "integer",
                      defaultValue: input.total_maxscore,
                    },
                  },
                },
                isNew: false,
              },
            },
            hierarchy: {
              [questionSetId]: {
                name: testName,
                children: [],
                root: true,
              },
            },
            lastUpdatedBy: this.configService.get("USER_ID"),
          },
        },
      };

      return reqObj;
    } catch (error: any) {
      this.logError(`Error in buildQuestionSetRequest ${error.message}`);
    }
  }
  buildSecondQuestionSectionRequest(records: any, sectionOneId: any): any {
    const input = records[1];
    const id1 = uuidv4();
    const nodesModified: any = {};
    nodesModified[id1] = {
      root: false,
      objectType: "QuestionSet",
      metadata: {
        mimeType: "application/vnd.sunbird.questionset",
        code: id1,
        name: input.sectionName,
        visibility: "Parent",
        primaryCategory: "Practice Question Set",
        shuffle: true,
        showFeedback: false,
        showSolutions: false,
        attributions: [],
        timeLimits: {
          questionSet: {
            max: 0,
            min: 0,
          },
        },
        description: "NA",
        instructions: "NA",
      },
      isNew: true,
    };
    nodesModified[input.questionSetId] = {
      root: false,
      objectType: "QuestionSet",
      metadata: {
        outcomeDeclaration: {
          maxScore: {
            cardinality: "single",
            type: "integer",
            defaultValue: 0,
          },
        },
      },
      isNew: false,
    };
    nodesModified[sectionOneId] = {
      root: false,
      objectType: "QuestionSet",
      metadata: {
        name: records[0].sectionName,
        shuffle: true,
        showFeedback: false,
        showSolutions: false,
        primaryCategory: "Practice Question Set",
        attributions: [],
        timeLimits: {
          questionSet: {
            max: 0,
            min: 0,
          },
        },
      },
      isNew: false,
    };

    const hierarchy: any = {};
    hierarchy[input.questionSetId] = {
      name: records[0].testName,
      children: [sectionOneId, id1],
      root: true,
    };
    hierarchy[sectionOneId] = {
      name: records[0].sectionName,
      children: [],
      root: false,
    };
    hierarchy[id1] = {
      name: input.sectionName,
      children: [],
      root: false,
    };

    return {
      request: {
        data: {
          nodesModified,
          hierarchy,
          lastUpdatedBy: this.configService.get("USER_ID"),
        },
      },
    };
  }

  buildFirstQuestionSectionRequest(input: SectionInput) {
    try {
      const id1 = uuidv4();
      const nodesModified: any = {};
      nodesModified[id1] = {
        root: false,
        objectType: "QuestionSet",
        metadata: {
          mimeType: "application/vnd.sunbird.questionset",
          code: id1,
          name: input.sectionName,
          visibility: "Parent",
          primaryCategory: "Practice Question Set",
          shuffle: true,
          showFeedback: false,
          showSolutions: false,
          attributions: [],
          timeLimits: {
            questionSet: {
              max: 0,
              min: 0,
            },
          },
          description: "NA",
          instructions: "NA",
        },
        isNew: true,
      };
      nodesModified[input.questionSetId] = {
        root: false,
        objectType: "QuestionSet",
        metadata: {
          outcomeDeclaration: {
            maxScore: {
              cardinality: "single",
              type: "integer",
              defaultValue: input.total_maxscore,
            },
          },
        },
        isNew: false,
      };

      const hierarchy: any = {};
      hierarchy[input.questionSetId] = {
        name: "Migration test",
        children: [id1],
        root: true,
      };

      hierarchy[id1] = {
        name: input.sectionName,
        children: [],
        root: false,
      };

      return {
        request: {
          data: {
            nodesModified,
            hierarchy,
            lastUpdatedBy: this.configService.get("USER_ID"),
          },
        },
      };
    } catch (error: any) {
      this.logError(
        `Error in buildFirstQuestionSectionRequest ${error.message}`
      );
    }
  }
  async questionSetPublish(questionSetId: string) {
    const endpoint = `${this.configService.get(
      "INTERFACE_BASE_URL"
    )}/action/questionset/v2/publish/${questionSetId}`;
    // Prepare the request body
    const requestBody = {
      request: {
        questionSet: {
          lastPublishedBy: this.configService.get("USER_ID"),
        },
      },
    };

    try {
      const response = await axios.post(endpoint, requestBody, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.configService.get("TOKEN")}`,
          tenantid: this.configService.get("TENANT_ID"),
        },
      });
      this.logger.log("Question set published successfully:", response.data);
    } catch (error) {
      this.logger.error("Error publishing question set:", error);
    }
  }
  async updateTestDoId(newValue: string, ids: number[]): Promise<void> {
    await this.questionSectionRepo
      .createQueryBuilder()
      .update(QuestionSet)
      .set({ test_do_id: newValue })
      .where("id IN (:...ids)", { ids }) // Use the spread operator to pass the list of IDs
      .execute();
  }
  async mapQuestionsToSections(recordIds: number[]): Promise<void> {
    try {
      //fetch records of question setions in recordIds
      const questionSetions = await this.questionSectionRepo
        .createQueryBuilder("QuestionSet")
        .where("QuestionSet.id IN (:...ids)", { ids: recordIds })
        .getMany();
      for (const section of questionSetions) {
        const rootId = section.test_do_id;
        const collectionId = section.sections_do_Ids[0];
        const children = section.questions_do_Ids;
        const endpoint = `${this.configService.get(
          "INTERFACE_BASE_URL"
        )}/action/questionset/v2/add`;
        const payload = {
          request: {
            questionset: {
              rootId: rootId,
              collectionId: collectionId,
              children: children,
            },
          },
        };
        const mapQuestionsToSectionResponse = await axios.patch(
          endpoint,
          payload,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.configService.get("TOKEN")}`,
              tenantid: this.configService.get("TENANT_ID"),
              "X-Channel-Id": this.configService.get("CHANNEL_ID"),
            },
          }
        );
        this.logger.log(
          "mapQuestionsToSectionResponse: ",
          mapQuestionsToSectionResponse.data
        );
      }
    } catch (error) {
      this.logger.error("Error in mapQuestionsToSections", error);
      throw error;
    }
  }
  async mapQuestionsToSection(recordId: number): Promise<void> {
    try {
      //fetch record of question setions of recordId

      const section = await this.questionSectionRepo
        .createQueryBuilder("QuestionSet")
        .where("QuestionSet.id = :id", { id: recordId })
        .getOne();
      if (section.questions_do_Ids.length === 0) {
        this.logger.log(`No questions to map for recordId: ${recordId}`);
        return;
      }
      const rootId = section.test_do_id;
      const collectionId = section.sections_do_Ids[0];
      const children = section.questions_do_Ids;

      const endpoint = `${this.configService.get(
        "INTERFACE_BASE_URL"
      )}/action/questionset/v2/add`;
      const payload = {
        request: {
          questionset: {
            rootId: rootId,
            collectionId: collectionId,
            children: children,
          },
        },
      };
      const mapQuestionsToSectionResponse = await this.retryRequest(
        () =>
          axios.patch(endpoint, payload, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.configService.get("TOKEN")}`,
              tenantid: this.configService.get("TENANT_ID"),
              "X-Channel-Id": this.configService.get("CHANNEL_ID"),
            },
          }),
        3,
        2000,
        "Map Section and questions"
      );
      this.logger.log(
        "mapQuestionsToSectionResponse: ",
        mapQuestionsToSectionResponse.data
      );
    } catch (error) {
      this.logError(`Error in mapQuestionsToSections ${error}`);
      throw error;
    }
  }
  private logError(message: string) {
    const logDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logDir, "migration.log");
    const logEntry = `[${new Date().toISOString()}] ${message}\n`;

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
  async getQuestionSectionById(id: number): Promise<QuestionSet | null> {
    return this.questionSectionRepo.findOne({ where: { id } });
  }
  createQuestionSetRequest(input: CreateRequestInput): any {
    const {
      doId,
      userId,
      questionSetName,
      questionSetDescription,
      author,
      contentLanguage,
      sections,
    } = input;

    let nodesModified: any = {};

    let hierarchy: any = {};
    hierarchy[doId] = {
      name: questionSetName,
      children: sections.map((section) => section.id),
      root: true,
    };

    for (const section of sections) {
      nodesModified[section.id] = {
        root: false,
        objectType: "QuestionSet",
        metadata: {
          mimeType: "application/vnd.sunbird.questionset",
          code: section.id,
          name: section.name,
          visibility: "Parent",
          primaryCategory: "Practice Question Set",
          shuffle: true,
          showFeedback: false,
          showSolutions: false,
          attributions: [],
          timeLimits: {
            questionSet: { max: 0, min: 0 },
          },
          description: section.description,
        },
        isNew: true,
      };

      hierarchy[section.id] = {
        name: section.name,
        children: [],
        root: false,
      };
    }
    hierarchy[doId] = {
      name: questionSetName,
      children: sections.map((section) => section.id),
      root: true,
    };
    nodesModified[doId] = {
      root: true,
      objectType: "QuestionSet",
      metadata: {
        appIcon: "",
        name: questionSetName,
        program: ["Vocational Training"],
        subject: ["Beauty"],
        targetAgeGroup: ["18 yrs +"],
        primaryUser: ["Learners/Children"],
        showTimer: false,
        requiresSubmit: "No",
        author,
        primaryCategory: "Practice Question Set",
        attributions: [],
        timeLimits: {
          questionSet: { max: 0, min: 0 },
        },
        description: questionSetDescription,
        domain: "Learning for Work",
        subDomain: ["Career Exploration"],
        contentLanguage,
        assessmentType: "Post Test",
        outcomeDeclaration: {
          maxScore: {
            cardinality: "single",
            type: "integer",
            defaultValue: 0,
          },
        },
      },
      isNew: false,
    };

    return {
      request: {
        data: {
          nodesModified,
          hierarchy,
          lastUpdatedBy: userId,
        },
      },
    };
  }
}
