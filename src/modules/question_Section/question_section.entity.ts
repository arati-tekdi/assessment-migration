import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("QuestionSet")
export class QuestionSet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  testName: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  test_do_id: string;

  @Column({ type: "varchar", nullable: true })
  sectionName: string;

  @Column({ type: "json", nullable: true })
  sections_do_Ids: string[];

  @Column({ type: "tinyint", width: 1, default: 0 })
  isMigrated: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  domain: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  subDomain: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  program: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  subject: string;

  @Column({ type: "varchar", length: 1000, nullable: true })
  description: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  language: string;

  @Column({ type: "text", nullable: true })
  instruction: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  assessmentType: string;

  @Column({ type: "json", nullable: true })
  questions_do_Ids: string[];
}
