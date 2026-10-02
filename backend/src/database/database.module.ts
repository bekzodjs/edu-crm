import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  User, UserSchema,
  Teacher, TeacherSchema,
  Group, GroupSchema,
  Student, StudentSchema,
  ScheduleSlot, ScheduleSlotSchema,
  Lesson, LessonSchema,
  Homework, HomeworkSchema,
  Grade, GradeSchema,
  Feedback, FeedbackSchema,
  Attendance, AttendanceSchema,
  Payment, PaymentSchema,
  ParentLink, ParentLinkSchema,
  TeacherLink, TeacherLinkSchema,
  TeacherAttendance, TeacherAttendanceSchema,
  TeacherLiveLocation, TeacherLiveLocationSchema,
  LeaveRequest, LeaveRequestSchema,
  StudentLeaveRequest, StudentLeaveRequestSchema,
  NotificationLog, NotificationLogSchema,
} from './schemas';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: config.get<string>('DATABASE_URL') }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Teacher.name, schema: TeacherSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Student.name, schema: StudentSchema },
      { name: ScheduleSlot.name, schema: ScheduleSlotSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Homework.name, schema: HomeworkSchema },
      { name: Grade.name, schema: GradeSchema },
      { name: Feedback.name, schema: FeedbackSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: ParentLink.name, schema: ParentLinkSchema },
      { name: TeacherLink.name, schema: TeacherLinkSchema },
      { name: TeacherAttendance.name, schema: TeacherAttendanceSchema },
      { name: TeacherLiveLocation.name, schema: TeacherLiveLocationSchema },
      { name: LeaveRequest.name, schema: LeaveRequestSchema },
      { name: StudentLeaveRequest.name, schema: StudentLeaveRequestSchema },
      { name: NotificationLog.name, schema: NotificationLogSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
