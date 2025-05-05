import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { QuestionSet } from "./question_section.entity";
import { fs } from "fs";

interface QuestionSetInput {
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
        this.logger.log(`✅✅✅et and sections generated successfully.`);
      }
    } catch (e) {
      this.logger.error("Error in migrateQuestionSection", e);
      throw e;
    }
  }

  async createQuestionSets(records: any): Promise<any[]> {
    const results = [];
    let recordIds = records.map((record: any) => record.id);

    const payload = {
      request: {
        questionset: {
          name: records[0].testName,
          mimeType: "application/vnd.sunbird.questionset",
          primaryCategory: "Practice Question Set",
          code: uuidv4(),
          createdBy: this.configService.get("USER_ID"),
          framework: this.configService.get("FRAMEWORK_ID"),
          channel: this.configService.get("CHANNEL_ID"),
        },
      },
    };

    try {
      //create questionSet
      const endpointCreate = `${this.configService.get(
        "INTERFACE_BASE_URL"
      )}/action/questionset/v2/create`;
      console.log("endpointCreate: ", endpointCreate);
      const createResponse = await axios.post(endpointCreate, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.configService.get("TOKEN")}`,
          tenantid: this.configService.get("TENANT_ID"),
          "X-Channel-Id": this.configService.get("CHANNEL_ID"),
        },
      });

      //update questionSetId for all records
      records.forEach((record: any) => {
        record.questionSetId = createResponse.data.result.identifier;
      });
      this.logger.log(
        "1. Question set created successfully: ",
        records[0].questionSetId
      );
      this.logger.log("set createResponse: ", createResponse.data);

      //prepare req body for update set
      const payloadUpdate = JSON.stringify(
        this.buildQuestionSetRequest(records[0])
      );
      console.log("payloadUpdate, ", payloadUpdate);

      //call update set
      const endpointUpdate = `${this.configService.get(
        "INTERFACE_BASE_URL"
      )}/action/questionset/v2/hierarchy/update`;
      console.log("endpointUpdate: ", endpointUpdate);
      const updateResponse = await axios.patch(endpointUpdate, payloadUpdate, {
        headers: {
          "Content-Type": "application/json",
          "X-Channel-Id": this.configService.get("CHANNEL_ID"),
          Authorization: `Bearer ${this.configService.get("TOKEN")}`,
          tenantid: this.configService.get("TENANT_ID"),
        },
      });
      this.logger.log(
        "2. Question set updated successfully: ",
        records[0].questionSetId
      );
      this.logger.log("set updateResponse: ", updateResponse.data);

      //update test_do_id
      const updateTestDoId = await this.updateTestDoId(
        records[0].questionSetId,
        recordIds
      );
      this.logger.log(
        "Question set updated in DB successfully: ",
        records[0].questionSetId
      );

      //for (const record of records) {
      //create section
      //prepare req body for update
      //for first
      const payloadCreateFirstSection = this.buildFirstQuestionSectionRequest(
        records[0]
      );

      //call update
      const createSectionFirstResponse = await axios.patch(
        endpointUpdate,
        payloadCreateFirstSection,
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
        "createSectionFirstResponse: ",
        createSectionFirstResponse.data
      );
      const identifiers = createSectionFirstResponse.data.result.identifiers;

      const firstSectionIdentifier: any = Object.entries(identifiers).find(
        ([key, value]) => key !== value
      )?.[1];
      this.logger.log("firstSectionId: ", firstSectionIdentifier);
      await this.questionSectionRepo.update(records[0].id, {
        sections_do_Ids: [firstSectionIdentifier],
      });
      if (records[1]) {
        //for second section
        const payloadCreateSecondSection =
          this.buildSecondQuestionSectionRequest(
            records,
            firstSectionIdentifier
          );
        //call update for second section
        const createSectionSecondResponse = await axios.patch(
          endpointUpdate,
          payloadCreateSecondSection,
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
          "createSectionSecondResponse: ",
          createSectionSecondResponse.data
        );
        const identifiers = createSectionSecondResponse.data.result.identifiers;

        const secondSectionIdentifier: any = Object.entries(identifiers).find(
          ([key, value]) => key !== value
        )?.[1];
        this.logger.log("secondSectionIdentifier: ", secondSectionIdentifier);
        await this.questionSectionRepo.update(records[1].id, {
          sections_do_Ids: [secondSectionIdentifier],
        });
      }

      //}
      this.logger.log(
        "3. Question Section and sets created successfully: ",
        records[0].questionSetId
      );

      //map questions to sections
      const resultOfQuestionMapping = await this.mapQuestionsToSections(
        recordIds
      );

      //publish questionset
      // const result = await this.questionSetPublish(records[0].questionSetId);
      // this.logger.log(
      //   "4. Question set published successfully: ",
      //   records[0].questionSetId
      // );
      // this.logger.log("result: ", result);

      //update DB
      // for (const record of records) {
      //   await this.questionSectionRepo.update(record.id, {
      //     isMigrated: 1,
      //   });
      //   results.push({
      //     name: record.name,
      //     status: "success",
      //     data: {
      //       questionSetId: record.questionSetId,
      //       questionSectionId: record.questionSectionId,
      //     },
      //   });
      // }
      return [];
    } catch (error) {
      results.push({
        name: records[0].name,
        status: "error",
        error: error,
      });
    }
  }

  buildQuestionSetRequest(input: QuestionSetInput): any {
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
    } = input;

    const reqObj: any = {
      request: {
        data: {
          nodesModified: {
            [questionSetId]: {
              root: true,
              objectType: "QuestionSet",
              metadata: {
                appIcon: "",
                name: testName,
                program: new Array(`${input.program}`),
                subject: Array.isArray(subject) ? subject : [subject],
                subDomain: Array.isArray(subDomain) ? subDomain : [subDomain],
                targetAgeGroup: ["18 yrs +"],
                primaryUser: ["Learners/Children"],
                showTimer: false,
                requiresSubmit: "Yes",
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
                assessmentType: `${assessmentType} Test`,
                domain,
                contentLanguage: language,
                maxAttempts: maxAttempts || 0,
                summaryType: "Complete",
                outcomeDeclaration: {
                  maxScore: {
                    cardinality: "single",
                    type: "integer",
                    defaultValue: 0,
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
        showFeedback: true,
        showSolutions: true,
        attributions: [],
        timeLimits: {
          questionSet: {
            max: 0,
            min: 0,
          },
        },
        description: "",
        instructions: "",
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
        showFeedback: true,
        showSolutions: true,
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
        showFeedback: true,
        showSolutions: true,
        attributions: [],
        timeLimits: {
          questionSet: {
            max: 0,
            min: 0,
          },
        },
        description: "",
        instructions: "",
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
  private logError(message: string) {
    const logDir = path.join(__dirname, "../../logs");
    const logFile = path.join(logDir, "migration.log");
    const logEntry = `[${new Date().toISOString()}] ${message}\n`;

    // ✅ Ensure /logs directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    // ✅ Create log file if it doesn't exist and append log entries
    fs.appendFileSync(logFile, logEntry);

    // ✅ Log to console
    console.error(message);
  }
}
