import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { GroupsModule } from './groups/groups.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PaymentsModule } from './payments/payments.module';
import { DebtsModule } from './debts/debts.module';
import { TelegramModule } from './telegram/telegram.module';
import { TeacherAttendanceModule } from './teacher-attendance/teacher-attendance.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { StudentLeaveRequestsModule } from './student-leave-requests/student-leave-requests.module';
import { ScheduleModule as CronScheduleModule } from '@nestjs/schedule';
import { HomeworkModule } from './homework/homework.module';
import { GradesModule } from './grades/grades.module';
import { DiscountsModule } from './discounts/discounts.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CronScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    TeachersModule,
    GroupsModule,
    ScheduleModule,
    AttendanceModule,
    PaymentsModule,
    DebtsModule,
    TelegramModule,
    TeacherAttendanceModule,
    LeaveRequestsModule,
    StudentLeaveRequestsModule,
    HomeworkModule,
    GradesModule,
    DiscountsModule,
    FeedbackModule,
  ],
})
export class AppModule {}
