import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("QuestionsData") // Table name in MySQL
export class QuestionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  question: string;

  @Column({ nullable: true })
  option0: string;

  @Column({ nullable: true })
  option1: string;

  @Column({ nullable: true })
  option2: string;

  @Column({ nullable: true })
  option3: string;

  @Column({ nullable: true })
  ansOption: string; // can be string or number, depending on how it's stored

  @Column("int")
  maxScore: number;

  @Column({ nullable: true })
  domain: string;

  @Column({ nullable: true })
  subDomain: string;
  @Column({ nullable: true })
  subject: string;
  @Column({ nullable: true })
  do_id: string; // domain id
  @Column({ nullable: true })
  versionKey: string; // version key
  @Column({ nullable: true })
  isMigrated: number;
  @Column({ nullable: true })
  assessmentType: string;
  @Column({ nullable: true })
  author: string;
  @Column({ nullable: true })
  questionType: string;
  @Column({ nullable: true })
  language: string;
  @Column({ nullable: true })
  testName: string;
  @Column({ nullable: true })
  sectionName: string;
  @Column({ nullable: true })
  description: string;
  @Column({ nullable: true })
  program: string;
}
