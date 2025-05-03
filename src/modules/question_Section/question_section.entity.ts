import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("QuestionSection")
export class QuestionSectionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  SectionName: string;

  @Column("text", { nullable: true })
  Description: string;

  @Column({ nullable: true })
  Program: string;

  @Column({ nullable: true })
  Domain: string;

  @Column({ nullable: true })
  SubDomain: string;

  @Column({ nullable: true })
  Subjects: string;

  @Column({ nullable: true })
  ContentLanguage: string;

  @Column("text", { nullable: true })
  Instruction: string;

  @Column({ nullable: true })
  AssessmentType: string;

  @Column({ nullable: true })
  CourseName: string;

  @Column({ nullable: true })
  TestName: string;
}
